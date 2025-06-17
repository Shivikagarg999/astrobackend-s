const express = require('express');
const expert = require('../../controllers/expert/auth');
const expertUpload = require('../../middlewares/expertUpload');
const auth = require('../../middlewares/auth');

const router = express.Router();


router.post("/sendOtp", expert.sendOtp);
router.post("/verifyOtp", expert.verifyOtp);
router.post("/register", expertUpload, expert.register);
router.get("/profile", auth, expert.getProfile);
router.patch("/profile", auth, expertUpload, expert.editProfile);


module.exports = router;