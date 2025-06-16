const http = require('http');
const os = require('os');
const app = require('./src/app');
const connectDB = require('./src/config/db');
// const { connectRedis } = require('./src/config/redis');
const connectSocket = require('./src/config/socket');


const server = http.createServer(app);
connectSocket(server);
connectDB();
// connectRedis();


const port = 3000;

server.listen(port, () => {
    const networkInterfaces = os.networkInterfaces();
    const localIp = Object.values(networkInterfaces)
        .flat()
        .filter((details) => details.family === "IPv4" && !details.internal)
        .map((details) => details.address)[0];
    console.log('✅ Backend running');
});