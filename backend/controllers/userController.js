import validator from 'validator';
import userModel from '../models/userModel.js';
import OtpModel from '../models/otpModel.js';
import {
    hashPassword, verifyPassword,
    generateAccessToken, generateRefreshToken,
    rotateRefreshToken, revokeRefreshToken, revokeAllRefreshTokens,
    getUserSessions, parseDeviceInfo,
    generateOTP, hashOTP, verifyOTP
} from '../utils/authUtils.js';
import {
    sendEmailVerificationOTP,
    sendPasswordResetOTP,
    sendAccountLockedAlert
} from '../services/emailService.js';

// ── Cookie config for refresh token ──────────────────────────────────────
const REFRESH_COOKIE_OPTIONS = {
    httpOnly: true,          // JS cannot access — prevents XSS token theft
    secure: process.env.NODE_ENV === 'production', // HTTPS only in prod
    sameSite: 'strict',      // Prevents CSRF
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
};

// ─────────────────────────────────────────────────────────────────────────────
// REGISTER — POST /api/user/register
// Creates user, hashes password with Argon2, sends email OTP
// ─────────────────────────────────────────────────────────────────────────────
const registerUser = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Validation
        if (!name || !email || !password) {
            return res.json({ success: false, message: 'All fields are required.' });
        }
        if (!validator.isEmail(email)) {
            return res.json({ success: false, message: 'Invalid email address.' });
        }
        if (password.length < 8) {
            return res.json({ success: false, message: 'Password must be at least 8 characters.' });
        }

        // Check if already registered
        const existingUser = await userModel.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.json({ success: false, message: 'An account with this email already exists.' });
        }

        // Hash password with Argon2id (replaces bcrypt)
        const hashedPassword = await hashPassword(password);

        const user = new userModel({
            name,
            email: email.toLowerCase(),
            password: hashedPassword,
            isEmailVerified: false, // Must verify email before full access
        });
        await user.save();

        // Send email verification OTP
        const otp = generateOTP(); // 6-digit random OTP
        const otpHash = hashOTP(otp);  // SHA-256 hash for storage
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Delete any previous OTPs for this email
        await OtpModel.deleteMany({ email: email.toLowerCase(), type: 'EMAIL_VERIFY' });

        await OtpModel.create({
            email: email.toLowerCase(),
            otpHash,
            type: 'EMAIL_VERIFY',
            expiresAt
        });

        // Send OTP email (non-blocking — don't fail registration if email fails)
        sendEmailVerificationOTP(email, otp, name).catch(err =>
            console.error('[Email] Failed to send verification OTP:', err.message)
        );

        res.json({
            success: true,
            message: 'Account created! Check your email for a 6-digit verification code.',
            requiresVerification: true,
            email: email.toLowerCase()
        });

    } catch (error) {
        console.error('[Register]', error);
        res.json({ success: false, message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// VERIFY EMAIL OTP — POST /api/user/verify-email
// ─────────────────────────────────────────────────────────────────────────────
const verifyEmail = async (req, res) => {
    try {
        const { email, otp } = req.body;

        const otpRecord = await OtpModel.findOne({
            email: email.toLowerCase(),
            type: 'EMAIL_VERIFY',
            used: false,
            expiresAt: { $gt: new Date() }
        });

        if (!otpRecord) {
            return res.json({ success: false, message: 'OTP expired or invalid. Request a new one.' });
        }

        // Check attempts (max 3 wrong guesses)
        if (otpRecord.attempts >= 3) {
            await OtpModel.deleteOne({ _id: otpRecord._id });
            return res.json({ success: false, message: 'Too many wrong attempts. Request a new OTP.' });
        }

        if (!verifyOTP(otp, otpRecord.otpHash)) {
            await OtpModel.findByIdAndUpdate(otpRecord._id, { $inc: { attempts: 1 } });
            const remaining = 3 - (otpRecord.attempts + 1);
            return res.json({ success: false, message: `Wrong OTP. ${remaining} attempt(s) remaining.` });
        }

        // Mark OTP as used and verify user
        await OtpModel.findByIdAndUpdate(otpRecord._id, { used: true });
        await userModel.findOneAndUpdate(
            { email: email.toLowerCase() },
            { isEmailVerified: true }
        );

        res.json({ success: true, message: 'Email verified successfully! You can now log in.' });

    } catch (error) {
        console.error('[VerifyEmail]', error);
        res.json({ success: false, message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// RESEND OTP — POST /api/user/resend-otp
// ─────────────────────────────────────────────────────────────────────────────
const resendOTP = async (req, res) => {
    try {
        const { email, type = 'EMAIL_VERIFY' } = req.body;

        const user = await userModel.findOne({ email: email.toLowerCase() });
        if (!user) return res.json({ success: false, message: 'No account found with this email.' });

        const otp = generateOTP();
        const otpHash = hashOTP(otp);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await OtpModel.deleteMany({ email: email.toLowerCase(), type });
        await OtpModel.create({ email: email.toLowerCase(), otpHash, type, expiresAt });

        if (type === 'EMAIL_VERIFY') {
            sendEmailVerificationOTP(email, otp, user.name).catch(console.error);
        } else if (type === 'PASSWORD_RESET') {
            sendPasswordResetOTP(email, otp, user.name).catch(console.error);
        }

        res.json({ success: true, message: 'New OTP sent to your email.' });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN — POST /api/user/login
//
// Enhanced login flow:
// 1. Check if account is locked (progressive backoff)
// 2. Verify password with Argon2
// 3. On success: generate access token (15min) + refresh token (7d httpOnly cookie)
// 4. On failure: increment attempts, lock if threshold reached
// ─────────────────────────────────────────────────────────────────────────────
const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await userModel.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.json({ success: false, message: 'Invalid email or password.' });
            // Note: Same error for both — don't reveal if email exists (security)
        }

        // ── Check account lockout ────────────────────────────────────────
        if (user.isLocked) {
            const unlockIn = Math.ceil((user.lockUntil - Date.now()) / 1000 / 60);
            return res.json({
                success: false,
                message: `Account locked due to too many failed attempts. Try again in ${unlockIn} minute(s).`,
                isLocked: true,
                lockUntil: user.lockUntil
            });
        }

        // ── Verify password (Argon2) ─────────────────────────────────────
        const isPasswordValid = await verifyPassword(password, user.password);

        if (!isPasswordValid) {
            const attempts = await user.incrementLoginAttempts();

            // Send lockout alert email on account lock thresholds
            if (attempts === 6) {
                sendAccountLockedAlert(user.email, user.name, 15).catch(console.error);
            } else if (attempts >= 10) {
                sendAccountLockedAlert(user.email, user.name, 60).catch(console.error);
            }

            return res.json({
                success: false,
                message: `Invalid email or password. (${attempts} failed attempt${attempts > 1 ? 's' : ''})`,
            });
        }

        // ── Reset lockout on success ─────────────────────────────────────
        await user.resetLoginAttempts();

        // ── Generate tokens ──────────────────────────────────────────────
        const accessToken = generateAccessToken(user._id, user.email, user.role);
        const refreshToken = await generateRefreshToken(user._id, req);

        // Set refresh token as httpOnly cookie (XSS-safe)
        res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);

        res.json({
            success: true,
            token: accessToken,           // Short-lived (15min) — stored in memory/state
            isEmailVerified: user.isEmailVerified,
            requiresVerification: !user.isEmailVerified,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error('[Login]', error);
        res.json({ success: false, message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// REFRESH TOKEN — POST /api/user/refresh
// Client calls this when access token expires to get a new one silently
// ─────────────────────────────────────────────────────────────────────────────
const refreshAccessToken = async (req, res) => {
    try {
        const rawToken = req.cookies?.refreshToken;

        if (!rawToken) {
            return res.json({ success: false, message: 'No refresh token. Please log in.' });
        }

        // Rotate: validate old token, issue new pair
        const userId = await rotateRefreshToken(rawToken, req);

        const user = await userModel.findById(userId);
        if (!user) return res.json({ success: false, message: 'User not found.' });

        const newAccessToken = generateAccessToken(user._id, user.email, user.role);
        const newRefreshToken = await generateRefreshToken(user._id, req);

        res.cookie('refreshToken', newRefreshToken, REFRESH_COOKIE_OPTIONS);

        res.json({ success: true, token: newAccessToken });

    } catch (error) {
        // Clear cookie on any error
        res.clearCookie('refreshToken');

        if (error.message === 'TOKEN_REUSE_DETECTED') {
            return res.json({
                success: false,
                message: 'Security alert: token reuse detected. All sessions revoked. Please log in again.',
                securityAlert: true
            });
        }
        res.json({ success: false, message: 'Session expired. Please log in again.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// LOGOUT — POST /api/user/logout
// Revokes the current device's refresh token + clears cookie
// ─────────────────────────────────────────────────────────────────────────────
const logoutUser = async (req, res) => {
    try {
        const rawToken = req.cookies?.refreshToken;
        if (rawToken) {
            await revokeRefreshToken(rawToken); // Remove from DB
        }
        res.clearCookie('refreshToken');
        res.json({ success: true, message: 'Logged out successfully.' });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// LOGOUT ALL DEVICES — POST /api/user/logout-all
// ─────────────────────────────────────────────────────────────────────────────
const logoutAllDevices = async (req, res) => {
    try {
        const { userId } = req.body;
        await revokeAllRefreshTokens(userId);
        res.clearCookie('refreshToken');
        res.json({ success: true, message: 'Logged out from all devices.' });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET ACTIVE SESSIONS — GET /api/user/sessions
// Returns list of devices currently logged in
// ─────────────────────────────────────────────────────────────────────────────
const getActiveSessions = async (req, res) => {
    try {
        const { userId } = req.body;
        const sessions = await getUserSessions(userId);
        res.json({
            success: true,
            sessions: sessions.map(s => ({
                id: s._id,
                browser: s.deviceInfo.browser,
                os: s.deviceInfo.os,
                device: s.deviceInfo.device,
                ip: s.deviceInfo.ip,
                createdAt: s.createdAt,
                lastUsedAt: s.lastUsedAt
            }))
        });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// REVOKE SESSION — POST /api/user/sessions/revoke
// Logout a specific device by session ID
// ─────────────────────────────────────────────────────────────────────────────
const revokeSession = async (req, res) => {
    try {
        const { userId, sessionId } = req.body;
        const RefreshToken = (await import('../models/refreshTokenModel.js')).default;
        const session = await RefreshToken.findOne({ _id: sessionId, userId });
        if (!session) return res.json({ success: false, message: 'Session not found.' });
        await RefreshToken.deleteOne({ _id: sessionId });
        res.json({ success: true, message: 'Device logged out successfully.' });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// FORGOT PASSWORD — POST /api/user/forgot-password
// ─────────────────────────────────────────────────────────────────────────────
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await userModel.findOne({ email: email.toLowerCase() });

        // Always return success to prevent email enumeration
        if (!user) {
            return res.json({ success: true, message: 'If this email exists, a reset code was sent.' });
        }

        const otp = generateOTP();
        const otpHash = hashOTP(otp);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await OtpModel.deleteMany({ email: email.toLowerCase(), type: 'PASSWORD_RESET' });
        await OtpModel.create({ email: email.toLowerCase(), otpHash, type: 'PASSWORD_RESET', expiresAt });

        sendPasswordResetOTP(email, otp, user.name).catch(console.error);

        res.json({ success: true, message: 'If this email exists, a reset code was sent.' });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// RESET PASSWORD — POST /api/user/reset-password
// ─────────────────────────────────────────────────────────────────────────────
const resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;

        if (newPassword.length < 8) {
            return res.json({ success: false, message: 'Password must be at least 8 characters.' });
        }

        const otpRecord = await OtpModel.findOne({
            email: email.toLowerCase(),
            type: 'PASSWORD_RESET',
            used: false,
            expiresAt: { $gt: new Date() }
        });

        if (!otpRecord) {
            return res.json({ success: false, message: 'OTP expired or invalid.' });
        }

        if (otpRecord.attempts >= 3) {
            await OtpModel.deleteOne({ _id: otpRecord._id });
            return res.json({ success: false, message: 'Too many wrong attempts. Request a new OTP.' });
        }

        if (!verifyOTP(otp, otpRecord.otpHash)) {
            await OtpModel.findByIdAndUpdate(otpRecord._id, { $inc: { attempts: 1 } });
            return res.json({ success: false, message: 'Wrong OTP.' });
        }

        // Hash new password with Argon2
        const hashedPassword = await hashPassword(newPassword);

        // Update password + set passwordChangedAt (invalidates all old JWTs)
        await userModel.findOneAndUpdate(
            { email: email.toLowerCase() },
            {
                password: hashedPassword,
                passwordChangedAt: new Date(),
            }
        );

        // Revoke all refresh tokens (force re-login everywhere)
        const user = await userModel.findOne({ email: email.toLowerCase() });
        if (user) await revokeAllRefreshTokens(user._id);

        await OtpModel.findByIdAndUpdate(otpRecord._id, { used: true });

        res.json({ success: true, message: 'Password reset successfully. Please log in with your new password.' });

    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN LOGIN — POST /api/user/admin
// ─────────────────────────────────────────────────────────────────────────────
const adminLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (email !== process.env.ADMIN_EMAIL || password !== process.env.ADMIN_PASSWORD) {
            return res.json({ success: false, message: 'Invalid admin credentials.' });
        }

        const token = generateAccessToken('admin', email, 'admin');
        res.json({ success: true, token });

    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

export {
    registerUser,
    verifyEmail,
    resendOTP,
    loginUser,
    refreshAccessToken,
    logoutUser,
    logoutAllDevices,
    getActiveSessions,
    revokeSession,
    forgotPassword,
    resetPassword,
    adminLogin,
};