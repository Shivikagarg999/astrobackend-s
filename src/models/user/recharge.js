const mongoose = require('mongoose');

const rechargeSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    paymentMethod: { type: String, enum: ['upi', 'card', 'wallet'], required: true, default: "upi" },
    transactionId: { type: String, required: false },
    status: { type: String, enum: ['pending', 'success', 'failed'], default: 'pending' },
    rechargedAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Recharge', rechargeSchema);
