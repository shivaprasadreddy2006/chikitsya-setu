const mongoose = require('mongoose');

const admissionSchema = new mongoose.Schema({
    patientId: { type: String, required: true },
    admittingDoctorId: { type: String, required: true },
    wardType: { 
        type: String, 
        required: true,
        enum: ['General Ward (Male)', 'General Ward (Female)', 'ICU', 'Post-Operative Care', 'Pediatric Ward']
    },
    bedNumber: { type: String, required: true }, // e.g. "BED-GW-12"
    diagnosis: { type: String },
    
    // Micro-Resource & Consumables tracking against patient (Zero Leakage)
    resourcesAllocated: [{
        itemName: { type: String }, // e.g. "Blood Unit O+", "IV Cannula 20G", "Syringe 5ml", "Surgical Kit"
        quantity: { type: Number, default: 1 },
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
    dischargeSummary: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Admission', admissionSchema);
