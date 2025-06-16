const User = require("../../models/user/user");
const Recharge = require("../../models/user/recharge");
const errorHandler = require('../../utils/errorHandler');
const ChatSession = require('../../models/chat/chatSession');
const Expert = require('../../models/expert/expert');
const { setRedis } = require('../../utils/redis');

// ✅ Recharge Add Karne Ka Function
exports.recharge = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { amount, paymentMethod, transactionId } = req.body;

        if (!userId || !amount || !paymentMethod) {
            return errorHandler(res, 'Missing required fields', 404);
        }

        // Step 1: Recharge create
        const recharge = await Recharge.create({
            userId,
            amount,
            paymentMethod,
            transactionId,
            status: 'success',
        });

        // Step 2: Wallet balance update
        const user = await User.findByIdAndUpdate(
            userId,
            { $inc: { walletBalance: amount } },
            { new: true }
        );

        // Step 3: Check for active chat session
        console.log(userId)
        const chatSession = await ChatSession.findOne({ userId: userId, status: "active" });
        console.log('chatSession', chatSession);
        if (chatSession) {
            const expertId = chatSession.expertId;

            // Fetch expert to get perMinuteCharge
            const expert = await Expert.findById(expertId);
            const chargePerMinute = expert?.perMinuteCharge?.forChat;

            const remainingMinutes = Math.floor(user.walletBalance / chargePerMinute);

            // Step 4: Update Redis values
            await setRedis(`expert_busy:${expertId}`, "true");
            await setRedis(`chat_session_start:${chatSession._id}`, Date.now().toString());
            await setRedis(`chat_session_balance:${chatSession._id}`, user.walletBalance.toString());
            await setRedis(`expert_remaining_minutes:${expertId}`, remainingMinutes.toString());

            console.log(`✅ Redis updated for expert ${expertId} on recharge.`);
        }

        return res.status(201).json({
            message: 'Recharge successful',
            recharge
        });

    } catch (err) {
        return errorHandler(res, err);
    }
};

// ✅ Recharge History Laane Ka Function
exports.paymentHistory = async (req, res) => {
    try {

        const userId = req.user.userId

        if (!userId) {
            return res.status(400).json({ message: 'User ID is required' });
        }

        const history = await Recharge.find({ userId }).sort({ createdAt: -1 });

        return res.status(200).json({
            message: 'Recharge history fetched',
            history
        });
    } catch (err) {
        return errorHandler(res, err);
    }
};
