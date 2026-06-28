import { verifyAccessToken } from '../utils/authUtils.js';
import userModel from '../models/userModel.js';

/**
 * Auth Middleware — verifies short-lived access token (15min JWT)
 *
 * Accepts token from:
 * 1. Authorization header: "Bearer <token>"   ← modern standard
 * 2. Custom header "token: <token>"            ← backward compat with existing frontend
 *
 * Also checks:
 * - Token hasn't expired
 * - Password hasn't been changed since token was issued
 *   (passwordChangedAt > iat → token is stale → force re-login)
 */
const authMiddleware = async (req, res, next) => {
    try {
        // Accept token from both Authorization header and legacy "token" header
        let token = req.headers.authorization?.split(' ')[1] // Bearer <token>
            || req.headers.token;                            // legacy

        if (!token) {
            return res.json({ success: false, message: 'Not authorized. Please log in.' });
        }

        // Verify JWT signature + expiry
        const decoded = verifyAccessToken(token);

        // Extra check: was password changed after this token was issued?
        if (decoded.id !== 'admin') {
            const user = await userModel.findById(decoded.id).select('passwordChangedAt');
            if (user && user.passwordChangedAfter(decoded.iat)) {
                return res.json({
                    success: false,
                    message: 'Password was changed recently. Please log in again.',
                    forceLogout: true
                });
            }
        }

        // Attach userId to request body (compatible with existing controllers)
        req.body.userId = decoded.id;
        req.user = decoded; // Also available as req.user.role, req.user.email

        next();

    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.json({
                success: false,
                message: 'Session expired. Please refresh your token.',
                tokenExpired: true  // Frontend uses this to trigger /refresh call
            });
        }
        res.json({ success: false, message: 'Invalid token. Please log in again.' });
    }
};

export default authMiddleware;