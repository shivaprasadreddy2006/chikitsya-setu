const express = require('express');
const router = express.Router();
const { getLabOrders, collectSample, publishReport } = require('../controllers/labController');

router.get('/orders', getLabOrders);
router.put('/collect/:requestId', collectSample);
router.put('/publish/:requestId', publishReport);

module.exports = router;
