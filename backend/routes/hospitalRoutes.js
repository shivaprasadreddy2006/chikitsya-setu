const express = require('express');
const router = express.Router();
const { getPatientFullFile, getHospitalStats } = require('../controllers/patientFullController');

router.get('/patient-file/:patientId', getPatientFullFile);
router.get('/stats', getHospitalStats);

module.exports = router;
