const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

app.use(express.json());
app.use(express.static('public'));

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/daslippah', {
  useNewUrlParser: true, useUnifiedTopology: true
});

const User = mongoose.model('User', new mongoose.Schema({
  username: String, email: { type: String, unique: true }, password: String,
  watchProgress: { movie1: Number, movie2: Number }
}, { minimize: false }));

const Review = mongoose.model('Review', new mongoose.Schema({
  movieId: String, username: String, rating: Number, comment: String, createdAt: { type: Date, default: Date.now }
}));

// Auth routes (simplified for demo)
app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;
  const user = new User({ username, email, password: await bcrypt.hash(password, 10), watchProgress: { movie1: 0, movie2: 0 } });
  await user.save();
  const token = jwt.sign({ id: user._id }, 'secret');
  res.json({ token, user: { username } });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (user && await bcrypt.compare(password, user.password)) {
    const token = jwt.sign({ id: user._id }, 'secret');
    res.json({ token, user: { username: user.username, watchProgress: user.watchProgress } });
  } else res.status(401).json({ error: "Invalid credentials" });
});

app.get('/api/reviews/:movieId', async (req, res) => {
  const reviews = await Review.find({ movieId: req.params.movieId }).sort('-createdAt');
  res.json(reviews);
});

app.post('/api/reviews', async (req, res) => {
  const review = new Review(req.body);
  await review.save();
  res.json(review);
});

// Watch Together rooms
const rooms = {};
io.on('connection', socket => {
  socket.on('join-room', ({ roomId, username }) => {
    socket.join(roomId);
    if (!rooms[roomId]) rooms[roomId] = { users: [], time: 0, playing: false };
    rooms[roomId].users.push(username);
    socket.to(roomId).emit('user-joined', username);
  });
  socket.on('sync', data => socket.to(data.roomId).emit('sync', data));
  socket.on('chat', data => io.to(data.roomId).emit('chat', data));
});

// Serve index.html for all routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', req.path === '/404' ? '404.html' : 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Da Slippah live on port ${PORT}`));
