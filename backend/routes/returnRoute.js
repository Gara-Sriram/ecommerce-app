import express from 'express';
import {
    initiateReturn,
    getNearbyReturns,
    purchaseReturnedItem,
    getMyReturns,
    adminGetAllReturns,
    adminUpdateReturnStatus
} from '../controllers/returnController.js';
import authMiddleware from '../middleware/auth.js';
import adminAuth from '../middleware/adminAuth.js';

const returnRouter = express.Router();

// User routes (protected)
returnRouter.post('/initiate', authMiddleware, initiateReturn);
returnRouter.get('/nearby', getNearbyReturns);                          // public — no auth needed
returnRouter.post('/purchase', authMiddleware, purchaseReturnedItem);
returnRouter.post('/my-returns', authMiddleware, getMyReturns);

// Admin routes
returnRouter.get('/admin/all', adminAuth, adminGetAllReturns);
returnRouter.post('/admin/update-status', adminAuth, adminUpdateReturnStatus);

export default returnRouter;
