const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');
const LabRequest = require('../models/LabRequest');

// 1. Get all doctors (for switching doctors on the dashboard)
exports.getAllDoctors = async (req, res) => {
    try {
        const doctors = await Doctor.find();
        res.status(200).json(doctors);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 2. Doctor opens their dashboard and sees their active patient queue
exports.getWaitingPatients = async (req, res) => {
    try {
        const { doctorId } = req.params;
        
        const patients = await Patient.find({ 
            assignedDoctorId: doctorId,
            currentStatus: { $in: ['WAITING_FOR_DOCTOR', 'IN_CONSULTATION'] }
        }).sort({ createdAt: 1 });
        
        res.status(200).json(patients);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 3. Doctor orders a test without printing any papers -> sent directly to Lab monitor
exports.orderLabTest = async (req, res) => {
    try {
        const { doctorId, patientId, testName, labRoom, notes } = req.body;

        if (!doctorId || !patientId || !testName || !labRoom) {
            return res.status(400).json({ message: "All fields (doctorId, patientId, testName, labRoom) are required." });
        }

        // Create the digital lab ticket
        const newRequest = new LabRequest({
            patientId,
            doctorId,
            testName,
            labRoom,
            notes: notes || ''
        });
        await newRequest.save();

        // Update patient status to IN_LAB (instant status change for patient app)
        const updatedPatient = await Patient.findOneAndUpdate(
            { patientId }, 
            { currentStatus: 'IN_LAB' },
            { new: true }
        );

        // Reduce doctor's waiting queue count
        await Doctor.findOneAndUpdate(
            { doctorId },
            { $inc: { currentQueueCount: -1 } }
        );

        res.status(201).json({ 
            message: `Lab request for ${testName} successfully dispatched to ${labRoom}!`, 
            labRequest: newRequest,
            patient: updatedPatient
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 4. Doctor completes consultation (Prescription / Discharge without tests)
exports.completeConsultation = async (req, res) => {
    try {
        const { doctorId, patientId, prescriptionNotes } = req.body;

        const updatedPatient = await Patient.findOneAndUpdate(
            { patientId },
            { currentStatus: 'DISCHARGED' },
            { new: true }
        );

        await Doctor.findOneAndUpdate(
            { doctorId },
            { $inc: { currentQueueCount: -1 } }
        );

        res.status(200).json({
            message: "Consultation completed and patient advised.",
            patient: updatedPatient
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
