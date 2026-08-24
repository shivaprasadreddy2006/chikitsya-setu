const express = require('express');
const router = express.Router();
const { getPrescriptions, createPrescription, dispenseMedicines } = require('../controllers/pharmacyController');

router.get('/', getPrescriptions);
router.post('/create', createPrescription);
router.put('/dispense/:prescriptionId', dispenseMedicines);

module.exports = router;
