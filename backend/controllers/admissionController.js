const Admission = require('../models/Admission');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');

// 1. Admit Patient & Allocate Bed
exports.admitPatient = async (req, res) => {
    try {
        const { patientId, admittingDoctorId, wardType, bedNumber, diagnosis } = req.body;

        const [patient, doctor] = await Promise.all([
            Patient.findOne({ patientId }),
            Doctor.findOne({ doctorId: admittingDoctorId })
        ]);

        const patName = patient ? patient.name : 'Inpatient';
        const patPhone = patient ? patient.phoneNumber : 'N/A';
        const patAge = patient ? patient.age : 40;
        const patGender = patient ? patient.gender : 'Unknown';
        const docName = doctor ? `${doctor.name} (${doctor.department})` : admittingDoctorId;

        const newAdmission = new Admission({
            patientId,
            patientName: patName,
            phoneNumber: patPhone,
            age: patAge,
            gender: patGender,
            admittingDoctorId,
            admittingDoctorName: docName,
            wardType: wardType || 'General Ward (Male)',
            bedNumber: bedNumber || 'BED-GW-04',
            diagnosis: diagnosis || 'Under Inpatient Observation & Treatment',
            resourcesAllocated: [
                { itemName: 'Inpatient Bed Sheet & Pillow Set', quantity: 1, loggedAt: new Date(), loggedByStaff: 'Ward Sister (Shift A)' },
                { itemName: 'IV Cannula 20G & Infusion Set 500ml NS', quantity: 1, loggedAt: new Date(), loggedByStaff: 'Ward Sister (Shift A)' }
            ]
        });
        await newAdmission.save();

        await Patient.findOneAndUpdate(
            { patientId },
            { currentStatus: 'ADMITTED' }
        );

        res.status(201).json({
            message: `Patient ${patName} admitted to ${wardType} (${bedNumber}) successfully!`,
            admission: newAdmission
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 2. Get all admissions (both active & discharged with full patient details)
exports.getActiveAdmissions = async (req, res) => {
    try {
        const [admissions, patients, doctors] = await Promise.all([
            Admission.find().sort({ createdAt: -1 }),
            Patient.find(),
            Doctor.find()
        ]);

        // Enrich any historical records with patient & doctor info if missing
        const enriched = admissions.map(adm => {
            const admObj = adm.toObject();
            const pat = patients.find(p => p.patientId === adm.patientId);
            const doc = doctors.find(d => d.doctorId === adm.admittingDoctorId);

            admObj.patientName = admObj.patientName || (pat ? pat.name : adm.patientId);
            admObj.phoneNumber = admObj.phoneNumber || (pat ? pat.phoneNumber : 'N/A');
            admObj.age = admObj.age || (pat ? pat.age : '-');
            admObj.gender = admObj.gender || (pat ? pat.gender : '-');
            admObj.admittingDoctorName = admObj.admittingDoctorName || (doc ? `${doc.name} (${doc.department})` : adm.admittingDoctorId);
            return admObj;
        });

        res.status(200).json(enriched);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 3. Nurse logs micro-consumable (Zero Leakage) with optional Bedside Photo Proof
exports.logResource = async (req, res) => {
    try {
        const { admissionId } = req.params;
        const { itemName, quantity, loggedByStaff, photoProof } = req.body;

        const resourceEntry = {
            itemName: itemName || 'Medical Consumable',
            quantity: quantity || 1,
            loggedAt: new Date(),
            loggedByStaff: loggedByStaff || 'Duty Nurse (Ward Station)'
        };

        if (photoProof) {
            resourceEntry.photoProof = photoProof;
            resourceEntry.photoProofTimestamp = new Date();
        }

        const updated = await Admission.findByIdAndUpdate(
            admissionId,
            {
                $push: {
                    resourcesAllocated: resourceEntry
                }
            },
            { new: true }
        );

        res.status(200).json({
            message: `Resource "${itemName}" logged digitally to patient bed ledger with ${photoProof ? '📸 Bedside Photo Proof' : 'Staff Timestamp'}!`,
            admission: updated
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 4. Discharge Patient from Inpatient Ward
exports.dischargePatient = async (req, res) => {
    try {
        const { admissionId } = req.params;
        const { dischargeSummary, dischargedBy } = req.body;

        const admission = await Admission.findById(admissionId);
        if (!admission) return res.status(404).json({ message: "Admission record not found" });

        const summaryText = dischargeSummary || 'Patient vitals stable. Cleared for discharge with home medications.';
        const dischargedByName = dischargedBy || 'Duty Ward Sister & Attending Physician';

        admission.status = 'DISCHARGED';
        admission.dischargedAt = new Date();
        admission.dischargeSummary = summaryText;
        admission.dischargedByDoctorName = dischargedByName;
        await admission.save();

        await Patient.findOneAndUpdate(
            { patientId: admission.patientId },
            { 
                currentStatus: 'COMPLETED',
                dischargeSummary: summaryText,
                dischargedByDoctorName: dischargedByName,
                dischargedAt: new Date()
            }
        );

        res.status(200).json({
            message: `Patient ${admission.patientName || admission.patientId} officially discharged from ${admission.wardType}!`,
            admission
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
