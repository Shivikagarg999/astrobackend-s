const express = require('express');
const recharge = require('../../controllers/user/recharge');
const auth = require('../../middlewares/auth');

const router = express.Router();


router.post("/recharge", auth, recharge.recharge);
router.get("/paymentHistory", auth, recharge.paymentHistory);


module.exports = router;
