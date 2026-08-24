const mongoose = require('mongoose');
require('dotenv').config();
const Doctor = require('./models/Doctor');
const Patient = require('./models/Patient');

async function seedDatabase() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB for full database seeding...');

        // Clear existing records to ensure clean state
        await Doctor.deleteMany();
        await Patient.deleteMany();

        // 1. DOCTORS (5 General Doctors + 2 from each Specialized Department)
        const doctors = [
            // General Medicine (5 Doctors)
            { doctorId: 'DR-GEN-01', name: 'Dr. Ramesh Sharma', department: 'General Medicine', isOnShift: true, currentQueueCount: 3 },
            { doctorId: 'DR-GEN-02', name: 'Dr. Priya Verma', department: 'General Medicine', isOnShift: true, currentQueueCount: 2 },
            { doctorId: 'DR-GEN-03', name: 'Dr. Anil Reddy', department: 'General Medicine', isOnShift: true, currentQueueCount: 2 },
            { doctorId: 'DR-GEN-04', name: 'Dr. Sunita Rao', department: 'General Medicine', isOnShift: true, currentQueueCount: 1 },
            { doctorId: 'DR-GEN-05', name: 'Dr. Rajesh Gupta', department: 'General Medicine', isOnShift: false, currentQueueCount: 0 },

            // Cardiology (2 Doctors)
            { doctorId: 'DR-CARD-01', name: 'Dr. Vikram Malhotra', department: 'Cardiology', isOnShift: true, currentQueueCount: 1 },
            { doctorId: 'DR-CARD-02', name: 'Dr. Sneha Kulkarni', department: 'Cardiology', isOnShift: true, currentQueueCount: 0 },

            // Orthopedics (2 Doctors)
            { doctorId: 'DR-ORTHO-01', name: 'Dr. Suresh Patel', department: 'Orthopedics', isOnShift: true, currentQueueCount: 1 },
            { doctorId: 'DR-ORTHO-02', name: 'Dr. Meera Nambiar', department: 'Orthopedics', isOnShift: true, currentQueueCount: 0 },

            // Pulmonology (2 Doctors)
            { doctorId: 'DR-PULM-01', name: 'Dr. Arvind Joshi', department: 'Pulmonology', isOnShift: true, currentQueueCount: 0 },
            { doctorId: 'DR-PULM-02', name: 'Dr. Kavita Nair', department: 'Pulmonology', isOnShift: true, currentQueueCount: 0 },

            // Nephrology / Kidney (2 Doctors)
            { doctorId: 'DR-NEPH-01', name: 'Dr. Manoj Deshmukh', department: 'Nephrology', isOnShift: true, currentQueueCount: 0 },
            { doctorId: 'DR-NEPH-02', name: 'Dr. Pooja Hegde', department: 'Nephrology', isOnShift: true, currentQueueCount: 0 },

            // General Surgery (2 Doctors)
            { doctorId: 'DR-SURG-01', name: 'Dr. Deepak Choudhary', department: 'General Surgery', isOnShift: true, currentQueueCount: 0 },
            { doctorId: 'DR-SURG-02', name: 'Dr. Swati Sen', department: 'General Surgery', isOnShift: true, currentQueueCount: 0 }
        ];

        await Doctor.insertMany(doctors);
        console.log(`✅ Seeded ${doctors.length} Doctors across 6 Departments!`);

        // 2. PATIENTS (10 Default Patient Accounts)
        const patients = [
            {
                patientId: 'PT-1001',
                name: 'Rahul Kumar',
                age: 28,
                gender: 'Male',
                phoneNumber: '9876500001',
                password: 'pass1',
                currentStatus: 'WAITING_FOR_DOCTOR',
                assignedDoctorId: 'DR-GEN-01'
            },
            {
                patientId: 'PT-1002',
                name: 'Anjali Devi',
                age: 45,
                gender: 'Female',
                phoneNumber: '9876500002',
                password: 'pass2',
                currentStatus: 'WAITING_FOR_DOCTOR',
                assignedDoctorId: 'DR-GEN-01'
            },
            {
                patientId: 'PT-1003',
                name: 'Suresh Chandra',
                age: 52,
                gender: 'Male',
                phoneNumber: '9876500003',
                password: 'pass3',
                currentStatus: 'IN_LAB',
                assignedDoctorId: 'DR-GEN-01'
            },
            {
                patientId: 'PT-1004',
                name: 'Lakshmi Bai',
                age: 60,
                gender: 'Female',
                phoneNumber: '9876500004',
                password: 'pass4',
                currentStatus: 'WAITING_FOR_DOCTOR',
                assignedDoctorId: 'DR-GEN-02'
            },
            {
                patientId: 'PT-1005',
                name: 'Mohammed Rizwan',
                age: 33,
                gender: 'Male',
                phoneNumber: '9876500005',
                password: 'pass5',
                currentStatus: 'WAITING_FOR_DOCTOR',
                assignedDoctorId: 'DR-GEN-02'
            },
            {
                patientId: 'PT-1006',
                name: 'Kavitha Reddy',
                age: 39,
                gender: 'Female',
                phoneNumber: '9876500006',
                password: 'pass6',
                currentStatus: 'WAITING_FOR_DOCTOR',
                assignedDoctorId: 'DR-GEN-03'
            },
            {
                patientId: 'PT-1007',
                name: 'Venkat Rao',
                age: 48,
                gender: 'Male',
                phoneNumber: '9876500007',
                password: 'pass7',
                currentStatus: 'WAITING_FOR_DOCTOR',
                assignedDoctorId: 'DR-GEN-03'
            },
            {
                patientId: 'PT-1008',
                name: 'Deepa Krishnan',
                age: 24,
                gender: 'Female',
                phoneNumber: '9876500008',
                password: 'pass8',
                currentStatus: 'WAITING_FOR_DOCTOR',
                assignedDoctorId: 'DR-GEN-04'
            },
            {
                patientId: 'PT-1009',
                name: 'Amitabh Sen',
                age: 58,
                gender: 'Male',
                phoneNumber: '9876500009',
                password: 'pass9',
                currentStatus: 'WAITING_FOR_DOCTOR',
                assignedDoctorId: 'DR-CARD-01'
            },
            {
                patientId: 'PT-1010',
                name: 'Sunita Mehra',
                age: 31,
                gender: 'Female',
                phoneNumber: '9876500010',
                password: 'pass10',
                currentStatus: 'WAITING_FOR_DOCTOR',
                assignedDoctorId: 'DR-ORTHO-01'
            }
        ];

        await Patient.insertMany(patients);
        console.log(`✅ Seeded ${patients.length} Patients with ready-to-use credentials!`);

        console.log('\n🏥 [SEEDING COMPLETE] Hospital environment is fully active.');
        process.exit(0);
    } catch (err) {
        console.error('Seeding error:', err);
        process.exit(1);
    }
}

seedDatabase();
