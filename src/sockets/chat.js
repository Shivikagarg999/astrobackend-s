const { getSocketio, getSocket } = require('../sockets/socketStore');

module.exports = (userId) => {

    const io = getSocketio();

    // socket.on('send_message', (data) => {
    //     console.log(`💬 Message from ${userId}:`, data);
    //     io.emit('receive_message', { userId, ...data });
    // });

    // socket.on('typing', () => {
    //     socket.broadcast.emit('user_typing', userId);
    // });

    // socket.on('stop_typing', () => {
    //     socket.broadcast.emit('user_stop_typing', userId);
    // });
};
