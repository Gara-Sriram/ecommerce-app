import mongoose from "mongoose";

/**
 * Enhanced User Schema
 *
 * Additions over the original:
 * - isEmailVerified: email must be verified before full access
 * - loginAttempts: tracks consecutive failed logins
 * - lockUntil: account locked until this timestamp (progressive lockout)
 * - passwordChangedAt: used to invalidate old tokens on password change
 * - role: 'user' | 'admin' (replaces hardcoded admin email check)
 */
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },  // Argon2 hash
    cartData: { type: Object, default: {} },

    // ── Email Verification ──────────────────────────────────────
    isEmailVerified: { type: Boolean, default: false },

    // ── Progressive Account Lockout ─────────────────────────────
    // Number of consecutive failed login attempts
    loginAttempts: { type: Number, default: 0 },
    // Epoch timestamp — account locked until this time (null = not locked)
    lockUntil: { type: Date, default: null },

    // ── Security Audit ──────────────────────────────────────────
    // When password was last changed — used to invalidate tokens issued before this
    passwordChangedAt: { type: Date },
    // Last successful login time
    lastLoginAt: { type: Date },

    // ── Role ────────────────────────────────────────────────────
    role: { type: String, enum: ['user', 'admin'], default: 'user' },

}, { minimize: false, timestamps: true });

// ── Virtual: isLocked ─────────────────────────────────────────────────────
// Returns true if account is currently locked
userSchema.virtual('isLocked').get(function () {
    return this.lockUntil && this.lockUntil > Date.now();
});

// ── Method: incrementLoginAttempts ────────────────────────────────────────
// Called on every failed login. Progressive backoff:
//   1-3 attempts  → no lockout
//   4-5 attempts  → locked 1 minute
//   6-9 attempts  → locked 15 minutes
//   10+ attempts  → locked 1 hour
userSchema.methods.incrementLoginAttempts = async function () {
    const attempts = this.loginAttempts + 1;

    let lockDuration = null;
    if (attempts >= 10) lockDuration = 60 * 60 * 1000;        // 1 hour
    else if (attempts >= 6) lockDuration = 15 * 60 * 1000;    // 15 minutes
    else if (attempts >= 4) lockDuration = 1 * 60 * 1000;     // 1 minute

    const update = { loginAttempts: attempts };
    if (lockDuration) update.lockUntil = new Date(Date.now() + lockDuration);

    await this.constructor.findByIdAndUpdate(this._id, update);
    return attempts;
};

// ── Method: resetLoginAttempts ─────────────────────────────────────────────
// Called on successful login — clears lockout state
userSchema.methods.resetLoginAttempts = async function () {
    await this.constructor.findByIdAndUpdate(this._id, {
        loginAttempts: 0,
        lockUntil: null,
        lastLoginAt: new Date()
    });
};

// ── Method: passwordChangedAfter ──────────────────────────────────────────
// Returns true if password was changed after a given JWT iat timestamp
// Used to invalidate tokens after password change
userSchema.methods.passwordChangedAfter = function (jwtIat) {
    if (this.passwordChangedAt) {
        const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
        return jwtIat < changedTimestamp;
    }
    return false;
};

const userModel = mongoose.models.user || mongoose.model('user', userSchema);
export default userModel;