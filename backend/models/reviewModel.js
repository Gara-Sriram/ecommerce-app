import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'product',
        required: [true, 'Review must belong to a product.']
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: [true, 'Review must belong to a user.']
    },
    userName: {
        type: String,
        required: [true, 'Review must have an author name.']
    },
    rating: {
        type: Number,
        min: 1,
        max: 5,
        required: [true, 'Review must have a rating between 1 and 5.']
    },
    comment: {
        type: String,
        required: [true, 'Review text cannot be empty.'],
        trim: true,
        maxlength: [1000, 'Review cannot exceed 1000 characters.']
    },
    verifiedPurchase: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Ensure a user can only leave one review per product
reviewSchema.index({ product: 1, user: 1 }, { unique: true });

// ── Static Method: Recalculate Average Ratings ─────────────────────────────
reviewSchema.statics.calcAverageRatings = async function(productId) {
    const Product = mongoose.model('product');
    
    const stats = await this.aggregate([
        { $match: { product: productId } },
        {
            $group: {
                _id: '$product',
                nRating: { $sum: 1 },
                avgRating: { $avg: '$rating' }
            }
        }
    ]);

    if (stats.length > 0) {
        await Product.findByIdAndUpdate(productId, {
            ratingsQuantity: stats[0].nRating,
            ratingsAverage: Math.round(stats[0].avgRating * 10) / 10 // e.g., 4.5
        });
    } else {
        await Product.findByIdAndUpdate(productId, {
            ratingsQuantity: 0,
            ratingsAverage: 0
        });
    }
};

// Call calcAverageRatings after saving a review
reviewSchema.post('save', function() {
    this.constructor.calcAverageRatings(this.product);
});

// Call calcAverageRatings before/after updating or deleting a review
reviewSchema.post(/^findOneAnd/, async function(doc) {
    if (doc) {
        await doc.constructor.calcAverageRatings(doc.product);
    }
});

const reviewModel = mongoose.models.review || mongoose.model('review', reviewSchema);
export default reviewModel;
