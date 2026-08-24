const mongoose = require('mongoose');

const prescriptionSchema = new mongoose.Schema({
    patientId: { type: String, required: true },
    doctorId: { type: String, required: true },
    doctorName: { type: String },
    doctorDepartment: { type: String },
    
    medicines: [{
        name: { type: String, required: true },
        dosage: { type: String, required: true }, // e.g. "1-0-1 after food"
        timing: { type: String, default: 'Morning & Night (After Food)' },
        durationDays: { type: Number, default: 5 },
        instructions: { type: String, default: 'Take with warm water after meals' },
        isDispensed: { type: Boolean, default: false }
    }],
    notes: { type: String },
    status: {
        type: String,
        default: 'PENDING_PHARMACY',
        enum: ['PENDING_PHARMACY', 'PARTIALLY_DISPENSED', 'COMPLETELY_DISPENSED']
    },
    dispensedAt: { type: Date },
    dispensedByStaff: { type: String, default: 'Duty Pharmacist (Counter #3)' }
}, { timestamps: true });

module.exports = mongoose.model('Prescription', prescriptionSchema);
