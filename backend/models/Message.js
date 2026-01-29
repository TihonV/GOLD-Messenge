const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const MessageSchema = new Schema({
  sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
}, {
  // Автоматическое удаление через 5 часов
  timestamps: { createdAt: 'timestamp' },
  expireAfterSeconds: 18000 // 5 часов = 18000 секунд
});

module.exports = mongoose.model('Message', MessageSchema);
