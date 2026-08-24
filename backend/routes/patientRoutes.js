const express = require('express');
const router = express.Router();
const { 
    getAllPatients,
    registerPatient, 
    loginPatient, 
    sendOtp, 
    verifyOtpAndLogin,
    updateProfile
} = require('../controllers/patientController');

// 0. List all patients (for quick testing / oversight)
router.get('/', getAllPatients);

// 1. O/P Desk: Register Patient
router.post('/register', registerPatient);

// 2. Patient: Standard Login (Patient ID + Password)
router.post('/login', loginPatient);

// 3. Patient: Forgot Password -> Send OTP to WhatsApp
router.post('/send-otp', sendOtp);

// 4. Patient: Verify OTP & Direct Login
router.post('/verify-otp', verifyOtpAndLogin);

// 5. Patient: Update Profile / Account Details (Photo, Mobile, Password)
router.put('/profile/:patientId', updateProfile);

module.exports = router;
