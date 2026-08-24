const mongoose = require('mongoose');

const labRequestSchema = new mongoose.Schema({
    patientId: { type: String, required: true },
    doctorId: { type: String, required: true },
    
    testName: { type: String, required: true },
    labRoom: { type: String, required: true },
    notes: { type: String },
    
    // Status tracker
    status: { 
        type: String, 
        default: 'PENDING',
        enum: ['PENDING', 'SAMPLE_COLLECTED', 'PROCESSING', 'REPORT_READY']
    },
    
    // Results & report details
    findings: { type: String },
    reportUrl: { type: String }, // Digital report file/link
    
    // SLA and Accountability timestamps
    sampleCollectedAt: { type: Date },
    completedAt: { type: Date },
    isDelayed: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('LabRequest', labRequestSchema);
