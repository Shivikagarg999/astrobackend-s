
module.exports = (req, res, next) => {
    req.folder = 'chatMedia';
    next();
};