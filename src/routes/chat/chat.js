const express = require('express');
const router = express.Router();
const message = require('../../controllers/chat/message');
const auth = require('../../middlewares/auth');
const chatMedia = require('../../middlewares/chatMedia');

// Get list of online users
router.get('/onlineUsers', message.getOnlineUsers);
router.get('/userInQueue', auth, message.userInQueue);
router.get('/chatRequest/:expertId', auth, message.sendChatRequest);
router.get('/acceptRequest/:userId', auth, message.acceptRequest);


router.post('/message', auth, chatMedia, message.sendMessage);
router.get('/message/:to', auth, chatMedia, message.getMessage);
router.get('/endChatSession', auth, message.endChatSession);
router.get('/startChatting/:expertId', auth, message.startChatting);

module.exports = router;