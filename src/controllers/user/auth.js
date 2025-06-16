const User = require("../../models/user/user");
const upload = require("../../utils/multer");
const { setRedis, getRedis } = require("../../utils/redis");
const { registerForm, profileEditForm } = require('../../validations/user/userValidation');
const logger = require('../../utils/logger');
const errorHandler = require('../../utils/errorHandler');
const otpGenerator = require('otp-generator');
const jwt = require('jsonwebtoken');

//send Otp
exports.sendOtp = async (req, res) => {
    try {
        const { phone } = req.body;

        if (!phone) return errorHandler(res, 'Phone number is required');

        const otp = otpGenerator.generate(4, {
            digits: true,
            upperCaseAlphabets: false,
            lowerCaseAlphabets: false,
            specialChars: false
        });

        // OTP data to store in Redis
        const otpData = {
            phone,
            otp,
            verified: false,
            createdAt: new Date()
        };

        await setRedis(phone, otpData, 600);
        return res.status(200).json({ success: true, phone: phone, otp: otp, message: 'OTP sent successfully' });

    } catch (err) {
        return errorHandler(res, err);
    }
};
//verify Otp
exports.verifyOtp = async (req, res) => {
    try {
        const { phone, otp } = req.body;

        if (!phone) return errorHandler(res, 'Phone number is required');
        if (!otp) return errorHandler(res, 'OTP is required');


        const otpData = await getRedis(phone);

        if (!otpData) return errorHandler(res, 'No OTP found or OTP has expired. Please request a new one.');

        if (otpData.phone !== phone) return errorHandler(res, 'Phone number mismatch.');

        const now = new Date();
        const elapsed = (now - new Date(otpData.createdAt)) / 1000; // in seconds

        // Check if OTP has expired (10 minutes)
        if (elapsed > 600) return errorHandler(res, 'OTP expired. Please request a new one.');

        // Validate OTP
        if (otpData.otp !== otp) return errorHandler(res, 'Invalid OTP.');

        // Mark OTP as verified
        otpData.verified = true;

        await setRedis(phone, otpData, 300);

        // Check if the user exists in the database
        const user = await User.findOne({ phone });



        let token = null;
        if (user) {
            user.fcm_token = req.body.fcm_token || null;
            await user.save();
            // Generate JWT token for the user
            token = jwt.sign(
                { userId: user._id, type: "User" },
                process.env.JWT_SECRET,
                { expiresIn: '1000d' }  // JWT expiration time
            );
        }

        return res.status(200).json({
            success: true,
            message: 'OTP verified successfully',
            user: user || null,
            isFirstTime: !user,  // If no user is found, this is their first time
            token: token || null,
        });

    } catch (err) {
        return errorHandler(res, err);
    }
}
//register 
exports.register = (req, res) => {
    const single = upload.single('image');

    single(req, res, async (err) => {
        try {
            // If file upload error occurs, use the error handler
            if (err) return errorHandler(res, err);

            // Validate user input
            const { error, value } = registerForm.validate(req.body);
            if (error) return errorHandler(res, error);

            // ✅ Check OTP session
            const otpData = await getRedis(value.phone);

            if (!otpData || otpData.phone != value.phone || otpData.verified != true) return errorHandler(res, 'Phone number is not verified.', 403);

            const existingUser = await User.findOne({ phone: value.phone });
            if (existingUser) return errorHandler(res, 'User with this phone number already exists.', 409);
            // Set image path if file exists
            const image = req.file
                ? `/uploads/${req.body.folder || 'user'}/${req.file.filename}`
                : null;

            const userData = {
                ...value,
                image,
            };

            // Create the user
            const user = await User.create(userData);
            const token = jwt.sign(
                { userId: user._id, "type": "User" },
                process.env.JWT_SECRET,
                { expiresIn: '1000d' }
            );
            return res.status(201).json({
                success: true,
                message: 'User registered successfully',
                user,
                token: token
            });

        } catch (err) {
            return errorHandler(res, err);
        }
    });
};

// Get Profile
exports.getProfile = async (req, res) => {
    try {
        const userId = req.user?.userId; // userId should come from JWT token payload

        if (!userId) {
            return errorHandler(res, 'Unauthorized', 401);
        }

        const user = await User.findById(userId);
        if (!user) {
            return errorHandler(res, 'User not found', 404);
        }

        // Send profile to frontend
        return res.status(200).json({
            success: true,
            message: 'Profile fetched successfully',
            user
        });

    } catch (err) {
        return errorHandler(res, err);
    }
};

//editProfile
exports.editProfile = (req, res) => {
    const single = upload.single('image');

    single(req, res, async (err) => {
        try {
            if (err) return errorHandler(res, err);

            const userId = req.user?.userId;
            if (!userId) {
                return errorHandler(res, 'Unauthorized', 401);
            }

            const { error, value } = profileEditForm.validate(req.body);
            if (error) return errorHandler(res, error);

            const user = await User.findById(userId);
            if (!user) return errorHandler(res, 'User not found', 404);

            // Set image if uploaded
            const image = req.file
                ? `/uploads/${req.body.folder || 'user'}/${req.file.filename}`
                : user.image;

            const updatedData = {
                ...value,
                image
            };

            const updatedUser = await User.findByIdAndUpdate(userId, updatedData, {
                new: true
            });

            return res.status(200).json({
                success: true,
                message: 'Profile updated successfully',
                user: updatedUser
            });

        } catch (err) {
            return errorHandler(res, err);
        }
    });
};


