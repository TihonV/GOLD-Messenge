const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
  username: { type: String, required: true, unique: true },
  name: { type: String, default: '' },
  email: { type: String, default: '' },
  avatar: { type: String, default: '/images/fron.jpg' },
  bio: { type: String, default: '' },
  isVerified: { type: Boolean, default: false },
  isAdmin: { type: Boolean, default: false },
  friends: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);
