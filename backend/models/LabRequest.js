const mongoose = require('mongoose');

const labRequestSchema = new mongoose.Schema({
    patientId: { type: String, required: true },
    doctorId: { type: String, required: true },
    
    testName: { type: String, required: true },
    labRoom: { type: String, required: true }, // e.g., 'Pathology Lab 1'
    
    // Status tracker for the Lab
    status: { 
        type: String, 
        default: 'PENDING',
        enum: ['PENDING', 'SAMPLE_COLLECTED', 'REPORT_READY']
    },
    
    // This will hold the PDF link once the lab uploads it
    reportUrl: { type: String } 
}, { timestamps: true });

module.exports = mongoose.model('LabRequest', labRequestSchema);
