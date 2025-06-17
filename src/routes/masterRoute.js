const express = require('express');
const router = express.Router();

// 📦 User Routes
router.use('/user', require('./user/auth'));
router.use('/user', require('./user/dashboard'));
router.use('/user', require('./user/recharge'));

// 🧠 Expert Routes
router.use('/expert', require('./expert/auth'));
router.use('/expert', require('./expert/dashboard'));

// 💬 Chat Routes
router.use('/chat', require('./chat/chat'));
router.use('/', require('./review/review'));


module.exports = router;
