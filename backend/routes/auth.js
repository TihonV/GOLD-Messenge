const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

// Простой вход без GitHub (для демо)
router.post('/login', async (req, res) => {
  const { username, asDev, pwd } = req.body;

  if (!username) return res.status(400).json({ error: 'Username required' });

  let user = await User.findOne({ username });
  const isAdminUser = username === 'tihon'; // ← замените на ваш ник

  if (!user) {
    const isDeveloper = asDev && isAdminUser && pwd === '2011';
    user = new User({
      username,
      name: username,
      isGold: isDeveloper,
      isAdmin: isDeveloper,
      avatar: isDeveloper ? '/images/dev_gold.png' : '/images/default-avatar.png'
    });
    await user.save();
  } else if (asDev && isAdminUser) {
    if (pwd !== '2011') return res.status(403).json({ error: 'Invalid password' });
    user.isGold = true;
    user.isAdmin = true;
    user.avatar = '/images/dev_gold.png';
    await user.save();
  }

  const token = jwt.sign(
    { id: user._id, username: user.username, isGold: user.isGold, isAdmin: user.isAdmin },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({ token, user });
});

module.exports = router;
