const express = require('express');
const review = require('../../controllers/review/review');
const auth = require('../../middlewares/auth');

const router = express.Router();


//review routes
router.post("/review", auth, review.createComment);
router.get("/myreview", auth, review.myreview);
router.patch("/review/:id", auth, review.editComment);
router.delete("/review/:id", auth, review.deleteComment);

//reply routes
router.post("/reply/:reviewId", auth, review.createReply);
router.get("/reply/:reviewId", auth, review.getReply);
router.patch("/reply/:id", auth, review.editReply);
router.delete("/reply/:id", auth, review.deleteReply);



module.exports = router;


