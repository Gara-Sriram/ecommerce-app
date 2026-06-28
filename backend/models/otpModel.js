import mongoose from 'mongoose';

/**
 * OTP Model
 *
 * Stores email verification and password-reset OTPs.
 * Each OTP:
 * - Is a 6-digit number, hashed before storage
 * - Expires in 10 minutes (TTL index)
 * - Can only be used once (used flag)
 * - Locked after 3 wrong attempts (brute-force protection)
 */
const otpSchema = new mongoose.Schema({
    email: { type: String, required: true },
    otpHash: { type: String, required: true },   // Hashed OTP (never store plaintext)
    type: {
        type: String,
        enum: ['EMAIL_VERIFY', 'PASSWORD_RESET', 'LOGIN_2FA'],
        required: true
    },
    expiresAt: { type: Date, required: true },   // 10 minutes from creation
    used: { type: Boolean, default: false },
    attempts: { type: Number, default: 0 },      // Wrong attempts — max 3
}, { timestamps: true });

// Auto-delete after expiry
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpSchema.index({ email: 1, type: 1 });

const OtpModel = mongoose.models.Otp || mongoose.model('Otp', otpSchema);
export default OtpModel;
