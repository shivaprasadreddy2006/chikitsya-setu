const Grievance = require('../models/Grievance')
const Patient = require('../models/Patient')

// Generate Unique Grievance ID
const generateGrievanceId = () => {
  return 'GRV-' + Math.floor(100000 + Math.random() * 900000)
}

// 1. Patient Creates a Grievance with Photo/Video
exports.createGrievance = async (req, res) => {
  try {
    const { patientId, category, department, description, mediaType, mediaUrl } = req.body

    if (!patientId || !category || !description) {
      return res.status(400).json({ message: 'Patient ID, category, and description are required.' })
    }

    const patient = await Patient.findOne({ patientId })
    const patientName = patient ? patient.name : 'Registered Patient'
    const phoneNumber = patient ? patient.phoneNumber : '9999999999'

    const newGrievance = new Grievance({
      grievanceId: generateGrievanceId(),
      patientId,
      patientName,
      phoneNumber,
      category,
      department: department || 'General Outpatient OPD',
      description,
      mediaType: mediaType || 'none',
      mediaUrl: mediaUrl || '',
      status: 'SUBMITTED' // Red Light
    })

    await newGrievance.save()

    res.status(201).json({
      message: 'Grievance submitted successfully. Hospital Vigilance Cell has received your complaint.',
      grievance: newGrievance,
      whatsAppNotification: {
        recipient: phoneNumber,
        message: `🚨 *Gandhi Hospital Grievance Cell*\nHello *${patientName}*,\nYour complaint [ID: *${newGrievance.grievanceId}*] regarding "${category}" has been registered.\n\n🔴 *Status:* SUBMITTED (Awaiting Admin Review)\nTrack live resolution on Chikitsya Setu: http://localhost:5173`
      }
    })
  } catch (error) {
    console.error('Error creating grievance:', error)
    res.status(500).json({ message: 'Server error creating grievance', error: error.message })
  }
}

// 2. Fetch Grievances for a Specific Patient
exports.getPatientGrievances = async (req, res) => {
  try {
    const { patientId } = req.params
    const grievances = await Grievance.find({ patientId }).sort({ createdAt: -1 })
    res.status(200).json(grievances)
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching grievances', error: error.message })
  }
}

// 3. Admin Fetches All Grievances
exports.getAllGrievances = async (req, res) => {
  try {
    const grievances = await Grievance.find().sort({ createdAt: -1 })
    res.status(200).json(grievances)
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching all grievances', error: error.message })
  }
}

// 4. Admin Updates Grievance Status & Replies Back to Patient
exports.respondToGrievance = async (req, res) => {
  try {
    const { grievanceId } = req.params
    const { status, adminReply, adminRepliedBy } = req.body

    const grievance = await Grievance.findOne({ grievanceId })
    if (!grievance) {
      return res.status(404).json({ message: 'Grievance not found.' })
    }

    if (status) grievance.status = status // 'UNDER_REVIEW' (Orange) or 'RESOLVED' (Green)
    if (adminReply) {
      grievance.adminReply = adminReply
      grievance.adminRepliedAt = new Date()
      grievance.adminRepliedBy = adminRepliedBy || 'Chief Medical Superintendent (Vigilance)'
    }

    await grievance.save()

    const statusEmoji = grievance.status === 'RESOLVED' ? '🟢 RESOLVED' : '🟠 UNDER INVESTIGATION'

    res.status(200).json({
      message: `Grievance updated to ${grievance.status}. Patient notified.`,
      grievance,
      whatsAppNotification: {
        recipient: grievance.phoneNumber,
        message: `🚨 *Gandhi Hospital Vigilance Update*\nHello *${grievance.patientName}*,\nYour complaint [ID: *${grievance.grievanceId}*] status updated:\n\n${statusEmoji}\n\n💬 *Official Admin Response:* "${grievance.adminReply || 'Action initiated by Medical Superintendent.'}"\n\n🕒 *Updated:* ${new Date().toLocaleTimeString('en-IN')}`
      }
    })
  } catch (error) {
    res.status(500).json({ message: 'Server error responding to grievance', error: error.message })
  }
}
