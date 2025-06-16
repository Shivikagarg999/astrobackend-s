const cron = require('node-cron');
const Expert = require('../../models/expert/expert');
const User = require('../../models/user/user');
const Call = require('../../models/call/call');
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


exports.startBilling = async (call) => {

    const callId = call._id;

    // Get expertId
    const expertId = call.caller.type === "Expert"
        ? call.caller.id._id
        : call.receiver.type === "Expert"
            ? call.receiver.id._id
            : null;

    // Get userId
    const userId = call.caller.type === "User"
        ? call.caller.id._id
        : call.receiver.type === "User"
            ? call.receiver.id._id
            : null;

    const expert = await Expert.findById(expertId);

    if (!expert) {
        console.log("❌ Expert not found before starting cron.");
        return;
    }

    const userSocket = await getSocket(userId);
    const expertSocket = await getSocket(expertId);


    console.log('🚀 Chat billing started for call session:', callId);

    const user = await User.findById(userId);
    if (!user) {
        console.log("❌ User not found before starting cron.");
        return;
    }

    const callChargePerMinute = expert.perMinuteCharge?.forCall;
    const videoCallChargePerMinute = expert.perMinuteCharge?.forVideoCall;
    const chargePerMinute = call.callType === "video" ? videoCallChargePerMinute : callChargePerMinute;


    let remainingMinutes = getRemainingMinutes(user.walletBalance, chargePerMinute);


    if (remainingMinutes == 0) {
        await endChatDueToLowBalance(userSocket, expertSocket, expertId, callId);
        return;
    }

    // Set initial Redis values
    await setRedis(`expert_busy:${expertId}`, "true");
    await setRedis(`chat_session_start:${callId}`, Date.now().toString());
    await setRedis(`chat_session_balance:${callId}`, user.walletBalance.toString());
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
            await endChatDueToLowBalance(userSocket, expertSocket, expertId, callId);
            delete global.croneJob[callId];
            job.stop();
            return;
        }

        // Deduct balance
        user.walletBalance -= chargePerMinute;
        await user.save();

        const remainingMinutes = getRemainingMinutes(user.walletBalance, chargePerMinute);

        // Update Redis
        await setRedis(`chat_session_balance:${callId}`, user.walletBalance.toString());
        await setRedis(`expert_remaining_minutes:${expertId}`, remainingMinutes.toString());

        // Show info
        console.log(`💸 ₹${chargePerMinute} deducted`);
        console.log(`💰 New Wallet: ₹${user.walletBalance}`);
        console.log(`⏳ Remaining minutes: ${remainingMinutes}`);

        // If balance became zero after deduction, end immediately
        if (remainingMinutes == 0) {
            await endChatDueToLowBalance(userSocket, expertSocket, expertId, callId);
            delete global.croneJob[callId];
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


    global.croneJob[callId] = job;
};

// Helper function: end chat properly
const endChatDueToLowBalance = async (userSocket, expertSocket, expertId, callId) => {
    console.log("❌ Chat ended due to low balance or user not found.");

    if (userSocket) {
        userSocket.emit('endCall', {
            message: 'Low wallet balance',
            sessionId: callId
        });
    }

    if (expertSocket) {
        expertSocket.emit('endCall', {
            message: 'User has insufficient balance',
            sessionId: callId
        });
    }

    // Delete Redis keys
    await deleteRedis(`expert_busy:${expertId}`);
    await deleteRedis(`chat_session_start:${callId}`);
    await deleteRedis(`chat_session_balance:${callId}`);
    await deleteRedis(`expert_remaining_minutes:${expertId}`);

    const call = await Call.findById(callId);
    if (!call) {
        throw new Error('Call not found');
    }

    const startTime = new Date(call.startedAt);
    const endTime = new Date();

    const durationInSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

    await Call.findByIdAndUpdate(
        callId,
        {
            status: "ended",
            endedAt: endTime,
            duration: durationInSeconds,
        },
        { new: true }
    );


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


