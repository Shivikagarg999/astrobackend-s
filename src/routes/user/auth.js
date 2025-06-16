const express = require('express');
const user = require('../../controllers/user/auth');
const userUpload = require('../../middlewares/userUpload');
const auth = require('../../middlewares/auth');

const router = express.Router();


router.post("/sendOtp", user.sendOtp);
router.post("/verifyOtp", user.verifyOtp);
router.post("/register", userUpload, user.register);
router.get("/profile", auth, user.getProfile);
router.patch("/profile", auth, userUpload, user.editProfile);


module.exports = router;