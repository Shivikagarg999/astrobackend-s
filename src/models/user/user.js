const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    phone: {
        type: String,
        required: true,
        unique: true
    },
    image: {
        type: String,
        default: ""
    },
    gender: {
        type: String,
        enum: ["male", "female"],
    },
    dob: {
        type: Date
    },
    address: {
        type: String,
        default: ""
    },
    
    qualification: {
        type: String,
        default: ""
    },
    designation: {
        type: String,
        default: ""
    },

    fcm_token: {
        type: String,
        default: ""
    },

    walletBalance: {
        type: Number,
        default: 0
    },

}, { timestamps: true });



module.exports = mongoose.model("User", userSchema);