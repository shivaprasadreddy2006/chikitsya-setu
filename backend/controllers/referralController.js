const Referral = require('../models/Referral');
const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');

// 1. Doctor requests specialist consult -> Load balances and assigns directly to specialist with shortest queue!
exports.createReferral = async (req, res) => {
    try {
        const { patientId, fromDoctorId, fromDoctorName, toDepartment, reason } = req.body;

        if (!patientId || !toDepartment) {
            return res.status(400).json({ message: "Patient ID and Target Department are required." });
        }

        // Find available specialist doctor in target department with the shortest queue
        let targetDoctor = await Doctor.findOne({
            department: toDepartment,
            isOnShift: true
        }).sort({ currentQueueCount: 1 });

        // Fallback if not marked on shift
        if (!targetDoctor) {
            targetDoctor = await Doctor.findOne({ department: toDepartment }).sort({ currentQueueCount: 1 });
        }

        if (!targetDoctor) {
            return res.status(404).json({ message: `No active specialist doctor found in ${toDepartment} department!` });
        }

        // Create the referral record with assigned specialist doctor
        const newReferral = new Referral({
            patientId,
            fromDoctorId,
            fromDoctorName: fromDoctorName || 'Referring Doctor',
            toDepartment,
            toDoctorId: targetDoctor.doctorId,
            toDoctorName: targetDoctor.name,
            reason: reason || 'Specialist diagnostic examination and secondary opinion',
            status: 'PENDING_CLEARANCE'
        });
        await newReferral.save();

        // Automatically transfer patient to the specialist doctor's active waiting queue!
        const updatedPatient = await Patient.findOneAndUpdate(
            { patientId },
            { 
                assignedDoctorId: targetDoctor.doctorId,
                currentStatus: 'WAITING_FOR_DOCTOR'
            },
            { new: true }
        );

        // Increment specialist's queue count
        targetDoctor.currentQueueCount += 1;
        await targetDoctor.save();

        // Decrement referring doctor's queue count
        if (fromDoctorId) {
            await Doctor.findOneAndUpdate(
                { doctorId: fromDoctorId, currentQueueCount: { $gt: 0 } },
                { $inc: { currentQueueCount: -1 } }
            );
        }

        res.status(201).json({
            message: `Patient successfully transferred & assigned to ${targetDoctor.name} (${toDepartment}) based on shortest queue!`,
            referral: newReferral,
            assignedDoctor: targetDoctor,
            patient: updatedPatient
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
