const Expert = require("../../models/expert/expert");
const Review = require("../../models/review/review");
const Reply = require("../../models/review/reply");
const User = require("../../models/user/user");
const errorHandler = require('../../utils/errorHandler');
const mongoose = require("mongoose");

// Create a Comment
exports.createComment = async (req, res) => {

    const { expertId, comment, rating } = req.body;
    const userId = req.user.userId;

    try {
        const expert = await Expert.findById(expertId);
        if (!expert) {
            return res.status(404).json({ message: "Expert not found" });
        }

        if (rating) {
            // Update existing review with the new rating if it exists
            let existingReview = await Review.findOne({ expertId, userId, rating: { $exists: true } });

            if (existingReview) {
                existingReview.rating = rating;
                await existingReview.save();
            }
        }

        // Create a new review with the provided comment and rating (if not provided earlier)
        const review = new Review({
            expertId,
            userId,
            comment,
            rating: rating || null // Allow null if rating is not provided
        });

        const savedReview = await review.save();
        res.status(201).json({ message: "Review created successfully", review: savedReview });
    } catch (error) {
        console.error("Error:", error); // For logging in the console
        res.status(500).json({
            message: "Error handling review",
            error: error.message, // Send only the message
            // stack: error.stack, // Optionally include stack for debugging
        });
    }
};

// Edit a Comment
exports.editComment = async (req, res) => {

    const { id } = req.params;
    const { comment, rating } = req.body;
    const userId = req.user.userId;

    try {
        const review = await Review.findById(id);

        if (!review) {
            return res.status(404).json({ message: "Review not found" });
        }

        // Check if the current user is authorized to edit this review
        if (review.userId.toString() !== userId.toString()) {
            return res.status(403).json({ message: "You are not authorized to edit this review" });
        }

        // Update the comment and rating based on provided data
        if (rating !== undefined) {
            review.rating = rating; // Replace the old rating with the new one
        }

        if (comment !== undefined) {
            review.comment = comment; // Update the comment if provided
        }

        const updatedReview = await review.save();

        res.status(200).json({ message: "Review updated successfully", review: updatedReview });
    } catch (error) {
        res.status(500).json({ message: "Error updating review", error });
    }
};


// Delete a Comment
exports.deleteComment = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;

    try {
        const review = await Review.findById(id);

        if (!review) {
            return res.status(404).json({ message: "Comment not found" });
        }

        if (review.userId.toString() !== userId.toString()) {
            return res.status(403).json({ message: "You are not authorized to delete this comment" });
        }

        await Review.findByIdAndDelete(id);
        res.status(200).json({ message: "Comment deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting comment", error });
    }
};


// Get all reviews by the current user
exports.myreview = async (req, res) => {
    const userId = req.user.userId;

    try {
        const reviews = await Review.find({ expertId: userId }).populate("userId", "name email image"); // Populate expertId with name and email fields

        if (!reviews || reviews.length === 0) {
            return res.status(404).json({ message: "No reviews found" });
        }

        res.status(200).json({ message: "Reviews retrieved successfully", reviews });
    } catch (error) {
        res.status(500).json({ message: "Error retrieving reviews", error });
    }
};


// Create a reply
exports.createReply = async (req, res) => {
    const { reply } = req.body;
    const reviewId = req.params.reviewId;
    const repliedBy = req.user.userId;
    const replierType = req.user.type;

    try {
        // Ensure the review exists
        const reviewExists = await Review.findById(reviewId);
        if (!reviewExists) {
            return res.status(404).json({ message: "Review not found" });
        }

        const newReply = await Reply.create({
            repliedBy,
            replierType,
            reviewId,
            reply
        });

        res.status(201).json({ message: "Reply added successfully", reply: newReply });
    } catch (error) {
        res.status(500).json({ message: "Error creating reply", error });
    }
};

// Get all replies for a specific review
exports.getReply = async (req, res) => {
    const reviewId = req.params.reviewId;

    try {
        const replies = await Reply.find({ reviewId })
            .populate("repliedBy", "name email image")

        res.status(200).json({ message: "Replies retrieved successfully", replies });
    } catch (error) {
        res.status(500).json({ message: "Error retrieving replies", error });
    }
};

// Edit a reply
exports.editReply = async (req, res) => {
    const replyId = req.params.id;
    const { reply } = req.body;
    const userId = req.user.userId;

    try {
        const existingReply = await Reply.findById(replyId);

        if (!existingReply) {
            return res.status(404).json({ message: "Reply not found" });
        }

        // Ensure the user is the one who created the reply
        if (existingReply.repliedBy.toString() !== userId) {
            return res.status(403).json({ message: "Unauthorized to edit this reply" });
        }

        existingReply.reply = reply || existingReply.reply;
        await existingReply.save();

        res.status(200).json({ message: "Reply updated successfully", reply: existingReply });
    } catch (error) {
        res.status(500).json({ message: "Error updating reply", error });
    }
};

// Delete a reply
exports.deleteReply = async (req, res) => {
    const replyId = req.params.id;
    const userId = req.user.userId;

    try {
        const reply = await Reply.findById(replyId);

        if (!reply) {
            return res.status(404).json({ message: "Reply not found" });
        }

        if (reply.repliedBy.toString() !== userId) {
            return res.status(403).json({ message: "Unauthorized to delete this reply" });
        }

        await Reply.findByIdAndDelete(replyId);

        res.status(200).json({ message: "Reply deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting reply", error });
    }
};





