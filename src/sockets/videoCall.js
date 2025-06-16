module.exports = (io, socket, userId) => {
    socket.on('start_video_call', (data) => {
        io.to(data.receiverId).emit('incoming_video_call', { from: userId, ...data });
    });

    socket.on('end_video_call', (data) => {
        io.to(data.receiverId).emit('video_call_ended', { from: userId });
    });
};
