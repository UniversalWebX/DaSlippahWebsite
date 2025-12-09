const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

app.use(express.json());
app.use(express.static('public'));

// === In-memory "database" (resets on redeploy – perfect for demo/indie site) ===
const users = {};        // { email: { username, passwordHash, watchProgress: {movie1:0, movie2:0} } }
const reviews = { movie1: [], movie2: [] };
const rooms = {};        // Watch Together rooms

// === Auth ===
app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (users[email]) return res.status(400).json({ error: "Email already used" });

  const passwordHash = await bcrypt.hash(password, 10);
  users[email] = { username, passwordHash, watchProgress: { movie1: 0, movie2: 0 } };

  const token = jwt.sign({ email }, 'daslippah_secret');
  res.json({ token, user: { username, email, watchProgress: users[email].watchProgress } });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const user = users[email];
  if (!user || !await bcrypt.compare(password, user.passwordHash)) {
    return res.status(401).json({ error: "Wrong email or password" });
  }
  const token = jwt.sign({ email }, 'daslippah_secret');
  res.json({ token, user: { username: user.username, email, watchProgress: user.watchProgress } });
});

app.put('/api/progress', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  try {
    const { email } = jwt.verify(token, 'daslippah_secret');
    const { movie, progress } = req.body;
    if (users[email]) {
      users[email].watchProgress[movie] = progress;
      res.json(users[email].watchProgress);
    } else res.status(404).json({ error: "User not found" });
  } catch { res.status(401).json({ error: "Invalid token" }); }
});

// === Reviews ===
app.get('/api/reviews/:movieId', (req, res) => {
  res.json(reviews[req.params.movieId] || []);
});

app.post('/api/reviews', (req, res) => {
  const { movieId, username, rating, comment } = req.body;
  const review = { username, rating, comment, date: new Date().toISOString() };
  reviews[movieId] = reviews[movieId] || [];
  reviews[movieId].push(review);
  res.json(review);
});

// === Watch Together ===
io.on('connection', socket => {
  socket.on('join-room', ({ roomId, username }) => {
    socket.join(roomId);
    socket.username = username;
    if (!rooms[roomId]) rooms[roomId] = { users: [], time: 0, playing: false };
    rooms[roomId].users = [...new Set([...rooms[roomId].users, username])];
    io.to(roomId).emit('users', rooms[roomId].users);
  });

  socket.on('sync', data => {
    if (rooms[data.roomId]) {
      rooms[data.roomId].time = data.time;
      rooms[data.roomId].playing = data.playing;
      socket.to(data.roomId).emit('sync', data);
    }
  });

  socket.on('chat', data => {
    io.to(data.roomId).emit('chat', { username: socket.username, message: data.message });
  });

  socket.on('disconnect', () => {
    // cleanup optional
  });
});

// === Serve site ===
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Da Slippah LIVE at https://your-site.onrender.com`);
  console.log(`No database needed – running in pure memory mode`);
});
