const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');
const LabRequest = require('../models/LabRequest');

// 1. Get all doctors
exports.getAllDoctors = async (req, res) => {
    try {
        const doctors = await Doctor.find();
        res.status(200).json(doctors);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 2. Get Doctor's Complete Patient Queue & Date-wise Assigned Patients
exports.getWaitingPatients = async (req, res) => {
    try {
        const { doctorId } = req.params;
        
        // Find ALL patients assigned to this doctor sorted by latest registration
        const allAssignedPatients = await Patient.find({ 
            assignedDoctorId: doctorId 
        }).sort({ createdAt: -1 });

        // Filter active waiting queue
        const waitingQueue = allAssignedPatients.filter(p => 
            ['WAITING_FOR_DOCTOR', 'IN_CONSULTATION', 'DIAGNOSTICS_ORDERED', 'IN_LAB', 'LAB_COMPLETED', 'PHARMACY_QUEUE'].includes(p.currentStatus)
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
            if (['WAITING_FOR_DOCTOR', 'IN_CONSULTATION', 'DIAGNOSTICS_ORDERED', 'IN_LAB', 'LAB_COMPLETED', 'PHARMACY_QUEUE'].includes(p.currentStatus)) {
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

// 4. Doctor completes consultation & Authorizes Discharge with Clinical Summary
exports.completeConsultation = async (req, res) => {
    try {
        const { doctorId, patientId, dischargeSummary, dischargeType, followUpAdvice } = req.body;

        const doc = await Doctor.findOne({ doctorId });
        const docName = doc ? doc.name : 'Attending Physician';
        const docDept = doc ? doc.department : 'General Medicine';

        const summaryText = dischargeSummary || 'Patient examined. Vitals normal. Prescribed home recovery medications.';
        const typeText = dischargeType || 'Routine Outpatient Completion (Home Recovery)';
        const followUpText = followUpAdvice || 'Follow-up after 5-7 days if symptoms persist.';

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

        await Doctor.findOneAndUpdate(
            { doctorId },
            { $inc: { currentQueueCount: -1 } }
        );

        res.status(200).json({
            message: `Discharge Authorized: ${updatedPatient.name} successfully discharged by ${docName} (${docDept})!`,
            patient: updatedPatient
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
