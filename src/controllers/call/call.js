const Call = require("../../models/call/call");
const User = require("../../models/user/user");
const Expert = require("../../models/expert/expert");
const errorHandler = require('../../utils/errorHandler');
const { startBilling } = require('./billing');
const { getSocket } = require('../../sockets/socketStore');
const { getRedis, setRedis, deleteRedis, pushToRedisQueue, popFromRedisQueue, getAllFromRedisQueue, flush } = require("../../utils/redis");
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');


const firebaseKeyPath = path.join(__dirname, "../../../public/js/notification.json");

if (!fs.existsSync(firebaseKeyPath)) {
  throw new Error("Firebase service account key is missing! Please add the JSON key file.");
}

admin.initializeApp({
  credential: admin.credential.cert(firebaseKeyPath),
});


const sendNotification = async (callerInfo, fcm_token) => {
  console.log("reached here", new Date().toLocaleTimeString());

  console.log("fcm_token=====", fcm_token)
  // Check if fcm_token is valid

  const deviceToken = fcm_token;

  // Notification content
  const notificationTitle = 'incomming call';
  const notificationBody = `A new call is coming in!`;


  // Message structure
  const message = {
    token: deviceToken,
    notification: {
      title: 'Incoming Call',
      body: 'You have a new call!',
    },
    data: {
      callerInfo: JSON.stringify(callerInfo),
    },
  };


  console.log('Sending message:', message);

  try {
    // Sending the message through Firebase Admin SDK
    const response = await admin.messaging().send(message);
    console.log('Successfully sent message:', response);
  } catch (error) {
    // Enhanced error handling
    console.error('Error while sending message:', error.code, error.message);
    if (error.code === 'messaging/invalid-registration-token') {
      console.error('The provided registration token is invalid. Please update the token.');
    } else if (error.code === 'messaging/third-party-auth-error') {
      console.error('Authentication error with FCM.');
    } else {
      console.error('An unexpected error occurred:', error);
    }
  }
};


exports.callUser = async (data) => {
  try {


    // sendNotification()
    // return;

    // flush();
    // return;

    const { callerId, receiverId, callerType, receiverType, callType } = data;

    const receiverSocket = await getSocket(receiverId);
    const callerSocket = await getSocket(callerId);

    // Final condition check to ensure all fields are valid
    if (!callerId || !receiverId || !callerType || !receiverType || !callType) {
      console.log('Invalid data:', { callerId, receiverId, callerType, receiverType, callType });
      return { error: 'Invalid data' };
    } else {
      console.log('All required data fields are valid.');
    }

    // Check if the caller and receiver are different
    let userId = null;
    let expertId = null;

    if (callerType == "User") {
      userId = callerId;
      expertId = receiverId;
    }

    if (callerType == "Expert") {
      userId = receiverId;
      expertId = callerId;
    }

    // Fetch caller information based on callerType
    let callerData;
    let receiverData;

    if (callerType === 'User') {
      callerData = await User.findById(callerId);
      const isBusy = await getRedis(`expert_busy:${expertId}`);
      //const isBusy = true;
      console.log("Is Expert Busy:", isBusy);
      if (isBusy === true) {
        const queueData = {
          userId: callerId,
          requestType: callType
        };
        await pushToRedisQueue(`expert_queue:${expertId}`, queueData);
        callerSocket.emit('queueNotification', {
          message: 'You have been added to the queue. Please wait for your turn.',
        });
        return;
      }

      receiverData = await Expert.findById(receiverId);

    } else if (callerType === 'Expert') {
      callerData = await Expert.findById(callerId);
      receiverData = await User.findById(receiverId);
    }

    console.log("Caller Data:", callerData);
    // If caller data not found, return an error
    if (!callerData) {
      return { error: 'Caller data not found' };
    }

    // Create a new call record
    const newCall = new Call({
      caller: { id: callerId, type: callerType },
      receiver: { id: receiverId, type: receiverType },
      callType,
      status: 'started',
    });

    await newCall.save();

    let populatedCall;

    try {
      // Populate caller and receiver
      populatedCall = await Call.findById(newCall._id)
        .populate('caller.id')
        .populate('receiver.id');
    } catch (error) {
      console.error('Error populating caller and receiver:', error);
      // You can also return an error response if in an API route
      // return res.status(500).json({ message: 'Internal Server Error' });
    }

    const callerInfo = {
      callType,
      name: populatedCall.caller.id.name,
      phone: populatedCall.caller.id.phone,
      image: populatedCall.caller.id.image,
      callId: populatedCall._id,
      callerId: populatedCall.caller.id._id,
      receiverId: populatedCall.receiver.id._id,
      callerType: populatedCall.caller.type,
      receiverType: populatedCall.receiver.type,
      callingIn: "oneToOne",
    };


    if (receiverSocket && callerSocket) {
      receiverSocket.emit('incomingCall', callerInfo);
      callerSocket.emit('callId', callerInfo);
    } else {
      return { error: 'Receiver is not online' };
    }

    if (receiverData.fcm_token) {
      sendNotification(callerInfo, receiverData.fcm_token);
    }

  } catch (error) {
    console.error('Error initiating call:', error);
    return { error: 'Failed to initiate the call.' };
  }
};


