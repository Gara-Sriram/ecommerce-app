import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';   // Pure JS — works on Vercel/Lambda (argon2 requires native compilation)
import crypto from 'crypto';
import RefreshToken from '../models/refreshTokenModel.js';

/**
 * Auth Utilities
 *
 * Centralises all token and password operations:
 * - Access token (short-lived, 15 minutes)
 * - Refresh token (long-lived, 7 days, stored in DB + httpOnly cookie)
 * - Argon2 password hashing (replaces bcrypt)
 * - Device fingerprint parsing from User-Agent
 */

// ── Token Durations ───────────────────────────────────────────────────────
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;
const REFRESH_TOKEN_EXPIRY_MS = REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

// ── Password Hashing (bcryptjs) ──────────────────────────────────────────
/**
 * Hash a password with bcryptjs (pure JavaScript — works on Vercel/Lambda)
 *
 * Note: bcryptjs is still highly secure (industry standard).
 * Argon2id is theoretically stronger but requires native C++ compilation
 * which breaks on serverless platforms (Vercel, AWS Lambda).
 * In a dedicated Node.js server, you'd switch to argon2id.
 *
 * Cost factor 12 = ~250ms per hash on modern hardware (good balance)
 */
export const hashPassword = async (password) => {
    const salt = await bcrypt.genSalt(12);
    return bcrypt.hash(password, salt);
};

export const verifyPassword = async (password, hash) => {
    return bcrypt.compare(password, hash);
};

// ── Access Token ──────────────────────────────────────────────────────────
/**
 * Generate a short-lived access token (15 minutes)
 * Payload includes: userId, email, role
 */
export const generateAccessToken = (userId, email, role = 'user') => {
    return jwt.sign(
        { id: userId, email, role, type: 'access' },
        process.env.JWT_SECRET,
        { expiresIn: ACCESS_TOKEN_EXPIRY }
    );
};

/**
 * Verify and decode an access token
 * Returns the decoded payload or throws on invalid/expired token
 */
export const verifyAccessToken = (token) => {
    return jwt.verify(token, process.env.JWT_SECRET);
};

// ── Refresh Token ─────────────────────────────────────────────────────────
/**
 * Generate and store a refresh token.
 *
 * Flow:
 * 1. Generate a cryptographically random 64-byte token
 * 2. Hash it (SHA-256) before storing in DB (same principle as password hashing)
 * 3. Return the raw token to be set in httpOnly cookie
 *
 * Why hash before storing?
 * If DB is breached, attacker gets token hashes, not usable tokens.
 */
export const generateRefreshToken = async (userId, deviceInfo) => {
    // Raw token — only sent to client, never stored directly
    const rawToken = crypto.randomBytes(64).toString('hex');

    // Hash for DB storage
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);

    // Store in DB with device info
    await RefreshToken.create({
        tokenHash,
        userId,
        deviceInfo: parseDeviceInfo(deviceInfo),
        expiresAt,
    });

    return rawToken; // Send this to client
};

/**
 * Rotate a refresh token.
 *
 * Refresh Token Rotation strategy:
 * 1. Client presents refresh token
 * 2. We verify it exists in DB and is not used/expired
 * 3. Mark old token as USED (one-time use)
 * 4. Issue a new access token + new refresh token
 * 5. Client stores new refresh token
 *
 * Security: If a used token is presented → possible token theft → revoke ALL sessions
 */
export const rotateRefreshToken = async (rawToken, deviceInfo) => {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const existing = await RefreshToken.findOne({ tokenHash });

    if (!existing) {
        throw new Error('INVALID_TOKEN');
    }

    if (existing.used) {
        // A used token was presented — possible token theft!
        // Revoke ALL sessions for this user (nuclear option)
        await RefreshToken.deleteMany({ userId: existing.userId });
        throw new Error('TOKEN_REUSE_DETECTED');
    }

    if (existing.expiresAt < new Date()) {
        await RefreshToken.deleteOne({ tokenHash });
        throw new Error('TOKEN_EXPIRED');
    }

    // Mark old token as used
    await RefreshToken.findByIdAndUpdate(existing._id, {
        used: true,
        lastUsedAt: new Date()
    });

    // Return userId for new token generation
    return existing.userId;
};

/**
 * Revoke a specific refresh token (single device logout)
 */
export const revokeRefreshToken = async (rawToken) => {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    await RefreshToken.deleteOne({ tokenHash });
};

/**
 * Revoke ALL refresh tokens for a user (logout all devices)
 */
export const revokeAllRefreshTokens = async (userId) => {
    await RefreshToken.deleteMany({ userId });
};

/**
 * Get all active sessions for a user (for the "Active Sessions" page)
 */
export const getUserSessions = async (userId) => {
    return RefreshToken.find({
        userId,
        used: false,
        expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });
};

// ── Device Info Parser ────────────────────────────────────────────────────
/**
 * Parse User-Agent string into human-readable device info
 * Used for the Active Sessions management page
 */
export const parseDeviceInfo = (req) => {
    const ua = req?.headers?.['user-agent'] || 'Unknown';
    const ip = req?.headers?.['x-forwarded-for']?.split(',')[0]
        || req?.socket?.remoteAddress
        || 'Unknown';

    // Browser detection
    let browser = 'Unknown';
    if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
    else if (ua.includes('Edg')) browser = 'Edge';
    else if (ua.includes('Opera') || ua.includes('OPR')) browser = 'Opera';

    // OS detection
    let os = 'Unknown';
    if (ua.includes('Windows NT 10')) os = 'Windows 10/11';
    else if (ua.includes('Windows NT 6.3')) os = 'Windows 8.1';
    else if (ua.includes('Mac OS X')) os = 'macOS';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
    else if (ua.includes('Linux')) os = 'Linux';

    // Device type
    let device = 'Desktop';
    if (ua.includes('Mobile') || ua.includes('Android') || ua.includes('iPhone')) {
        device = 'Mobile';
    } else if (ua.includes('iPad') || ua.includes('Tablet')) {
        device = 'Tablet';
    }

    return { ip, userAgent: ua, browser, os, device };
};

// ── OTP Utilities ─────────────────────────────────────────────────────────
/**
 * Generate a 6-digit OTP
 */
export const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Hash an OTP before storing in DB (same principle as password hashing)
 * crypto.createHash is synchronous — no need for async
 */
export const hashOTP = (otp) => {
    return crypto.createHash('sha256').update(otp).digest('hex');
};

export const verifyOTP = (otp, storedHash) => {
    const hash = crypto.createHash('sha256').update(otp).digest('hex');
    return hash === storedHash;
};
