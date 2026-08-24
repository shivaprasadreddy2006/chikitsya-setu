const express = require('express');
const router = express.Router();
const { createReferral, getDepartmentReferrals, submitClearance } = require('../controllers/referralController');

router.post('/create', createReferral);
router.get('/department/:department', getDepartmentReferrals);
router.put('/clear/:referralId', submitClearance);

module.exports = router;
