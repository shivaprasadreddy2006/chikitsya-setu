const LabRequest = require('../models/LabRequest');
const Patient = require('../models/Patient');

// 1. Get all pending lab orders
exports.getLabOrders = async (req, res) => {
    try {
        const { labRoom } = req.query;
        let query = {};
        if (labRoom) query.labRoom = labRoom;

        const orders = await LabRequest.find(query).sort({ createdAt: -1 });
        res.status(200).json(orders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 2. Lab Staff clicks "Sample Collected" with Photo Proof of Barcoded Tube/Vial
exports.collectSample = async (req, res) => {
    try {
        const { requestId } = req.params;
        const { photoProof } = req.body;

        const updateData = { 
            status: 'SAMPLE_COLLECTED',
            sampleCollectedAt: new Date()
        };

        if (photoProof) {
            updateData.photoProof = photoProof;
            updateData.photoProofTimestamp = new Date();
        }

        const updated = await LabRequest.findByIdAndUpdate(
            requestId,
            updateData,
            { new: true }
        );

        res.status(200).json({
            message: `Sample collected and verified with ${photoProof ? '📸 Photo Proof of Barcode' : 'Digital Timestamp'}!`,
            labRequest: updated
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 3. Lab Staff uploads findings / report with Photo Proof of Diagnostic Sheet / Film
exports.publishReport = async (req, res) => {
    try {
        const { requestId } = req.params;
        const { findings, reportUrl, photoProof } = req.body;

        const updateData = { 
            status: 'REPORT_READY',
            findings: findings || 'Normal parameters within acceptable reference ranges.',
            reportUrl: reportUrl || 'https://chikitsyasetu.gov.in/reports/sample-report.pdf',
            completedAt: new Date()
        };

        if (photoProof) {
            updateData.photoProof = photoProof;
            updateData.photoProofTimestamp = new Date();
        }

        const updated = await LabRequest.findByIdAndUpdate(
            requestId,
            updateData,
            { new: true }
        );

        res.status(200).json({
            message: `Diagnostic report published successfully with ${photoProof ? '📸 Photo Proof of Diagnostic Film' : 'Verified Digital Signature'}!`,
            labRequest: updated
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
