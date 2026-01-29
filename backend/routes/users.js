const express = require('express');
const User = require('../models/User');
const Message = require('../models/Message');
const Post = require('../models/Post');
const Channel = require('../models/Channel');
const router = express.Router();

// Получить текущего пользователя
router.get('/me', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id);
    res.json(user);
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Удалить пользователя (только админ)
router.delete('/:id', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const currentUser = await User.findById(payload.id);
    if (!currentUser.isAdmin) return res.status(403).json({ error: 'Admin only' });

    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });

    await Message.deleteMany({ $or: [{ sender: target._id }, { recipient: target._id }] });
    await Post.deleteMany({ user: target._id });
    await Channel.deleteMany({ creator: target._id });
    await target.deleteOne();

    res.json({ message: 'Account deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
