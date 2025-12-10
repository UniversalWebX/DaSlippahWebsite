
let user = null, token = null, socket = io(), currentRoom = null, player = null;

function openModal(type) {
  document.getElementById('auth-modal').style.display = 'flex';
  document.getElementById('auth-title').textContent = type === 'login' ? 'Login' : 'Register';
  document.getElementById('username').style.display = type === 'register' ? 'block' : 'none';
}
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

async function handleAuth(e) {
  e.preventDefault();
  const form = e.target;
  const body = { email: form[1].value, password: form[2].value };
  if (form[0].style.display !== 'none') body.username = form[0].value;
  const url = document.getElementById('auth-title').textContent === 'Login' ? '/api/login' : '/api/register';
  const res = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
  const data = await res.json();
  if (res.ok) {
    user = data.user; token = data.token;
    document.getElementById('welcome').textContent = 'Hi ' + user.username;
    document.getElementById('welcome').style.display = 'inline';
    document.getElementById('logout').style.display = 'inline-block';
    document.querySelectorAll('.auth button').forEach(b => b.style.display = 'none');
    closeModal('auth-modal');
  }
}
function logout() { user = null; token = null; location.reload(); }

document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.querySelector(link.getAttribute('href')).classList.add('active');
    link.classList.add('active');
  });
});

function watchMovie(id) {
  const urls = { movie1: "https://drive.google.com/file/d/1LyNZxP_bm2lVbnC6J9HPQn8hKbxlx0Al/preview", memes: "https://drive.google.com/file/d/1P4TUhjsUsp9rH-BxsAFK7UdLbvhhUgOL/preview" };
  document.getElementById('video').src = urls[id];
  document.getElementById('watch-modal').style.display = 'flex';
}
function watchTogether(id) {
  currentRoom = prompt("Room name:") || "main";
  socket.emit('join-room', { roomId: currentRoom, username: user ? user.username : "Guest" });
  watchMovie(id);
}
function closeWatch() { document.getElementById('watch-modal').style.display = 'none'; document.getElementById('video').src = ''; }

document.getElementById('video').addEventListener('load', () => {
  player = document.getElementById('video').contentWindow;
  setInterval(() => {
    if (currentRoom) socket.emit('video-sync', { roomId: currentRoom, time: player.currentTime || 0, playing: !player.paused });
  }, 1000);
});
socket.on('video-sync', d => { if (player) player.currentTime = d.time; });
socket.on('chat', d => { document.getElementById('chat').innerHTML += `<div><b>${d.username}:</b> ${d.message}</div>`; });
socket.on('room-users', u => { document.getElementById('room-users').textContent = "Users: " + u.join(', '); });
function sendChat() {
  const msg = document.getElementById('chat-input').value;
  if (msg && currentRoom) { socket.emit('chat', { roomId: currentRoom, message: msg }); document.getElementById('chat-input').value = ''; }
}
