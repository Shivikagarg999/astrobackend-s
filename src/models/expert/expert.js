const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const expertSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    
    phone: {
        type: String,
        default: null,
        unique: true
    },

    image: {
        type: String,
        default: ""

    },

    aadharCard: {
        type: String,
        default: ""

    },
    pan: {
        type: String,
        default: ""

    },
    verificationVideo: {
        type: String,
        default: ""

    },

    qualification: {
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

    fcm_token: {
        type: String,
        default: ""
    },

    address: {
        type: String,
        default: ""

    },

    verified: {
        type: String,
        enum: ["verified", "pending", "not-verified"],
        default: "pending"
    },

    availability: {
        forChat: {
            type: String,
            default: "1"
        },
        forCall: {
            type: String,
            default: "1"
        },
        forVideoCall: {
            type: String,
            default: "1"
        },
    },

    walletBalance: {
        type: Number,
        default: 0
    },

    perMinuteCharge: {
        forChat: {
            type: Number,
            default: 0
        },
        forCall: {
            type: Number,
            default: 0
        },
        forVideoCall: {
            type: Number,
            default: 0
        },
    },

    designation: {
        type: String,
        default: ""
    },

    experience: {
        type: String,
        default: null
    },

    discription: {
        type: String,
        default: null
    },

    username: {
        type: String,
        default: null,
        unique: true
    },

    password: {
        type: String,
        required: true,
        select: false
    },

}, { timestamps: true });



module.exports = mongoose.model("Expert", expertSchema);
