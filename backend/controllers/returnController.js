import returnModel from '../models/returnModel.js';
import orderModel from '../models/orderModel.js';
import productModel from '../models/productModel.js';
import userModel from '../models/userModel.js';

// ─────────────────────────────────────────────────
// USER: Initiate a return request
// POST /api/returns/initiate
// Body: { orderId, productId, reason, condition, size, latitude, longitude, locationLabel }
// ─────────────────────────────────────────────────
const initiateReturn = async (req, res) => {
    try {
        const { userId } = req.body;
        const { orderId, productId, reason, condition, size, latitude, longitude, locationLabel } = req.body;

        // Verify the order belongs to this user
        const order = await orderModel.findOne({ _id: orderId, userId });
        if (!order) {
            return res.json({ success: false, message: 'Order not found or unauthorized.' });
        }

        // Get product details
        const product = await productModel.findById(productId);
        if (!product) {
            return res.json({ success: false, message: 'Product not found.' });
        }

        // Check if return already exists for this order + product
        const existingReturn = await returnModel.findOne({ orderId, productId, userId });
        if (existingReturn) {
            return res.json({ success: false, message: 'Return already initiated for this item.' });
        }

        const discountPercent = 25;
        const resalePrice = parseFloat((product.price * (1 - discountPercent / 100)).toFixed(2));
        const cashbackAmount = parseFloat((product.price * 0.02).toFixed(2)); // 2% cashback if sold locally

        // Listing expires in 7 days
        const listingExpiresAt = new Date();
        listingExpiresAt.setDate(listingExpiresAt.getDate() + 7);

        const newReturn = new returnModel({
            userId,
            orderId,
            productId,
            productName: product.name,
            productImage: product.image[0],
            originalPrice: product.price,
            reason,
            condition,
            size: size || null,
            isListedForResale: true,
            discountPercent,
            resalePrice,
            cashbackAmount,
            location: {
                type: 'Point',
                coordinates: [parseFloat(longitude) || 0, parseFloat(latitude) || 0]
            },
            locationLabel: locationLabel || 'Location not shared',
            status: 'Listed for Resale',
            listingExpiresAt
        });

        await newReturn.save();

        // Update order status to reflect return initiated
        await orderModel.findByIdAndUpdate(orderId, { status: 'Return Initiated' });

        res.json({
            success: true,
            message: 'Return initiated! Your item is now listed for nearby buyers.',
            return: newReturn,
            cashbackAmount
        });

    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};

// ─────────────────────────────────────────────────
// USER: Get nearby resale listings
// GET /api/returns/nearby?lat=&lng=&radius=50000
// ─────────────────────────────────────────────────
const getNearbyReturns = async (req, res) => {
    try {
        const { lat, lng, radius = 50000 } = req.query; // radius in meters, default 50km

        if (!lat || !lng) {
            // If no location provided, return all active listings (fallback)
            const listings = await returnModel.find({
                status: 'Listed for Resale',
                listingExpiresAt: { $gt: new Date() }
            }).limit(20);
            return res.json({ success: true, listings, locationUsed: false });
        }

        // MongoDB $near query — finds documents sorted by distance
        const listings = await returnModel.find({
            status: 'Listed for Resale',
            listingExpiresAt: { $gt: new Date() },
            location: {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [parseFloat(lng), parseFloat(lat)]
                    },
                    $maxDistance: parseInt(radius)
                }
            }
        }).limit(20);

        res.json({ success: true, listings, locationUsed: true, count: listings.length });

    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};

// ─────────────────────────────────────────────────
// USER: Purchase a nearby returned item
// POST /api/returns/purchase
// Body: { returnId, buyerUserId }
// ─────────────────────────────────────────────────
const purchaseReturnedItem = async (req, res) => {
    try {
        const { userId: buyerUserId } = req.body;
        const { returnId } = req.body;

        const returnItem = await returnModel.findById(returnId);

        if (!returnItem) {
            return res.json({ success: false, message: 'Listing not found.' });
        }
        if (returnItem.status !== 'Listed for Resale') {
            return res.json({ success: false, message: 'This item is no longer available.' });
        }
        if (returnItem.userId.toString() === buyerUserId) {
            return res.json({ success: false, message: "You can't buy your own returned item." });
        }
        if (returnItem.listingExpiresAt < new Date()) {
            await returnModel.findByIdAndUpdate(returnId, { status: 'Returned to Warehouse' });
            return res.json({ success: false, message: 'This listing has expired.' });
        }

        // Mark as sold
        await returnModel.findByIdAndUpdate(returnId, {
            status: 'Sold Locally',
            soldToUserId: buyerUserId,
            soldAt: new Date(),
            cashbackPaid: false // admin will process cashback
        });

        res.json({
            success: true,
            message: `Item purchased at ₹${returnItem.resalePrice} (${returnItem.discountPercent}% off)! Proceed to payment.`,
            item: returnItem
        });

    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};

// ─────────────────────────────────────────────────
// USER: Get my return requests
// GET /api/returns/my-returns
// ─────────────────────────────────────────────────
const getMyReturns = async (req, res) => {
    try {
        const { userId } = req.body;
        const returns = await returnModel.find({ userId }).sort({ createdAt: -1 });
        res.json({ success: true, returns });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};

// ─────────────────────────────────────────────────
// ADMIN: Get all return requests
// GET /api/returns/admin/all
// ─────────────────────────────────────────────────
const adminGetAllReturns = async (req, res) => {
    try {
        const returns = await returnModel.find({}).sort({ createdAt: -1 });
        res.json({ success: true, returns });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};

// ─────────────────────────────────────────────────
// ADMIN: Update return status
// POST /api/returns/admin/update-status
// ─────────────────────────────────────────────────
const adminUpdateReturnStatus = async (req, res) => {
    try {
        const { returnId, status } = req.body;
        await returnModel.findByIdAndUpdate(returnId, { status });
        res.json({ success: true, message: 'Return status updated.' });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};

export {
    initiateReturn,
    getNearbyReturns,
    purchaseReturnedItem,
    getMyReturns,
    adminGetAllReturns,
    adminUpdateReturnStatus
};
