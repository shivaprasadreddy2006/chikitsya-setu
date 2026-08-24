const mongoose = require('mongoose');

const labRequestSchema = new mongoose.Schema({
    patientId: { type: String, required: true },
    doctorId: { type: String, required: true },
    doctorName: { type: String },
    doctorDepartment: { type: String },
    
    testName: { type: String, required: true },
    labRoom: { type: String, required: true },
    notes: { type: String },
    
    // Delivery mode: Digital vs Physical Hard-Copy
    deliveryMode: { 
        type: String, 
        enum: ['DIGITAL_EHR', 'PHYSICAL_COUNTER', 'BOTH'], 
        default: 'DIGITAL_EHR' 
    },
    deliveryInstructions: { type: String },
    
    // Status tracker
    status: { 
        type: String, 
        default: 'PENDING',
        enum: ['PENDING', 'SAMPLE_COLLECTED', 'PROCESSING', 'REPORT_READY']
    },
    
    // Results & report details
    findings: { type: String },
    referenceRange: { type: String, default: 'Biological reference intervals within normal clinical tolerance.' },
    reportUrl: { type: String },
    
    // Photographic Proof of Sample Collection / Physical Diagnostic Film (Anti-Corruption / Zero Exploitation)
    photoProof: { type: String },
    photoProofTimestamp: { type: Date },

    // SLA and Accountability timestamps
    sampleCollectedAt: { type: Date },
    completedAt: { type: Date },
    isDelayed: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('LabRequest', labRequestSchema);
