require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "http://localhost:3000" }
});

// Подключение к MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ DB error:', err));

// Middleware
app.use(cors());
app.use(express.json());
app.use('/images', express.static(path.join(__dirname, 'public/images')));
app.use('/svg', express.static(path.join(__dirname, 'public/svg')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/chats', require('./routes/chats'));
app.use('/api/channels', require('./routes/channels'));

// WebRTC Signaling
io.on('connection', (socket) => {
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    socket.to(roomId).emit('user-connected', socket.id);
  });

  socket.on('offer', (data) => {
    io.to(data.to).emit('offer', { from: socket.id, sdp: data.sdp });
  });

  socket.on('answer', (data) => {
    io.to(data.to).emit('answer', { from: socket.id, sdp: data.sdp });
  });

  socket.on('ice-candidate', (data) => {
    io.to(data.to).emit('ice-candidate', { from: socket.id, candidate: data.candidate });
  });

  socket.on('disconnect', () => {
    socket.rooms.forEach(room => {
      socket.to(room).emit('user-disconnected', socket.id);
    });
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
});
