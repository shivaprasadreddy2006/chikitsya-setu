const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');
const LabRequest = require('../models/LabRequest');
const Admission = require('../models/Admission');
const Referral = require('../models/Referral');

const DOCTOR_PORTRAITS = {
    'DR-GEN-01': 'https://randomuser.me/api/portraits/men/32.jpg',
    'DR-GEN-02': 'https://randomuser.me/api/portraits/women/44.jpg',
    'DR-GEN-03': 'https://randomuser.me/api/portraits/men/11.jpg',
    'DR-GEN-04': 'https://randomuser.me/api/portraits/women/21.jpg',
    'DR-GEN-05': 'https://randomuser.me/api/portraits/men/75.jpg',
    'DR-CARD-01': 'https://randomuser.me/api/portraits/men/52.jpg',
    'DR-CARD-02': 'https://randomuser.me/api/portraits/women/65.jpg',
    'DR-ORTHO-01': 'https://randomuser.me/api/portraits/men/41.jpg',
    'DR-ORTHO-02': 'https://randomuser.me/api/portraits/women/33.jpg',
    'DR-PULM-01': 'https://randomuser.me/api/portraits/men/22.jpg',
    'DR-PULM-02': 'https://randomuser.me/api/portraits/women/12.jpg',
    'DR-NEPH-01': 'https://randomuser.me/api/portraits/men/64.jpg',
    'DR-NEPH-02': 'https://randomuser.me/api/portraits/women/68.jpg',
    'DR-SURG-01': 'https://randomuser.me/api/portraits/men/7.jpg',
    'DR-SURG-02': 'https://randomuser.me/api/portraits/women/8.jpg'
};

const withDoctorPhoto = (doc) => {
    const obj = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
    obj.photoUrl = DOCTOR_PORTRAITS[obj.doctorId] || obj.photoUrl || `https://i.pravatar.cc/300?u=${encodeURIComponent(obj.doctorId || obj.name || 'doctor')}`;
    return obj;
};

