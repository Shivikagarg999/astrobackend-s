const mongoose = require('mongoose');

const chatSessionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    expertId: { type: mongoose.Schema.Types.ObjectId, ref: 'Expert', required: true },
    status: { type: String, enum: ['active', 'ended'], default: 'active' },
    startTime: { type: Date, default: Date.now },
    endTime: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('ChatSession', chatSessionSchema);