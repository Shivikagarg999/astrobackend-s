const Expert = require("../../models/expert/expert");
const errorHandler = require('../../utils/errorHandler');

// allExperts
exports.data = async (req, res) => {
    try {

        return res.status(200).json({
            message: 'data fetched successfully',
        });

    } catch (err) {
        return errorHandler(res, err);
    }
};
