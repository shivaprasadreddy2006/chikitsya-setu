const express = require('express');
const router = express.Router();
const { 
    getPatientFullFile, 
    getHospitalStats, 
    askHospitalAIAssistant 
} = require('../controllers/patientFullController');

router.get('/patient-file/:patientId', getPatientFullFile);
router.get('/stats', getHospitalStats);
router.post('/ai-assistant', askHospitalAIAssistant);

module.exports = router;
