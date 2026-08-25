const express = require('express');
const router = express.Router();
const { 
    getAllDoctors, 
    getWaitingPatients,
    startConsultation,
    orderLabTest,
    completeConsultation 
} = require('../controllers/doctorController');

// 1. Get all doctors (for switching on the dashboard)
router.get('/', getAllDoctors);

// 2. GET patients waiting for a specific doctor
router.get('/:doctorId/patients', getWaitingPatients);

// 3. POST doctor starts checking a patient (leaves waiting queue)
router.post('/start-consultation', startConsultation);

// 4. POST doctor orders a lab test
router.post('/order-lab', orderLabTest);

// 4. POST complete consultation
router.post('/complete', completeConsultation);

module.exports = router;
