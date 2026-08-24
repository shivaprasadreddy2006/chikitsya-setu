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
        console.log('Connected to MongoDB: Resetting hospital data...');

        // Clear all patient-related activity so you have a 100% clean slate to test manually
        await Doctor.deleteMany();
        await Patient.deleteMany();
        await LabRequest.deleteMany();
        await Prescription.deleteMany();
        await Referral.deleteMany();
        await Admission.deleteMany();

        // 15 Default Doctors across 6 Departments (Ready on shift with 0 queues)
        const doctors = [
            // General Medicine (5 Doctors)
            { doctorId: 'DR-GEN-01', name: 'Dr. Ramesh Sharma', department: 'General Medicine', isOnShift: true, currentQueueCount: 0 },
            { doctorId: 'DR-GEN-02', name: 'Dr. Priya Verma', department: 'General Medicine', isOnShift: true, currentQueueCount: 0 },
            { doctorId: 'DR-GEN-03', name: 'Dr. Anil Reddy', department: 'General Medicine', isOnShift: true, currentQueueCount: 0 },
            { doctorId: 'DR-GEN-04', name: 'Dr. Sunita Rao', department: 'General Medicine', isOnShift: true, currentQueueCount: 0 },
            { doctorId: 'DR-GEN-05', name: 'Dr. Rajesh Gupta', department: 'General Medicine', isOnShift: false, currentQueueCount: 0 },

            // Cardiology (2 Doctors)
            { doctorId: 'DR-CARD-01', name: 'Dr. Vikram Malhotra', department: 'Cardiology', isOnShift: true, currentQueueCount: 0 },
            { doctorId: 'DR-CARD-02', name: 'Dr. Sneha Kulkarni', department: 'Cardiology', isOnShift: true, currentQueueCount: 0 },

            // Orthopedics (2 Doctors)
            { doctorId: 'DR-ORTHO-01', name: 'Dr. Suresh Patel', department: 'Orthopedics', isOnShift: true, currentQueueCount: 0 },
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
        console.log(`✅ Seeded ${doctors.length} Doctors across 6 Departments (Queues reset to 0).`);
        console.log('✅ Patient records cleared. You can now register and monitor real patient journeys from scratch!');

        process.exit(0);
    } catch (err) {
        console.error('Seeding error:', err);
        process.exit(1);
    }
}

seedDatabase();
