const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const Doctor = require('./models/Doctor');
const Patient = require('./models/Patient');

const DOCTOR_PHOTOS = {
  'DR-GEN-01': 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300&auto=format&fit=crop&q=80',
  'DR-CARD-01': 'https://images.unsplash.com/photo-1594824813580-c11929d5b0d0?w=300&auto=format&fit=crop&q=80',
  'DR-ORTH-01': 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=300&auto=format&fit=crop&q=80',
  'DR-PULM-01': 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=300&auto=format&fit=crop&q=80',
  'DR-NEPH-01': 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=300&auto=format&fit=crop&q=80',
  'DR-SURG-01': 'https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=300&auto=format&fit=crop&q=80'
};

const DEFAULT_PATIENT_PHOTOS = [
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&auto=format&fit=crop&q=80'
];

async function seedPhotos() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/chikitsya_setu';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB for photo seeding...');

    // 1. Seed Doctor Photos
    const doctors = await Doctor.find();
    for (let doc of doctors) {
      const photo = DOCTOR_PHOTOS[doc.doctorId] || 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300&auto=format&fit=crop&q=80';
      doc.photoUrl = photo;
      await doc.save();
      console.log(`Updated photo for Doctor: ${doc.name} (${doc.doctorId})`);
    }

    // 2. Seed Patient Photos
    const patients = await Patient.find();
    let idx = 0;
    for (let pat of patients) {
      if (!pat.photoUrl) {
        pat.photoUrl = DEFAULT_PATIENT_PHOTOS[idx % DEFAULT_PATIENT_PHOTOS.length];
        await pat.save();
        console.log(`Updated photo for Patient: ${pat.name} (${pat.patientId})`);
      }
      idx++;
    }

    console.log('✅ Doctor & Patient Photos Seeded Successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding photos:', err);
    process.exit(1);
  }
}

seedPhotos();
