import express from 'express';
import {
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
    addToWishlist,
    removeFromWishlist,
    getWishlist,
    listAllUsers,
    updateUserRole
} from '../controllers/userController.js';
import { authLimiter, apiLimiter } from '../middleware/rateLimiter.js';
import authMiddleware from '../middleware/auth.js';
import adminAuth from '../middleware/adminAuth.js';

const userRouter = express.Router();

// ── Public routes (rate limited) ──────────────────────────────────────────
userRouter.post('/register', authLimiter, registerUser);
userRouter.post('/login', authLimiter, loginUser);
userRouter.post('/admin', authLimiter, adminLogin);

// ── Email verification ────────────────────────────────────────────────────
userRouter.post('/verify-email', apiLimiter, verifyEmail);
userRouter.post('/resend-otp', authLimiter, resendOTP);

// ── Token management ──────────────────────────────────────────────────────
userRouter.post('/refresh', apiLimiter, refreshAccessToken);    // Rotate refresh token
userRouter.post('/logout', logoutUser);                         // Logout current device
userRouter.post('/logout-all', authMiddleware, logoutAllDevices); // Logout all devices

// ── Session management ────────────────────────────────────────────────────
userRouter.get('/sessions', authMiddleware, getActiveSessions);          // List active sessions
userRouter.post('/sessions/revoke', authMiddleware, revokeSession);      // Revoke specific session

// ── Wishlist management ───────────────────────────────────────────────────
userRouter.post('/wishlist/add', authMiddleware, addToWishlist);
userRouter.post('/wishlist/remove', authMiddleware, removeFromWishlist);
userRouter.get('/wishlist', authMiddleware, getWishlist);

// ── Password reset ────────────────────────────────────────────────────────
userRouter.post('/forgot-password', authLimiter, forgotPassword);
userRouter.post('/reset-password', authLimiter, resetPassword);

// ── Admin: User and Role Management (RBAC) ────────────────────────────────
userRouter.get('/admin/users', adminAuth, listAllUsers);
userRouter.post('/admin/update-role', adminAuth, updateUserRole);

export default userRouter;