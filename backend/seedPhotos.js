const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const Doctor = require('./models/Doctor');
const Patient = require('./models/Patient');

const DOCTOR_PHOTOS = {
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

    const doctors = await Doctor.find();
    for (let doc of doctors) {
      const photo = DOCTOR_PHOTOS[doc.doctorId] || `https://i.pravatar.cc/300?u=${encodeURIComponent(doc.doctorId)}`;
      doc.photoUrl = photo;
      await doc.save();
      console.log(`Updated photo for Doctor: ${doc.name} (${doc.doctorId})`);
    }

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
