const { redis } = require('../config/redis');



exports.setRedis = async (key, value, expiration = null) => {
    try {
        const stringified = typeof value === 'string' ? value : JSON.stringify(value);

        if (expiration !== null) {
            await redis.setEx(key, expiration, stringified);
        } else {
            await redis.set(key, stringified);
        }
    } catch (err) {
        console.error('Error setting value in Redis:', err);
    }
};


exports.getRedis = async (key) => {
    try {
        const data = await redis.get(key);
        try {
            return JSON.parse(data);
        } catch {
            return data;
        }
    } catch (err) {
        console.error('Error getting value from Redis:', err);
        return null;
    }
};


// Utility to delete Redis key
exports.deleteRedis = async (key) => {
    try {
        await redis.del(key);
        console.log(`Deleted Redis key: ${key}`);
    } catch (err) {
        console.error('Redis DELETE Error:', err);
    }
};


exports.getAllFromRedisQueue = async (queueKey) => {
    const values = await redis.lRange(queueKey, 0, -1);
    if (!values || values.length === 0) return [];

    return values.map(value => {
        try {
            return JSON.parse(value);
        } catch (err) {
            return value; // If not JSON, return as-is
        }
    });
};


exports.pushToRedisQueue = async (key, value) => {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);

    // Check if userId already exists in queue
    const existingQueue = await exports.getAllFromRedisQueue(key);
    const isDuplicate = existingQueue.some(item => item.userId === value.userId);

    if (!isDuplicate) {
        await redis.rPush(key, stringValue);
    } else {
        console.log(`🚫 User ${value.userId} already exists in queue for ${key}`);
    }
};


exports.popFromRedisQueue = async (queueKey) => {
    const value = await redis.lPop(queueKey);
    if (!value) return null;

    try {
        return JSON.parse(value);
    } catch (err) {
        return value; // If not JSON, return as-is
    }
};




exports.flush = async () => {
    try {
        await redis.flushAll();  // This is the correct way to call `flushAll` in node-redis v4.x.x
        console.log('Redis flushed successfully.');
    } catch (err) {
        console.error('Error while flushing Redis:', err);
    }
};

