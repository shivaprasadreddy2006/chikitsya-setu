const mongoose = require('mongoose');

const admissionSchema = new mongoose.Schema({
    patientId: { type: String, required: true },
    patientName: { type: String },
    phoneNumber: { type: String },
    age: { type: Number },
    gender: { type: String },

    admittingDoctorId: { type: String, required: true },
    admittingDoctorName: { type: String },
    
    wardType: { 
        type: String, 
        required: true
    },
    bedNumber: { type: String, required: true }, // e.g. "BED-GW-12"
    diagnosis: { type: String },
    
    // Micro-Resource & Consumables tracking against patient (Zero Leakage) with Photographic Evidence
    resourcesAllocated: [{
        itemName: { type: String }, // e.g. "Blood Unit O+", "IV Cannula 20G", "Syringe 5ml", "Surgical Kit"
        quantity: { type: Number, default: 1 },
        photoProof: { type: String }, // Base64 or image URL of consumable at patient bedside
        photoProofTimestamp: { type: Date },
        loggedAt: { type: Date, default: Date.now },
        loggedByStaff: { type: String, default: 'Duty Nurse' }
    }],
    
    status: {
        type: String,
        default: 'ADMITTED',
        enum: ['ADMITTED', 'READY_FOR_DISCHARGE', 'DISCHARGED']
    },
    admittedAt: { type: Date, default: Date.now },
    dischargedAt: { type: Date },
    dischargeSummary: { type: String },
    dischargedByDoctorName: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Admission', admissionSchema);
