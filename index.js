require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimiter = require('./middleware/rateLimiter');
const memoryMonitor = require('./utils/memoryMonitor');

// Routes
const createUserRouter = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const cartRoutes = require('./routes/cartRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const topUpRoutes = require('./routes/topUpRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const salesRoutes = require('./routes/salesRoutes');
const smsRoutes = require('./routes/smsRoutes');
const announcementRoutes = require('./routes/announcementRoutes');
const pasteRoutes = require('./routes/pasteRoutes');
const shopRoutes = require('./routes/shopRoutes');

// Log initial memory usage
memoryMonitor.log('Server Starting');

const app = express();
const server = http.createServer(app);

// Optimized Socket.io configuration for lower RAM usage
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  // Memory optimization settings
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e6, // 1MB max message size (reduced from default 100MB)
  perMessageDeflate: false, // Disable compression to save CPU/RAM
  httpCompression: false,
  transports: ['websocket', 'polling'], // Prefer websocket
  allowUpgrades: true,
  connectTimeout: 45000
});

const userSockets = new Map();

io.on('connection', (socket) => {
  // console.log('a user connected', socket.id);

  socket.on('register', (data) => {
    // The frontend might send the ID directly or in an object { userId: '123' }.
    // This handles both cases to ensure we always get the ID.
    const userId = (typeof data === 'object' && data.userId) ? data.userId : data;

    if (userId) {
      // console.log(`[Socket Debug] Received 'register' event for user ID: ${userId} with socket ID: ${socket.id}`);
      userSockets.set(userId, socket.id);
      // console.log(`[Socket Debug] Current userSockets map:`, userSockets);
    } else {
      console.error(`[Socket Error] Received invalid data for 'register' event:`, data);
    }
  });

  socket.on('disconnect', () => {
    // console.log('user disconnected', socket.id);
    for (let [userId, socketId] of userSockets.entries()) {
      if (socketId === socket.id) {
        userSockets.delete(userId);
        break;
      }
    }
  });
});

// Export io and userSockets for use in other modules
module.exports = { app, io, userSockets };

// Set io instance for services that need to emit socket events
const orderService = require('./services/orderService');
const topUpService = require('./services/topUpService');
const shopController = require('./controllers/shopController');

orderService.setIoInstance(io);
topUpService.setIoInstance(io);
shopController.setIoInstance(io);

// Middleware - Order matters!
app.use(express.json({ limit: '1mb' })); // Limit JSON payload size
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cors());
app.use(helmet());

// Apply rate limiter to all API routes (prevents memory spikes from excessive requests)
app.use('/api', rateLimiter({ 
  windowMs: 60000, // 1 minute
  maxRequests: 100 // 100 requests per minute per IP
}));

const userRoutes = createUserRouter(io, userSockets);
app.use('/api/users', userRoutes);



app.use('/api/order', pasteRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/cart', cartRoutes);
app.use('/products', productRoutes);
app.use('/order', orderRoutes);
app.use('/api', topUpRoutes);
app.use('/api', uploadRoutes);
app.use('/api', transactionRoutes);

app.use('/api/sales', salesRoutes);
app.use('/api/sms', smsRoutes);
app.use('/api/announcement', announcementRoutes);
app.use('/api', pasteRoutes);
app.use('/api/shop', shopRoutes);


// Memory health endpoint for monitoring
app.get('/api/health', (req, res) => {
  const usage = memoryMonitor.getCurrentUsage();
  res.json({
    status: 'ok',
    memory: usage,
    uptime: process.uptime()
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  // console.log(`Server running on port ${PORT}`);
  memoryMonitor.log('Server Started');
  
  // Log memory usage every 10 minutes in production
  setInterval(() => {
    memoryMonitor.log('Periodic Memory Check');
    
    // Force garbage collection if memory is high and GC is exposed
    if (memoryMonitor.isMemoryHigh(400)) {
      console.warn('[Memory Warning] High memory usage detected!');
      if (global.gc) {
        global.gc();
        // console.log('[Memory] Forced garbage collection');
      }
    }
  }, 600000); // Every 10 minutes
});
