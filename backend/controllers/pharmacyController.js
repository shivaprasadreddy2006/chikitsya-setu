const Prescription = require('../models/Prescription');

// 1. Get all pending prescriptions for pharmacy queue
exports.getPrescriptions = async (req, res) => {
    try {
        const list = await Prescription.find().sort({ createdAt: -1 });
        res.status(200).json(list);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 2. Doctor creates a digital prescription
exports.createPrescription = async (req, res) => {
    try {
        const { patientId, doctorId, medicines, notes } = req.body;
        
        const newPrescription = new Prescription({
            patientId,
            doctorId,
            medicines: medicines || [{ name: 'Paracetamol 650mg', dosage: '1-0-1 after food', durationDays: 3 }],
            notes: notes || 'Drink warm fluids.'
        });
        await newPrescription.save();

        res.status(201).json({
            message: "Prescription dispatched to Pharmacy queue!",
            prescription: newPrescription
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 3. Pharmacy dispenses medicine
exports.dispenseMedicines = async (req, res) => {
    try {
        const { prescriptionId } = req.params;

        const updated = await Prescription.findByIdAndUpdate(
            prescriptionId,
            {
                status: 'COMPLETELY_DISPENSED',
                dispensedAt: new Date(),
                'medicines.$[].isDispensed': true
            },
            { new: true }
        );

        res.status(200).json({
            message: "Medicines dispensed and logged against patient file!",
            prescription: updated
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
