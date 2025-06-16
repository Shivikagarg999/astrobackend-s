const express = require('express');
const dashboard = require('../../controllers/expert/dashboard');
const auth = require('../../middlewares/auth');

const router = express.Router();

router.get("/dashboard", auth, dashboard.getDashboardData);
router.get("/yearlyDetails", auth, dashboard.yearlyDetails);
router.get("/chatDetails", auth, dashboard.chatDetails);
router.get("/callDetails", auth, dashboard.callDetails);
router.get("/history", auth, dashboard.history);

module.exports = router;