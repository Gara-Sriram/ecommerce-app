import express from 'express';
import { addProduct, listProducts, removeProduct, singleProduct } from '../controllers/productController.js';
import { addReview, getProductReviews, deleteReview, checkReviewEligibility } from '../controllers/reviewController.js';
import upload from '../middleware/multer.js';
import adminAuth from '../middleware/adminAuth.js';
import authMiddleware from '../middleware/auth.js';

const productRouter = express.Router();

// ── Admin Product Routes ──────────────────────────────────────────────────────
productRouter.post('/add', adminAuth, upload.fields([
    { name: 'image1', maxCount: 1 },
    { name: 'image2', maxCount: 1 },
    { name: 'image3', maxCount: 1 },
    { name: 'image4', maxCount: 1 }
]), addProduct);
productRouter.post('/remove', adminAuth, removeProduct);

// ── Public Product Routes ─────────────────────────────────────────────────────
productRouter.post('/single', singleProduct);
productRouter.get('/list', listProducts);

// ── Product Reviews & Ratings Routes ──────────────────────────────────────────
productRouter.get('/reviews/:productId', getProductReviews); // Public: View product reviews
productRouter.post('/reviews/add', authMiddleware, addReview); // Secure: Add a review
productRouter.delete('/reviews/delete/:reviewId', authMiddleware, deleteReview); // Secure: Delete a review
productRouter.get('/reviews/eligible/:productId', authMiddleware, checkReviewEligibility); // Secure: Check user's eligibility to write review

export default productRouter;