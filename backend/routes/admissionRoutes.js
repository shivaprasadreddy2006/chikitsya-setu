const express = require('express');
const router = express.Router();
const { admitPatient, getActiveAdmissions, logResource, dischargePatient } = require('../controllers/admissionController');

router.post('/admit', admitPatient);
router.get('/active', getActiveAdmissions);
router.post('/resource/:admissionId', logResource);
router.put('/discharge/:admissionId', dischargePatient);

module.exports = router;
