const mongoose = require("mongoose");

const replySchema = new mongoose.Schema({
    repliedBy: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: 'replierType'
    },
    replierType: {
        type: String,
        required: true,
        enum: ['User', 'Expert']
    },
    reviewId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Review",
        required: true,
    },
    reply: {
        type: String,
        required: false,
    },
    created_at: {
        type: Date,
        default: Date.now,
    }
});

module.exports = mongoose.model("Reply", replySchema);
