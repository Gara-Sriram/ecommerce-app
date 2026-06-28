import express from 'express';
import { loginUser, registerUser, adminLogin } from '../controllers/userController.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const userRouter = express.Router();

// authLimiter: max 10 attempts per 15 minutes per IP
userRouter.post('/register', authLimiter, registerUser)
userRouter.post('/login', authLimiter, loginUser)
userRouter.post('/admin', authLimiter, adminLogin)

export default userRouter;