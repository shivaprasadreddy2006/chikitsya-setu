const mongoose = require('mongoose');
require('dotenv').config();
const Doctor = require('./models/Doctor');
const Patient = require('./models/Patient');
const LabRequest = require('./models/LabRequest');
const Prescription = require('./models/Prescription');
const Referral = require('./models/Referral');
const Admission = require('./models/Admission');

async function seedDatabase() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB for complete hospital seeding...');

        // Clear all collections
        await Doctor.deleteMany();
        await Patient.deleteMany();
        await LabRequest.deleteMany();
        await Prescription.deleteMany();
        await Referral.deleteMany();
        await Admission.deleteMany();

        // 1. DOCTORS (15 Doctors across 6 Departments)
        const doctors = [
            { doctorId: 'DR-GEN-01', name: 'Dr. Ramesh Sharma', department: 'General Medicine', isOnShift: true, currentQueueCount: 3 },
            { doctorId: 'DR-GEN-02', name: 'Dr. Priya Verma', department: 'General Medicine', isOnShift: true, currentQueueCount: 2 },
            { doctorId: 'DR-GEN-03', name: 'Dr. Anil Reddy', department: 'General Medicine', isOnShift: true, currentQueueCount: 2 },
            { doctorId: 'DR-GEN-04', name: 'Dr. Sunita Rao', department: 'General Medicine', isOnShift: true, currentQueueCount: 1 },
            { doctorId: 'DR-GEN-05', name: 'Dr. Rajesh Gupta', department: 'General Medicine', isOnShift: false, currentQueueCount: 0 },

            { doctorId: 'DR-CARD-01', name: 'Dr. Vikram Malhotra', department: 'Cardiology', isOnShift: true, currentQueueCount: 1 },
            { doctorId: 'DR-CARD-02', name: 'Dr. Sneha Kulkarni', department: 'Cardiology', isOnShift: true, currentQueueCount: 0 },

            { doctorId: 'DR-ORTHO-01', name: 'Dr. Suresh Patel', department: 'Orthopedics', isOnShift: true, currentQueueCount: 1 },
            { doctorId: 'DR-ORTHO-02', name: 'Dr. Meera Nambiar', department: 'Orthopedics', isOnShift: true, currentQueueCount: 0 },

            { doctorId: 'DR-PULM-01', name: 'Dr. Arvind Joshi', department: 'Pulmonology', isOnShift: true, currentQueueCount: 0 },
            { doctorId: 'DR-PULM-02', name: 'Dr. Kavita Nair', department: 'Pulmonology', isOnShift: true, currentQueueCount: 0 },

            { doctorId: 'DR-NEPH-01', name: 'Dr. Manoj Deshmukh', department: 'Nephrology', isOnShift: true, currentQueueCount: 0 },
            { doctorId: 'DR-NEPH-02', name: 'Dr. Pooja Hegde', department: 'Nephrology', isOnShift: true, currentQueueCount: 0 },

            { doctorId: 'DR-SURG-01', name: 'Dr. Deepak Choudhary', department: 'General Surgery', isOnShift: true, currentQueueCount: 0 },
            { doctorId: 'DR-SURG-02', name: 'Dr. Swati Sen', department: 'General Surgery', isOnShift: true, currentQueueCount: 0 }
        ];
        await Doctor.insertMany(doctors);

        // 2. PATIENTS (10 Patients with varied stages)
        const patients = [
            { patientId: 'PT-1001', name: 'Rahul Kumar', age: 28, gender: 'Male', phoneNumber: '9876500001', password: 'pass1', currentStatus: 'WAITING_FOR_DOCTOR', assignedDoctorId: 'DR-GEN-01' },
            { patientId: 'PT-1002', name: 'Anjali Devi', age: 45, gender: 'Female', phoneNumber: '9876500002', password: 'pass2', currentStatus: 'WAITING_FOR_DOCTOR', assignedDoctorId: 'DR-GEN-01' },
            { patientId: 'PT-1003', name: 'Suresh Chandra', age: 52, gender: 'Male', phoneNumber: '9876500003', password: 'pass3', currentStatus: 'IN_LAB', assignedDoctorId: 'DR-GEN-01' },
            { patientId: 'PT-1004', name: 'Lakshmi Bai', age: 60, gender: 'Female', phoneNumber: '9876500004', password: 'pass4', currentStatus: 'ADMITTED', assignedDoctorId: 'DR-GEN-02' },
            { patientId: 'PT-1005', name: 'Mohammed Rizwan', age: 33, gender: 'Male', phoneNumber: '9876500005', password: 'pass5', currentStatus: 'WAITING_FOR_DOCTOR', assignedDoctorId: 'DR-GEN-02' },
            { patientId: 'PT-1006', name: 'Kavitha Reddy', age: 39, gender: 'Female', phoneNumber: '9876500006', password: 'pass6', currentStatus: 'WAITING_FOR_DOCTOR', assignedDoctorId: 'DR-GEN-03' },
            { patientId: 'PT-1007', name: 'Venkat Rao', age: 48, gender: 'Male', phoneNumber: '9876500007', password: 'pass7', currentStatus: 'WAITING_FOR_DOCTOR', assignedDoctorId: 'DR-GEN-03' },
            { patientId: 'PT-1008', name: 'Deepa Krishnan', age: 24, gender: 'Female', phoneNumber: '9876500008', password: 'pass8', currentStatus: 'WAITING_FOR_DOCTOR', assignedDoctorId: 'DR-GEN-04' },
            { patientId: 'PT-1009', name: 'Amitabh Sen', age: 58, gender: 'Male', phoneNumber: '9876500009', password: 'pass9', currentStatus: 'WAITING_FOR_DOCTOR', assignedDoctorId: 'DR-CARD-01' },
            { patientId: 'PT-1010', name: 'Sunita Mehra', age: 31, gender: 'Female', phoneNumber: '9876500010', password: 'pass10', currentStatus: 'DISCHARGED', assignedDoctorId: 'DR-ORTHO-01' }
        ];
        await Patient.insertMany(patients);

        // 3. LAB REQUESTS
        const labRequests = [
            { patientId: 'PT-1003', doctorId: 'DR-GEN-01', testName: 'Complete Blood Count (CBC)', labRoom: 'Pathology Lab 1 (Room 105)', status: 'PENDING', notes: 'Suspected acute fever & infection' },
            { patientId: 'PT-1004', doctorId: 'DR-GEN-02', testName: 'Chest X-Ray (PA View)', labRoom: 'Radiology Wing (Room 12)', status: 'SAMPLE_COLLECTED', sampleCollectedAt: new Date(Date.now() - 15 * 60 * 1000), notes: 'Check for congestion' },
            { patientId: 'PT-1010', doctorId: 'DR-ORTHO-01', testName: 'Right Knee X-Ray', labRoom: 'Radiology Wing (Room 12)', status: 'REPORT_READY', findings: 'Mild degenerative changes. No acute fracture.', reportUrl: 'https://chikitsyasetu.gov.in/reports/knee-xray.pdf', completedAt: new Date() }
        ];
        await LabRequest.insertMany(labRequests);

        // 4. PRESCRIPTIONS (PHARMACY)
        const prescriptions = [
            {
                patientId: 'PT-1003',
                doctorId: 'DR-GEN-01',
                medicines: [
                    { name: 'Paracetamol 650mg', dosage: '1-0-1 after food', durationDays: 5, isDispensed: false },
                    { name: 'Azithromycin 500mg', dosage: '1-0-0 before food', durationDays: 3, isDispensed: false }
                ],
                notes: 'Drink plenty of warm water.'
            },
            {
                patientId: 'PT-1010',
                doctorId: 'DR-ORTHO-01',
                status: 'COMPLETELY_DISPENSED',
                dispensedAt: new Date(),
                medicines: [
                    { name: 'Aceclofenac + Paracetamol', dosage: '1-0-1 after food', durationDays: 5, isDispensed: true },
                    { name: 'Calcium + Vit D3 Tablet', dosage: '0-1-0 after lunch', durationDays: 30, isDispensed: true }
                ]
            }
        ];
        await Prescription.insertMany(prescriptions);

        // 5. REFERRALS (DOCTOR-TO-DOCTOR)
        const referrals = [
            {
                patientId: 'PT-1004',
                fromDoctorId: 'DR-GEN-02',
                fromDoctorName: 'Dr. Priya Verma (General)',
                toDepartment: 'Cardiology',
                reason: 'ECG irregularity, needs cardio evaluation before ward medication',
                status: 'PENDING_CLEARANCE'
            }
        ];
        await Referral.insertMany(referrals);

        // 6. INPATIENT ADMISSIONS & RESOURCE LOGS
        const admissions = [
            {
                patientId: 'PT-1004',
                admittingDoctorId: 'DR-GEN-02',
                wardType: 'General Ward (Female)',
                bedNumber: 'BED-GW-08',
                diagnosis: 'Severe dehydration and respiratory observation',
                status: 'ADMITTED',
                resourcesAllocated: [
                    { itemName: 'Bedding & Sanitized Patient Kit', quantity: 1, loggedByStaff: 'Sister Mary' },
                    { itemName: 'IV Cannula 20G & 500ml Ringer Lactate', quantity: 2, loggedByStaff: 'Staff Nurse Geeta' },
                    { itemName: 'Syringe 5ml Disposable', quantity: 3, loggedByStaff: 'Staff Nurse Geeta' },
                    { itemName: 'Nebulizer Medication Kit', quantity: 1, loggedByStaff: 'Staff Nurse Geeta' }
                ]
            }
        ];
        await Admission.insertMany(admissions);

        console.log('✅ COMPLETE HOSPITAL ENVIRONMENT SEEDED SUCCESSFULLY!');
        process.exit(0);
    } catch (err) {
        console.error('Seeding error:', err);
        process.exit(1);
    }
}

seedDatabase();
