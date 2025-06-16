const multer = require('multer');
const path = require('path');
const errorHandler = require('../utils/errorHandler'); // Import the error handler


const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const folder = req.folder;

        // Check if the folder is valid
        if (!folder) {
            return errorHandler(req.res, 'Invalid or missing folder name');
        }

        const uploadPath = path.join(__dirname, `../..//public/uploads/${folder}`);
        cb(null, uploadPath);
    },

    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, uniqueName + ext);
    }
});


const upload = multer({ storage });

module.exports = upload;
