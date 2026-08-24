const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware with higher body parser limit for Photo Proofs
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

// Routes
const patientRoutes = require('./routes/patientRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const labRoutes = require('./routes/labRoutes');
const pharmacyRoutes = require('./routes/pharmacyRoutes');
const admissionRoutes = require('./routes/admissionRoutes');
const referralRoutes = require('./routes/referralRoutes');
const hospitalRoutes = require('./routes/hospitalRoutes');

app.use('/api/patients', patientRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/labs', labRoutes);
app.use('/api/pharmacy', pharmacyRoutes);
app.use('/api/admissions', admissionRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/hospital', hospitalRoutes);

// Health check route
app.get('/', (req, res) => {
    res.send('Chikitsya Setu Full Hospital API is operational with Photo Proof Verification!');
});

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Successfully connected to MongoDB!'))
    .catch((err) => console.error('MongoDB connection error:', err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});
