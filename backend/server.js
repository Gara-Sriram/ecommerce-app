import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import connectDB from './config/mongodb.js'
import connectCloudinary from './config/cloudinary.js'
import userRouter from './routes/userRoute.js'
import productRouter from './routes/productRoute.js'
import cartRouter from './routes/cartRoute.js'
import orderRouter from './routes/orderRoute.js'

// App Config
const app = express()
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "https://forever-frontend-2rea281gj-sriram-garas-projects.vercel.app");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.use(cors({
  origin: "https://forever-frontend-2rea281gj-sriram-garas-projects.vercel.app",
  credentials: true
}));



const port = process.env.PORT || 4000
connectDB()
connectCloudinary()

// middlewares
app.use(express.json())



// api endpoints
app.use('/api/user',userRouter)
app.use("/api/product",productRouter)
app.use('/api/cart',cartRouter)
app.use('/api/order',orderRouter)

app.get('/',(req,res)=>{
    res.send("API Working");
})

app.listen(port, ()=>console.log('Server started on PORT : '+ port))

