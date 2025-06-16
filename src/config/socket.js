const { Server } = require('socket.io');
const chatSocket = require('../sockets/chat');
const callSocket = require('../sockets/call');
const videoCallSocket = require('../sockets/videoCall');
const { setSocketio, addOnlineUser, removeOnlineUser, getUserIdFromSocketId, getAllOnlineUsers } = require('../sockets/socketStore');

const connectSocket = (server) => {
    const io = new Server(server, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST']
        }
    });

    setSocketio(io);

    io.on('connection', (socket) => {
        console.log(`✅ User connected: ${socket.id}`);

        socket.on('addUser', async (userId) => {
            console.log('🔗 New user added: ', userId, socket.id);

            if (userId) await addOnlineUser(userId, socket.id);

            const onlineUsers = await getAllOnlineUsers();

            socket.emit('onlineUsers', onlineUsers)

            console.log('👥 Online users:', onlineUsers);
        });

        socket.on('disconnect', async () => {
            const userId = await getUserIdFromSocketId(socket.id);
            if (userId) {
                await removeOnlineUser(userId);
                console.log(`❌ User disconnected: ${userId}`);
            }
        });

        // You can call these once userId is available (after 'addUser' event)
        // chatSocket(io, socket);
        callSocket(io, socket);
        // videoCallSocket(io, socket);
    });

    return io;
};

module.exports = connectSocket;