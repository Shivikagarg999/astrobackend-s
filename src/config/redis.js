const redisLib = require('redis');

const redis = redisLib.createClient({
    url: 'redis://localhost:6379'
});

let isConnected = false;

const connectRedis = async () => {
    if (!isConnected) {
        try {
            await redis.connect();
            isConnected = true;
            console.log('✅ Redis connected!');
        } catch (err) {
            console.error('❌ Redis connection error:', err);
        }
    }
};

module.exports = { redis, connectRedis };
