const Referral = require('../models/Referral');
const Doctor = require('../models/Doctor');

// 1. Doctor requests specialist consult
exports.createReferral = async (req, res) => {
    try {
        const { patientId, fromDoctorId, fromDoctorName, toDepartment, reason } = req.body;

        const newReferral = new Referral({
            patientId,
            fromDoctorId,
            fromDoctorName: fromDoctorName || 'Referring Doctor',
            toDepartment,
            reason: reason || 'Pre-operative evaluation / specialist opinion'
        });
        await newReferral.save();

        res.status(201).json({
            message: `Referral sent to ${toDepartment} department!`,
            referral: newReferral
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 2. Specialist gets referrals for their department
exports.getDepartmentReferrals = async (req, res) => {
    try {
        const { department } = req.params;
        const list = await Referral.find({ toDepartment: department }).sort({ createdAt: -1 });
        res.status(200).json(list);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 3. Specialist provides clearance/opinion
exports.submitClearance = async (req, res) => {
    try {
        const { referralId } = req.params;
        const { clearanceNotes, toDoctorId, toDoctorName } = req.body;

        const updated = await Referral.findByIdAndUpdate(
            referralId,
            {
                status: 'CLEARED',
                clearanceNotes: clearanceNotes || 'Patient evaluated. Cleared for procedure.',
                toDoctorId,
                toDoctorName,
                clearedAt: new Date()
            },
            { new: true }
        );

        res.status(200).json({
            message: "Specialist clearance recorded and sent back to referring doctor!",
            referral: updated
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
