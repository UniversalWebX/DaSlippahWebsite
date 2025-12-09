const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Security and Optimization Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1d', // Cache static files
}));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
}));

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/daslippah', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Schemas
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  watchProgress: {
    movie1: { type: Number, default: 0 },
    movie2: { type: Number, default: 0 }
  },
  createdAt: { type: Date, default: Date.now }
});

const reviewSchema = new mongoose.Schema({
  movieId: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Review = mongoose.model('Review', reviewSchema);

// Auth Middleware
const authMiddleware = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token provided' });
  
  try {
    const decoded = jwt.verify(token, 'daslippah_secret');
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Auth Routes - same as before
app.post('/api/register', async (req, res) => { /* same */ });
app.post('/api/login', async (req, res) => { /* same */ });
app.get('/api/user/:id', authMiddleware, async (req, res) => { /* same */ });
app.put('/api/user/:id/progress', authMiddleware, async (req, res) => { /* same */ });

// Reviews Routes
app.get('/api/reviews/:movieId', async (req, res) => {
  try {
    const reviews = await Review.find({ movieId: req.params.movieId })
      .populate('userId', 'username')
      .sort({ createdAt: -1 });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/reviews', authMiddleware, async (req, res) => {
  try {
    const { movieId, rating, comment } = req.body;
    const review = new Review({ movieId, userId: req.userId, rating, comment });
    await review.save();
    res.json(review);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Search Route
app.get('/api/search', async (req, res) => {
  const query = req.query.q?.toLowerCase();
  if (!query) return res.json([]);
  
  // Mock search - in real, search DB
  const results = [
    { type: 'movie', id: 'movie1', title: 'Da Slippah 1', match: query },
    { type: 'blog', id: 'blog1', title: 'Scene One Recording', match: query }
  ].filter(item => item.title.toLowerCase().includes(query));
  
  res.json(results);
});

// Socket.IO - same as before

// 404 Handler
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
