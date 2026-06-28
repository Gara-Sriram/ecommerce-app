import mongoose from 'mongoose';

/**
 * RefreshToken Model
 * 
 * Stores issued refresh tokens with device metadata.
 * Each token is:
 * - Bound to a specific user + device fingerprint
 * - One-time use (rotated on every /refresh call)
 * - Auto-expires after 7 days via MongoDB TTL index
 * 
 * This enables:
 * 1. Refresh Token Rotation (rotate on every use)
 * 2. Device Session Management (see all active sessions)
 * 3. Token Revocation (delete token = logout device)
 */
const refreshTokenSchema = new mongoose.Schema({
    // The hashed token value (we hash it before storing, like passwords)
    tokenHash: { type: String, required: true, unique: true },

    // Which user this token belongs to
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },

    // Device / session metadata (for session management UI)
    deviceInfo: {
        ip: { type: String, default: 'Unknown' },
        userAgent: { type: String, default: 'Unknown' },
        browser: { type: String, default: 'Unknown' },       // e.g., "Chrome 125"
        os: { type: String, default: 'Unknown' },            // e.g., "Windows 11"
        device: { type: String, default: 'Desktop' },        // "Mobile" | "Desktop" | "Tablet"
    },

    // When this token expires (7 days from creation)
    // MongoDB TTL index auto-deletes the document after this time
    expiresAt: { type: Date, required: true },

    // Whether this token has already been used (rotation security)
    // If a used token is presented again → possible token theft → revoke all sessions
    used: { type: Boolean, default: false },

    // When the token was last used to refresh (audit trail)
    lastUsedAt: { type: Date },

}, { timestamps: true });

// ── Indexes ──────────────────────────────────────────────────────────────────
// TTL index: auto-deletes token document when expiresAt passes
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// Query index: fast lookup by userId for session list
refreshTokenSchema.index({ userId: 1 });

const RefreshToken = mongoose.models.RefreshToken
    || mongoose.model('RefreshToken', refreshTokenSchema);

export default RefreshToken;
