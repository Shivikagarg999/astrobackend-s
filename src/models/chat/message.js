const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  from: {
    id: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'from.type' },
    type: { type: String, required: true, enum: ['User', 'Expert'] }
  },
  to: {
    id: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'to.type' },
    type: { type: String, required: true, enum: ['User', 'Expert'] }
  },
  message: { type: String },
  mediaType: { type: String, default: null },
  mediaUrl: { type: String, default: null },
  seen: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);