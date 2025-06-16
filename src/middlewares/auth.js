const jwt = require("jsonwebtoken");
const jwtSecret = process.env.JWT_SECRET;
const errorHandler = require('../utils/errorHandler');

const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) return errorHandler(res, 'No token provided', 401);

    try {
        const decoded = jwt.verify(token, jwtSecret);

        if (!decoded.userId) return errorHandler(res, 'Unauthorized', 401);

        req.user = decoded;

        req.user = { userId: decoded.userId, type: decoded.type };

        //req.user = { userId: "6801edf8b8f241b4844974a9" } //expert akhil 
        //  req.user = { userId: "6801ead13029e270050c7323" } //user anil

        next();
    } catch (err) {
        console.error("Authentication error:", err);
        return res.status(403).json({ success: false, msg: "Invalid token" });
    }
};

module.exports = authenticateToken;
