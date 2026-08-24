const mongoose = require('mongoose');

const prescriptionSchema = new mongoose.Schema({
    patientId: { type: String, required: true },
    doctorId: { type: String, required: true },
    medicines: [{
        name: { type: String, required: true },
        dosage: { type: String, required: true }, // e.g. "1-0-1 after food"
        durationDays: { type: Number, default: 5 },
        isDispensed: { type: Boolean, default: false }
    }],
    notes: { type: String },
    status: {
        type: String,
        default: 'PENDING_PHARMACY',
        enum: ['PENDING_PHARMACY', 'PARTIALLY_DISPENSED', 'COMPLETELY_DISPENSED']
    },
    dispensedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Prescription', prescriptionSchema);
