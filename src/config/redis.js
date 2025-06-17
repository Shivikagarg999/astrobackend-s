const redisLib = require('redis');

const redis = redisLib.createClient({
    url: 'rediss://default:4bff1d68aa60487d8b3aa6cbaacce095@gusc1-quiet-pegasus-31879.upstash.io:31879'
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
