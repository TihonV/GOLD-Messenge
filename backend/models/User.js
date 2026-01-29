const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
  githubId: { type: String, unique: true },
  username: { type: String, required: true },
  name: String,
  email: String,
  avatar: { type: String, default: '/images/default-avatar.png' },
  bio: String,
  isGold: { type: Boolean, default: false },
  isAdmin: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);
