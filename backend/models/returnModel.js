import mongoose from 'mongoose';

const returnSchema = new mongoose.Schema({
    // Who is returning
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },

    // Which order and product
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'order', required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'product', required: true },
    productName: { type: String, required: true },
    productImage: { type: String, required: true },
    originalPrice: { type: Number, required: true },

    // Return details
    reason: {
        type: String,
        enum: ['Wrong size', 'Not as described', "Didn't like it", 'Defective', 'Changed mind', 'Other'],
        required: true
    },
    condition: {
        type: String,
        enum: ['Like New', 'Good', 'Acceptable'],
        required: true
    },
    size: { type: String },

    // Nearby resale listing
    isListedForResale: { type: Boolean, default: false },
    discountPercent: { type: Number, default: 25 }, // 25% off original price
    resalePrice: { type: Number },

    // GeoJSON location for nearby queries (from user's delivery address)
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            default: [0, 0]
        }
    },
    locationLabel: { type: String }, // e.g., "Mumbai, Maharashtra"
    // Whether user shared their real GPS location (false = saved as 0,0 — show to everyone)
    hasLocation: { type: Boolean, default: false },

    // Status lifecycle
    status: {
        type: String,
        enum: ['Pending Approval', 'Listed for Resale', 'Sold Locally', 'Returned to Warehouse', 'Completed'],
        default: 'Pending Approval'
    },

    // Who bought the resale listing
    soldToUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    soldAt: { type: Date },

    // Cashback for original returner if sold locally
    cashbackAmount: { type: Number, default: 0 },
    cashbackPaid: { type: Boolean, default: false },

    // Auto-expire listing after 7 days → goes to warehouse
    listingExpiresAt: { type: Date },

}, { timestamps: true });

// 2dsphere index — required for $near geospatial queries
returnSchema.index({ location: '2dsphere' });
returnSchema.index({ status: 1 });
returnSchema.index({ userId: 1 });

const returnModel = mongoose.models.return || mongoose.model('return', returnSchema);
export default returnModel;
