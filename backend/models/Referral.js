const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema({
    patientId: { type: String, required: true },
    fromDoctorId: { type: String, required: true },
    fromDoctorName: { type: String, required: true },
    toDepartment: { type: String, required: true }, // e.g. "Cardiology", "Nephrology"
    toDoctorId: { type: String },
    toDoctorName: { type: String },
    reason: { type: String, required: true },
    status: {
        type: String,
        default: 'PENDING_CLEARANCE',
        enum: ['PENDING_CLEARANCE', 'CLEARED', 'REJECTED']
    },
    clearanceNotes: { type: String },
    clearedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Referral', referralSchema);
