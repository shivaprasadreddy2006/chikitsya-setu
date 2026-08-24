const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema({
    doctorId: { 
        type: String, 
        required: true, 
        unique: true 
    }, // e.g., 'DR-GEN-01'
    
    name: { 
        type: String, 
        required: true 
    },
    
    department: { 
        type: String, 
        required: true 
    }, // e.g., 'General Medicine', 'Cardiology'
    
    photoUrl: {
        type: String,
        default: ''
    },

    isOnShift: { 
        type: Boolean, 
        default: true 
    },
    
    currentQueueCount: { 
        type: Number, 
        default: 0 
    }
}, { timestamps: true });

module.exports = mongoose.model('Doctor', doctorSchema);