// 1. Get all doctors
exports.getAllDoctors = async (req, res) => {
    try {
        const doctors = await Doctor.find();
        res.status(200).json(doctors.map(withDoctorPhoto));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 2. Get Doctor's Complete Patient Queue & Date-wise Assigned Patients
exports.getWaitingPatients = async (req, res) => {
    try {
        const { doctorId } = req.params;

        const relatedReferrals = await Referral.find({
            $or: [{ fromDoctorId: doctorId }, { toDoctorId: doctorId }]
        });
        const referredPatientIds = relatedReferrals.map(r => r.patientId);

        // Current queue + original (referring) doctor + incoming referrals
        const allAssignedPatients = await Patient.find({
            $or: [
                { assignedDoctorId: doctorId },
                { originalDoctorId: doctorId },
                { referredToDoctorId: doctorId },
                { referredFromDoctorId: doctorId },
                { patientId: { $in: referredPatientIds.length ? referredPatientIds : ['__none__'] } }
            ]
        }).sort({ createdAt: -1 });

        // Waiting line: currently assigned to this doctor and not yet in consult
        const waitingQueue = allAssignedPatients.filter(p =>
            p.assignedDoctorId === doctorId && p.currentStatus === 'WAITING_FOR_DOCTOR'
        );

        // Date-wise grouping
        const dateStats = {};
        allAssignedPatients.forEach(p => {
            const dateKey = new Date(p.createdAt).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });
            if (!dateStats[dateKey]) {
                dateStats[dateKey] = { date: dateKey, total: 0, waiting: 0, completed: 0, patients: [] };
            }
            dateStats[dateKey].total += 1;
            if (p.currentStatus === 'WAITING_FOR_DOCTOR') {
                dateStats[dateKey].waiting += 1;
            } else {
                dateStats[dateKey].completed += 1;
            }
            dateStats[dateKey].patients.push(p);
        });

        res.status(200).json({
            waitingQueue,
            allAssignedPatients,
            totalAssigned: allAssignedPatients.length,
            waitingCount: waitingQueue.length,
            dateStats: Object.values(dateStats)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 2b. Doctor opens a patient file -> remove them from the waiting line
exports.startConsultation = async (req, res) => {
    try {
        const { doctorId, patientId } = req.body;

        if (!patientId) {
            return res.status(400).json({ message: 'patientId is required.' });
        }

        const patient = await Patient.findOne({ patientId });
        if (!patient) {
            return res.status(404).json({ message: 'Patient not found.' });
        }

        const canAccess = !doctorId ||
            patient.assignedDoctorId === doctorId ||
            patient.originalDoctorId === doctorId ||
            patient.referredToDoctorId === doctorId ||
            patient.referredFromDoctorId === doctorId;

        if (!canAccess) {
            const linkedReferral = await Referral.findOne({
                patientId,
                $or: [{ fromDoctorId: doctorId }, { toDoctorId: doctorId }]
            });
            if (!linkedReferral) {
                return res.status(403).json({ message: 'Patient is assigned to a different doctor.' });
            }
        }

        // Only the current assigned doctor pulls them off the waiting line
        if (
            patient.assignedDoctorId === doctorId &&
            (patient.currentStatus === 'WAITING_FOR_DOCTOR' || patient.currentStatus === 'OP_REGISTERED')
        ) {
            patient.currentStatus = 'IN_CONSULTATION';
            await patient.save();
        }

        res.status(200).json({
            message: `${patient.name} is now in consultation.`,
            patient
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 3. Doctor orders a test -> dispatched to Lab monitor with delivery mode & doctor name
exports.orderLabTest = async (req, res) => {
    try {
        const { doctorId, patientId, testName, labRoom, notes, deliveryMode } = req.body;

        if (!doctorId || !patientId || !testName || !labRoom) {
            return res.status(400).json({ message: "All fields (doctorId, patientId, testName, labRoom) are required." });
        }

        const doc = await Doctor.findOne({ doctorId });
        const docName = doc ? doc.name : 'Physician';
        const docDept = doc ? doc.department : 'General Medicine';

        const finalDeliveryMode = deliveryMode || 'DIGITAL_EHR';
        const deliveryInstructions = finalDeliveryMode === 'DIGITAL_EHR'
            ? '⚡ Instant direct digital report will be published to your Patient Portal with Zero Bribery verification.'
            : '📄 Hard copy report will be available at Diagnostic Counter #1 (Room 105) by presenting your Patient ID.';

        const newRequest = new LabRequest({
            patientId,
            doctorId,
            doctorName: docName,
            doctorDepartment: docDept,
            testName,
            labRoom,
            deliveryMode: finalDeliveryMode,
            deliveryInstructions,
            notes: notes || ''
        });
        await newRequest.save();

        const updatedPatient = await Patient.findOneAndUpdate(
            { patientId }, 
            { currentStatus: 'DIAGNOSTICS_ORDERED' },
            { new: true }
        );

        await Doctor.findOneAndUpdate(
            { doctorId },
            { $inc: { currentQueueCount: -1 } }
        );

        res.status(201).json({ 
            message: `Lab test "${testName}" ordered by ${docName} (${docDept}) and dispatched to ${labRoom}! [Delivery: ${finalDeliveryMode}]`, 
            labRequest: newRequest,
            patient: updatedPatient
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 4. Doctor completes consultation & Authorizes Discharge (Syncs with Ward Inpatient Records!)
exports.completeConsultation = async (req, res) => {
    try {
        const { doctorId, patientId, dischargeSummary, dischargeType, followUpAdvice } = req.body;

        const doc = await Doctor.findOne({ doctorId });
        const docName = doc ? doc.name : 'Attending Physician';
        const docDept = doc ? doc.department : 'General Medicine';

        const summaryText = dischargeSummary || 'Patient examined. Vitals normal. Prescribed home recovery medications.';
        const typeText = dischargeType || 'Routine Outpatient Completion (Home Recovery)';
        const followUpText = followUpAdvice || 'Follow-up after 5-7 days if symptoms persist.';

        // Update Patient
        const updatedPatient = await Patient.findOneAndUpdate(
            { patientId },
            { 
                currentStatus: 'COMPLETED',
                dischargeSummary: summaryText,
                dischargeType: typeText,
                followUpAdvice: followUpText,
                dischargedByDoctorName: `${docName} (${docDept})`,
                dischargedAt: new Date()
            },
            { new: true }
        );

        // Synchronously discharge active Inpatient Ward record if exists (never delete, archive with full resources!)
        await Admission.updateMany(
            { patientId, status: 'ADMITTED' },
            {
                status: 'DISCHARGED',
                dischargedAt: new Date(),
                dischargeSummary: summaryText,
                dischargedByDoctorName: `${docName} (${docDept})`
            }
        );

        await Doctor.findOneAndUpdate(
            { doctorId },
            { $inc: { currentQueueCount: -1 } }
        );

        res.status(200).json({
            message: `Discharge Authorized: ${updatedPatient.name} successfully discharged by ${docName} (${docDept})! Synchronized across Ward Ledgers.`,
            patient: updatedPatient
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
