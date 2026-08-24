const Admission = require('../models/Admission');
const Patient = require('../models/Patient');

// 1. Admit Patient & Allocate Bed
exports.admitPatient = async (req, res) => {
    try {
        const { patientId, admittingDoctorId, wardType, bedNumber, diagnosis } = req.body;

        const newAdmission = new Admission({
            patientId,
            admittingDoctorId,
            wardType: wardType || 'General Ward (Male)',
            bedNumber: bedNumber || 'BED-GW-04',
            diagnosis: diagnosis || 'Under Inpatient Observation & Treatment',
            resourcesAllocated: [
                { itemName: 'Inpatient Bed Sheet & Pillow Set', quantity: 1 },
                { itemName: 'IV Infusion Set 500ml Normal Saline', quantity: 1 }
            ]
        });
        await newAdmission.save();

        await Patient.findOneAndUpdate(
            { patientId },
            { currentStatus: 'ADMITTED' }
        );

        res.status(201).json({
            message: `Patient admitted to ${wardType} (${bedNumber}) successfully!`,
            admission: newAdmission
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 2. Get active admissions
exports.getActiveAdmissions = async (req, res) => {
    try {
        const list = await Admission.find({ status: 'ADMITTED' }).sort({ createdAt: -1 });
        res.status(200).json(list);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 3. Nurse logs micro-consumable (Zero Leakage)
exports.logResource = async (req, res) => {
    try {
        const { admissionId } = req.params;
        const { itemName, quantity, loggedByStaff } = req.body;

        const updated = await Admission.findByIdAndUpdate(
            admissionId,
            {
                $push: {
                    resourcesAllocated: {
                        itemName,
                        quantity: quantity || 1,
                        loggedByStaff: loggedByStaff || 'Duty Nurse'
                    }
                }
            },
            { new: true }
        );

        res.status(200).json({
            message: `Resource "${itemName}" logged digitally to patient file!`,
            admission: updated
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 4. Discharge Patient
exports.dischargePatient = async (req, res) => {
    try {
        const { admissionId } = req.params;
        const { dischargeSummary } = req.body;

        const admission = await Admission.findById(admissionId);
        if (!admission) return res.status(404).json({ message: "Admission record not found" });

        admission.status = 'DISCHARGED';
        admission.dischargedAt = new Date();
        admission.dischargeSummary = dischargeSummary || 'Patient stable and discharged with home medications.';
        await admission.save();

        await Patient.findOneAndUpdate(
            { patientId: admission.patientId },
            { currentStatus: 'DISCHARGED' }
        );

        res.status(200).json({
            message: "Patient officially discharged and cleared!",
            admission
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
