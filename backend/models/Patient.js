const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
    patientId: { 
        type: String, 
        required: true, 
        unique: true 
    }, // e.g., 'PT-1001'
    
    name: { 
        type: String, 
        required: true 
    },
    
    age: { 
        type: Number, 
        required: true 
    },
    
    gender: { 
        type: String, 
        required: true 
    },

    phoneNumber: {
        type: String,
        required: true
    },

    password: {
        type: String,
        required: true
    },

    // OTP fields for Forgot Password / WhatsApp Login
    otp: {
        type: String
    },
    otpExpires: {
        type: Date
    },
    
    // Tracks where the patient is in the hospital
    currentStatus: {
        type: String,
        default: 'WAITING_FOR_DOCTOR',
        enum: [
            'OP_REGISTERED', 
            'WAITING_FOR_DOCTOR', 
            'IN_CONSULTATION',
            'IN_LAB', 
            'ADMITTED',
            'DISCHARGED'
        ]
    },
    
    // Links patient to their assigned doctor
    assignedDoctorId: {
        type: String
    }
}, { timestamps: true });

module.exports = mongoose.model('Patient', patientSchema);
