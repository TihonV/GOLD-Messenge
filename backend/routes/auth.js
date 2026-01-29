const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

// Регистрация нового пользователя
router.post('/register', async (req, res) => {
  const { username, name } = req.body;
  if (!username || !name) return res.status(400).json({ error: 'Username and name required' });

  let user = await User.findOne({ username });
  if (user) return res.status(409).json({ error: 'Username already exists' });

  user = new User({ username, name });
  await user.save();

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user });
});

// Вход (обычный или как разработчик)
router.post('/login', async (req, res) => {
  const { username, pwd } = req.body;

  // Главный админ: tihon + пароль 2011
  if (username === 'tihon' && pwd === '2011') {
    let user = await User.findOne({ username });
    if (!user) {
      user = new User({
        username,
        name: 'TihonV',
        isVerified: true,
        isAdmin: true,
        avatar: '/images/fron.jpg'
      });
      await user.save();
    }
    const token = jwt.sign(
      { id: user._id, isAdmin: true, isVerified: true },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    return res.json({ token, user });
  }

  // Обычный пользователь
  const user = await User.findOne({ username });
  if (!user) return res.status(404).json({ error: 'User not found' });

  const token = jwt.sign(
    { id: user._id, isAdmin: user.isAdmin, isVerified: user.isVerified },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.json({ token, user });
});

module.exports = router;
