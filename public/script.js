// Global variables
let currentUser = null;
let currentToken = null;
let socket = null;
let currentRoomId = null;
let videoPlayer = null;
let watchInterval = null;

// DOM Elements
const navLinks = document.querySelectorAll('.nav-link');
const sections = document.querySelectorAll('.section');
const authModal = document.getElementById('authModal');
const watchModal = document.getElementById('watchModal');
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const logoutBtn = document.getElementById('logoutBtn');
const watchTogetherBtn = document.getElementById('watchTogetherBtn');
const userProfile = document.getElementById('userProfile');
const authForm = document.getElementById('authForm');
const authTitle = document.getElementById('authTitle');
const authSubmit = document.getElementById('authSubmit');
const toggleText = document.getElementById('toggleText');
const usernameInput = document.getElementById('username');
const roomIdInput = document.getElementById('roomId');
const joinRoomBtn = document.getElementById('joinRoom');
const createRoomBtn = document.getElementById('createRoom');
const roomInterface = document.getElementById('roomInterface');
const chatInput = document.getElementById('chatInput');
const sendMessageBtn = document.getElementById('sendMessage');
const chatMessages = document.getElementById('chatMessages');
const roomUsers = document.getElementById('roomUsers');
const playPauseBtn = document.getElementById('playPause');
const syncTimeBtn = document.getElementById('syncTime');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeNavigation();
    initializeAuth();
    initializeWatchTogether();
    checkAuthStatus();
    updateProgressBars();
});

// Navigation
function initializeNavigation() {
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href').substring(1);
            switchSection(targetId);
        });
    });

    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    
    hamburger.addEventListener('click', () => {
        navMenu.classList.toggle('active');
    });
}

function switchSection(sectionId) {
    // Update active nav link
    navLinks.forEach(link => link.classList.remove('active'));
    document.querySelector(`[href="#${sectionId}"]`).classList.add('active');
    
    // Switch sections
    sections.forEach(section => section.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
    
    // Close mobile menu
    document.querySelector('.nav-menu').classList.remove('active');
    
    // Smooth scroll
    document.getElementById(sectionId).scrollIntoView({ behavior: 'smooth' });
}

// Authentication
function initializeAuth() {
    loginBtn.addEventListener('click', () => openAuthModal('login'));
    registerBtn.addEventListener('click', () => openAuthModal('register'));
    logoutBtn.addEventListener('click', logout);
    toggleText.addEventListener('click', toggleAuthMode);
    authForm.addEventListener('submit', handleAuth);
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', closeModal);
    });
    
    // Close modals on outside click
    window.addEventListener('click', (e) => {
        if (e.target === authModal) closeModal(authModal);
        if (e.target === watchModal) closeModal(watchModal);
    });
}

function openAuthModal(mode) {
    authModal.style.display = 'block';
    authTitle.textContent = mode === 'login' ? 'Login' : 'Sign Up';
    authSubmit.textContent = mode === 'login' ? 'Login' : 'Sign Up';
    toggleText.textContent = mode === 'login' ? "Don't have an account? Sign up" : "Already have an account? Login";
    usernameInput.style.display = mode === 'register' ? 'block' : 'none';
    authForm.reset();
}

function toggleAuthMode() {
    const isLogin = authTitle.textContent === 'Login';
    openAuthModal(isLogin ? 'register' : 'login');
}

async function handleAuth(e) {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const username = document.getElementById('username').value;
    
    const endpoint = authTitle.textContent === 'Login' ? '/api/login' : '/api/register';
    const body = authTitle.textContent === 'Login' ? { email, password } : { email, password, username };
    
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentUser = data.user;
            currentToken = data.token;
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            updateUI();
            closeModal(authModal);
            showNotification(`${authTitle.textContent === 'Login' ? 'Welcome back' : 'Account created'}!`, 'success');
        } else {
            showNotification(data.error || 'Authentication failed', 'error');
        }
    } catch (error) {
        showNotification('Network error. Please try again.', 'error');
    }
}

