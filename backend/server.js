const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json()); // Allows us to receive JSON data

// Routes
const patientRoutes = require('./routes/patientRoutes');
const doctorRoutes = require('./routes/doctorRoutes');

app.use('/api/patients', patientRoutes);
app.use('/api/doctors', doctorRoutes);

// Basic test route
app.get('/', (req, res) => {
    res.send('Chikitsya Setu API is running!');
});

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Successfully connected to MongoDB!'))
    .catch((err) => console.error('MongoDB connection error:', err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
