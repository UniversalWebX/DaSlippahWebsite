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

let users = {};
let reviews = { movie1: [], memes: [] };
let userPosts = []; // Userblog posts
let rooms = {};

// === ADMIN / SERVER-SIDE COMMAND STATE ===
const bannedAccounts = new Set();           // Banned usernames (or emails if you prefer)
const connectedClients = new Map();         // socket.id → { username, email }

// Hardcoded admin username for now (change later if you want dynamic admins)
const ADMIN_USERNAME = 'DaSlippah';

// Your existing routes...
app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (users[email]) return res.status(400).json({ error: "Email exists" });
  users[email] = { username, passwordHash: await bcrypt.hash(password, 10), progress: { movie1: 0, memes: 0 } };
  const token = jwt.sign({ email }, 'secret');
  res.json({ token, user: { username, progress: users[email].progress } });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const u = users[email];
  if (!u || !await bcrypt.compare(password, u.passwordHash)) return res.status(401).json({ error: "Invalid" });
  const token = jwt.sign({ email }, 'secret');
  res.json({ token, user: { username: u.username, progress: u.progress } });
});

app.put('/api/progress', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  try {
    const { email } = jwt.verify(token, 'secret');
    const { movie, progress } = req.body;
    users[email].progress[movie] = progress;
    res.json(users[email].progress);
  } catch { res.status(401).json({ error: "Invalid token" }); }
});

app.get('/api/reviews/:movieId', (req, res) => res.json(reviews[req.params.movieId] || []));
app.post('/api/reviews', (req, res) => {
  const { movieId, username, rating, comment } = req.body;
  reviews[movieId] = reviews[movieId] || [];
  const r = { username, rating, comment, date: new Date().toISOString() };
  reviews[movieId].push(r);
  res.json(r);
});

app.get('/api/userblog', (req, res) => res.json(userPosts));
app.post('/api/userblog', (req, res) => {
  const { username, title, content } = req.body;
  const post = { id: Date.now().toString(), username, title, content, date: new Date().toISOString(), likes: 0 };
  userPosts.unshift(post);
  res.json(post);
});

// === SOCKET.IO CONNECTION HANDLING ===
io.on('connection', socket => {
  console.log('User connected:', socket.id);

  // Optional: let clients register their identity after login
  socket.on('registerUser', ({ username, email }) => {
    if (bannedAccounts.has(username)) {
      socket.emit('banned');
      socket.disconnect(true);
      return;
    }
    connectedClients.set(socket.id, { username, email });
  });

  // === ROOM / VIDEO SYNC (your existing code) ===
  socket.on('join-room', ({ roomId, username }) => {
    socket.join(roomId);
    socket.username = username || "Guest";
    rooms[roomId] = rooms[roomId] || { users: [], time: 0, playing: false };
    rooms[roomId].users = [...new Set([...rooms[roomId].users, socket.username])];
    io.to(roomId).emit('room-users', rooms[roomId].users);
  });

  socket.on('video-sync', data => {
    if (rooms[data.roomId]) {
      rooms[data.roomId].time = data.time;
      rooms[data.roomId].playing = data.playing;
      socket.to(data.roomId).emit('video-sync', data);
    }
  });

  socket.on('chat', data => io.to(data.roomId).emit('chat', { username: socket.username, message: data.message }));

  // === ADMIN COMMANDS ===
  socket.on('adminCommand', (data, ack) => {
    const client = connectedClients.get(socket.id);
    if (!client || client.username !== ADMIN_USERNAME) {
      if (ack) ack({ success: false, error: "Unauthorized" });
      return;
    }

    const { command, arg } = data;

    if (command === 'announcement' && arg) {
      io.emit('announcement', arg);
      if (ack) ack({ success: true });
    }

    else if (command === 'kickall') {
      io.emit('kicked');
      if (ack) ack({ success: true });
    }

    else if (command === 'banaccount' && arg) {
      bannedAccounts.add(arg);
      // Kick all currently connected users with this username
      for (const [id, info] of connectedClients.entries()) {
        if (info.username === arg) {
          io.to(id).emit('banned');
          io.sockets.sockets.get(id)?.disconnect(true);
          connectedClients.delete(id);
        }
      }
      if (ack) ack({ success: true });
    }

    else {
      if (ack) ack({ success: false, error: "Unknown command" });
    }
  });

  socket.on('disconnect', () => {
    connectedClients.delete(socket.id);
    console.log('User disconnected:', socket.id);
  });
});

// Catch-all route for SPA
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

server.listen(process.env.PORT || 3000, () => console.log("Da Slippah is LIVE"));
