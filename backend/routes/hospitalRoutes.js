const express = require('express');
const router = express.Router();
const { 
    getPatientFullFile, 
    getHospitalStats, 
    getHospitalAuditTrail
} = require('../controllers/patientFullController');

router.get('/patient-file/:patientId', getPatientFullFile);
router.get('/stats', getHospitalStats);
router.get('/audit-trail', getHospitalAuditTrail);

module.exports = router;
