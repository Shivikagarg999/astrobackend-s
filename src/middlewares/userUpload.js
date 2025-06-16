
module.exports = (req, res, next) => {
    req.folder = 'user';
    next();
};