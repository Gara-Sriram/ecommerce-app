import orderModel from "../models/orderModel.js";
import userModel from "../models/userModel.js";
import Stripe from 'stripe'
import razorpay from 'razorpay'

//global variables 
const currency = 'inr'
const deliveryCharge = 10

//gateway initialize
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const razorpayInstance = new razorpay({
    key_id : process.env.RAZORPAY_KEY_ID ,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
})

// Placing orders using COD Method
const placeOrder = async(req,res)=>{
    try{
        const {userId, items, amount, address} = req.body;
        const orderData = {
            userId,
            items,
            address,
            amount,
            paymentMethod: "COD",
            payment: false,
            date: Date.now()
        }
        const newOrder = new orderModel(orderData)
        await newOrder.save()

        await userModel.findByIdAndUpdate(userId,{cartData:{}})
        res.json({success:true, message:"Order Placed"})

    }catch(error){
        console.log(error)
        res.json({success: false, message:error.message})

    }

}

// Placing orders using Stripe Method
const placeOrderStripe = async(req,res)=>{
    try{
        const {userId, items, amount, address} = req.body
        const {origin} = req.headers
       
        const orderData = {
            userId,
            items,
            address,
            amount,
            paymentMethod:"Stripe",
            payment:false,
            date: Date.now()
            }
            const newOrder = new orderModel(orderData)
            await newOrder.save()
            const line_items = items.map((item)=>(  {
                price_data: {
                    currency: currency,
                    product_data:{
                        name:item.name
                    },
                unit_amount: item.price*100              
               },
               quantity: item.quantity
    }))
    line_items.push({
        price_data: {
            currency: currency,
            product_data:{
                name:"Delivery Charges"
            },
        unit_amount: deliveryCharge*100              
       },
       quantity: 1

    })

    const session = await stripe.checkout.sessions.create({
        success_url: `${origin}/verify?success=true&orderId=${newOrder._id}`,
        cancel_url:  `${origin}/verify?success=false&orderId=${newOrder._id}`,
        line_items,
        mode:'payment'

    })
 

    res.json({success:true,session_url: session.url})

    }catch(error){
        console.log(error)
        res.json({success: false, message:error.message})

    }

}


// Verify Stripe

const verifyStripe = async (req,res)=>{
    const {orderId, success,userId} = req.body
    try{
        if(success==="true"){
            await orderModel.findByIdAndUpdate(orderId,{payment: true});
            await userModel.findByIdAndUpdate(userId,{cartData:{}})
            res.json({success:true});
        }
        else{
           
            await orderModel.findByIdAndDelete(orderId)
            res.json({success:false});
        }
    }catch(error){
        console.log(error)
        res.json({success: false, message:error.message})

    }
}


// Placing orders using Razorpay Method
const placeOrderRazorpay = async(req,res)=>{
    try{
        const {userId, items, amount, address} = req.body
        const {origin} = req.headers
       
        const orderData = {
            userId,
            items,
            address,
            amount,
            paymentMethod:"Razorpay",
            payment:false,
            date: Date.now()
            }
            const newOrder = new orderModel(orderData)
            await newOrder.save()

            const options = {
                amount: amount*100,
                currency: currency.toUpperCase(),
                receipt : newOrder._id.toString()
            }
            await  razorpayInstance.orders.create(options,(error,order)=>{
                if(error){
                    console.log(error)
                    res.json({success:false,message: error})
                }
                res.json({success:true,order})
            })



    }catch(error){
        console.log(error)
        res.json({success: false, message:error.message})


    }


}

const verifyRazorpay = async(req,res)=>{
    try{
        const {userId, razorpay_order_id} = req.body

        const orderInfo = await razorpayInstance.orders.fetch(razorpay_order_id)
       if(orderInfo.status === 'paid'){
        await orderModel.findByIdAndUpdate(orderInfo.receipt,{payment:true});
        await userModel.findByIdAndUpdate(userId,{cartData:{}})
        res.json({success: true,message:"Payment Succesful"})
       }
       else{
        await orderModel.findByIdAndDelete(orderInfo.receipt)
       
        res.json({success: false, message: 'Payment Failed'})
       }

    }catch(error){
        console.log(error)
        res.json({success: false, message:error.message})
    }
}

//All Orders data for Admin Panel
const allOrders = async(req,res)=>{
    try{
        const orders = await orderModel.find({})
        res.json({success:true,orders})

    }catch(error){
        console.log(error)
        res.json({success: false, message:error.message})


    }

}

// User Order Data For Frontend
const userOrders = async(req,res)=>{
    try{
        const {userId} = req.body
        const orders = await orderModel.find({userId})
        res.json({success:true,orders})


    }catch(error){
        console.log(error)
        res.json({success: false, message:error.message})



    }
    
}

//update Orders status from Admin Panel
const updateStatus = async (req,res)=>{
    try{
        const {orderId, status} = req.body
        await orderModel.findByIdAndUpdate(orderId, {status})
        res.json({success:true, message: 'Status Updated'})

    }catch(error){
        console.log(error)
        res.json({success: false, message:error.message})
    }

}

// Get Admin Dashboard Stats (Revenue, User Growth, Top Selling)
const getAdminDashboardStats = async (req, res) => {
    try {
        const productModel = (await import('../models/productModel.js')).default;
        
        const totalProducts = await productModel.countDocuments();
        const totalUsers = await userModel.countDocuments();
        const totalOrders = await orderModel.countDocuments();

        // 1. Calculate Total Revenue (completed orders / paid)
        const revenueResult = await orderModel.aggregate([
            { $match: { status: { $ne: 'Cancelled' } } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const totalRevenue = revenueResult[0]?.total || 0;

        // 2. Revenue & Orders timeline (Last 30 active days that have sales)
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
            { $sort: { _id: -1 } }, // Get most recent dates first
            { $limit: 30 },         // Limit to last 30 active days
            { $sort: { _id: 1 } }   // Sort chronologically for chart display
        ]);

        // 3. User Growth Timeline (Last 30 active days that have registrations)
        const userGrowthTimeline = await userModel.aggregate([
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    newUsers: { $sum: 1 }
                }
            },
            { $sort: { _id: -1 } }, // Get most recent dates first
            { $limit: 30 },         // Limit to last 30 active days
            { $sort: { _id: 1 } }   // Sort chronologically for chart display
        ]);

        // 4. Top Selling Products (based on quantities ordered)
        const topSellingProducts = await orderModel.aggregate([
            { $match: { status: { $ne: 'Cancelled' } } },
            { $unwind: '$items' },
            {
                $group: {
                    _id: '$items._id',
                    name: { $first: '$items.name' },
                    image: { $first: '$items.image' },
                    price: { $first: '$items.price' },
                    category: { $first: '$items.category' },
                    totalQuantity: { $sum: '$items.quantity' },
                    totalSales: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
                }
            },
            { $sort: { totalQuantity: -1 } },
            { $limit: 5 }
        ]);

        res.json({
            success: true,
            stats: {
                totalRevenue,
                totalOrders,
                totalProducts,
                totalUsers,
                revenueTimeline,
                userGrowthTimeline,
                topSellingProducts
            }
        });

    } catch (error) {
        console.error('[DashboardStats Error]', error);
        res.json({ success: false, message: error.message });
    }
};

export {verifyRazorpay,placeOrder,placeOrderStripe,placeOrderRazorpay,allOrders,userOrders,updateStatus,verifyStripe,getAdminDashboardStats}