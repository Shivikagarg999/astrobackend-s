const Expert = require("../../models/expert/expert");
const User = require("../../models/user/user");
const Review = require("../../models/review/review");
const errorHandler = require('../../utils/errorHandler');
const { getAllOnlineUsers, getSocket } = require('../../sockets/socketStore');
const mongoose = require('mongoose');
const { getRedis } = require("../../utils/redis");
const Call = require("../../models/call/call");
const Chat = require("../../models/chat/chatSession");


// 🔹 Utility to calculate remaining minutes
function getRemainingMinutes(walletBalance, chargePerMinute) {
    if (!chargePerMinute || chargePerMinute <= 0) return 0;
    return Math.floor(walletBalance / chargePerMinute);
}


// 🔹 Get expert list with online status
async function getExpertsWithOnlineStatus() {
    const onlineUsers = await getAllOnlineUsers();
    const onlineUserObjectIds = onlineUsers.map(id => new mongoose.Types.ObjectId(id));

    const experts = await Expert.aggregate([
        {
            $addFields: {
                online: {
                    $in: ["$_id", onlineUserObjectIds]
                }
            }
        },
        {
            $project: {
                name: 1,
                image: 1,
                address: 1,
                online: 1,
                availability: 1,
                chargePerMinute: 1,
                experience: 1,
            }
        }
    ]);

    return experts;
}


async function getRating(expertId) {
    try {
        const result = await Review.aggregate([
            { $match: { expertId: new mongoose.Types.ObjectId(expertId) } },
            {
                $group: {
                    _id: "$expertId",
                    averageRating: { $avg: "$rating" },
                    totalReviews: { $sum: 1 }
                }
            }
        ]);

        if (result.length === 0) {
            return { averageRating: 0, totalReviews: 0 };
        }

        return {
            averageRating: parseFloat(result[0].averageRating.toFixed(1)),
            totalReviews: result[0].totalReviews
        };
    } catch (error) {
        console.error("Error calculating rating:", error);
        throw error;
    }
}

// 🔹 Get updated expert info with Redis values and wallet calculations
async function enrichExpertsWithStatusAndCharges(experts, walletBalance) {
    return Promise.all(experts.map(async (expert) => {
        const expertId = String(expert._id);

        const isBusy = await getRedis(`expert_busy:${expertId}`);
        const remainingMinutes = await getRedis(`expert_remaining_minutes:${expertId}`);

        const { forChat, forCall, forVideoCall } = expert.perMinuteCharge || {};

        const chatMinutesAvailable = getRemainingMinutes(walletBalance, forChat);
        const callMinutesAvailable = getRemainingMinutes(walletBalance, forCall);
        const videoCallMinutesAvailable = getRemainingMinutes(walletBalance, forVideoCall);

        const rewiewCount = (await getRating(expertId)).totalReviews || 0;
        const rating = (await getRating(expertId)).averageRating || 0;


        return {
            ...expert,
            busy: !!isBusy,
            remainingMinutes: remainingMinutes ? parseInt(remainingMinutes, 10) : 0,
            chatMinutesAvailable,
            callMinutesAvailable,
            videoCallMinutesAvailable,
            rating: rating,
            review: rewiewCount
        };
    }));
}

// 🔹 Main controller function
exports.getExperts = async (req, res) => {
    try {

        const experts = await getExpertsWithOnlineStatus();
        if (!experts.length) return errorHandler(res, 'No experts found', 404);

        const user = await User.findById(req.user.userId);
        const updatedExperts = await enrichExpertsWithStatusAndCharges(experts, user.walletBalance);

        return res.status(200).json({
            message: 'Experts fetched successfully',
            experts: updatedExperts
        });

    } catch (err) {
        return errorHandler(res, err);
    }
};


// 🔹 Get expert details by ID



const getCallDuration = async (expertId) => {
    try {
        // Convert the expertId to ObjectId
        const expertObjectId = new mongoose.Types.ObjectId(expertId);

        console.log("Expert ID:", expertObjectId); // Debugging line

        const result = await Call.aggregate([
            {
                $match: {
                    $or: [
                        { 'caller.id': expertObjectId },
                        { 'receiver.id': expertObjectId }
                    ]
                }
            },
            {
                $group: {
                    _id: null,
                    totalDuration: { $sum: '$duration' }
                }
            }
        ]);

        console.log("Call Duration Result:", result); // Debugging line

        return result.length > 0 ? result[0].totalDuration : 0;
    } catch (error) {
        console.error("Error calculating call duration:", error);
        throw error;
    }
}



const getChatDuration = async (expertId) => {
    try {


        const expertObjectId = new mongoose.Types.ObjectId(expertId);

        console.log("Expert ID:", expertObjectId); // Debugging line


        const result = await Chat.aggregate([
            {
                $match: {
                    $or: [
                        { userId: expertObjectId },
                        { expertId: expertObjectId }
                    ],
                    startTime: { $ne: null },
                    endTime: { $ne: null }
                }
            },
            {
                $project: {
                    durationInSeconds: {
                        $divide: [
                            { $subtract: ['$endTime', '$startTime'] },
                            1000 // convert milliseconds to seconds
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    totalDuration: { $sum: '$durationInSeconds' }
                }
            }
        ]);

        return result.length > 0 ? result[0].totalDuration : 0;
    } catch (error) {
        console.error("Error calculating chat duration:", error);
        throw error;
    }
}


exports.getExpertDetails = async (req, res) => {
    try {

        const expertId = req.params.id;

        const expert = await Expert.findById(expertId);
        if (!expert) return errorHandler(res, 'Expert not found', 404);

        const user = await User.findById(req.user.userId);
        if (!user) return errorHandler(res, 'User not found', 404);

        const { forChat = 0, forCall = 0, forVideoCall = 0 } = expert.perMinuteCharge || {};

        const chatMinutesAvailable = getRemainingMinutes(user.walletBalance, forChat);
        const callMinutesAvailable = getRemainingMinutes(user.walletBalance, forCall);
        const videoCallMinutesAvailable = getRemainingMinutes(user.walletBalance, forVideoCall);

        const callDuration = await getCallDuration(expertId);
        const chatDuration = await getChatDuration(expertId);

        return res.status(200).json({
            message: 'Expert details fetched successfully',
            expert: {
                ...expert.toObject(),
                chatMinutesAvailable,
                callMinutesAvailable,
                videoCallMinutesAvailable,
                callDuration: callDuration,
                chatDuration: chatDuration,
            }
        });
    } catch (err) {
        console.error('Error fetching expert details:', err);
        return errorHandler(res, err);
    }
};

