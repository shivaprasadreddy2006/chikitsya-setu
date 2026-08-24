const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema({
    doctorId: { 
        type: String, 
        required: true, 
        unique: true 
    }, // e.g., 'DR-101'
    
    name: { 
        type: String, 
        required: true 
    },
    
    department: { 
        type: String, 
        required: true 
    }, // e.g., 'General Medicine', 'Cardiology'
    
    // These two fields power our "Equal Split" logic!
    isOnShift: { 
        type: Boolean, 
        default: false 
    },
    
    currentQueueCount: { 
        type: Number, 
        default: 0 
    }
}, { timestamps: true });

module.exports = mongoose.model('Doctor', doctorSchema);
