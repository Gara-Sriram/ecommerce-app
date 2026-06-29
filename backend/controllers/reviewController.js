import reviewModel from '../models/reviewModel.js';
import orderModel from '../models/orderModel.js';
import userModel from '../models/userModel.js';
import productModel from '../models/productModel.js';

// ── ADD REVIEW ───────────────────────────────────────────────────────────────
// POST /api/product/reviews/add
export const addReview = async (req, res) => {
    try {
        const { userId, productId, rating, comment } = req.body;

        if (!productId || !rating || !comment) {
            return res.json({ success: false, message: 'All fields are required.' });
        }

        const ratingVal = Number(rating);
        if (isNaN(ratingVal) || ratingVal < 1 || ratingVal > 5) {
            return res.json({ success: false, message: 'Rating must be a number between 1 and 5.' });
        }

        // 1. Check if product exists
        const product = await productModel.findById(productId);
        if (!product) {
            return res.json({ success: false, message: 'Product not found.' });
        }

        // 2. Check if user already reviewed this product
        const existingReview = await reviewModel.findOne({ product: productId, user: userId });
        if (existingReview) {
            return res.json({ success: false, message: 'You have already reviewed this product.' });
        }

        // 3. Find user name
        const user = await userModel.findById(userId);
        if (!user) {
            return res.json({ success: false, message: 'User not found.' });
        }

        // 4. Check if user purchased the product (Verified Purchase)
        // Check if there's any order by this user where the items array contains this productId
        // (items are saved in the array with their product id, usually as _id or id)
        const purchasedOrder = await orderModel.findOne({
            userId,
            'items._id': productId
        });

        const verifiedPurchase = !!purchasedOrder;

        // 5. Create review
        const review = new reviewModel({
            product: productId,
            user: userId,
            userName: user.name,
            rating: ratingVal,
            comment,
            verifiedPurchase
        });

        await review.save();

        res.json({
            success: true,
            message: 'Review added successfully!',
            review
        });

    } catch (error) {
        console.error('[AddReview]', error);
        res.json({ success: false, message: error.message });
    }
};

// ── GET PRODUCT REVIEWS ───────────────────────────────────────────────────────
// GET /api/product/reviews/:productId
export const getProductReviews = async (req, res) => {
    try {
        const { productId } = req.params;

        const reviews = await reviewModel.find({ product: productId })
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            reviews
        });
    } catch (error) {
        console.error('[GetReviews]', error);
        res.json({ success: false, message: error.message });
    }
};

// ── DELETE REVIEW ────────────────────────────────────────────────────────────
// DELETE /api/product/reviews/delete/:reviewId
export const deleteReview = async (req, res) => {
    try {
        const { userId, role } = req.body; // attached by authMiddleware
        const { reviewId } = req.params;

        const review = await reviewModel.findById(reviewId);
        if (!review) {
            return res.json({ success: false, message: 'Review not found.' });
        }

        // User can only delete their own review; admin can delete any review
        if (review.user.toString() !== userId && role !== 'admin') {
            return res.json({ success: false, message: 'Not authorized to delete this review.' });
        }

        // Use findByIdAndDelete so hooks findOneAnd trigger for stats update
        const deletedDoc = await reviewModel.findByIdAndDelete(reviewId);

        // Recalculate stats for product
        if (deletedDoc) {
            await reviewModel.calcAverageRatings(deletedDoc.product);
        }

        res.json({ success: true, message: 'Review deleted successfully.' });

    } catch (error) {
        console.error('[DeleteReview]', error);
        res.json({ success: false, message: error.message });
    }
};

// ── CHECK ELIGIBILITY ────────────────────────────────────────────────────────
// GET /api/product/reviews/eligible/:productId
export const checkReviewEligibility = async (req, res) => {
    try {
        const { userId } = req.body;
        const { productId } = req.params;

        const existingReview = await reviewModel.findOne({ product: productId, user: userId });
        if (existingReview) {
            return res.json({
                success: true,
                eligible: false,
                reason: 'ALREADY_REVIEWED',
                message: 'You have already reviewed this product.'
            });
        }

        const purchasedOrder = await orderModel.findOne({
            userId,
            'items._id': productId
        });

        res.json({
            success: true,
            eligible: true,
            verifiedPurchase: !!purchasedOrder
        });

    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};