function logout() {
    currentUser = null;
    currentToken = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    updateUI();
    if (socket) socket.disconnect();
    showNotification('Logged out successfully', 'success');
}

function checkAuthStatus() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (token && user) {
        currentToken = token;
        currentUser = JSON.parse(user);
        updateUI();
        // Verify token
        verifyToken();
    }
}

async function verifyToken() {
    try {
        const response = await fetch(`/api/user/${currentUser.id}`, {
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        
        if (response.ok) {
            const userData = await response.json();
            currentUser.watchProgress = userData.watchProgress;
            localStorage.setItem('user', JSON.stringify(currentUser));
            updateProgressBars();
        } else {
            logout();
        }
    } catch (error) {
        logout();
    }
}

function updateUI() {
    if (currentUser) {
        loginBtn.style.display = 'none';
        registerBtn.style.display = 'none';
        userProfile.style.display = 'flex';
        document.getElementById('username').textContent = currentUser.username;
    } else {
        loginBtn.style.display = 'inline-block';
        registerBtn.style.display = 'inline-block';
        userProfile.style.display = 'none';
        watchTogetherBtn.style.display = 'none';
    }
}

// Watch Together
function initializeWatchTogether() {
    watchTogetherBtn.addEventListener('click', () => {
        if (!currentUser) {
            showNotification('Please login to use Watch Together', 'error');
            openAuthModal('login');
            return;
        }
        watchModal.style.display = 'block';
    });
    
    joinRoomBtn.addEventListener('click', joinRoom);
    createRoomBtn.addEventListener('click', createRoom);
    sendMessageBtn.addEventListener('click', sendChatMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });
    playPauseBtn.addEventListener('click', togglePlayPause);
    syncTimeBtn.addEventListener('click', syncVideoTime);
}

function createRoom() {
    const roomId = 'room_' + Date.now();
    roomIdInput.value = roomId;
    joinRoom();
}

async function joinRoom() {
    const roomId = roomIdInput.value.trim();
    if (!roomId) {
        showNotification('Please enter a room ID', 'error');
        return;
    }
    
    if (!socket) {
        socket = io();
        setupSocketEvents();
    }
    
    currentRoomId = roomId;
    roomCreation.style.display = 'none';
    roomInterface.style.display = 'block';
    
    // Create demo video player
    createVideoPlayer();
    
    socket.emit('join-room', { roomId, username: currentUser.username });
}

function setupSocketEvents() {
    socket.on('room-info', (data) => {
        updateRoomUsers(data.users);
        if (data.currentTime > 0) {
            videoPlayer.currentTime = data.currentTime;
            if (!data.paused) videoPlayer.play();
        }
    });
    
    socket.on('user-joined', (data) => {
        updateRoomUsers(data.users);
        addChatMessage('system', `${data.username} joined the room`);
    });
    
    socket.on('user-left', (data) => {
        updateRoomUsers(data.users);
        addChatMessage('system', `${data.username} left the room`);
    });
    
    socket.on('sync-time', (data) => {
        if (videoPlayer && Math.abs(videoPlayer.currentTime - data.time) > 2) {
            videoPlayer.currentTime = data.time;
            if (!data.paused) videoPlayer.play();
            else videoPlayer.pause();
        }
    });
    
    socket.on('chat-message', (data) => {
        addChatMessage(data.username, data.message, data.timestamp);
    });
}

function createVideoPlayer() {
    const videoContainer = document.getElementById('videoPlayer');
    videoContainer.innerHTML = `
        <video id="mainVideo" controls width="100%" height="100%">
            <source src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" type="video/mp4">
            Your browser does not support the video tag.
        </video>
    `;
    
    videoPlayer = document.getElementById('mainVideo');
    videoPlayer.addEventListener('timeupdate', syncVideoProgress);
    videoPlayer.addEventListener('play', () => syncVideoState(true));
    videoPlayer.addEventListener('pause', () => syncVideoState(false));
}

function syncVideoProgress() {
    if (watchInterval) clearInterval(watchInterval);
    watchInterval = setInterval(() => {
        if (currentRoomId && socket) {
            socket.emit('sync-time', {
                roomId: currentRoomId,
                time: videoPlayer.currentTime,
                paused: videoPlayer.paused
            });
        }
    }, 1000);
}

function syncVideoState(playing) {
    if (currentRoomId && socket) {
        socket.emit('sync-time', {
            roomId: currentRoomId,
            time: videoPlayer.currentTime,
            paused: !playing
        });
    }
}

function togglePlayPause() {
    if (videoPlayer.paused) {
        videoPlayer.play();
        playPauseBtn.textContent = 'Pause';
    } else {
        videoPlayer.pause();
        playPauseBtn.textContent = 'Play';
    }
}

function syncVideoTime() {
    if (currentRoomId && socket) {
        socket.emit('sync-time', {
            roomId: currentRoomId,
            time: 0,
            paused: true
        });
        videoPlayer.currentTime = 0;
        videoPlayer.pause();
        playPauseBtn.textContent = 'Play';
    }
}

function sendChatMessage() {
    const message = chatInput.value.trim();
    if (message && currentRoomId && socket) {
        socket.emit('chat-message', {
            roomId: currentRoomId,
            message: message
        });
        addChatMessage(currentUser.username, message);
        chatInput.value = '';
    }
}

function addChatMessage(username, message, timestamp = new Date()) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message';
    
    if (username === 'system') {
        messageDiv.style.borderLeftColor = '#666';
        messageDiv.innerHTML = `<strong>${message}</strong>`;
    } else {
        const time = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        messageDiv.innerHTML = `
            <div><strong>${username}</strong> <span style="color: #666; font-size: 0.8rem;">${time}</span></div>
            <div>${message}</div>
        `;
    }
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function updateRoomUsers(users) {
    roomUsers.innerHTML = `
        <h4>Room Members (${users.length})</h4>
        <div class="user-list">
            ${users.map(user => `<span class="user-tag">${user.username}</span>`).join('')}
        </div>
    `;
}

// Movie watching
function watchMovie(movieId) {
    if (!currentUser) {
        showNotification('Please login to save your progress', 'info');
        openAuthModal('login');
        return;
    }
    
    // For demo purposes, simulate watching
    const progress = Math.random() * 100;
    updateMovieProgress(movieId, progress);
    
    showNotification(`Started watching ${movieId === 'movie1' ? 'Da Slippah 1' : 'Da Slippah 2'}`, 'success');
    
    // In real implementation, this would open the video player
    // and start tracking actual progress
}

// Progress management
async function updateMovieProgress(movieId, progress) {
    try {
        const response = await fetch(`/api/user/${currentUser.id}/progress`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify({ movie: movieId, progress })
        });
        
        if (response.ok) {
            const progressData = await response.json();
            currentUser.watchProgress = progressData;
            localStorage.setItem('user', JSON.stringify(currentUser));
            updateProgressBars();
        }
    } catch (error) {
        console.error('Error updating progress:', error);
    }
}

function updateProgressBars() {
    if (!currentUser) return;
    
    const movie1Progress = currentUser.watchProgress.movie1 || 0;
    const movie2Progress = currentUser.watchProgress.movie2 || 0;
    
    document.getElementById('movie1-progress').style.width = `${movie1Progress}%`;
    document.getElementById('movie1-time').textContent = `${Math.floor(movie1Progress/100 * 120)}:00 / 120:00`;
    
    document.getElementById('movie2-progress').style.width = `${movie2Progress}%`;
    document.getElementById('movie2-time').textContent = `${Math.floor(movie2Progress/100 * 120)}:00 / 120:00`;
}

// Utilities
function closeModal(modal) {
    modal.style.display = 'none';
}

function showNotification(message, type = 'info') {
    // Create notification
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        padding: 1rem 2rem;
        border-radius: 10px;
        color: white;
        font-weight: 500;
        z-index: 3000;
        transform: translateX(100%);
        transition: transform 0.3s ease;
        ${type === 'success'
