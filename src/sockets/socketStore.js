const { setRedis, getRedis, deleteRedis } = require('../utils/redis');
const { redis } = require('../config/redis')

// Store socket instance
let io = null;

// Prefix to avoid key conflicts
const ONLINE_USER_PREFIX = 'online_user:';

// Set and get socket instance
exports.setSocketio = (ioInstance) => {
    io = ioInstance;
};

exports.getSocketio = () => io;

// Add an online user (no expiry)
exports.addOnlineUser = async (userId, socketId) => {

    await setRedis(`${ONLINE_USER_PREFIX}${userId}`, socketId);
};

// Remove an online user
exports.removeOnlineUser = async (userId) => {
    await deleteRedis(`${ONLINE_USER_PREFIX}${userId}`);
};

// Get the socket ID of an online user
exports.getOnlineUserSocketId = async (userId) => {
    return await getRedis(`${ONLINE_USER_PREFIX}${userId}`);
};

// socketStore.js

exports.getAllOnlineUsers = async () => {
    const keys = await redis.keys(`${ONLINE_USER_PREFIX}*`);
    const userIds = keys.map(key => key.replace(ONLINE_USER_PREFIX, ''));

    const confirmedOnlineUsers = [];

    for (const userId of userIds) {
        const socketId = await getRedis(`${ONLINE_USER_PREFIX}${userId}`);
        const socket = io?.sockets?.sockets?.get(socketId);
        if (socket) {
            confirmedOnlineUsers.push(userId);
        } else {
            // Clean up stale Redis entry
            await exports.removeOnlineUser(userId);
        }
    }
    return confirmedOnlineUsers;
};


// Get socketId by userId
exports.getSocketId = async (userId) => {
    return await getRedis(`${ONLINE_USER_PREFIX}${userId}`);
};

// Get userId from socketId
exports.getUserIdFromSocketId = async (socketId) => {
    const keys = await redis.keys(`${ONLINE_USER_PREFIX}*`);

    for (let key of keys) {
        const storedSocketId = await getRedis(key);
        if (storedSocketId === socketId) {
            return key.replace(ONLINE_USER_PREFIX, '');
        }
    }
    return null;
};

// Get the socket object by userId
exports.getSocket = async (userId) => {
    const socketId = await exports.getSocketId(userId);
    const socket = io?.sockets?.sockets?.get(socketId);
    return socket;
};

