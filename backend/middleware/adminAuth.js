import jwt from 'jsonwebtoken';

/**
 * Admin Authentication Middleware
 *
 * Authorizes access if:
 * 1. The token is the legacy concatenated ADMIN_EMAIL + ADMIN_PASSWORD string.
 * 2. The token is a standard JWT with role === 'admin' or id === 'admin'.
 */
const adminAuth = async (req, res, next) => {
    try {
        const { token } = req.headers;
        if (!token) {
            return res.json({ success: false, message: 'Not authorized. Please log in again.' });
        }

        // 1. Support legacy hardcoded token for backward compatibility
        if (token === process.env.ADMIN_EMAIL + process.env.ADMIN_PASSWORD) {
            req.user = { id: 'admin', role: 'admin', email: process.env.ADMIN_EMAIL };
            return next();
        }

        // 2. Decode standard JWT token
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            if (decoded.role === 'admin' || decoded.id === 'admin') {
                req.user = decoded;
                next();
            } else {
                return res.json({ success: false, message: 'Access denied. Admin role required.' });
            }
        } catch (jwtErr) {
            // If JWT verification fails, double-check if it's the legacy token signature
            try {
                const legacyDecode = jwt.verify(token, process.env.JWT_SECRET);
                if (legacyDecode === process.env.ADMIN_EMAIL + process.env.ADMIN_PASSWORD) {
                    req.user = { id: 'admin', role: 'admin', email: process.env.ADMIN_EMAIL };
                    return next();
                }
            } catch (e) {}

            return res.json({ success: false, message: 'Invalid or expired token. Please log in again.' });
        }

    } catch (error) {
        console.error('[AdminAuth Error]', error);
        res.json({ success: false, message: error.message });
    }
};

export default adminAuth;