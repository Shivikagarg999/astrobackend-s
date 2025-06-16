
module.exports = (req, res, next) => {
    req.folder = 'expert';
    next();
};