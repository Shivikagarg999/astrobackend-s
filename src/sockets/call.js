const call = require('../controllers/call/call')
const { getSocket, getUserIdFromSocketId } = require('../sockets/socketStore');

module.exports = (io, socket) => {

    socket.on("callUser", async (data) => {
        try {
            console.log('Call request', data);
            await call.callUser(data);
        } catch (error) {
            console.error('Error handling call request:', error);
            socket.emit('error', 'An error occurred while initiating the call.');
        }
    });

    // Handle offer
    socket.on("offer", async ({ offer, to }) => {

        const toSocket = await getSocket(to);
        console.log('offer received', to);
        // console.log('==============================================================================================================');
        // console.log('offer', offer);
        const from = await getUserIdFromSocketId(socket.id);

        if (toSocket) {
            toSocket.emit("offer", { offer, from: from });
        } else {
            console.log('User not found for socketId:', to);
        }
    });

    // Handle answer
    socket.on("answer", async ({ answer, to }) => {
        console.log('answer received', to);
        // console.log('==============================================================================================================');
        // console.log('answer', answer);
        const toSocket = await getSocket(to);
        if (toSocket) {
            toSocket.emit("answer", { answer });
        }
    });


    // Handle candidate
    socket.on("candidate", async ({ candidate, to }) => {
        console.log('candidate received', to);
        // console.log('==============================================================================================================');
        // console.log('candidate', candidate);
        const toSocket = await getSocket(to);
        if (toSocket) {
            toSocket.emit("candidate", { candidate });
        }
    });

    // Handle accept call
    socket.on("acceptCall", async ({ to, callId }) => {

        console.log('acceptCall received', to);
        // console.log('==============================================================================================================');
        // console.log(`Call accepted by ${socket.id} for ${to}`);
        // console.log(`Call id  ${callId}`);
        await call.initiateCall(callId);
        const from = await getUserIdFromSocketId(socket.id);
        const toSocket = await getSocket(to);
        const fromSocket = await getSocket(from);
        if (toSocket) {
            toSocket.emit("acceptCall", { callId });
            fromSocket.emit("acceptCall", { callId });
        }
    });

    // Handle reject call
    socket.on("rejectCall", async ({ to, callId }) => {
        try {
            console.log(`Call rejected by ${socket.id} for ${to}`);
            console.log(`Call id  ${callId}`);
            const toSocket = await getSocket(to);
            await call.updateCallStatus(callId, 'missed');
            toSocket.emit("rejectCall", { message: "The call was rejected." });
        } catch (error) {
            console.error('Error handling reject call:', error);
            io.to(socket.id).emit("error", { message: "An error occurred while rejecting the call." });
        }
    });

    // Handle end call
    socket.on("endCall", async ({ to, callId }) => {
        try {

            const from = await getUserIdFromSocketId(socket.id);
            const fromSocket = await getSocket(from);
            const toSocket = await getSocket(to);

            if (!fromSocket) {
                console.error(`Socket not found for 'from' user ID: ${from}`);
            }

            if (!toSocket) {
                console.error(`Socket not found for 'to' user ID: ${to}`);
            }

            if (fromSocket) {
                fromSocket.emit("endCall", { message: "The call has ended." });
            }

            if (toSocket) {
                toSocket.emit("endCall", { message: "The call has ended." });
            }

            await call.updateCallStatus(callId, 'ended');
        } catch (error) {
            console.error('Error handling end call:', error);
            socket.emit('error', 'An error occurred while ending the call.');
        }
    });



};
