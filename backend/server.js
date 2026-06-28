import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import mongoSanitize from 'express-mongo-sanitize'
import 'dotenv/config'
import connectDB from './config/mongodb.js'
import connectCloudinary from './config/cloudinary.js'
import userRouter from './routes/userRoute.js'
import productRouter from './routes/productRoute.js'
import cartRouter from './routes/cartRoute.js'
import orderRouter from './routes/orderRoute.js'
import returnRouter from './routes/returnRoute.js'
import { apiLimiter } from './middleware/rateLimiter.js'
import { errorHandler } from './middleware/errorHandler.js'

// ─── App Config ───────────────────────────────────
const app = express()
const port = process.env.PORT || 4000

// ─── Security Middleware ───────────────────────────
// Sets secure HTTP response headers (XSS, clickjacking, MIME sniffing protection)
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}))

// CORS — allow your frontend + admin origins
app.use(cors({
    origin: [
        'http://localhost:5173',
        'http://localhost:5174',
        'https://ecommerce-app-yio8.vercel.app',   // frontend
        'https://ecommerce-app-qh9m.vercel.app'    // admin
    ],
    credentials: true
}))

// Parse JSON bodies
app.use(express.json())

// Sanitize all incoming request data against NoSQL injection
// e.g., { "email": { "$gt": "" } } gets stripped to {}
app.use(mongoSanitize())

// General rate limiter on all API routes
app.use('/api', apiLimiter)

// ─── DB & Cloud Connections ────────────────────────
connectDB()
connectCloudinary()

// ─── Health Check ──────────────────────────────────
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'API is running',
        timestamp: new Date().toISOString()
    })
})

app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    })
})

// ─── API Routes ────────────────────────────────────
app.use('/api/user', userRouter)
app.use('/api/product', productRouter)
app.use('/api/cart', cartRouter)
app.use('/api/order', orderRouter)
app.use('/api/returns', returnRouter)

// ─── 404 Handler ──────────────────────────────────
app.use('*', (req, res) => {
    res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found.` })
})

// ─── Centralized Error Handler ────────────────────
// Must be LAST middleware — handles all errors thrown in controllers
app.use(errorHandler)

// ─── Start Server ─────────────────────────────────
const server = app.listen(port, () =>
    console.log(`🚀 Server started on PORT: ${port}`)
)

// ─── Graceful Shutdown ────────────────────────────
// Ensures existing connections finish before shutting down
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...')
    server.close(() => {
        console.log('Server closed.')
        process.exit(0)
    })
})
