const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema({
    expertId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Expert",
        required: true,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5,
    },
    comment: {
        type: String,
        required: false,
    },
    created_at: {
        type: Date,
        default: Date.now,
    }
});

module.exports = mongoose.model("Review", reviewSchema);