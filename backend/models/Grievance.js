const mongoose = require('mongoose')

const grievanceSchema = new mongoose.Schema({
  grievanceId: {
    type: String,
    unique: true,
    required: true
  },
  patientId: {
    type: String,
    required: true
  },
  patientName: {
    type: String,
    required: true
  },
  phoneNumber: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: [
      'Bribery / Illegal Demands',
      'Doctor Delay / Absence',
      'Medicines Out of Stock',
      'Diagnostic Lab Delay',
      'Staff Neglect or Misbehavior',
      'Ward Sanitation & Hygiene',
      'Emergency Triage Issue',
      'Other Grievance'
    ]
  },
  department: {
    type: String,
    default: 'General Hospital'
  },
  description: {
    type: String,
    required: true
  },
  mediaType: {
    type: String,
    enum: ['photo', 'video', 'none'],
    default: 'none'
  },
  mediaUrl: {
    type: String // Base64 data URI
  },
  status: {
    type: String,
    enum: ['SUBMITTED', 'UNDER_REVIEW', 'ACTION_PROPOSED', 'RESOLVED'],
    default: 'SUBMITTED' // Red: SUBMITTED, Orange: UNDER_REVIEW / ACTION_PROPOSED, Green: RESOLVED (Confirmed by Patient)
  },
  adminReply: {
    type: String,
    default: ''
  },
  adminRepliedAt: {
    type: Date
  },
  adminRepliedBy: {
    type: String,
    default: ''
  },
  patientConfirmedResolved: {
    type: Boolean,
    default: false
  },
  patientResolvedAt: {
    type: Date
  },
  patientFeedback: {
    type: String,
    default: ''
  },
  reopenReason: {
    type: String,
    default: ''
  }
}, { timestamps: true })

module.exports = mongoose.model('Grievance', grievanceSchema)
