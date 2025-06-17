const Expert = require("../../models/expert/expert");
const upload = require("../../utils/multer");
const { registerForm, profileEditForm } = require('../../validations/expert/expertValidation');
const logger = require('../../utils/logger');
const { setRedis, getRedis } = require("../../utils/redis");
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
    const { phone, otp } = req.body;

    const otpData = await getRedis(phone);

    if (!phone) return errorHandler(res, 'Phone number is required');
    if (!otp) return errorHandler(res, 'OTP is required');
    if (!otpData) return errorHandler(res, 'No OTP found. Please request a new one.');

    if (otpData.phone !== phone) return errorHandler(res, 'Phone number mismatch.');

    const now = new Date();
    const elapsed = (now - new Date(otpData.createdAt)) / 1000; // in seconds
    if (elapsed > 600) return errorHandler(res, 'OTP expired. Please request a new one.');

    if (otpData.otp !== otp) return errorHandler(res, 'Invalid OTP.');

    otpData.verified = true;
    otpData.fcm_token = req.body.fcm_token || null;
    await setRedis(phone, otpData, 600);

    const user = await Expert.findOne({ phone });

    let token = null;
    if (user) {
        user.fcm_token = req.body.fcm_token || null;
        await user.save();
        token = jwt.sign(
            { userId: user._id, type: "Expert" },
            process.env.JWT_SECRET,
            { expiresIn: '1000d' }
        );
    }

    return res.status(200).json({
        success: true,
        message: 'OTP verified successfully',
        user: user || null,
        isFirstTime: !user,
        token: token || null,
    });
};

//register
exports.register = (req, res) => {

    const multiple = upload.fields([
        { name: 'image' },
        { name: 'qualification' },
        { name: 'aadharCard' },
        { name: 'pan' },
        { name: 'verificationVideo' }
    ]);

    multiple(req, res, async (err) => {
        try {
            // If file upload error occurs, use the error handler
            if (err) return errorHandler(res, err);

            // Validate user input
            const { error, value } = registerForm.validate(req.body);
            if (error) return errorHandler(res, error);

            const otpData = await getRedis(value.phone);

            if (!otpData || otpData.phone != value.phone || otpData.verified != true) return errorHandler(res, 'Phone number is not verified.', 403);

            const existingUser = await Expert.findOne({ phone: value.phone });
            if (existingUser) return errorHandler(res, 'Expert with this phone number already exists.', 409);
            // Set image path if file exists
            const folder = 'expert';

            // ✅ Access uploaded files (like your old style)
            const image = req.files.image
                ? `/uploads/${folder}/${req.files.image[0].filename}`
                : null;

            const qualification = req.files.qualification
                ? `/uploads/${folder}/${req.files.qualification[0].filename}`
                : null;

            const aadharCard = req.files.aadharCard
                ? `/uploads/${folder}/${req.files.aadharCard[0].filename}`
                : null;

            const pan = req.files.pan
                ? `/uploads/${folder}/${req.files.pan[0].filename}`
                : null;

            const verificationVideo = req.files.verificationVideo
                ? `/uploads/${folder}/${req.files.verificationVideo[0].filename}`
                : null;

            const userData = {
                ...value,
                image,
                qualification,
                aadharCard,
                pan,
                verificationVideo,
            };

            // Create the user
            const user = await Expert.create(userData);
            const token = jwt.sign(
                { userId: user._id, "type": "Expert" },
                process.env.JWT_SECRET,
                { expiresIn: '1000d' }
            );
            return res.status(201).json({
                success: true,
                message: 'Expert registered successfully',
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
        const userId = req.user?.userId;

        const user = await Expert.findById(userId);
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

            const { error, value } = profileEditForm.validate(req.body);
            if (error) return errorHandler(res, error);

            const user = await Expert.findById(userId);
            if (!user) return errorHandler(res, 'User not found', 404);

            // Set image if uploaded
            const image = req.file
                ? `/uploads/${req.body.folder || 'expert'}/${req.file.filename}`
                : user.image;

            const updatedData = {
                ...value,
                image
            };

            const updatedUser = await Expert.findByIdAndUpdate(userId, updatedData, {
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




