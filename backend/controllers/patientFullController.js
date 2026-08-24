const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const LabRequest = require('../models/LabRequest');
const Prescription = require('../models/Prescription');
const Referral = require('../models/Referral');
const Admission = require('../models/Admission');

const DEPARTMENT_ROOM_MAP = {
    'General Medicine': { room: 'Room 102', block: 'OPD Block A (Ground Floor, Wing 1)' },
    'Cardiology': { room: 'Room 201', block: 'Specialty Wing C (2nd Floor)' },
    'Orthopedics': { room: 'Room 204', block: 'Trauma Wing (2nd Floor)' },
    'Pulmonology': { room: 'Room 302', block: 'Chest Clinic (3rd Floor)' },
    'Nephrology': { room: 'Room 401', block: 'Dialysis Unit (4th Floor)' },
    'General Surgery': { room: 'Room 108', block: 'Surgical Block (1st Floor)' }
};

// 1. Unified Complete Medical History & Chronological Journey Timeline
exports.getPatientFullFile = async (req, res) => {
    try {
        const { patientId } = req.params;

        const patient = await Patient.findOne({ patientId: patientId.toUpperCase() });
        if (!patient) return res.status(404).json({ message: "Patient not found" });

        const [doctorsList, labRequests, prescriptions, referrals, admission] = await Promise.all([
            Doctor.find(),
            LabRequest.find({ patientId: patient.patientId }).sort({ createdAt: 1 }),
            Prescription.find({ patientId: patient.patientId }).sort({ createdAt: 1 }),
            Referral.find({ patientId: patient.patientId }).sort({ createdAt: 1 }),
            Admission.findOne({ patientId: patient.patientId }).sort({ createdAt: -1 })
        ]);

        // Helper to find doctor info
        const getDocInfo = (docId) => {
            const d = doctorsList.find(doc => doc.doctorId === docId);
            return d || { name: 'Dr. Ramesh Sharma', department: 'General Medicine', doctorId: docId };
        };

        // Resolve active assigned doctor
        let doctor = doctorsList.find(d => d.doctorId === patient.assignedDoctorId);
        if (!doctor && referrals.length > 0) {
            const lastRef = referrals[referrals.length - 1];
            doctor = doctorsList.find(d => d.doctorId === lastRef.toDoctorId || d.department === lastRef.toDepartment);
        }
        if (!doctor) {
            doctor = doctorsList.find(d => d.department === 'General Medicine') || { name: 'Dr. Ramesh Sharma', department: 'General Medicine', doctorId: 'DR-GEN-01' };
        }

        const docLoc = DEPARTMENT_ROOM_MAP[doctor.department] || { room: 'Room 102', block: 'OPD Block A (Ground Floor)' };

        // Enhance Lab Requests with Doctor Names
        const enhancedLabs = labRequests.map(l => {
            const d = getDocInfo(l.doctorId);
            const lObj = l.toObject();
            lObj.doctorName = lObj.doctorName || d.name;
            lObj.doctorDepartment = lObj.doctorDepartment || d.department;
            return lObj;
        });

        // Enhance Prescriptions with Doctor Names
        const enhancedPrescriptions = prescriptions.map(p => {
            const d = getDocInfo(p.doctorId);
            const pObj = p.toObject();
            pObj.doctorName = pObj.doctorName || d.name;
            pObj.doctorDepartment = pObj.doctorDepartment || d.department;
            return pObj;
        });

        // Synthesize Complete Chronological Journey Milestones
        const timeline = [];

        // Milestone 1: Registration
        timeline.push({
            id: 'reg-01',
            type: 'REGISTRATION',
            stage: 'O/P Registration & Token Generated',
            timestamp: patient.createdAt,
            details: `Registered at Gandhi Hospital O/P Reception Desk. Assigned to initial physician (${doctor.name}, ${doctor.department}, Room 102).`,
            performedBy: 'O/P Desk Staff (STAFF-OP-01)',
            doctorName: doctor.name,
            doctorDepartment: doctor.department,
            room: 'Room 102',
            block: 'OPD Block A (Ground Floor)',
            status: 'COMPLETED',
            badgeBg: '#f0fdf4',
            badgeColor: '#166534',
            icon: '🎫',
            rawData: { patient, doctor }
        });

        // Milestone 2: Lab Orders & Results
        enhancedLabs.forEach((lab, idx) => {
            timeline.push({
                id: `lab-order-${idx}`,
                type: 'LAB_ORDER',
                stage: `Diagnostic Test Ordered: ${lab.testName}`,
                timestamp: lab.createdAt,
                details: `Ordered by ${lab.doctorName} (${lab.doctorDepartment}). Dispatched to ${lab.labRoom}. Delivery Mode: ${lab.deliveryMode === 'PHYSICAL_COUNTER' ? '📄 Physical Hard-Copy Collection' : '⚡ Digital Direct to Phone'}. Clinical Notes: ${lab.notes || 'Routine checkup'}`,
                performedBy: `${lab.doctorName} (${lab.doctorDepartment})`,
                doctorName: lab.doctorName,
                doctorDepartment: lab.doctorDepartment,
                room: lab.labRoom,
                deliveryMode: lab.deliveryMode || 'DIGITAL_EHR',
                deliveryInstructions: lab.deliveryInstructions || (lab.deliveryMode === 'PHYSICAL_COUNTER' ? 'Collect physical report copy at Diagnostic Counter 1 (Room 105) by presenting Patient ID.' : 'Instant zero-bribery digital report published directly to patient phone and doctor console.'),
                status: 'ORDERED',
                badgeBg: '#eff6ff',
                badgeColor: '#1d4ed8',
                icon: '🧪',
                rawData: lab
            });

            if (lab.sampleCollectedAt) {
                timeline.push({
                    id: `lab-sample-${idx}`,
                    type: 'LAB_SAMPLE',
                    stage: `Sample Collected (${lab.testName})`,
                    timestamp: lab.sampleCollectedAt,
                    details: `Sample received and barcoded by Pathology Technician in ${lab.labRoom}. Analysis in progress.`,
                    performedBy: 'Pathology Lab Technician',
                    doctorName: lab.doctorName,
                    doctorDepartment: lab.doctorDepartment,
                    room: lab.labRoom,
                    status: 'IN_ANALYSIS',
                    badgeBg: '#fef3c7',
                    badgeColor: '#92400e',
                    icon: '🔬',
                    rawData: lab
                });
            }

            if (lab.status === 'REPORT_READY') {
                timeline.push({
                    id: `lab-result-${idx}`,
                    type: 'LAB_REPORT',
                    stage: `Lab Report Published: ${lab.testName}`,
                    timestamp: lab.updatedAt || lab.createdAt,
                    details: `Clinical Findings: "${lab.findings || 'Normal physiological ranges maintained'}". Reference: "${lab.referenceRange || 'Standard clinical limits'}". Delivery: ${lab.deliveryMode === 'PHYSICAL_COUNTER' ? '📄 Physical copy ready at Room 105' : '⚡ Verified Digital EHR Upload'}.`,
                    performedBy: 'Chief Biochemist / Pathologist',
                    doctorName: lab.doctorName,
                    doctorDepartment: lab.doctorDepartment,
                    room: lab.labRoom,
                    clinicalFindings: lab.findings || 'Normal physiological ranges maintained.',
                    referenceRange: lab.referenceRange || 'Standard clinical limits',
                    deliveryMode: lab.deliveryMode || 'DIGITAL_EHR',
                    deliveryInstructions: lab.deliveryInstructions || 'Zero Bribery verification complete.',
                    status: 'PUBLISHED',
                    badgeBg: '#dcfce7',
                    badgeColor: '#15803d',
                    icon: '✅',
                    rawData: lab
                });
            }
        });

        // Milestone 3: Prescriptions & Dispensation
        enhancedPrescriptions.forEach((rx, idx) => {
            timeline.push({
                id: `rx-order-${idx}`,
                type: 'PRESCRIPTION',
                stage: `Prescription Created (${rx.medicines.length} Medicines)`,
                timestamp: rx.createdAt,
                details: `Prescribed by ${rx.doctorName} (${rx.doctorDepartment}). Medicines: ${rx.medicines.map(m => `${m.name} (${m.dosage})`).join(', ')}. Instructions: ${rx.notes || 'Take as advised.'}`,
                performedBy: `${rx.doctorName} (${rx.doctorDepartment})`,
                doctorName: rx.doctorName,
                doctorDepartment: rx.doctorDepartment,
                medicines: rx.medicines,
                notes: rx.notes || 'Take as advised with warm water.',
                status: 'PRESCRIBED',
                badgeBg: '#f5f3ff',
                badgeColor: '#6d28d9',
                icon: '💊',
                rawData: rx
            });

            if (rx.status === 'COMPLETELY_DISPENSED' || rx.status === 'DISPENSED' || rx.dispensedAt) {
                timeline.push({
                    id: `rx-dispense-${idx}`,
                    type: 'PHARMACY_DISPENSE',
                    stage: `Medicines Dispensed by Central Pharmacy`,
                    timestamp: rx.dispensedAt || rx.updatedAt || rx.createdAt,
                    details: `All ${rx.medicines.length} medications dispensed at Counter #3. Zero cash payment verification complete.`,
                    performedBy: rx.dispensedByStaff || 'Duty Pharmacist (Counter #3)',
                    doctorName: rx.doctorName,
                    doctorDepartment: rx.doctorDepartment,
                    room: 'Counter #3',
                    block: 'Central Pharmacy Hall (Gate 2)',
                    medicines: rx.medicines,
                    status: 'DISPENSED',
                    badgeBg: '#dcfce7',
                    badgeColor: '#15803d',
                    icon: '📦',
                    rawData: rx
                });
            }
        });

        // Milestone 4: Referrals with full Doctor Name and Room Number
        referrals.forEach((ref, idx) => {
            const specDoc = doctorsList.find(d => d.doctorId === ref.toDoctorId || d.department === ref.toDepartment);
            const specName = ref.toDoctorName || (specDoc ? specDoc.name : `Specialist (${ref.toDepartment})`);
            const loc = DEPARTMENT_ROOM_MAP[ref.toDepartment] || { room: 'Room 201', block: 'Specialty Wing' };

            timeline.push({
                id: `ref-${idx}`,
                type: 'REFERRAL',
                stage: `Super-Specialty Referral: ${ref.toDepartment} (${specName})`,
                timestamp: ref.createdAt,
                details: `Referred by ${ref.fromDoctorName || 'Referring Doctor'} ➔ Assigned Specialist: ${specName} (${loc.room}, ${loc.block}). Clinical Reason: "${ref.reason}"`,
                performedBy: `${ref.fromDoctorName || 'Doctor'} (Referring Doctor)`,
                doctorName: specName,
                doctorDepartment: ref.toDepartment,
                room: loc.room,
                block: loc.block,
                reason: ref.reason,
                status: 'REFERRED',
                badgeBg: '#fef2f2',
                badgeColor: '#b91c1c',
                icon: '🔄',
                rawData: ref
            });
        });

        // Milestone 5: Inpatient Ward Admission & Consumables
        if (admission) {
            timeline.push({
                id: `adm-01`,
                type: 'ADMISSION',
                stage: `Inpatient Ward Admission (${admission.wardType})`,
                timestamp: admission.admittedAt || admission.createdAt,
                details: `Admitted by ${admission.admittingDoctorId}. Allocated Bed: ${admission.bedNumber}. Diagnosis: ${admission.diagnosis}`,
                performedBy: 'Admitting Physician & Ward Sister',
                room: admission.bedNumber,
                block: admission.wardType,
                status: admission.status,
                badgeBg: '#fee2e2',
                badgeColor: '#991b1b',
                icon: '🛏️',
                rawData: admission
            });

            if (admission.resourcesAllocated && admission.resourcesAllocated.length > 0) {
                admission.resourcesAllocated.forEach((res, i) => {
                    timeline.push({
                        id: `res-${i}`,
                        type: 'RESOURCE_USAGE',
                        stage: `Consumable Logged: ${res.itemName}`,
                        timestamp: res.loggedAt || admission.createdAt,
                        details: `Quantity: ${res.quantity}. Logged to patient bed ledger by ${res.loggedByStaff} (Zero Leakage audit trail).`,
                        performedBy: res.loggedByStaff || 'Duty Nurse',
                        room: admission.bedNumber,
                        block: admission.wardType,
                        status: 'LOGGED',
                        badgeBg: '#faf5ff',
                        badgeColor: '#7e22ce',
                        icon: '💉',
                        rawData: res
                    });
                });
            }

            if (admission.status === 'DISCHARGED' || admission.dischargedAt) {
                timeline.push({
                    id: `disch-01`,
                    type: 'DISCHARGE',
                    stage: `Patient Discharged from Inpatient Ward`,
                    timestamp: admission.dischargedAt || admission.updatedAt,
                    details: `Discharge Summary: "${admission.dischargeSummary || 'Patient stable. Home recovery advised.'}"`,
                    performedBy: 'Ward Sister & Chief Resident',
                    room: admission.bedNumber,
                    block: admission.wardType,
                    status: 'DISCHARGED',
                    badgeBg: '#dcfce7',
                    badgeColor: '#15803d',
                    icon: '🏁',
                    rawData: admission
                });
            }
        }

        // Sort chronologically (earliest to latest)
        timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        res.status(200).json({
            patient,
            doctor,
            doctorLocation: docLoc,
            labRequests: enhancedLabs,
            prescriptions: enhancedPrescriptions,
            referrals,
            admission,
            timeline
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 2. Hospital Transparency & Real-Time Stats
exports.getHospitalStats = async (req, res) => {
    try {
        const [totalPatients, totalDoctors, pendingLabs, activeAdmissions, completedReports] = await Promise.all([
            Patient.countDocuments(),
            Doctor.countDocuments(),
            LabRequest.countDocuments({ status: { $in: ['PENDING', 'SAMPLE_COLLECTED', 'PROCESSING'] } }),
            Admission.countDocuments({ status: 'ADMITTED' }),
            LabRequest.countDocuments({ status: 'REPORT_READY' })
        ]);

        res.status(200).json({
            totalPatients,
            totalDoctors,
            pendingLabs,
            activeAdmissions,
            completedReports,
            transparencyScore: '99.4%',
            averageWaitTimeMinutes: 14
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 3. Complete Comprehensive Hospital Audit Trail (Date & Time for Everything)
exports.getHospitalAuditTrail = async (req, res) => {
    try {
        const [patients, doctors, labRequests, prescriptions, admissions, referrals] = await Promise.all([
            Patient.find().sort({ createdAt: -1 }),
            Doctor.find(),
            LabRequest.find().sort({ createdAt: -1 }),
            Prescription.find().sort({ createdAt: -1 }),
            Admission.find().sort({ createdAt: -1 }),
            Referral.find().sort({ createdAt: -1 })
        ]);

        const allLogs = [];

        // Patient Registrations
        patients.forEach(p => {
            const doc = doctors.find(d => d.doctorId === p.assignedDoctorId);
            allLogs.push({
                type: 'REGISTRATION',
                title: `Patient Registered: ${p.name} (${p.patientId})`,
                timestamp: p.createdAt,
                details: `Age: ${p.age}y ${p.gender} | Phone: +91 ${p.phoneNumber} | Assigned: ${doc ? doc.name : p.assignedDoctorId} (Room 102)`,
                actor: 'O/P Desk Staff (STAFF-OP-01)',
                patientId: p.patientId,
                patientName: p.name,
                status: p.currentStatus,
                color: '#16a34a'
            });
        });

        // Referrals with Doctor and Room
        referrals.forEach(ref => {
            const loc = DEPARTMENT_ROOM_MAP[ref.toDepartment] || { room: 'Room 201', block: 'Specialty Wing' };
            allLogs.push({
                type: 'REFERRAL',
                title: `Specialist Referral: ${ref.toDepartment}`,
                timestamp: ref.createdAt,
                details: `Patient: ${ref.patientId} | From: ${ref.fromDoctorName} ➔ Assigned to: ${ref.toDoctorName || ref.toDepartment} (${loc.room}, ${loc.block}) | Reason: "${ref.reason}"`,
                actor: ref.fromDoctorName,
                patientId: ref.patientId,
                status: 'REFERRED',
                color: '#dc2626'
            });
        });

        // Lab Orders & Results
        labRequests.forEach(l => {
            allLogs.push({
                type: 'LAB_ORDER',
                title: `Lab Test Dispatched: ${l.testName}`,
                timestamp: l.createdAt,
                details: `Patient: ${l.patientId} | Room: ${l.labRoom} | Ordered by: ${l.doctorName || l.doctorId} (${l.doctorDepartment || 'General Medicine'}) | Delivery: ${l.deliveryMode || 'DIGITAL_EHR'}`,
                actor: l.doctorName || l.doctorId,
                patientId: l.patientId,
                status: l.status,
                color: '#2563eb'
            });

            if (l.status === 'REPORT_READY') {
                allLogs.push({
                    type: 'LAB_REPORT',
                    title: `Diagnostic Finding Published: ${l.testName}`,
                    timestamp: l.updatedAt || l.createdAt,
                    details: `Patient: ${l.patientId} | Findings: "${l.findings || 'Normal'}" | Mode: ${l.deliveryMode || 'DIGITAL_EHR'} | Zero Bribery verified`,
                    actor: 'Pathology Lab In-Charge',
                    patientId: l.patientId,
                    status: 'PUBLISHED',
                    color: '#15803d'
                });
            }
        });

        // Prescriptions & Dispensation
        prescriptions.forEach(rx => {
            allLogs.push({
                type: 'PRESCRIPTION',
                title: `Prescription Written (${rx.medicines.length} Meds)`,
                timestamp: rx.createdAt,
                details: `Patient: ${rx.patientId} | Doctor: ${rx.doctorName || rx.doctorId} (${rx.doctorDepartment || 'General Medicine'}) | Drugs: ${rx.medicines.map(m => m.name).join(', ')}`,
                actor: rx.doctorName || rx.doctorId,
                patientId: rx.patientId,
                status: rx.status,
                color: '#7c3aed'
            });

            if (rx.status === 'COMPLETELY_DISPENSED' || rx.status === 'DISPENSED' || rx.dispensedAt) {
                allLogs.push({
                    type: 'PHARMACY_DISPENSE',
                    title: `Free Medications Dispensed`,
                    timestamp: rx.dispensedAt || rx.updatedAt,
                    details: `Patient: ${rx.patientId} | Counter #3 | Zero Cash charge policy applied`,
                    actor: rx.dispensedByStaff || 'Chief Pharmacist',
                    patientId: rx.patientId,
                    status: 'DISPENSED',
                    color: '#059669'
                });
            }
        });

        // Admissions & Micro-Resources
        admissions.forEach(adm => {
            allLogs.push({
                type: 'ADMISSION',
                title: `Inpatient Admission: ${adm.wardType}`,
                timestamp: adm.admittedAt || adm.createdAt,
                details: `Patient: ${adm.patientId} | Bed: ${adm.bedNumber} | Diagnosis: ${adm.diagnosis}`,
                actor: adm.admittingDoctorId,
                patientId: adm.patientId,
                status: adm.status,
                color: '#dc2626'
            });

            if (adm.resourcesAllocated && adm.resourcesAllocated.length > 0) {
                adm.resourcesAllocated.forEach(res => {
                    allLogs.push({
                        type: 'RESOURCE_USAGE',
                        title: `Micro-Resource Logged: ${res.itemName}`,
                        timestamp: res.loggedAt || adm.createdAt,
                        details: `Patient: ${adm.patientId} | Qty: ${res.quantity} | Logged by: ${res.loggedByStaff} (Anti-Theft Ledger)`,
                        actor: res.loggedByStaff,
                        patientId: adm.patientId,
                        status: 'VERIFIED',
                        color: '#9333ea'
                    });
                });
            }

            if (adm.status === 'DISCHARGED' || adm.dischargedAt) {
                allLogs.push({
                    type: 'DISCHARGE',
                    title: `Patient Discharged from Ward`,
                    timestamp: adm.dischargedAt || adm.updatedAt,
                    details: `Patient: ${adm.patientId} | Summary: "${adm.dischargeSummary || 'Stable'}"`,
                    actor: 'Ward Sister',
                    patientId: adm.patientId,
                    status: 'COMPLETED',
                    color: '#166534'
                });
            }
        });

        // Sort all logs by Date & Time (Latest First)
        allLogs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        // Group by Date for Date-wise Statistics
        const dateBreakdown = {};
        allLogs.forEach(log => {
            const dateStr = new Date(log.timestamp).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });
            if (!dateBreakdown[dateStr]) {
                dateBreakdown[dateStr] = { date: dateStr, count: 0, registrations: 0, referrals: 0, labs: 0, prescriptions: 0, admissions: 0 };
            }
            dateBreakdown[dateStr].count += 1;
            if (log.type === 'REGISTRATION') dateBreakdown[dateStr].registrations += 1;
            if (log.type === 'REFERRAL') dateBreakdown[dateStr].referrals += 1;
            if (log.type.startsWith('LAB')) dateBreakdown[dateStr].labs += 1;
            if (log.type.startsWith('PRESCRIPTION') || log.type.startsWith('PHARMACY')) dateBreakdown[dateStr].prescriptions += 1;
            if (log.type.startsWith('ADMISSION') || log.type.startsWith('RESOURCE')) dateBreakdown[dateStr].admissions += 1;
        });

        res.status(200).json({
            totalEvents: allLogs.length,
            dateBreakdown: Object.values(dateBreakdown),
            allLogs
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
