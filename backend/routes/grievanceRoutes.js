const express = require('express')
const router = express.Router()
const grievanceController = require('../controllers/grievanceController')

// Patient creates grievance
router.post('/create', grievanceController.createGrievance)

// Patient gets own grievances
router.get('/patient/:patientId', grievanceController.getPatientGrievances)

// Admin gets all hospital grievances
router.get('/all', grievanceController.getAllGrievances)

// Admin responds to grievance
router.put('/respond/:grievanceId', grievanceController.respondToGrievance)

// Patient confirms physical resolution (Turns status Green or keeps Orange)
router.put('/patient-confirm/:grievanceId', grievanceController.confirmPatientResolution)

module.exports = router
