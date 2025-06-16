const express = require('express');
const chatDashboard = require('../../controllers/user/chatDashboard');
const homeDashboard = require('../../controllers/user/homeDashboard');
const auth = require('../../middlewares/auth');

const router = express.Router();


//home dashboard
router.get("/data", auth, homeDashboard.data);

//chat dashboard
router.get("/expert", auth, chatDashboard.getExperts);
router.get("/expert/:id", auth, chatDashboard.getExpertDetails);

module.exports = router;