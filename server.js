
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
let rooms = {};

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
  reviews[movieId].push({ username, rating, comment, date: new Date().toISOString() });
  res.json(reviews[movieId].at(-1));
});

io.on('connection', socket => {
  socket.on('join-room', ({ roomId, username }) => {
    socket.join(roomId);
    socket.username = username || "Guest";
    rooms[roomId] = rooms[roomId] || { users: [], time: 0, playing: false };
    rooms[roomId].users = [...new Set([...rooms[roomId].users, socket.username])];
    io.to(roomId).emit('users', rooms[roomId].users);
  });

  socket.on('sync', data => {
    if (rooms[data.roomId]) {
      rooms[data.roomId].time = data.time;
      rooms[data.roomId].playing = data.playing;
      socket.to(data.roomId).emit('sync', data);
    }
  });

  socket.on('chat', data => io.to(data.roomId).emit('chat', { username: socket.username, message: data.message }));
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

server.listen(process.env.PORT || 3000, () => console.log("Da Slippah live!"));
