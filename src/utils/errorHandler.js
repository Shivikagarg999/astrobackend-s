module.exports = (res, error, status = 400) => {
    // If error is a string, wrap it in an Error object
    if (typeof error === 'string') {
        error = new Error(error);
    }

    console.error(`Error occurred: ${error.message}`);

    return res.status(status).json({
        success: false,
        message: error.message
    });
};
