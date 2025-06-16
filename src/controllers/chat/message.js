const Expert = require("../../models/expert/expert");
const User = require("../../models/user/user");
const Message = require("../../models/chat/message");
const ChatSession = require("../../models/chat/chatSession");
const path = require('path');
const upload = require("../../utils/multer");
const errorHandler = require('../../utils/errorHandler');
const { startBilling } = require('./billing');
const { getSocket } = require('../../sockets/socketStore');
const { MINIMUM_REQUIRED_MINUTES } = require('../../constants/constants');
const { getRedis, deleteRedis, pushToRedisQueue, popFromRedisQueue, getAllFromRedisQueue, flush } = require("../../utils/redis");


exports.getOnlineUsers = async (req, res) => {
    try {
        // For now, just send a response

        const user = await User.find(); // for Mongoose; use `findAll()` for Sequelize

        return res.status(200).json({
            success: true,
            data: user
        });


    } catch (error) {
        console.error('Error fetching online users or sending OTP:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};
exports.userInQueue = async (req, res) => {
    try {

        const expertId = req.user.userId;

        const queuedUsers = await getAllFromRedisQueue(`expert_queue:${expertId}`);

        let allUserDetails = [];

        if (queuedUsers && queuedUsers.length > 0) {
            // Step 1: Extract all user IDs from queue
            const userIdMap = new Map(); // To keep requestType mapped with userId
            const userIds = [];

            for (const user of queuedUsers) {
                if (user.userId) {
                    userIds.push(user.userId);
                    userIdMap.set(user.userId, user.requestType);
                }
            }

            // Step 2: Fetch all user details at once
            const usersFromDb = await User.find({ _id: { $in: userIds } });

            // Step 3: Map requestType back to each user
            allUserDetails = usersFromDb.map(user => ({
                userDetails: user,
                requestType: userIdMap.get(user._id.toString())
            }));
        }

        return res.status(200).json({
            success: true,
            users: allUserDetails,
        });

    } catch (error) {
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};
exports.sendMessage = (req, res) => {
    const multi = upload.array('media');

    multi(req, res, async (err) => {
        try {

            const senderSocket = await getSocket(req.user.userId)
            const receiverSocket = await getSocket(req.body.to)

            if (err) return errorHandler(res, err);

            const from = req.user.userId;
            const fromType = req.user.type;

            const to = req.body.to;
            const toType = (fromType === 'User' ? 'Expert' : 'User');

            const { message } = req.body;

            const createdMessages = [];

            // If files exist
            if (req.files && req.files.length > 0) {
                for (const file of req.files) {
                    const ext = path.extname(file.originalname).toLowerCase();
                    const mediaType = ext.includes('mp4') ? 'video'
                        : ext.includes('mp3') || ext.includes('wav') ? 'audio'
                            : ext.includes('png') || ext.includes('jpg') || ext.includes('jpeg') ? 'image'
                                : 'file';

                    const newMsg = await Message.create({
                        from: {
                            id: from,
                            type: fromType
                        },
                        to: {
                            id: to,
                            type: toType
                        },
                        mediaType,
                        mediaUrl: `/uploads/chatMedia/${file.filename}`,
                        message: null
                    });

                    createdMessages.push(newMsg);
                }
            }

            // If simple text message also there
            if (message && message.trim()) {
                const textMsg = await Message.create({
                    from: {
                        id: from,
                        type: fromType
                    },
                    to: {
                        id: to,
                        type: toType
                    },
                    message,
                    mediaType: null
                });
                createdMessages.push(textMsg);
            }

            if (senderSocket) senderSocket.emit('newMessage', createdMessages)
            if (receiverSocket) receiverSocket.emit('newMessage', createdMessages)

            return res.status(200).json({
                success: true,
                message: 'Messages sent successfully',
                data: createdMessages
            });

        } catch (error) {
            console.error('Send Message Error:', error);
            return res.status(500).json({ success: false, message: 'Internal Server Error' });
        }
    });
};

const updateMessageStatus = async (messages, userId) => {

    const messageIdsToUpdate = messages
        .filter(msg => msg.to.toString() === userId.toString() && !msg.seen)
        .map(msg => msg._id);

    if (messageIdsToUpdate.length > 0) {
        await Message.updateMany(
            { _id: { $in: messageIdsToUpdate } },
            { $set: { seen: true } }
        );
    }

}

exports.getMessage = async (req, res) => {
    try {

        const userId = req.user.userId;
        console.log('User ID:', userId);
        const to = req.params.to;

        const messages = await Message.find({
            $or: [
                { 'from.id': userId, 'to.id': to },
                { 'from.id': to, 'to.id': userId }
            ]
        })
            .sort({ createdAt: 1 })
        // .populate('from.id')
        // .populate('to.id');

        updateMessageStatus(messages, userId)

        return res.status(200).json({
            success: true,
            message: 'Messages fetched successfully',
            data: messages
        });

    } catch (error) {
        console.error('Get Message Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal Server Error'
        });
    }
};

exports.sendChatRequest = async (req, res) => {
    try {

        console.log('User:', req.user);
        const type = req.user.type; // User or Expert
        let userId = null;
        let expertId = null;

        if (type == 'User') {
            userId = req.user.userId;
            expertId = req.params.expertId;
        }

        if (type == 'Expert') {
            userId = req.params.userId;
            expertId = req.user.userId;
        }

        console.log('User ID:', userId);
        console.log('Expert ID:', expertId);
        // 👤 Get user details
        const user = await User.findById(userId);
        if (!user) return errorHandler(res, 'User not found', 404);

        const expert = await Expert.findById(expertId);
        if (!expert) return errorHandler(res, 'Expert not found', 404);

        const chargePerMinute = expert.perMinuteCharge?.forChat || 5;
        const remainingMinutes = Math.floor(user.walletBalance / chargePerMinute);

        if (remainingMinutes < MINIMUM_REQUIRED_MINUTES) {
            return errorHandler(res, 'Insufficient balance.', 400);
        }

        const isBusy = await getRedis(`expert_busy:${expertId}`);

        if (isBusy === true) {
            // Step 2: Add user to queue if expert is busy
            const queueData = {
                userId,
                requestType: "chat"
            };

            await pushToRedisQueue(`expert_queue:${expertId}`, queueData);

            console.log(`👥 User ${userId} (request: chat added to expert ${expertId}'s queue.`);


            return res.status(200).json({
                success: true,
                message: 'Expert is currently busy. You have been added to the queue.'
            });
        }

        // ✅ Step 3: Expert is free, send request via socket
        const expertSocket = await getSocket(expertId);
        if (expertSocket && type === 'User') {
            expertSocket.emit('newChatRequest', {
                user: user,
            });
        }

        const userSocket = await getSocket(userId);
        if (userSocket && type === 'Expert') {
            userSocket.emit('newChatRequest', {
                expert: expert,
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Chat request sent successfully!'
        });

    } catch (error) {
        console.error('Send Chat Request Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal Server Error'
        });
    }
};

exports.acceptRequest = async (req, res) => {
    try {

        const type = req.user.type; // User or Expert
        let userId = null;
        let expertId = null;

        if (type == 'User') {
            userId = req.user.userId;
            expertId = req.params.expertId;
        }

        if (type == 'Expert') {
            userId = req.params.userId;
            expertId = req.user.userId;
        }

        // ✅ Get both users
        const user = await User.findById(userId);
        const expert = await Expert.findById(expertId);
        if (!user || !expert) return errorHandler(res, 'User or expert not found', 404);

        // 📌 Create chat session
        const chatSession = await ChatSession.create({
            userId: userId,
            expertId: expertId,
        });

        // 📡 Send event to user that chat has been accepted
        const userSocket = await getSocket(userId);
        if (userSocket && type === 'Expert') {
            userSocket.emit('chatRequestAccepted', {
                sessionId: chatSession._id,
                expert: {
                    _id: user._id,
                    name: user.name,
                    image: user.image,
                },
                user: {
                    _id: expert._id,
                    name: expert.name,
                    image: expert.image,
                },

            });
        }

        const expertSocket = await getSocket(expertId);
        if (expertSocket && type === 'User') {
            expertSocket.emit('chatRequestAccepted', {
                sessionId: chatSession._id,
                expert: {
                    _id: user._id,
                    name: user.name,
                    image: user.image,
                },
                user: {
                    _id: expert._id,
                    name: expert.name,
                    image: expert.image,
                },
            });
        }

        await startBilling(userId, expertId, chatSession._id);

        return res.status(200).json({
            success: true,
            message: 'Chat request accepted and session started!',
            data: chatSession
        });

    } catch (error) {
        console.error('Accept Chat Request Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal Server Error',
        });
    }
};

exports.startChatting = async (req, res) => {
    try {

        const type = req.user.type; // User or Expert
        let userId = null;
        let expertId = null;

        if (type == 'User') {
            userId = req.user.userId;
            expertId = req.params.expertId;
        }

        if (type == 'Expert') {
            userId = req.params.userId;
            expertId = req.user.userId;
        }

        // ✅ Get both users
        const user = await User.findById(userId);
        const expert = await Expert.findById(expertId);
        if (!user || !expert) return errorHandler(res, 'User or expert not found', 404);

        // 📌 Create chat session
        const chatSession = await ChatSession.create({
            userId: userId,
            expertId: expertId,
        });

        // 📡 Send event to user that chat has been accepted
        const expertSocket = await getSocket(expertId);
        if (expertSocket && type === 'User') {
            expertSocket.emit('chattingStarted', {
                sessionId: chatSession._id,
                expert: {
                    _id: user._id,
                    name: user.name,
                    image: user.image,
                },
                user: {
                    _id: expert._id,
                    name: expert.name,
                    image: expert.image,
                },
            });
        }

        const userSocket = await getSocket(userId);
        if (userSocket && type === 'Expert') {
            userSocket.emit('chattingStarted', {
                sessionId: chatSession._id,
                expert: {
                    _id: user._id,
                    name: user.name,
                    image: user.image,
                },
                user: {
                    _id: expert._id,
                    name: expert.name,
                    image: expert.image,
                },
            });
        }

        await startBilling(userId, expertId, chatSession._id);

        return res.status(200).json({
            success: true,
            message: 'Chat request accepted and session started!',
            data: chatSession
        });

    } catch (error) {
        console.error('Accept Chat Request Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal Server Error',
        });
    }
};


exports.endChatSession = async (req, res) => {
    try {
        const userId = req.user.userId;

        // 📌 Get the active chat session where user is either participant or expert
        const session = await ChatSession.findOne({
            $and: [
                {
                    $or: [
                        { userId: userId },
                        { expertId: userId }
                    ]
                },
                { status: "active" }
            ]
        });

        if (!session) return errorHandler(res, 'no active session', 404);

        // 🛑 Mark session as ended
        session.status = "ended";
        session.endTime = Date.now();
        await session.save();

        // 🔔 Notify both user and expert
        const userSocket = await getSocket(session.userId);
        const expertSocket = await getSocket(session.expertId);

        if (userSocket) {
            userSocket.emit('chatEnded', {
                reason: 'Session ended manually',
                sessionId: session._id
            });
        }

        if (expertSocket) {
            expertSocket.emit('chatEnded', {
                reason: 'Session ended manually',
                sessionId: session._id
            });
        }

        // 🧹 Redis cleanup
        await deleteRedis(`expert_busy:${session.expertId}`);
        await deleteRedis(`chat_session_start:${session._id}`);
        await deleteRedis(`chat_session_balance:${session._id}`);
        await deleteRedis(`expert_remaining_minutes:${session.expertId}`);


        global.croneJob[session._id] && global.croneJob[session._id].stop();
        delete global.croneJob[session._id];


        const expertId = session.expertId;
        const queuedUsers = await getAllFromRedisQueue(`expert_queue:${expertId}`);

        if (queuedUsers && queuedUsers.length > 0) {

            const userIdMap = new Map();
            const userIds = [];

            for (const user of queuedUsers) {
                if (user.userId) {
                    userIds.push(user.userId);
                    userIdMap.set(user.userId, user.requestType);
                }
            }

            // Step 2: Fetch all user details at once
            const usersFromDb = await User.find({ _id: { $in: userIds } });

            // Step 3: Map requestType back to each user
            const allUserDetails = usersFromDb.map(user => ({
                userDetails: user,
                requestType: userIdMap.get(user._id.toString())
            }));

            // Step 4: Send to expert
            const expertSocket = await getSocket(expertId);
            if (expertSocket) {
                console.log(`📩 Sending all users in queue to expert: ${expertId}`);
                expertSocket.emit('userRequests', {
                    users: allUserDetails,
                    message: 'All users currently in the queue',
                });
            }
        } else {
            console.log("📭 No users in queue.");
        }

        return res.status(200).json({
            success: true,
            message: "Session ended successfully."
        });

    } catch (error) {
        console.error('End Chat Session Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal Server Error',
        });
    }
};