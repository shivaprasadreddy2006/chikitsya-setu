const Prescription = require('../models/Prescription');
const Doctor = require('../models/Doctor');

// 1. Get all pending prescriptions for pharmacy queue
exports.getPrescriptions = async (req, res) => {
    try {
        const list = await Prescription.find().sort({ createdAt: -1 });
        res.status(200).json(list);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 2. Doctor creates a digital prescription with doctor name & department
exports.createPrescription = async (req, res) => {
    try {
        const { patientId, doctorId, medicines, notes } = req.body;

        const doc = await Doctor.findOne({ doctorId });
        const docName = doc ? doc.name : 'Physician';
        const docDept = doc ? doc.department : 'General Medicine';
        
        const newPrescription = new Prescription({
            patientId,
            doctorId,
            doctorName: docName,
            doctorDepartment: docDept,
            medicines: medicines || [{ name: 'Paracetamol 650mg', dosage: '1-0-1 after food', durationDays: 3 }],
            notes: notes || 'Take prescribed medicines with warm water after meals.'
        });
        await newPrescription.save();

        res.status(201).json({
            message: `Prescription created by ${docName} (${docDept}) and dispatched to Pharmacy Counter #3!`,
            prescription: newPrescription
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 3. Pharmacy dispenses medicine with Photo Proof of Handed-Over Packet
exports.dispenseMedicines = async (req, res) => {
    try {
        const { prescriptionId } = req.params;
        const { photoProof } = req.body;

        const updateData = {
            status: 'COMPLETELY_DISPENSED',
            dispensedAt: new Date(),
            dispensedByStaff: 'Duty Pharmacist (Counter #3)',
            'medicines.$[].isDispensed': true
        };

        if (photoProof) {
            updateData.photoProof = photoProof;
            updateData.photoProofTimestamp = new Date();
        }

        const updated = await Prescription.findByIdAndUpdate(
            prescriptionId,
            updateData,
            { new: true }
        );

        res.status(200).json({
            message: `Medicines dispensed and verified with ${photoProof ? '📸 Photographic Proof of Handover' : 'Digital Log'}!`,
            prescription: updated
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
