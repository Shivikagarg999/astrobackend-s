const cron = require('node-cron');
const Expert = require('../../models/expert/expert');
const User = require('../../models/user/user');
const ChatSession = require('../../models/chat/chatSession');
const { LOW_BALANCE_ALERT_MINUTES } = require('../../constants/constants');
const { getSocket } = require('../../sockets/socketStore');
const { setRedis, deleteRedis, popFromRedisQueue } = require('../../utils/redis');


function getTime() {
    const now = new Date();
    const date = now.toLocaleDateString('en-GB'); // DD/MM/YYYY
    const time = now.toLocaleTimeString('en-GB'); // HH:MM:SS
    return `${date.replace(/\//g, '-')} ${time}`;
}

function getRemainingMinutes(walletBalance, chargePerMinute) {
    if (!chargePerMinute || chargePerMinute <= 0) return 0;
    return Math.floor(walletBalance / chargePerMinute);
}


exports.startBilling = async (userId, expertId, chatSessionId) => {
    const expert = await Expert.findById(expertId);
    const chargePerMinute = expert.perMinuteCharge?.forChat;

    const userSocket = await getSocket(userId);
    const expertSocket = await getSocket(expertId);

    console.log('🚀 Chat billing started for session:', chatSessionId);

    const user = await User.findById(userId);
    if (!user) {
        console.log("❌ User not found before starting cron.");
        return;
    }

    let remainingMinutes = getRemainingMinutes(user.walletBalance, chargePerMinute);


    if (remainingMinutes == 0) {
        await endChatDueToLowBalance(userSocket, expertSocket, expertId, chatSessionId);
        return;
    }

    // Set initial Redis values
    await setRedis(`expert_busy:${expertId}`, "true");
    await setRedis(`chat_session_start:${chatSessionId}`, Date.now().toString());
    await setRedis(`chat_session_balance:${chatSessionId}`, user.walletBalance.toString());
    await setRedis(`expert_remaining_minutes:${expertId}`, remainingMinutes.toString());

    console.log("🕒 Current Time:", getTime());
    console.log(`⏳ Initial chat minutes: ${remainingMinutes}`);
    console.log(`💰 Wallet: ₹${user.walletBalance}`);

    // Start cron
    const job = cron.schedule('* * * * *', async () => {
        const user = await User.findById(userId);
        console.log("\n---------------------");
        console.log("🕒 Current Time:", getTime());
        console.log("🕒 user balance:", user?.walletBalance);

        if (!user || user.walletBalance < chargePerMinute || user.walletBalance <= 0) {
            await endChatDueToLowBalance(userSocket, expertSocket, expertId, chatSessionId);
            delete global.croneJob[chatSessionId];
            job.stop();
            return;
        }

        // Deduct balance
        user.walletBalance -= chargePerMinute;
        await user.save();

        const remainingMinutes = getRemainingMinutes(user.walletBalance, chargePerMinute);

        // Update Redis
        await setRedis(`chat_session_balance:${chatSessionId}`, user.walletBalance.toString());
        await setRedis(`expert_remaining_minutes:${expertId}`, remainingMinutes.toString());

        // Show info
        console.log(`💸 ₹${chargePerMinute} deducted`);
        console.log(`💰 New Wallet: ₹${user.walletBalance}`);
        console.log(`⏳ Remaining minutes: ${remainingMinutes}`);

        // If balance became zero after deduction, end immediately
        if (remainingMinutes == 0) {
            await endChatDueToLowBalance(userSocket, expertSocket, expertId, chatSessionId);
            delete global.croneJob[chatSessionId];
            job.stop();
            return;
        }

        // Alert if low balance
        if (remainingMinutes <= LOW_BALANCE_ALERT_MINUTES) {
            console.log(`⚠️ Low Balance Alert! Only ${remainingMinutes} minutes left.`);
            if (userSocket) {
                userSocket.emit('lowBalanceAlert', {
                    message: `Low Balance Alert! Only ${remainingMinutes} minutes left.`,
                    remainingMinutes
                });
            }
        }
    });


    global.croneJob[chatSessionId] = job;
};

// Helper function: end chat properly
const endChatDueToLowBalance = async (userSocket, expertSocket, expertId, chatSessionId) => {
    console.log("❌ Chat ended due to low balance or user not found.");

    if (userSocket) {
        userSocket.emit('chatEnded', {
            reason: 'Low wallet balance',
            sessionId: chatSessionId
        });
    }

    if (expertSocket) {
        expertSocket.emit('chatEnded', {
            reason: 'User has insufficient balance',
            sessionId: chatSessionId
        });
    }

    // Delete Redis keys
    await deleteRedis(`expert_busy:${expertId}`);
    await deleteRedis(`chat_session_start:${chatSessionId}`);
    await deleteRedis(`chat_session_balance:${chatSessionId}`);
    await deleteRedis(`expert_remaining_minutes:${expertId}`);

    // Mark chat session as ended
    await ChatSession.findByIdAndUpdate(chatSessionId, { status: "ended", endTime: Date.now() });

    const nextUser = await popFromRedisQueue(`expert_queue:${expertId}`);
    if (nextUser) {

        const nextuserId = nextUser.userId;
        const requestType = nextUser.requestType;
        const nextUserSocket = await getSocket(nextuserId);
        if (nextUserSocket) {

            console.log(`📩 Notifying next user in queue: ${nextuserId}`);

            nextUserSocket.emit('yourTurn', {
                expertId,
                message: `It's your turn to ${requestType} with the expert!`,
                requestType: requestType,
            });

        }
    } else {
        console.log("📭 No users in queue.");
    }
};


