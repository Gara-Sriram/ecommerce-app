import mongoose from 'mongoose';
import dotenv from 'dotenv';
import orderModel from './models/orderModel.js';
import userModel from './models/userModel.js';
import productModel from './models/productModel.js';

dotenv.config({ path: './.env' });

const test = async () => {
    try {
        await mongoose.connect(`${process.env.MONGODB_URI}/e-commerce`);
        console.log('Connected to DB');

        const totalProducts = await productModel.countDocuments();
        const totalUsers = await userModel.countDocuments();
        const totalOrders = await orderModel.countDocuments();

        const revenueResult = await orderModel.aggregate([
            { $match: { status: { $ne: 'Cancelled' } } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const totalRevenue = revenueResult[0]?.total || 0;

        const revenueTimeline = await orderModel.aggregate([
            { $match: { status: { $ne: 'Cancelled' } } },
            {
                $project: {
                    amount: 1,
                    dateObj: { $toDate: '$date' }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$dateObj' } },
                    revenue: { $sum: '$amount' },
                    ordersCount: { $sum: 1 }
                }
            },
            { $sort: { _id: -1 } },
            { $limit: 30 },
            { $sort: { _id: 1 } }
        ]);

        const userGrowthTimeline = await userModel.aggregate([
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    newUsers: { $sum: 1 }
                }
            },
            { $sort: { _id: -1 } },
            { $limit: 30 },
            { $sort: { _id: 1 } }
        ]);

        console.log({
            totalProducts,
            totalUsers,
            totalOrders,
            totalRevenue,
            revenueTimelineLength: revenueTimeline.length,
            revenueTimeline,
            userGrowthTimelineLength: userGrowthTimeline.length,
            userGrowthTimeline
        });

        await mongoose.disconnect();
    } catch (e) {
        console.error(e);
    }
};

test();
