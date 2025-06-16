const Expert = require("../../models/expert/expert");
const Call = require("../../models/call/call");
const User = require("../../models/user/user");
const ChatSession = require("../../models/chat/chatSession");
const errorHandler = require('../../utils/errorHandler');
const mongoose = require('mongoose');



// Chat Data Function
const getChatData = async (userId) => {
    const objectId = new mongoose.Types.ObjectId(userId);

    const callStats = await ChatSession.aggregate([
        {
            $match: {
                expertId: objectId,
                status: "ended", // Sirf completed calls consider karo
                startTime: { $ne: null },
                endTime: { $ne: null }
            }
        },
        {
            $project: {
                durationInMinutes: {
                    $divide: [
                        { $subtract: ["$endTime", "$startTime"] },
                        1000 * 60 // Convert milliseconds to minutes
                    ]
                }
            }
        },
        {
            $group: {
                _id: null,
                totalCalls: { $sum: 1 },
                totalDuration: { $sum: "$durationInMinutes" }
            }
        }
    ]);

    return {
        name: 'chat',
        order: callStats[0]?.totalCalls || 0,
        minutesCount: Math.round(callStats[0]?.totalDuration || 0),
    };
};




// Audio Call Data Function
const getCallData = async (userId) => {
    const objectId = new mongoose.Types.ObjectId(userId);

    const callStats = await Call.aggregate([
        {
            $match: {
                callType: "audio",
                duration: { $gt: 0 },
                $or: [
                    { "caller.id": objectId },
                    { "receiver.id": objectId }
                ]
            }
        },
        {
            $group: {
                _id: null,
                totalCalls: { $sum: 1 },
                totalDuration: { $sum: "$duration" }
            }
        }
    ]);

    return {
        name: 'audioCall',
        order: callStats[0]?.totalCalls || 0,
        minutesCount: callStats[0]?.totalDuration ? Math.round(callStats[0].totalDuration / 60) : 0,
    };
};

// Video Call Data Function
const getVideoCallData = async (userId) => {
    const objectId = new mongoose.Types.ObjectId(userId);

    const callStats = await Call.aggregate([
        {
            $match: {
                callType: "video",
                duration: { $gt: 0 },
                $or: [
                    { "caller.id": objectId },
                    { "receiver.id": objectId }
                ]
            }
        },
        {
            $group: {
                _id: null,
                totalCalls: { $sum: 1 },
                totalDuration: { $sum: "$duration" }
            }
        }
    ]);

    return {
        name: 'videoCall',
        order: callStats[0]?.totalCalls || 0,
        minutesCount: callStats[0]?.totalDuration ? Math.round(callStats[0].totalDuration / 60) : 0,
    };
};



// allExperts
exports.getDashboardData = async (req, res) => {
    try {

        const userId = req.user?.userId;

        console.log("User ID:", userId);

        const chatData = await getChatData(userId);
        const callData = await getCallData(userId);
        const videoCallData = await getVideoCallData(userId);
        const totalOrder = callData.order + videoCallData.order + chatData.order;
        const totalMinutes = callData.minutesCount + videoCallData.minutesCount + chatData.minutesCount;

        const walletData = {
            name: 'Wallet',
            order: totalOrder,
            minutesCount: totalMinutes,
        };

        const data = [
            chatData,
            callData,
            videoCallData,
            walletData,
        ];

        return res.status(200).json({
            message: 'data fetched successfully',
            experts: data,
        });
    } catch (err) {
        return errorHandler(res, err);
    }
};


// Yearly Details
exports.yearlyDetails = async (req, res) => {
    try {
        const userId = req.user?.userId;
        const objectId = new mongoose.Types.ObjectId(userId);

        const yearlyData = await Call.aggregate([
            {
                $match: {
                    $or: [
                        { "caller.id": objectId },
                        { "receiver.id": objectId }
                    ]
                }
            },
            {
                $group: {
                    _id: { $year: "$createdAt" },
                    totalCalls: { $sum: 1 },
                    totalDuration: { $sum: "$duration" }
                }
            },
            {
                $sort: { _id: -1 } // Sort by year in descending order
            }
        ]);

        return res.status(200).json({
            message: 'Yearly data fetched successfully',
            yearlyData,
        });
    } catch (err) {
        return errorHandler(res, err);
    }
};

// Chat Details
exports.chatDetails = async (req, res) => {
    try {

        const userId = req.user?.userId;

        const chatDetails = await ChatSession.aggregate([
            {
                $match: {
                    expertId: new mongoose.Types.ObjectId(userId),
                    status: "ended",
                    startTime: { $ne: null },
                    endTime: { $ne: null }
                }
            },
            {
                $addFields: {
                    userIdObject: { $toObjectId: "$userId" }
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "userIdObject",
                    foreignField: "_id",
                    as: "userDetails"
                }
            },
            {
                $unwind: "$userDetails"
            },
            {
                $addFields: {
                    durationInMinutes: {
                        $divide: [
                            { $subtract: ["$endTime", "$startTime"] },
                            1000 * 60
                        ]
                    }
                }
            },
            {
                $project: {
                    _id: 1,
                    status: 1,
                    startTime: 1,
                    endTime: 1,
                    durationInMinutes: 1,
                    userDetails: 1
                }
            },
            {
                $sort: { createdAt: -1 }
            }
        ]);

        return res.status(200).json({
            message: 'Chat details fetched successfully',
            chatDetails,
        });
    } catch (err) {
        return errorHandler(res, err);
    }
};

// Call Details
exports.callDetails = async (req, res) => {
    try {
        const userId = req.user?.userId;
        const objectId = new mongoose.Types.ObjectId(userId);

        const callDetails = await Call.aggregate([
            {
                $match: {
                    $or: [
                        { "caller.id": objectId },
                        { "receiver.id": objectId }
                    ],
                    startedAt: { $ne: null },
                    endedAt: { $ne: null }
                }
            },
            {
                $addFields: {
                    callerIdObject: { $toObjectId: "$caller.id" }
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "callerIdObject",
                    foreignField: "_id",
                    as: "userDetails"
                }
            },
            {
                $unwind: "$userDetails"
            },
            {
                $project: {
                    _id: 1,
                    callType: 1,
                    duration: 1,
                    status: 1,
                    startedAt: 1,
                    endedAt: 1,
                    userDetails: 1
                }
            },
            {
                $sort: { createdAt: -1 }
            }
        ]);

        return res.status(200).json({
            message: 'Call details fetched successfully',
            callDetails,
        });
    } catch (err) {
        return errorHandler(res, err);
    }
};



// History
exports.history = async (req, res) => {
    try {
        const userId = req.user?.userId;
        const objectId = new mongoose.Types.ObjectId(userId);

        const history = await Call.aggregate([
            {
                $match: {
                    $or: [
                        { "caller.id": objectId },
                        { "receiver.id": objectId }
                    ]
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "caller.id",
                    foreignField: "_id",
                    as: "callerDetails"
                }
            },
            {
                $unwind: "$callerDetails"
            },
            {
                $project: {
                    _id: 1,
                    callerName: "$callerDetails.name",
                    duration: 1,
                    createdAt: 1,
                    callType: 1
                }
            },
            {
                $sort: { createdAt: -1 } // Sort by createdAt in descending order
            }
        ]);

        return res.status(200).json({
            message: 'History fetched successfully',
            history,
        });
    } catch (err) {
        return errorHandler(res, err);
    }
};