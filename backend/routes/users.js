const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

// Получить текущего пользователя
router.get('/me', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Поиск пользователей
router.get('/', async (req, res) => {
  const { search } = req.query;
  if (!search) return res.json([]);
  const users = await User.find({
    $or: [
      { username: { $regex: search, $options: 'i' } },
      { name: { $regex: search, $options: 'i' } }
    ]
  }).limit(10);
  res.json(users);
});

// Назначить админа (только главный админ)
router.post('/:id/admin', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const currentUser = await User.findById(payload.id);
    if (!currentUser.isAdmin) return res.status(403).json({ error: 'Admin only' });

    const targetUser = await User.findById(req.params.id);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    targetUser.isAdmin = true;
    await targetUser.save();
    res.json({ message: 'Admin granted', user: targetUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