exports.initiateCall = async (callId) => {
  try {

    const call = await Call.findById(callId).populate('caller.id')
      .populate('receiver.id');

    if (!call) {
      return { error: 'Call not found' };
    }
    // Update call status
    call.startedAt = new Date();
    call.status = "ongoing";

    await call.save();

    await startBilling(call);

    return { message: 'Call status updated successfully!' };
  } catch (error) {
    console.error('Error updating call status:', error);
    return { error: 'Failed to update the call status.' };
  }
};


exports.updateCallStatus = async (callId, status) => {
  try {
    const call = await Call.findById(callId);

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



    if (!call) {
      return { error: 'Call not found' };
    }

    // Update call status
    call.status = status;

    // If the status is 'ended', calculate the call duration
    if (status === 'ended') {
      const endTime = new Date();
      const startTime = new Date(call.createdAt); // The call's start time (createdAt is the time when the call was initiated)

      // Calculate the duration in seconds
      const duration = Math.floor((endTime - startTime) / 1000); // Duration in seconds

      call.duration = duration;  // Set the calculated duration
      call.endedAt = endTime;  // Store the actual end time

    }


    await call.save();


    // // Update Redis keys


    // Delete Redis keys
    await deleteRedis(`expert_busy:${expertId}`);
    await deleteRedis(`chat_session_start:${callId}`);
    await deleteRedis(`chat_session_balance:${callId}`);
    await deleteRedis(`expert_remaining_minutes:${expertId}`);


    console.log("Deleting Redis keys for callId:", callId);
    global.croneJob[callId] && global.croneJob[callId].stop();
    delete global.croneJob[callId];

    // If the status is 'ended', remove the call from the Redis queue
    const queuedUsers = await getAllFromRedisQueue(`expert_queue:${expertId}`);

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

    popFromRedisQueue(`expert_queue:${expertId}`);

    return { message: 'Call status updated successfully!' };
  } catch (error) {
    console.error('Error updating call status:', error);
    return { error: 'Failed to update the call status.' };
  }
};



exports.onlineUsers = async (callId, status) => {
  try {


    const call = await Call.findById(callId);

    if (!call) {
      return { error: 'Call not found' };
    }

    // Update call status
    call.status = status;

    // If the status is 'ended', calculate the call duration
    if (status === 'ended') {
      const endTime = new Date();
      const startTime = new Date(call.createdAt); // The call's start time (createdAt is the time when the call was initiated)

      // Calculate the duration in seconds
      const duration = Math.floor((endTime - startTime) / 1000); // Duration in seconds

      call.duration = duration;  // Set the calculated duration
      call.endedAt = endTime;  // Store the actual end time
    }

    await call.save();

    return { message: 'Call status updated successfully!' };
  } catch (error) {
    console.error('Error updating call status:', error);
    return { error: 'Failed to update the call status.' };
  }
};





