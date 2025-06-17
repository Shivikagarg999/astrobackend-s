const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
    gender: {
    type: String,
  },

  googleId: String,
  qualification: String,
  designation: String,
  dob: String, 
  gender: {
  type: String,
  },

  email: {
    type: String,
    unique: false
  },

  phone: {
    type: String,
  },

  password: {
    type: String,
    // required: true,
  },
  address: String,
  city:String,
  state:String,
  country:String,
  pincode:Number,
  role: {
    type: String,
    default: 'user',
  },

  wallet: {
    type: Number,
    default: 0, 
  },

  profilePic: {
    type: String, 
    default: '',
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },

  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

userSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('User', userSchema);