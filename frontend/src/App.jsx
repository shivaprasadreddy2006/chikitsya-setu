import { useState, useEffect, useRef } from 'react'
import axios from 'axios'

const API_BASE = 'http://localhost:5000/api'

// Helper to retrieve persisted session from localStorage
const getSavedSession = () => {
  try {
    const saved = localStorage.getItem('chikitsya_session')
    if (saved) return JSON.parse(saved)
  } catch (e) {
    console.error('Session parse error:', e)
  }
  return null
}

// Department Location Map in Gandhi Hospital
const DEPARTMENT_LOCATIONS = {
  'General Medicine': { room: 'Room 102', block: 'OPD Block A (Ground Floor, Wing 1)' },
  'Cardiology': { room: 'Room 201', block: 'Specialty Wing C (2nd Floor)' },
  'Orthopedics': { room: 'Room 204', block: 'Trauma Wing (2nd Floor)' },
  'Pulmonology': { room: 'Room 302', block: 'Chest Clinic (3rd Floor)' },
  'Nephrology': { room: 'Room 401', block: 'Dialysis Unit (4th Floor)' },
  'General Surgery': { room: 'Room 108', block: 'Surgical Block (1st Floor)' }
}

// Helper: Format ISO Date string into beautiful Indian standard Date & Time
const formatDateTime = (dateStr) => {
  if (!dateStr) return 'N/A'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  })
}

// Helper: Blob to Base64
const blobToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(blob)
    reader.onload = () => resolve(reader.result)
    reader.onerror = error => reject(error)
  })
}

// Generate an instant stylized high-resolution Medical Verification Badge Canvas
const generateMedicalPresetImage = (type, title, subtitle) => {
  const canvas = document.createElement('canvas')
  canvas.width = 600
  canvas.height = 400
  const ctx = canvas.getContext('2d')

  // Royal Background
  ctx.fillStyle = type === 'pharmacy' ? '#064e3b' : type === 'lab' ? '#0c4a6e' : type === 'grievance' ? '#881337' : '#1e1b4b'
  ctx.fillRect(0, 0, 600, 400)

  // Inner Card
  ctx.fillStyle = '#ffffff'
  ctx.roundRect(20, 20, 560, 360, 20)
  ctx.fill()

  // Header Banner
  ctx.fillStyle = type === 'pharmacy' ? '#059669' : type === 'lab' ? '#0284c7' : type === 'grievance' ? '#e11d48' : '#4f46e5'
  ctx.fillRect(20, 20, 560, 60)

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 20px sans-serif'
  ctx.fillText('🏥 GANDHI HOSPITAL - VERIFIED DIGITAL EVIDENCE', 40, 58)

  // Icon
  ctx.font = '48px sans-serif'
  ctx.fillText(type === 'pharmacy' ? '💊' : type === 'lab' ? '🧪' : type === 'grievance' ? '🚨' : '💉', 40, 146)

  // Content
  ctx.fillStyle = '#0f172a'
  ctx.font = 'bold 20px sans-serif'
  ctx.fillText(title, 110, 126)

  ctx.fillStyle = '#64748b'
  ctx.font = '15px sans-serif'
  ctx.fillText(subtitle, 110, 154)

  // Details box
  ctx.fillStyle = '#f8fafc'
  ctx.fillRect(40, 185, 520, 115)
  ctx.strokeStyle = '#cbd5e1'
  ctx.strokeRect(40, 185, 520, 115)

  ctx.fillStyle = '#1e293b'
  ctx.font = '13px monospace'
  ctx.fillText(`STATUS: VERIFIED ON-SITE EVIDENCE`, 55, 215)
  ctx.fillText(`TIMESTAMP: ${new Date().toLocaleString('en-IN')}`, 55, 240)
  ctx.fillText(`AUDIT: ZERO-CORRUPTION DIGITAL WATERMARK`, 55, 265)

  // Official Stamp
  ctx.fillStyle = '#059669'
  ctx.font = 'bold 15px sans-serif'
  ctx.fillText('✅ OFFICIAL ACCOUNTABILITY EVIDENCE LOGGED', 110, 345)

  return canvas.toDataURL('image/jpeg', 0.85)
}

function App() {
  const savedSession = getSavedSession()

  // Navigation View: 'home' | 'patient' | 'doctor' | 'lab' | 'pharmacy' | 'ward' | 'op-desk' | 'admin'
  const [activeView, setActiveView] = useState(savedSession ? savedSession.role : 'home')

  // Login Modal
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [loginRole, setLoginRole] = useState('patient')
  const [currentUser, setCurrentUser] = useState(savedSession ? savedSession : null)

  // Camera / Webcam State
  const [cameraModal, setCameraModal] = useState({
    isOpen: false,
    title: '',
    purpose: '',
    targetId: null,
    onSuccess: null
  })
  const [cameraStreamActive, setCameraStreamActive] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [capturedPhotoPreview, setCapturedPhotoPreview] = useState(null)
  const videoRef = useRef(null)
  const streamRef = useRef(null)

  // Staff / OP Desk Login
  const [opStaffUser, setOpStaffUser] = useState('')
  const [opStaffPass, setOpStaffPass] = useState('')
  const [staffLoginError, setStaffLoginError] = useState('')

  // Patient State
  const [registeredPatients, setRegisteredPatients] = useState([])
  const [patientLoginMode, setPatientLoginMode] = useState('password')
  const [loginId, setLoginId] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [otpIdentifier, setOtpIdentifier] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [enteredOtp, setEnteredOtp] = useState('')
  const [otpInfo, setOtpInfo] = useState(null)
  const [otpError, setOtpError] = useState('')
  const [patientFullFile, setPatientFullFile] = useState(null)
  const [patientTab, setPatientTab] = useState('overview')
  const [selectedDetailItem, setSelectedDetailItem] = useState(null)

  // Patient Grievances
  const [patientGrievances, setPatientGrievances] = useState([])
  const [grievanceForm, setGrievanceForm] = useState({
    category: 'Bribery / Illegal Demands',
    department: 'Pharmacy Dispensing Counter #3',
    description: '',
    mediaType: 'none',
    mediaUrl: ''
  })
  const [isRecordingGrievanceVideo, setIsRecordingGrievanceVideo] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [grievanceCameraActive, setGrievanceCameraActive] = useState(false)
  const [grievanceMessage, setGrievanceMessage] = useState('')
  const grievanceVideoRef = useRef(null)
  const grievanceStreamRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const mediaChunksRef = useRef([])
  const recordingTimerRef = useRef(null)

  // Doctor State
  const [doctorsList, setDoctorsList] = useState([])
  const [selectedDoctorId, setSelectedDoctorId] = useState(
    savedSession?.role === 'doctor' && savedSession?.data?.doctorId ? savedSession.data.doctorId : 'DR-GEN-01'
  )
  const [doctorQueueData, setDoctorQueueData] = useState({ waitingQueue: [], allAssignedPatients: [], totalAssigned: 0, waitingCount: 0, dateStats: [] })
  const [doctorViewFilter, setDoctorViewFilter] = useState('waiting')
  const [selectedDateFilter, setSelectedDateFilter] = useState('ALL')
  const [activePatientForExam, setActivePatientForExam] = useState(null)
  const [inspectedPatientFullFile, setInspectedPatientFullFile] = useState(null)
  const [doctorActionTab, setDoctorActionTab] = useState('lab')
  const [selectedTest, setSelectedTest] = useState('Complete Blood Count (CBC)')
  const [selectedLabRoom, setSelectedLabRoom] = useState('Pathology Lab 1 (Room 105)')
  const [labDeliveryMode, setLabDeliveryMode] = useState('DIGITAL_EHR')
  const [rxMedicines, setRxMedicines] = useState('Paracetamol 650mg (1-0-1), Cetirizine 10mg (0-0-1)')
  const [referralDept, setReferralDept] = useState('Cardiology')
  const [referralReason, setReferralReason] = useState('Pre-operative specialist opinion required')
  const [admitWard, setAdmitWard] = useState('General Ward (Male)')
  const [admitBed, setAdmitBed] = useState('BED-GW-14')
  const [clinicalNotes, setClinicalNotes] = useState('')
  const [dischargeSummaryText, setDischargeSummaryText] = useState('Patient examined. Vitals normal. Prescribed oral medications for 5 days. Home rest and fluids advised.')
  const [dischargeTypeSelect, setDischargeTypeSelect] = useState('Routine Outpatient Completion (Home Recovery)')
  const [followUpAdviceText, setFollowUpAdviceText] = useState('Follow-up after 5-7 days in OPD Room 102 if symptoms persist.')
  const [doctorMessage, setDoctorMessage] = useState('')

  // Lab State
  const [labOrders, setLabOrders] = useState([])
  const [labFindingsInput, setLabFindingsInput] = useState({})
  const [labMessage, setLabMessage] = useState('')

  // Pharmacy State
  const [prescriptions, setPrescriptions] = useState([])
  const [pharmacyMessage, setPharmacyMessage] = useState('')

  // Ward State
  const [admissionsList, setAdmissionsList] = useState([])
  const [wardViewFilter, setWardViewFilter] = useState('admitted')
  const [resourceItemName, setResourceItemName] = useState('IV Cannula 20G & Normal Saline')
  const [wardResourcePhotoProof, setWardResourcePhotoProof] = useState(null)
  const [wardMessage, setWardMessage] = useState('')

  // O/P Desk State
  const [opForm, setOpForm] = useState({
    name: '',
    age: '',
    gender: 'Male',
    phoneNumber: '',
    registrationDate: new Date().toISOString().slice(0, 16)
  })
  const [opTicket, setOpTicket] = useState(null)
  const [opError, setOpError] = useState('')

  // Admin State
  const [hospitalStats, setHospitalStats] = useState(null)
  const [hospitalAuditTrail, setHospitalAuditTrail] = useState(null)
  const [allHospitalGrievances, setAllHospitalGrievances] = useState([])
  const [adminActiveTab, setAdminActiveTab] = useState('registered-patients')
  const [photoServiceFilter, setPhotoServiceFilter] = useState('ALL')
  const [adminSearchQuery, setAdminSearchQuery] = useState('')
  const [adminInspectedPatientFile, setAdminInspectedPatientFile] = useState(null)
  const [adminSelectedDoctor, setAdminSelectedDoctor] = useState(null)
  const [selectedAdminGrievance, setSelectedAdminGrievance] = useState(null)
  const [adminGrievanceReplyText, setAdminGrievanceReplyText] = useState('')
  const [adminGrievanceStatusSelect, setAdminGrievanceStatusSelect] = useState('UNDER_REVIEW')

  // Notification Toast
  const [whatsAppNotification, setWhatsAppNotification] = useState(null)

  const showWhatsAppAlert = (notification) => {
    setWhatsAppNotification(notification)
    setTimeout(() => setWhatsAppNotification(null), 12000)
  }

  useEffect(() => {
    fetchDoctors()
    fetchHospitalStats()
    fetchPatientsList()
  }, [])

  useEffect(() => {
    if (activeView === 'doctor' && selectedDoctorId) {
      fetchDoctorQueue(selectedDoctorId)
    }
    if (activeView === 'lab') fetchLabOrders()
    if (activeView === 'pharmacy') fetchPrescriptions()
    if (activeView === 'ward') fetchAdmissions()
    if (activeView === 'admin') {
      fetchHospitalStats()
      fetchHospitalAuditTrail()
      fetchDoctors()
      fetchPatientsList()
      fetchLabOrders()
      fetchPrescriptions()
      fetchAdmissions()
      fetchAllHospitalGrievances()
    }
    if (activeView === 'patient' && currentUser?.role === 'patient' && currentUser.data?.patientId) {
      fetchPatientFullFile(currentUser.data.patientId)
      fetchPatientGrievances(currentUser.data.patientId)
    }
  }, [activeView, selectedDoctorId, currentUser])

  useEffect(() => {
    if (!cameraModal.isOpen && streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
      setCameraStreamActive(false)
    }
  }, [cameraModal.isOpen])

  useEffect(() => {
    return () => {
      if (grievanceStreamRef.current) {
        grievanceStreamRef.current.getTracks().forEach(track => track.stop())
      }
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
    }
  }, [])

  // Camera Handlers
  const startWebcam = async () => {
    setCameraError('')
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 } }
        })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
        }
        setCameraStreamActive(true)
      } else {
        setCameraError('Camera access not supported on this browser.')
      }
    } catch (err) {
      setCameraError('Camera permission denied. You can use verified presets to test!')
    }
  }

  const snapWebcamPhoto = () => {
    if (!videoRef.current) return
    const video = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    
    ctx.fillStyle = 'rgba(7, 14, 30, 0.85)'
    ctx.fillRect(10, canvas.height - 40, canvas.width - 20, 30)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 13px sans-serif'
    ctx.fillText(`🏥 GANDHI HOSPITAL AUDIT PROOF | ${new Date().toLocaleString('en-IN')}`, 20, canvas.height - 20)

    const base64 = canvas.toDataURL('image/jpeg', 0.85)
    setCapturedPhotoPreview(base64)
  }

  const openCameraModal = (title, purpose, targetId, onSuccess) => {
    setCapturedPhotoPreview(null)
    setCameraError('')
    setCameraModal({ isOpen: true, title, purpose, targetId, onSuccess })
    setTimeout(() => { startWebcam() }, 200)
  }

  const confirmCapturedPhoto = () => {
    if (cameraModal.onSuccess && capturedPhotoPreview) {
      cameraModal.onSuccess(capturedPhotoPreview)
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    setCameraModal({ isOpen: false, title: '', purpose: '', targetId: null, onSuccess: null })
    setCapturedPhotoPreview(null)
  }

  // Grievance Camera / Video Handlers
  const startGrievanceCamera = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 } },
          audio: true
        })
        grievanceStreamRef.current = stream
        if (grievanceVideoRef.current) {
          grievanceVideoRef.current.srcObject = stream
          grievanceVideoRef.current.play()
        }
        setGrievanceCameraActive(true)
      }
    } catch (err) {
      console.warn('Grievance camera access error:', err)
    }
  }

  const stopGrievanceCamera = () => {
    if (grievanceStreamRef.current) {
      grievanceStreamRef.current.getTracks().forEach(track => track.stop())
      grievanceStreamRef.current = null
    }
    setGrievanceCameraActive(false)
  }

  const snapGrievancePhoto = () => {
    if (!grievanceVideoRef.current) return
    const video = grievanceVideoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    
    ctx.fillStyle = 'rgba(225, 29, 72, 0.85)'
    ctx.fillRect(10, canvas.height - 40, canvas.width - 20, 30)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 13px sans-serif'
    ctx.fillText(`🚨 GANDHI HOSPITAL GRIEVANCE EVIDENCE | ${new Date().toLocaleString('en-IN')}`, 20, canvas.height - 20)

    const base64 = canvas.toDataURL('image/jpeg', 0.85)
    setGrievanceForm({ ...grievanceForm, mediaType: 'photo', mediaUrl: base64 })
    stopGrievanceCamera()
  }

  const startGrievanceVideoRecording = () => {
    if (!grievanceStreamRef.current) return
    mediaChunksRef.current = []
    try {
      const recorder = new MediaRecorder(grievanceStreamRef.current)
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) mediaChunksRef.current.push(e.data)
      }
      recorder.onstop = async () => {
        const blob = new Blob(mediaChunksRef.current, { type: 'video/webm' })
        const base64 = await blobToBase64(blob)
        setGrievanceForm(prev => ({ ...prev, mediaType: 'video', mediaUrl: base64 }))
        stopGrievanceCamera()
      }
      recorder.start(200)
      mediaRecorderRef.current = recorder
      setIsRecordingGrievanceVideo(true)
      setRecordingSeconds(0)
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(sec => {
          if (sec >= 30) {
            stopGrievanceVideoRecording()
            return 30
          }
          return sec + 1
        })
      }, 1000)
    } catch (err) {
      console.error('MediaRecorder error:', err)
    }
  }

  const stopGrievanceVideoRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    setIsRecordingGrievanceVideo(false)
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
  }

  const handleGrievanceSubmit = async (e) => {
    e.preventDefault()
    if (!currentUser?.data?.patientId) return
    try {
      const res = await axios.post(`${API_BASE}/grievances/create`, {
        patientId: currentUser.data.patientId,
        category: grievanceForm.category,
        department: grievanceForm.department,
        description: grievanceForm.description,
        mediaType: grievanceForm.mediaType,
        mediaUrl: grievanceForm.mediaUrl
      })
      setGrievanceMessage(`✅ ${res.data.message}`)
      if (res.data.whatsAppNotification) showWhatsAppAlert(res.data.whatsAppNotification)
      setGrievanceForm({
        category: 'Bribery / Illegal Demands',
        department: 'Pharmacy Dispensing Counter #3',
        description: '',
        mediaType: 'none',
        mediaUrl: ''
      })
      fetchPatientGrievances(currentUser.data.patientId)
      stopGrievanceCamera()
    } catch (err) {
      setGrievanceMessage(`⚠️ ${err.response?.data?.message || 'Failed to submit grievance.'}`)
    }
  }

  const handlePatientConfirmResolution = async (grievanceId, isResolved) => {
    try {
      const res = await axios.put(`${API_BASE}/grievances/patient-confirm/${grievanceId}`, {
        isResolved,
        feedback: isResolved ? 'Verified & satisfied with action taken.' : 'Issue still pending on the ground.',
        reopenReason: isResolved ? '' : 'Patient reported issue is still pending.'
      })
      if (res.data.whatsAppNotification) showWhatsAppAlert(res.data.whatsAppNotification)
      if (currentUser?.data?.patientId) {
        fetchPatientGrievances(currentUser.data.patientId)
      }
      fetchAllHospitalGrievances()
    } catch (err) {
      console.error('Error confirming resolution:', err)
    }
  }

  const fetchPatientGrievances = async (patId) => {
    try {
      const res = await axios.get(`${API_BASE}/grievances/patient/${patId}`)
      setPatientGrievances(res.data)
    } catch (err) { console.error(err) }
  }

  const fetchAllHospitalGrievances = async () => {
    try {
      const res = await axios.get(`${API_BASE}/grievances/all`)
      setAllHospitalGrievances(res.data)
    } catch (err) { console.error(err) }
  }

  const handleAdminRespondToGrievance = async (e) => {
    e.preventDefault()
    if (!selectedAdminGrievance) return
    try {
      const res = await axios.put(`${API_BASE}/grievances/respond/${selectedAdminGrievance.grievanceId}`, {
        status: adminGrievanceStatusSelect,
        adminReply: adminGrievanceReplyText,
        adminRepliedBy: 'Chief Medical Superintendent (Hospital Vigilance)'
      })
      if (res.data.whatsAppNotification) showWhatsAppAlert(res.data.whatsAppNotification)
      fetchAllHospitalGrievances()
      setSelectedAdminGrievance(null)
      setAdminGrievanceReplyText('')
    } catch (err) { console.error(err) }
  }

  // Data Fetchers
  const fetchDoctors = async () => {
    try {
      const res = await axios.get(`${API_BASE}/doctors`)
      setDoctorsList(res.data)
    } catch (err) { console.error(err) }
  }

  const fetchPatientsList = async () => {
    try {
      const res = await axios.get(`${API_BASE}/patients`)
      setRegisteredPatients(res.data)
    } catch (err) { console.error(err) }
  }

  const fetchHospitalStats = async () => {
    try {
      const res = await axios.get(`${API_BASE}/hospital/stats`)
      setHospitalStats(res.data)
    } catch (err) { console.error(err) }
  }

  const fetchHospitalAuditTrail = async () => {
    try {
      const res = await axios.get(`${API_BASE}/hospital/audit-trail`)
      setHospitalAuditTrail(res.data)
    } catch (err) { console.error(err) }
  }

  const fetchDoctorQueue = async (docId) => {
    try {
      const res = await axios.get(`${API_BASE}/doctors/${docId}/patients`)
      setDoctorQueueData(res.data)
    } catch (err) { console.error(err) }
  }

  const fetchLabOrders = async () => {
    try {
      const res = await axios.get(`${API_BASE}/labs/orders`)
      setLabOrders(res.data)
    } catch (err) { console.error(err) }
  }

  const fetchPrescriptions = async () => {
    try {
      const res = await axios.get(`${API_BASE}/pharmacy`)
      setPrescriptions(res.data)
    } catch (err) { console.error(err) }
  }

  const fetchAdmissions = async () => {
    try {
      const res = await axios.get(`${API_BASE}/admissions/active`)
      setAdmissionsList(res.data)
    } catch (err) { console.error(err) }
  }

  const fetchPatientFullFile = async (patId) => {
    try {
      const res = await axios.get(`${API_BASE}/hospital/patient-file/${patId}`)
      setPatientFullFile(res.data)
      return res.data
    } catch (err) { console.error(err) }
  }

  const inspectPatientTimeline = async (patient) => {
    setActivePatientForExam(patient)
    try {
      const res = await axios.get(`${API_BASE}/hospital/patient-file/${patient.patientId}`)
      setInspectedPatientFullFile(res.data)
    } catch (err) { console.error(err) }
  }

  const handleAdminInspectPatient = async (patId) => {
    try {
      const res = await axios.get(`${API_BASE}/hospital/patient-file/${patId}`)
      setAdminInspectedPatientFile(res.data)
    } catch (err) { console.error(err) }
  }

  const persistLogin = (role, data) => {
    const session = { role, data }
    setCurrentUser(session)
    setActiveView(role)
    if (role === 'doctor' && data?.doctorId) {
      setSelectedDoctorId(data.doctorId)
    }
    localStorage.setItem('chikitsya_session', JSON.stringify(session))
    setShowLoginModal(false)
  }

  const handleOpStaffLogin = (e) => {
    e.preventDefault()
    setStaffLoginError('')
    if (opStaffUser.trim() === 'op_staff' && opStaffPass.trim() === 'gandhi2026') {
      persistLogin('op-desk', { name: 'O/P Receptionist (Desk #1)', staffId: 'STAFF-OP-01' })
      setOpStaffUser('')
      setOpStaffPass('')
    } else {
      setStaffLoginError('Invalid Staff ID or Password.')
    }
  }

  const handlePatientPasswordLogin = async (e) => {
    e.preventDefault()
    setLoginError('')
    try {
      const res = await axios.post(`${API_BASE}/patients/login`, { patientId: loginId, password: loginPassword })
      persistLogin('patient', res.data.patient)
      await fetchPatientFullFile(res.data.patient.patientId)
      await fetchPatientGrievances(res.data.patient.patientId)
      setLoginId('')
      setLoginPassword('')
    } catch (err) {
      setLoginError(err.response?.data?.message || 'Invalid credentials. Please verify your Patient ID and PIN.')
    }
  }

  const handleDirectPatientSelect = async (patient) => {
    persistLogin('patient', patient)
    await fetchPatientFullFile(patient.patientId)
    await fetchPatientGrievances(patient.patientId)
  }

  const handleSendOtp = async (e) => {
    e.preventDefault()
    setOtpError('')
    try {
      const res = await axios.post(`${API_BASE}/patients/send-otp`, { identifier: otpIdentifier })
      setOtpSent(true)
      setOtpInfo(res.data)
      if (res.data.whatsAppNotification) showWhatsAppAlert(res.data.whatsAppNotification)
    } catch (err) {
      setOtpError(err.response?.data?.message || 'Failed to send OTP.')
    }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    setOtpError('')
    try {
      const res = await axios.post(`${API_BASE}/patients/verify-otp`, { identifier: otpIdentifier, otp: enteredOtp })
      persistLogin('patient', res.data.patient)
      await fetchPatientFullFile(res.data.patient.patientId)
      await fetchPatientGrievances(res.data.patient.patientId)
      setOtpSent(false)
      setEnteredOtp('')
      setOtpIdentifier('')
    } catch (err) {
      setOtpError(err.response?.data?.message || 'Invalid OTP.')
    }
  }

  const handleRoleSelectLogin = (role, data) => {
    if (role === 'doctor' && data?.doctorId) {
      setSelectedDoctorId(data.doctorId)
    }
    persistLogin(role, data)
  }

  const handleLogout = () => {
    localStorage.removeItem('chikitsya_session')
    setCurrentUser(null)
    setActiveView('home')
    setLoginError('')
    setOtpError('')
    setStaffLoginError('')
    setOtpSent(false)
    setPatientFullFile(null)
    setPatientGrievances([])
    setActivePatientForExam(null)
    setInspectedPatientFullFile(null)
    setSelectedDetailItem(null)
    setAdminInspectedPatientFile(null)
    setSelectedAdminGrievance(null)
    stopGrievanceCamera()
    fetchPatientsList()
  }

  const handleOpRegister = async (e) => {
    e.preventDefault()
    setOpError('')
    setOpTicket(null)
    try {
      const res = await axios.post(`${API_BASE}/patients/register`, opForm)
      setOpTicket(res.data)
      if (res.data.whatsAppNotification) showWhatsAppAlert(res.data.whatsAppNotification)
      setOpForm({
        name: '',
        age: '',
        gender: 'Male',
        phoneNumber: '',
        registrationDate: new Date().toISOString().slice(0, 16)
      })
      fetchHospitalStats()
      fetchPatientsList()
    } catch (err) {
      setOpError(err.response?.data?.message || 'Registration failed.')
    }
  }

  // Doctor Actions
  const handleDoctorOrderLab = async (e) => {
    e.preventDefault()
    if (!activePatientForExam) return
    try {
      const res = await axios.post(`${API_BASE}/doctors/order-lab`, {
        doctorId: selectedDoctorId,
        patientId: activePatientForExam.patientId,
        testName: selectedTest,
        labRoom: selectedLabRoom,
        deliveryMode: labDeliveryMode,
        notes: clinicalNotes
      })
      setDoctorMessage(`✅ ${res.data.message}`)
      fetchDoctorQueue(selectedDoctorId)
      inspectPatientTimeline(activePatientForExam)
    } catch (err) { setDoctorMessage(`⚠️ ${err.response?.data?.message || 'Failed'}`) }
  }

  const handleDoctorPrescribe = async (e) => {
    e.preventDefault()
    if (!activePatientForExam) return
    try {
      const medArray = rxMedicines.split(',').map(m => ({ 
        name: m.trim(), 
        dosage: '1-0-1 after food', 
        timing: 'Morning & Night (After Food)',
        durationDays: 5,
        instructions: 'Take with warm water after meals'
      }))
      const res = await axios.post(`${API_BASE}/pharmacy/create`, {
        doctorId: selectedDoctorId,
        patientId: activePatientForExam.patientId,
        medicines: medArray,
        notes: clinicalNotes
      })
      setDoctorMessage(`✅ ${res.data.message}`)
      fetchDoctorQueue(selectedDoctorId)
      inspectPatientTimeline(activePatientForExam)
    } catch (err) { setDoctorMessage(`⚠️ ${err.response?.data?.message || 'Failed'}`) }
  }

  const handleDoctorReferral = async (e) => {
    e.preventDefault()
    if (!activePatientForExam) return
    try {
      const fromDoc = doctorsList.find(d => d.doctorId === selectedDoctorId)
      const res = await axios.post(`${API_BASE}/referrals/create`, {
        fromDoctorId: selectedDoctorId,
        fromDoctorName: fromDoc?.name || 'Physician',
        patientId: activePatientForExam.patientId,
        toDepartment: referralDept,
        reason: referralReason
      })
      setDoctorMessage(`✅ ${res.data.message}`)
      fetchDoctorQueue(selectedDoctorId)
      fetchDoctors()
      setActivePatientForExam(null)
      setInspectedPatientFullFile(null)
    } catch (err) { setDoctorMessage(`⚠️ ${err.response?.data?.message || 'Failed'}`) }
  }

  const handleDoctorAdmit = async (e) => {
    e.preventDefault()
    if (!activePatientForExam) return
    try {
      const res = await axios.post(`${API_BASE}/admissions/admit`, {
        admittingDoctorId: selectedDoctorId,
        patientId: activePatientForExam.patientId,
        wardType: admitWard,
        bedNumber: admitBed,
        diagnosis: clinicalNotes || 'Under Inpatient Treatment'
      })
      setDoctorMessage(`✅ ${res.data.message}`)
      fetchDoctorQueue(selectedDoctorId)
      inspectPatientTimeline(activePatientForExam)
    } catch (err) { setDoctorMessage(`⚠️ ${err.response?.data?.message || 'Failed'}`) }
  }

  const handleDoctorDischargeSubmit = async (e) => {
    e.preventDefault()
    if (!activePatientForExam) return
    try {
      const res = await axios.post(`${API_BASE}/doctors/complete`, {
        doctorId: selectedDoctorId,
        patientId: activePatientForExam.patientId,
        dischargeSummary: dischargeSummaryText,
        dischargeType: dischargeTypeSelect,
        followUpAdvice: followUpAdviceText
      })
      setDoctorMessage(`✅ ${res.data.message}`)
      fetchDoctorQueue(selectedDoctorId)
      inspectPatientTimeline(activePatientForExam)
      fetchAdmissions()
      fetchHospitalStats()
    } catch (err) { setDoctorMessage(`⚠️ ${err.response?.data?.message || 'Failed'}`) }
  }

  // Station Executions
  const executeLabCollectWithPhoto = async (reqId, photoProof) => {
    try {
      const res = await axios.put(`${API_BASE}/labs/collect/${reqId}`, { photoProof })
      setLabMessage(`✅ ${res.data.message}`)
      fetchLabOrders()
    } catch (err) { setLabMessage(`⚠️ ${err.message}`) }
  }

  const executeLabPublishWithPhoto = async (reqId, photoProof) => {
    try {
      const findings = labFindingsInput[reqId] || 'Normal biological reference intervals maintained.'
      const res = await axios.put(`${API_BASE}/labs/publish/${reqId}`, { findings, photoProof })
      setLabMessage(`✅ ${res.data.message}`)
      fetchLabOrders()
    } catch (err) { setLabMessage(`⚠️ ${err.message}`) }
  }

  const executeDispenseWithPhoto = async (rxId, photoProof) => {
    try {
      const res = await axios.put(`${API_BASE}/pharmacy/dispense/${rxId}`, { photoProof })
      setPharmacyMessage(`✅ ${res.data.message}`)
      fetchPrescriptions()
    } catch (err) { setPharmacyMessage(`⚠️ ${err.message}`) }
  }

  const handleDischarge = async (admissionId) => {
    try {
      const res = await axios.put(`${API_BASE}/admissions/discharge/${admissionId}`, { 
        dischargeSummary: 'Vitals stable. Home medications advised.',
        dischargedBy: 'Duty Ward Sister & Chief Resident'
      })
      setWardMessage(`✅ ${res.data.message}`)
      fetchAdmissions()
      fetchHospitalStats()
    } catch (err) { setWardMessage(`⚠️ ${err.message}`) }
  }

  // Helpers
  const latestReferral = patientFullFile?.referrals && patientFullFile.referrals.length > 0 
    ? patientFullFile.referrals[patientFullFile.referrals.length - 1] 
    : null

  const resolvedDoctor = patientFullFile?.doctor || doctorsList.find(d => 
    d.doctorId === (patientFullFile?.patient?.assignedDoctorId || currentUser?.data?.assignedDoctorId)
  )

  const activeDoctorName = resolvedDoctor?.name || latestReferral?.toDoctorName || 'Dr. Suresh Patel'
  const activeDoctorDept = resolvedDoctor?.department || latestReferral?.toDepartment || 'Orthopedics'
  const activeDoctorLocation = patientFullFile?.doctorLocation || DEPARTMENT_LOCATIONS[activeDoctorDept] || { room: 'Room 204', block: 'Trauma Wing (2nd Floor)' }

  const displayedDoctorPatients = (() => {
    if (doctorViewFilter === 'waiting') return doctorQueueData.waitingQueue || []
    if (doctorViewFilter === 'date-wise' && selectedDateFilter !== 'ALL') {
      const group = (doctorQueueData.dateStats || []).find(d => d.date === selectedDateFilter)
      return group ? group.patients : []
    }
    return doctorQueueData.allAssignedPatients || []
  })()

  const activeAdmittedList = admissionsList.filter(a => a.status === 'ADMITTED')
  const dischargedAdmittedList = admissionsList.filter(a => a.status === 'DISCHARGED')
  const displayedWardList = wardViewFilter === 'admitted' ? activeAdmittedList : dischargedAdmittedList
  const dischargedPatientsList = registeredPatients.filter(p => p.currentStatus === 'COMPLETED' || p.dischargeSummary)

  const adminCategorizedPhotos = (() => {
    const photos = []

    prescriptions.forEach(rx => {
      if (rx.photoProof) {
        photos.push({
          id: rx._id,
          service: 'pharmacy',
          serviceName: '💊 Pharmacy Dispensing Handover',
          patientId: rx.patientId,
          staffName: rx.dispensedByStaff || 'Duty Pharmacist',
          itemSummary: rx.medicines?.map(m => m.name).join(', ') || 'Prescribed Medications',
          timestamp: new Date(rx.dispensedAt || rx.updatedAt || rx.createdAt),
          photoProof: rx.photoProof
        })
      }
    })

    labOrders.forEach(lab => {
      if (lab.photoProof) {
        const isManual = lab.deliveryMode === 'PHYSICAL_COUNTER'
        photos.push({
          id: lab._id,
          service: isManual ? 'manual' : 'lab',
          serviceName: isManual ? '📄 Physical Diagnostic Copy' : '🧪 Lab Sample & Diagnostic Film',
          patientId: lab.patientId,
          staffName: 'Pathology Lab In-Charge',
          itemSummary: `${lab.testName} (${lab.findings || 'Sample in Analysis'})`,
          timestamp: new Date(lab.updatedAt || lab.sampleCollectedAt || lab.createdAt),
          photoProof: lab.photoProof
        })
      }
    })

    admissionsList.forEach(adm => {
      adm.resourcesAllocated?.forEach((res, idx) => {
        if (res.photoProof) {
          photos.push({
            id: `${adm._id}-${idx}`,
            service: 'ward',
            serviceName: '🛏️ Ward Bedside Consumable Administration',
            patientId: adm.patientId,
            staffName: res.loggedByStaff || 'Duty Ward Sister',
            itemSummary: `${res.itemName} (Qty: ${res.quantity}) - Bed: ${adm.bedNumber}`,
            timestamp: new Date(res.loggedAt || adm.createdAt),
            photoProof: res.photoProof
          })
        }
      })
    })

    photos.sort((a, b) => b.timestamp - a.timestamp)
    if (photoServiceFilter === 'ALL') return photos
    return photos.filter(p => p.service === photoServiceFilter)
  })()

  const filteredAdminRegisteredPatients = registeredPatients.filter(p => {
    if (!adminSearchQuery) return true
    const q = adminSearchQuery.toLowerCase()
    return p.name.toLowerCase().includes(q) || p.patientId.toLowerCase().includes(q) || p.phoneNumber.includes(q)
  })

  const filteredAdminDischargedPatients = dischargedPatientsList.filter(p => {
    if (!adminSearchQuery) return true
    const q = adminSearchQuery.toLowerCase()
    return p.name.toLowerCase().includes(q) || p.patientId.toLowerCase().includes(q) || p.phoneNumber.includes(q)
  })

  // Role Theme Color Map
  const getRoleTheme = (role) => {
    switch(role) {
      case 'patient': return { accent: '#1d4ed8', light: '#eff6ff', border: '#cbd5e1', name: 'Patient Health Portal', icon: '👤' }
      case 'doctor': return { accent: '#4338ca', light: '#eef2ff', border: '#c7d2fe', name: 'Doctor Consultation Desk', icon: '👨‍⚕️' }
      case 'lab': return { accent: '#0369a1', light: '#f0f9ff', border: '#bae6fd', name: 'Diagnostic Laboratory', icon: '🔬' }
      case 'pharmacy': return { accent: '#047857', light: '#ecfdf5', border: '#a7f3d0', name: 'Pharmacy Dispensary', icon: '💊' }
      case 'ward': return { accent: '#6d28d9', light: '#f5f3ff', border: '#ddd6fe', name: 'Inpatient Ward Station', icon: '🛏️' }
      case 'op-desk': return { accent: '#b45309', light: '#fffbeb', border: '#fde68a', name: 'O/P Reception Desk', icon: '🎫' }
      case 'admin': return { accent: '#be123c', light: '#fff1f2', border: '#fecdd3', name: 'Executive Administration', icon: '📊' }
      default: return { accent: '#1d4ed8', light: '#eff6ff', border: '#cbd5e1', name: 'Chikitsya Setu', icon: '🏥' }
    }
  }

  const roleTheme = getRoleTheme(currentUser?.role)

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f1f5f9', color: '#070e1e', display: 'flex', flexDirection: 'column' }}>
      
      {/* NOTIFICATION TOAST */}
      {whatsAppNotification && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          backgroundColor: '#070e1e',
          color: '#ffffff',
          padding: '18px 22px',
          borderRadius: '20px',
          boxShadow: '0 20px 40px -8px rgba(0,0,0,0.4)',
          maxWidth: '380px',
          zIndex: 99999,
          border: '1px solid #1e293b'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>📱</span>
              <strong style={{ fontSize: '13px', color: '#38bdf8' }}>SMS / WhatsApp Alert</strong>
            </div>
            <button onClick={() => setWhatsAppNotification(null)} style={{ background: '#1e293b', border: 'none', borderRadius: '50%', width: '22px', height: '22px', cursor: 'pointer', fontSize: '11px', color: '#94a3b8' }}>✕</button>
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '6px' }}>To: +91 {whatsAppNotification.recipient}</div>
          <div style={{ backgroundColor: '#0f1c3f', padding: '12px', borderRadius: '12px', fontSize: '13px', whiteSpace: 'pre-line', lineHeight: '1.45', border: '1px solid #1e3a8a' }}>
            {whatsAppNotification.message}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. BEFORE LOGIN: ROYAL TOP NAVBAR ONLY & PUBLIC HERO LANDING PAGE */}
      {/* ========================================================================= */}
      {!currentUser && (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
          
          {/* Top Navbar */}
          <header style={{
            backgroundColor: '#070e1e',
            borderBottom: '1px solid #1e293b',
            padding: '18px 48px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
            position: 'sticky',
            top: 0,
            zIndex: 100
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', boxShadow: '0 0 20px rgba(37,99,235,0.4)' }}>
                🏥
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: '#ffffff', letterSpacing: '-0.03em' }}>
                  Chikitsya Setu
                </h1>
                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700', letterSpacing: '0.6px' }}>GANDHI HOSPITAL TRANSPARENCY ECOSYSTEM</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8', fontSize: '13px', fontWeight: '600' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block', boxShadow: '0 0 8px #10b981' }}></span>
                Gandhi Hospital Live Network
              </div>

              <button
                onClick={() => { fetchPatientsList(); setShowLoginModal(true); }}
                style={{
                  padding: '12px 28px',
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '9999px',
                  fontSize: '14px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: '0 6px 20px rgba(37, 99, 235, 0.4)'
                }}>
                🔐 Access Portals ➔
              </button>
            </div>
          </header>

          {/* Hero Section */}
          <main style={{ flex: 1, padding: '48px 24px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ width: '100%', maxWidth: '1120px' }}>
              
              {/* Grand Royal Hero Banner */}
              <div className="royal-card animate-fade-in" style={{ padding: '56px 48px', borderRadius: '28px', textAlign: 'center', marginBottom: '36px', background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 20px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '9999px', fontSize: '13px', color: '#1d4ed8', fontWeight: '700', marginBottom: '22px' }}>
                  <span>👑</span> Secunderabad Tertiary Government Hospital
                </div>

                <h2 style={{ fontSize: '38px', color: '#070e1e', margin: '0 0 18px 0', fontWeight: '800', letterSpacing: '-0.03em', lineHeight: '1.2' }}>
                  Public Healthcare Transparency & Anti-Corruption Engine
                </h2>

                <p style={{ fontSize: '16px', color: '#475569', maxWidth: '780px', margin: '0 auto 32px auto', lineHeight: '1.65' }}>
                  Serving 3,500+ daily outpatients and 1,200+ inpatient beds. Chikitsya Setu provides an end-to-end digital accountability framework to stop illegal bribery, eliminate doctor cherry-picking, and track every single pharmaceutical supply.
                </p>

                {/* Animated Stat Badges */}
                <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '36px' }}>
                  <span style={{ padding: '10px 20px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '9999px', fontSize: '13px', fontWeight: '700', color: '#1e293b' }}>
                    🏥 1,200+ Bed Inpatient Capacity
                  </span>
                  <span style={{ padding: '10px 20px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '9999px', fontSize: '13px', fontWeight: '700', color: '#1e293b' }}>
                    👥 3,500+ Daily Outpatients
                  </span>
                  <span style={{ padding: '10px 20px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '9999px', fontSize: '13px', fontWeight: '700', color: '#1e293b' }}>
                    🚨 24/7 Emergency Triage
                  </span>
                  <span style={{ padding: '10px 20px', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '9999px', fontSize: '13px', fontWeight: '700', color: '#065f46' }}>
                    ✅ 100% Free Public Health Policy
                  </span>
                </div>

                {/* Live KPI Metric Grid */}
                {hospitalStats && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '18px', textAlign: 'center' }}>
                    <div className="royal-card" style={{ padding: '24px', borderRadius: '20px', border: '1px solid #e2e8f0', background: '#ffffff' }}>
                      <div style={{ fontSize: '32px', fontWeight: '800', color: '#070e1e' }}>{hospitalStats.totalPatients}</div>
                      <div style={{ fontSize: '13px', color: '#64748b', marginTop: '6px', fontWeight: '600' }}>Patients Registered</div>
                    </div>
                    <div className="royal-card" style={{ padding: '24px', borderRadius: '20px', border: '1px solid #bfdbfe', background: '#eff6ff' }}>
                      <div style={{ fontSize: '32px', fontWeight: '800', color: '#2563eb' }}>{hospitalStats.totalDoctors}</div>
                      <div style={{ fontSize: '13px', color: '#1e40af', marginTop: '6px', fontWeight: '600' }}>Doctors On Shift</div>
                    </div>
                    <div className="royal-card" style={{ padding: '24px', borderRadius: '20px', border: '1px solid #fde68a', background: '#fffbeb' }}>
                      <div style={{ fontSize: '32px', fontWeight: '800', color: '#d97706' }}>{hospitalStats.pendingLabs}</div>
                      <div style={{ fontSize: '13px', color: '#92400e', marginTop: '6px', fontWeight: '600' }}>Diagnostic Orders</div>
                    </div>
                    <div className="royal-card" style={{ padding: '24px', borderRadius: '20px', border: '1px solid #a7f3d0', background: '#ecfdf5' }}>
                      <div style={{ fontSize: '32px', fontWeight: '800', color: '#059669' }}>{hospitalStats.transparencyScore}</div>
                      <div style={{ fontSize: '13px', color: '#065f46', marginTop: '6px', fontWeight: '600' }}>Integrity Index</div>
                    </div>
                  </div>
                )}
              </div>

              {/* 3 Pillars of Reform */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '22px' }}>
                <div className="royal-card" style={{ padding: '32px', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '16px', backgroundColor: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', marginBottom: '16px' }}>⚖️</div>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '18px', color: '#1e3a8a', fontWeight: '800' }}>1. Zero Neglect</h4>
                  <p style={{ fontSize: '14px', color: '#64748b', margin: 0, lineHeight: '1.6' }}>
                    Eliminates doctor cherry-picking. Smart load-balancing algorithms distribute outpatients automatically across doctors with shortest queues.
                  </p>
                </div>

                <div className="royal-card" style={{ padding: '32px', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '16px', backgroundColor: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', marginBottom: '16px' }}>🚫</div>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '18px', color: '#065f46', fontWeight: '800' }}>2. Zero Exploitation</h4>
                  <p style={{ fontSize: '14px', color: '#64748b', margin: 0, lineHeight: '1.6' }}>
                    No more paying bribes to lab attendants. All diagnostic findings are published directly to the patient's phone with live camera proofs.
                  </p>
                </div>

                <div className="royal-card" style={{ padding: '32px', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '16px', backgroundColor: '#fffbeb', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', marginBottom: '16px' }}>📦</div>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '18px', color: '#92400e', fontWeight: '800' }}>3. Zero Leakage</h4>
                  <p style={{ fontSize: '14px', color: '#64748b', margin: 0, lineHeight: '1.6' }}>
                    Every syringe, IV cannula, and medicine is tracked digitally to the patient's bed ledger before discharge, stopping black-market diversion.
                  </p>
                </div>
              </div>

            </div>
          </main>

          <footer style={{ backgroundColor: '#070e1e', borderTop: '1px solid #1e293b', color: '#94a3b8', textAlign: 'center', padding: '24px', fontSize: '13px' }}>
            &copy; 2026 Chikitsya Setu - Gandhi Hospital Public Healthcare Transparency Engine
          </footer>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. AFTER LOGIN: FULL-SCREEN APP LAYOUT WITH ROYAL LEFT SIDEBAR */}
      {/* ========================================================================= */}
      {currentUser && (
        <div style={{ display: 'flex', minHeight: '100vh', width: '100%' }}>
          
          {/* LEFT SIDEBAR (FIXED 270px WIDE WITH ROYAL NAVY GRADIENT) */}
          <aside style={{
            width: '270px',
            backgroundColor: '#070e1e',
            background: 'linear-gradient(180deg, #070e1e 0%, #0f1c3f 100%)',
            borderRight: '1px solid #1e293b',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
            position: 'sticky',
            top: 0,
            height: '100vh',
            padding: '24px 18px',
            boxSizing: 'border-box',
            zIndex: 200,
            overflowY: 'auto'
          }}>
            
            {/* Sidebar Brand Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px', paddingLeft: '8px' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: `linear-gradient(135deg, ${roleTheme.accent} 0%, #1e1b4b 100%)`, color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', boxShadow: `0 0 16px ${roleTheme.accent}66` }}>
                {roleTheme.icon}
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#ffffff', letterSpacing: '-0.02em' }}>Chikitsya Setu</h2>
                <span style={{ fontSize: '10px', color: '#38bdf8', fontWeight: '700', letterSpacing: '0.5px' }}>GANDHI HOSPITAL</span>
              </div>
            </div>

            {/* User Profile Card */}
            <div style={{ backgroundColor: '#0f172a', border: `1px solid ${roleTheme.accent}44`, borderRadius: '16px', padding: '14px', marginBottom: '24px', boxShadow: '0 4px 14px rgba(0,0,0,0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '34px', height: '34px', borderRadius: '50%', backgroundColor: roleTheme.accent, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 'bold' }}>
                  {currentUser.data?.name ? currentUser.data.name.charAt(0) : 'U'}
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ color: '#ffffff', fontSize: '13px', fontWeight: '700', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {currentUser.data?.name || roleTheme.name}
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '11px' }}>
                    {currentUser.data?.patientId || currentUser.data?.doctorId || currentUser.data?.staffId || currentUser.role.toUpperCase()}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', color: '#10b981', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }}></span>
                  Session Active
                </span>
                <span style={{ fontSize: '10px', color: '#38bdf8', fontWeight: '600' }}>
                  {currentUser.role.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Sidebar Navigation Links (Role Specific) */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '10px', color: '#64748b', fontWeight: '800', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '4px', paddingLeft: '8px' }}>
                Portal Navigation
              </span>

              {/* Patient Navigation */}
              {currentUser.role === 'patient' && (
                <>
                  {[
                    { key: 'overview', icon: '📍', label: 'Journey Timeline' },
                    { key: 'labs', icon: '🧪', label: `Lab Reports (${patientFullFile?.labRequests?.length || 0})` },
                    { key: 'medicines', icon: '💊', label: `Prescriptions (${patientFullFile?.prescriptions?.length || 0})` },
                    { key: 'admissions', icon: '🛏️', label: 'Ward & Consumables' },
                    { key: 'grievance', icon: '🚨', label: `Raise Grievance (${patientGrievances.length})` }
                  ].map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setPatientTab(tab.key)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 14px',
                        borderRadius: '12px',
                        border: 'none',
                        backgroundColor: patientTab === tab.key ? '#2563eb' : 'transparent',
                        color: patientTab === tab.key ? '#ffffff' : '#94a3b8',
                        fontWeight: patientTab === tab.key ? '700' : '600',
                        fontSize: '13px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        boxShadow: patientTab === tab.key ? '0 4px 14px rgba(37,99,235,0.3)' : 'none'
                      }}>
                      <span>{tab.icon}</span> {tab.label}
                    </button>
                  ))}
                </>
              )}

              {/* Doctor Navigation */}
              {currentUser.role === 'doctor' && (
                <>
                  {[
                    { key: 'waiting', icon: '⏳', label: `Waiting Queue (${doctorQueueData.waitingCount || 0})` },
                    { key: 'all', icon: '📋', label: `All Assigned (${doctorQueueData.totalAssigned || 0})` },
                    { key: 'date-wise', icon: '📅', label: 'Date-wise Schedule' }
                  ].map(filter => (
                    <button
                      key={filter.key}
                      onClick={() => setDoctorViewFilter(filter.key)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 14px',
                        borderRadius: '12px',
                        border: 'none',
                        backgroundColor: doctorViewFilter === filter.key ? '#4f46e5' : 'transparent',
                        color: doctorViewFilter === filter.key ? '#ffffff' : '#94a3b8',
                        fontWeight: doctorViewFilter === filter.key ? '700' : '600',
                        fontSize: '13px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        boxShadow: doctorViewFilter === filter.key ? '0 4px 14px rgba(79,70,229,0.3)' : 'none'
                      }}>
                      <span>{filter.icon}</span> {filter.label}
                    </button>
                  ))}
                </>
              )}

              {/* Lab Navigation */}
              {currentUser.role === 'lab' && (
                <div style={{ color: '#38bdf8', padding: '10px', fontSize: '13px', fontWeight: '600' }}>
                  🧪 Diagnostic Orders ({labOrders.length})
                </div>
              )}

              {/* Pharmacy Navigation */}
              {currentUser.role === 'pharmacy' && (
                <div style={{ color: '#10b981', padding: '10px', fontSize: '13px', fontWeight: '600' }}>
                  💊 Active Prescriptions ({prescriptions.length})
                </div>
              )}

              {/* Ward Navigation */}
              {currentUser.role === 'ward' && (
                <div style={{ color: '#c084fc', padding: '10px', fontSize: '13px', fontWeight: '600' }}>
                  🛏️ Ward Admissions ({admissionsList.length})
                </div>
              )}

              {/* O/P Desk Navigation */}
              {currentUser.role === 'op-desk' && (
                <div style={{ color: '#fbbf24', padding: '10px', fontSize: '13px', fontWeight: '600' }}>
                  🎫 O/P Patient Registration
                </div>
              )}

              {/* Admin Navigation */}
              {currentUser.role === 'admin' && (
                <>
                  {[
                    { key: 'registered-patients', icon: '👥', label: `1. Patients (${registeredPatients.length})` },
                    { key: 'doctors-duty', icon: '👨‍⚕️', label: `2. Doctors (${doctorsList.length})` },
                    { key: 'labs', icon: '🔬', label: `3. Labs (${labOrders.length})` },
                    { key: 'photos', icon: '📸', label: `4. Photos (${adminCategorizedPhotos.length})` },
                    { key: 'discharged-patients', icon: '🏁', label: `5. Discharges (${dischargedPatientsList.length})` },
                    { key: 'grievances', icon: '🚨', label: `6. Grievances (${allHospitalGrievances.length})` }
                  ].map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => { setAdminActiveTab(tab.key); setAdminSearchQuery(''); }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 14px',
                        borderRadius: '12px',
                        border: 'none',
                        backgroundColor: adminActiveTab === tab.key ? '#e11d48' : 'transparent',
                        color: adminActiveTab === tab.key ? '#ffffff' : '#94a3b8',
                        fontWeight: adminActiveTab === tab.key ? '700' : '600',
                        fontSize: '12px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        boxShadow: adminActiveTab === tab.key ? '0 4px 14px rgba(225,29,72,0.3)' : 'none'
                      }}>
                      <span>{tab.icon}</span> {tab.label}
                    </button>
                  ))}
                </>
              )}
            </div>

            {/* Logout Button */}
            <div style={{ paddingTop: '16px', borderTop: '1px solid #1e293b' }}>
              <button
                onClick={handleLogout}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  backgroundColor: '#fee2e2',
                  color: '#991b1b',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}>
                <span>🚪</span> Sign Out
              </button>
            </div>
          </aside>

          {/* RIGHT MAIN CONTENT AREA */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh', overflowX: 'hidden' }}>
            
            {/* Top Breadcrumb & Status Bar */}
            <div style={{
              backgroundColor: '#ffffff',
              borderBottom: '1px solid #e2e8f0',
              padding: '16px 36px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
            }}>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Gandhi Hospital Platform</span>
                <div style={{ fontSize: '16px', fontWeight: '800', color: roleTheme.accent }}>
                  {roleTheme.name}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span style={{ fontSize: '12px', color: '#64748b', backgroundColor: '#f1f5f9', padding: '6px 14px', borderRadius: '9999px', fontWeight: '600' }}>
                  🕒 {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
                <span style={{ fontSize: '12px', color: '#059669', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', padding: '6px 14px', borderRadius: '9999px', fontWeight: '700' }}>
                  ● 100% Free Public Care
                </span>
              </div>
            </div>

            {/* Viewport Content */}
            <main style={{ flex: 1, padding: '32px 36px', display: 'flex', justifyContent: 'center' }}>
              
              {/* 2.1 PATIENT VIEWPORT */}
              {currentUser.role === 'patient' && (
                <div style={{ width: '100%', maxWidth: '920px' }}>
                  
                  {/* Header Card */}
                  <div className="royal-card animate-fade-in" style={{ padding: '28px 32px', marginBottom: '24px', borderLeft: `6px solid ${roleTheme.accent}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                      <div>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Patient Health Record (EHR)</span>
                        <h2 style={{ margin: '4px 0 2px 0', fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>{currentUser.data.name}</h2>
                        <span style={{ fontSize: '13px', color: '#64748b' }}>Patient ID: <strong>{currentUser.data.patientId}</strong> | Mobile: +91 {currentUser.data.phoneNumber}</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Registration Date:</span>
                        <strong style={{ fontSize: '13px', color: '#0f172a' }}>{formatDateTime(currentUser.data.createdAt)}</strong>
                      </div>
                    </div>
                  </div>

                  {/* OVERVIEW TAB */}
                  {patientTab === 'overview' && (
                    <div className="animate-fade-in">
                      {/* Discharge Banner */}
                      {(patientFullFile?.patient?.currentStatus === 'COMPLETED' || patientFullFile?.patient?.dischargeSummary) && (
                        <div className="royal-card" style={{ backgroundColor: '#ecfdf5', border: '1.5px solid #6ee7b7', padding: '22px', marginBottom: '20px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ fontSize: '24px' }}>🏁</span>
                              <div>
                                <strong style={{ color: '#065f46', fontSize: '15px' }}>Outpatient Consultation Completed & Discharge Authorized</strong>
                                <div style={{ fontSize: '12px', color: '#047857' }}>
                                  Discharged by: <strong>{patientFullFile?.patient?.dischargedByDoctorName || activeDoctorName}</strong> • {formatDateTime(patientFullFile?.patient?.dischargedAt || new Date())}
                                </div>
                              </div>
                            </div>
                            <span style={{ padding: '4px 14px', backgroundColor: '#a7f3d0', color: '#065f46', borderRadius: '9999px', fontSize: '12px', fontWeight: '800' }}>
                              {patientFullFile?.patient?.dischargeType || 'Routine Outpatient Completion'}
                            </span>
                          </div>

                          <div style={{ backgroundColor: 'white', padding: '14px', borderRadius: '12px', border: '1px solid #a7f3d0' }}>
                            <div style={{ fontSize: '13px', color: '#0f172a', marginBottom: '6px' }}>
                              <strong>Doctor Summary:</strong> {patientFullFile?.patient?.dischargeSummary || 'Patient examined. Vitals normal.'}
                            </div>
                            <div style={{ fontSize: '12px', color: '#0284c7' }}>
                              <strong>📅 Follow-up:</strong> {patientFullFile?.patient?.followUpAdvice || 'Follow-up after 5-7 days if symptoms persist.'}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Current Action Status Card */}
                      <div className="royal-card" style={{ padding: '20px 24px', marginBottom: '20px', background: 'linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)', border: '1px solid #bfdbfe' }}>
                        <span style={{ fontSize: '11px', color: '#1e40af', textTransform: 'uppercase', fontWeight: '800' }}>Live Action Directive</span>
                        <div style={{ fontSize: '16px', fontWeight: '800', color: '#1e3a8a', marginTop: '4px' }}>
                          {currentUser.data.currentStatus === 'WAITING_FOR_DOCTOR' && (
                            `⏳ Please proceed to ${activeDoctorLocation.room} for consultation with ${activeDoctorName} (${activeDoctorDept})`
                          )}
                          {currentUser.data.currentStatus === 'DIAGNOSTICS_ORDERED' && '🧪 Proceed to Laboratory Room 105 for Sample Collection'}
                          {currentUser.data.currentStatus === 'LAB_COMPLETED' && '📋 Lab reports ready! Return to Doctor for Prescription'}
                          {currentUser.data.currentStatus === 'PHARMACY_QUEUE' && '💊 Proceed to Pharmacy Counter #3 for Medicine Collection'}
                          {currentUser.data.currentStatus === 'ADMITTED' && '🛏️ Inpatient Ward Admission Active'}
                          {currentUser.data.currentStatus === 'COMPLETED' && '✅ Checkup Complete. You may leave the hospital.'}
                        </div>
                      </div>

                      {/* Doctor & Location Info */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                        <div className="royal-card" style={{ padding: '20px' }}>
                          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase' }}>Assigned Physician</div>
                          <div style={{ fontSize: '17px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>👨‍⚕️ {activeDoctorName}</div>
                          <div style={{ fontSize: '13px', color: '#2563eb', fontWeight: '700', marginTop: '2px' }}>Department: {activeDoctorDept}</div>
                        </div>

                        <div className="royal-card" style={{ padding: '20px' }}>
                          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase' }}>Physical Room Location</div>
                          <div style={{ fontSize: '17px', fontWeight: '800', color: '#d97706', marginTop: '4px' }}>📍 {activeDoctorLocation.room}</div>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{activeDoctorLocation.block}</div>
                        </div>
                      </div>

                      {/* Chronological Journey Timeline */}
                      <div className="royal-card" style={{ padding: '26px' }}>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                          📅 Patient Journey & Accountability Timeline
                        </h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {patientFullFile?.timeline?.map((item, idx) => (
                            <div key={idx} className="royal-card royal-card-interactive" onClick={() => setSelectedDetailItem(item)} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', padding: '16px', backgroundColor: '#ffffff' }}>
                              <div style={{ fontSize: '20px', width: '40px', height: '40px', borderRadius: '12px', backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid #bfdbfe' }}>
                                {item.icon}
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                                  <strong style={{ fontSize: '14px', color: '#0f172a' }}>{item.stage}</strong>
                                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    {item.photoProof && (
                                      <span style={{ fontSize: '11px', backgroundColor: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', padding: '2px 8px', borderRadius: '9999px', fontWeight: '800' }}>
                                        📸 Photo Proof
                                      </span>
                                    )}
                                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#2563eb', backgroundColor: '#eff6ff', padding: '2px 10px', borderRadius: '9999px' }}>
                                      🕒 {formatDateTime(item.timestamp)}
                                    </span>
                                  </div>
                                </div>
                                <p style={{ margin: '2px 0', fontSize: '13px', color: '#475569' }}>{item.details}</p>
                                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Staff: <strong>{item.performedBy || item.doctorName}</strong></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* LABS TAB */}
                  {patientTab === 'labs' && (
                    <div className="animate-fade-in">
                      <h3 style={{ margin: '0 0 16px 0', color: '#0f172a', fontSize: '17px' }}>Diagnostic Laboratory Reports</h3>
                      {patientFullFile?.labRequests?.map(lab => (
                        <div key={lab._id} className="royal-card" style={{ padding: '20px', marginBottom: '14px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <strong style={{ fontSize: '15px' }}>{lab.testName}</strong>
                            <span style={{ padding: '4px 12px', borderRadius: '9999px', fontSize: '11px', fontWeight: '800', backgroundColor: lab.status === 'REPORT_READY' ? '#ecfdf5' : '#fffbeb', color: lab.status === 'REPORT_READY' ? '#059669' : '#d97706' }}>
                              {lab.status === 'REPORT_READY' ? '✅ Report Ready' : '⏳ Processing'}
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>Ordered by {lab.doctorName} • {formatDateTime(lab.createdAt)}</div>
                          {lab.findings && (
                            <div style={{ marginTop: '10px', padding: '12px 16px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '13px' }}>
                              <strong>Findings:</strong> {lab.findings}
                            </div>
                          )}
                          {lab.photoProof && (
                            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <img src={lab.photoProof} alt="Proof" style={{ height: '54px', borderRadius: '8px' }} />
                              <span style={{ fontSize: '11px', color: '#059669', fontWeight: '800' }}>✓ Verified diagnostic film attached</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* MEDICINES TAB */}
                  {patientTab === 'medicines' && (
                    <div className="animate-fade-in">
                      <h3 style={{ margin: '0 0 16px 0', color: '#0f172a', fontSize: '17px' }}>Prescribed Medications</h3>
                      {patientFullFile?.prescriptions?.map(rx => (
                        <div key={rx._id} className="royal-card" style={{ padding: '20px', marginBottom: '14px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <strong style={{ fontSize: '14px' }}>Prescription by {rx.doctorName}</strong>
                            <span style={{ padding: '4px 12px', borderRadius: '9999px', fontSize: '11px', fontWeight: '800', backgroundColor: rx.status === 'COMPLETELY_DISPENSED' || rx.status === 'DISPENSED' ? '#ecfdf5' : '#fffbeb', color: rx.status === 'COMPLETELY_DISPENSED' || rx.status === 'DISPENSED' ? '#059669' : '#d97706' }}>
                              {rx.status}
                            </span>
                          </div>
                          <ul style={{ margin: '0 0 10px 0', paddingLeft: '20px', fontSize: '13px' }}>
                            {rx.medicines?.map((m, i) => <li key={i}>{m.name} - {m.dosage} ({m.durationDays} days)</li>)}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ADMISSIONS TAB */}
                  {patientTab === 'admissions' && (
                    <div className="animate-fade-in">
                      <h3 style={{ margin: '0 0 16px 0', color: '#0f172a', fontSize: '17px' }}>Inpatient Ward & Bed Ledger</h3>
                      {patientFullFile?.admission ? (
                        <div className="royal-card" style={{ padding: '22px' }}>
                          <strong>Ward: {patientFullFile.admission.wardType} ({patientFullFile.admission.bedNumber})</strong>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Admitted on: {formatDateTime(patientFullFile.admission.admittedAt)}</div>
                          <h4 style={{ margin: '14px 0 6px 0', fontSize: '13px' }}>Consumables Administered:</h4>
                          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px' }}>
                            {patientFullFile.admission.resourcesAllocated?.map((res, i) => (
                              <li key={i}>{res.itemName} (Qty: {res.quantity}) - {res.loggedByStaff} • {formatDateTime(res.loggedAt)}</li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <p style={{ color: '#64748b', fontSize: '13px' }}>Outpatient record (not admitted to ward).</p>
                      )}
                    </div>
                  )}

                  {/* GRIEVANCE TAB & RESOLUTION PROTOCOL */}
                  {patientTab === 'grievance' && (
                    <div className="animate-fade-in">
                      <div className="royal-card" style={{ backgroundColor: '#fff1f2', border: '1px solid #fecdd3', padding: '20px 24px', marginBottom: '22px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '24px' }}>🚨</span>
                          <div>
                            <h3 style={{ margin: '0 0 2px 0', color: '#9f1239', fontSize: '16px', fontWeight: '800' }}>
                              Gandhi Hospital Anti-Corruption & Vigilance Cell
                            </h3>
                            <p style={{ margin: 0, fontSize: '13px', color: '#881337' }}>
                              Record live video or camera evidence of bribery, delay, or doctor absence. Directly reviewed by the Superintendent.
                            </p>
                          </div>
                        </div>
                      </div>

                      {grievanceMessage && (
                        <div style={{ marginBottom: '16px', padding: '12px 16px', backgroundColor: '#ecfdf5', color: '#065f46', borderRadius: '12px', border: '1px solid #a7f3d0', fontWeight: '700', fontSize: '13px' }}>
                          {grievanceMessage}
                        </div>
                      )}

                      {/* Submission Form */}
                      <div className="royal-card" style={{ padding: '24px', marginBottom: '24px' }}>
                        <h4 style={{ margin: '0 0 14px 0', fontSize: '16px', fontWeight: '800' }}>📝 Submit New Video / Photo Complaint</h4>
                        
                        <form onSubmit={handleGrievanceSubmit}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                            <div>
                              <label style={{ fontSize: '12px', fontWeight: '700', display: 'block', marginBottom: '4px' }}>Problem Category:</label>
                              <select style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '13px' }} value={grievanceForm.category} onChange={e => setGrievanceForm({ ...grievanceForm, category: e.target.value })}>
                                <option>Bribery / Illegal Demands</option>
                                <option>Doctor Delay / Absence</option>
                                <option>Medicines Out of Stock</option>
                                <option>Diagnostic Lab Delay</option>
                                <option>Staff Neglect or Misbehavior</option>
                                <option>Ward Sanitation & Hygiene</option>
                                <option>Emergency Triage Issue</option>
                                <option>Other Grievance</option>
                              </select>
                            </div>

                            <div>
                              <label style={{ fontSize: '12px', fontWeight: '700', display: 'block', marginBottom: '4px' }}>Department / Location:</label>
                              <select style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '13px' }} value={grievanceForm.department} onChange={e => setGrievanceForm({ ...grievanceForm, department: e.target.value })}>
                                <option>Pharmacy Dispensing Counter #3</option>
                                <option>Diagnostic Lab 1 (Room 105)</option>
                                <option>OPD Doctor Chambers (Block A)</option>
                                <option>Inpatient Wards (GW Male/Female)</option>
                                <option>Emergency & Casualty Desk</option>
                                <option>O/P Reception Registration</option>
                              </select>
                            </div>
                          </div>

                          <div style={{ marginBottom: '14px' }}>
                            <label style={{ fontSize: '12px', fontWeight: '700', display: 'block', marginBottom: '4px' }}>Detailed Statement:</label>
                            <textarea rows={3} required placeholder="Describe the issue, staff involved, or room number..." style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }} value={grievanceForm.description} onChange={e => setGrievanceForm({ ...grievanceForm, description: e.target.value })} />
                          </div>

                          {/* Media Capture Viewfinder */}
                          <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
                            <span style={{ fontSize: '12px', fontWeight: '800', color: '#0f172a', display: 'block', marginBottom: '8px' }}>
                              📷 Video & Photo Evidence Attachment:
                            </span>

                            {grievanceCameraActive && (
                              <div style={{ marginBottom: '12px', backgroundColor: '#070e1e', borderRadius: '16px', overflow: 'hidden', padding: '8px', textAlign: 'center' }}>
                                <video ref={grievanceVideoRef} autoPlay playsInline muted style={{ maxWidth: '100%', height: '220px', borderRadius: '10px', objectFit: 'cover' }} />
                                
                                {isRecordingGrievanceVideo && (
                                  <div style={{ color: '#fb7185', fontWeight: '700', fontSize: '13px', marginTop: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                    <span>🔴</span> RECORDING: 00:{recordingSeconds < 10 ? `0${recordingSeconds}` : recordingSeconds} / 00:30 max
                                  </div>
                                )}

                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '10px' }}>
                                  {!isRecordingGrievanceVideo ? (
                                    <>
                                      <button type="button" onClick={snapGrievancePhoto} style={{ padding: '8px 18px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '9999px', fontWeight: '700', cursor: 'pointer', fontSize: '12px' }}>
                                        📸 Snap Photo
                                      </button>
                                      <button type="button" onClick={startGrievanceVideoRecording} style={{ padding: '8px 18px', backgroundColor: '#e11d48', color: 'white', border: 'none', borderRadius: '9999px', fontWeight: '700', cursor: 'pointer', fontSize: '12px' }}>
                                        🎥 Record Video
                                      </button>
                                      <button type="button" onClick={stopGrievanceCamera} style={{ padding: '8px 14px', backgroundColor: '#64748b', color: 'white', border: 'none', borderRadius: '9999px', cursor: 'pointer', fontSize: '12px' }}>
                                        Cancel
                                      </button>
                                    </>
                                  ) : (
                                    <button type="button" onClick={stopGrievanceVideoRecording} style={{ padding: '8px 22px', backgroundColor: '#059669', color: 'white', border: 'none', borderRadius: '9999px', fontWeight: '700', cursor: 'pointer', fontSize: '13px' }}>
                                      ⏹️ Stop Recording & Attach ➔
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}

                            {grievanceForm.mediaUrl ? (
                              <div style={{ backgroundColor: '#ffffff', padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  {grievanceForm.mediaType === 'photo' ? (
                                    <img src={grievanceForm.mediaUrl} alt="Evidence" style={{ height: '60px', borderRadius: '8px' }} />
                                  ) : (
                                    <video src={grievanceForm.mediaUrl} controls style={{ height: '60px', borderRadius: '8px' }} />
                                  )}
                                  <div>
                                    <strong style={{ fontSize: '13px', color: '#059669' }}>
                                      {grievanceForm.mediaType === 'video' ? '🎥 Video Attached' : '📸 Photo Attached'}
                                    </strong>
                                  </div>
                                </div>

                                <button type="button" onClick={() => setGrievanceForm({ ...grievanceForm, mediaType: 'none', mediaUrl: '' })} style={{ padding: '6px 12px', backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: '9999px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                                  Remove
                                </button>
                              </div>
                            ) : (
                              !grievanceCameraActive && (
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                  <button type="button" onClick={startGrievanceCamera} style={{ padding: '8px 16px', backgroundColor: '#070e1e', color: 'white', border: 'none', borderRadius: '9999px', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>
                                    <span>📷</span> Turn on Camera (Photo / Video)
                                  </button>
                                  <button type="button" onClick={() => setGrievanceForm({ ...grievanceForm, mediaType: 'photo', mediaUrl: generateMedicalPresetImage('grievance', 'Counter Overcharge Demo', 'Pharmacy Counter #3') })} style={{ padding: '8px 14px', backgroundColor: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '9999px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                                    ⚡ Preset Demo Evidence
                                  </button>
                                </div>
                              )
                            )}
                          </div>

                          <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#e11d48', color: 'white', border: 'none', borderRadius: '9999px', fontSize: '14px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 4px 16px rgba(225,29,72,0.3)' }}>
                            🚨 Submit Grievance with Evidence ➔
                          </button>
                        </form>
                      </div>

                      {/* Grievance Ledger & Resolution Protocol */}
                      <div>
                        <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '800' }}>
                          📊 My Grievance Status & Signals ({patientGrievances.length})
                        </h4>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                          {patientGrievances.map(grv => {
                            const isRed = grv.status === 'SUBMITTED'
                            const isGreen = grv.status === 'RESOLVED' && grv.patientConfirmedResolved
                            const isOrange = !isRed && !isGreen

                            return (
                              <div key={grv.grievanceId} className="royal-card" style={{ border: `1.5px solid ${isGreen ? '#6ee7b7' : isOrange ? '#fde68a' : '#fecdd3'}`, padding: '20px', backgroundColor: isGreen ? '#ecfdf5' : isOrange ? '#fffbeb' : '#fff1f2' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                                  <div>
                                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700' }}>{grv.grievanceId} • {grv.department}</span>
                                    <h4 style={{ margin: '2px 0 0 0', color: '#0f172a', fontSize: '15px' }}>{grv.category}</h4>
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'white', padding: '4px 12px', borderRadius: '9999px', border: `1px solid ${isGreen ? '#a7f3d0' : isOrange ? '#fde68a' : '#fecdd3'}` }}>
                                    <span>{isGreen ? '🟢' : isOrange ? '🟠' : '🔴'}</span>
                                    <strong style={{ fontSize: '11px', color: isGreen ? '#059669' : isOrange ? '#d97706' : '#e11d48' }}>
                                      {isGreen ? 'RESOLVED (APPROVED BY YOU)' : isOrange ? (grv.adminReply ? 'ACTION TAKEN (CONFIRM BELOW)' : 'UNDER INVESTIGATION') : 'SUBMITTED (AWAITING REVIEW)'}
                                    </strong>
                                  </div>
                                </div>

                                <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#334155' }}>
                                  <strong>Statement:</strong> "{grv.description}"
                                </p>

                                {grv.mediaUrl && (
                                  <div style={{ margin: '8px 0' }}>
                                    {grv.mediaType === 'video' ? (
                                      <video src={grv.mediaUrl} controls style={{ maxHeight: '160px', borderRadius: '10px' }} />
                                    ) : (
                                      <img src={grv.mediaUrl} alt="Evidence" style={{ maxHeight: '120px', borderRadius: '10px' }} />
                                    )}
                                  </div>
                                )}

                                {grv.adminReply ? (
                                  <div style={{ backgroundColor: '#ffffff', padding: '14px', borderRadius: '14px', border: '1px solid #cbd5e1', marginTop: '10px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                      <strong style={{ fontSize: '12px', color: '#059669' }}>💬 Superintendent Response:</strong>
                                      <span style={{ fontSize: '11px', color: '#2563eb' }}>🕒 {formatDateTime(grv.adminRepliedAt)}</span>
                                    </div>
                                    <p style={{ margin: '2px 0 6px 0', fontSize: '13px', color: '#0f172a' }}>"{grv.adminReply}"</p>
                                    <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Officer: {grv.adminRepliedBy}</span>

                                    {!grv.patientConfirmedResolved ? (
                                      <div style={{ backgroundColor: '#fff7ed', border: '1px solid #fed7aa', padding: '12px 14px', borderRadius: '12px', marginTop: '10px' }}>
                                        <div style={{ fontSize: '12px', fontWeight: '700', color: '#9a3412', marginBottom: '4px' }}>
                                          🛡️ Resolution Confirmation: Has your issue been solved on the ground?
                                        </div>
                                        <p style={{ fontSize: '11px', color: '#7c2d12', margin: '0 0 8px 0' }}>
                                          Only YOU have the authority to grant permission to close this issue as Green 🟢.
                                        </p>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                          <button onClick={() => handlePatientConfirmResolution(grv.grievanceId, true)} style={{ padding: '6px 14px', backgroundColor: '#059669', color: 'white', border: 'none', borderRadius: '9999px', fontWeight: '700', fontSize: '11px', cursor: 'pointer' }}>
                                            ✅ Yes, Issue Fixed (Turn Green 🟢)
                                          </button>
                                          <button onClick={() => handlePatientConfirmResolution(grv.grievanceId, false)} style={{ padding: '6px 14px', backgroundColor: '#e11d48', color: 'white', border: 'none', borderRadius: '9999px', fontWeight: '700', fontSize: '11px', cursor: 'pointer' }}>
                                            ❌ No, Still Pending (Stay Orange 🟠)
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#ecfdf5', padding: '8px 12px', borderRadius: '10px', border: '1px solid #a7f3d0', marginTop: '10px' }}>
                                        <span style={{ fontSize: '14px' }}>🟢</span>
                                        <strong style={{ fontSize: '11px', color: '#059669' }}>
                                          Resolution verified & approved by you on {formatDateTime(grv.patientResolvedAt)}
                                        </strong>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div style={{ fontSize: '11px', color: '#be123c', fontStyle: 'italic', marginTop: '6px' }}>
                                    ⏳ Evidence uploaded to hospital server. Awaiting review by Superintendent.
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>

                    </div>
                  )}

                </div>
              )}

              {/* 2.2 DOCTOR VIEWPORT */}
              {currentUser.role === 'doctor' && (
                <div style={{ width: '100%', maxWidth: '1040px' }} className="animate-fade-in">
                  
                  {/* Doctor Profile Card */}
                  <div className="royal-card" style={{ padding: '22px 28px', marginBottom: '20px', borderLeft: '6px solid #4f46e5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                    <div>
                      <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>Physician On Duty</span>
                      <h2 style={{ margin: '2px 0 0 0', color: '#0f172a', fontSize: '20px', fontWeight: '800' }}>{currentUser.data.name}</h2>
                      <span style={{ fontSize: '13px', color: '#4f46e5', fontWeight: '700' }}>
                        {currentUser.data.department} • 📍 {DEPARTMENT_LOCATIONS[currentUser.data.department]?.room} ({DEPARTMENT_LOCATIONS[currentUser.data.department]?.block})
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>Switch Doctor:</label>
                      <select style={{ padding: '8px 14px', borderRadius: '9999px', border: '1px solid #cbd5e1', fontSize: '13px' }} value={selectedDoctorId} onChange={e => {
                        const doc = doctorsList.find(d => d.doctorId === e.target.value)
                        if (doc) persistLogin('doctor', doc)
                        setSelectedDoctorId(e.target.value)
                        setActivePatientForExam(null)
                      }}>
                        {doctorsList.map(d => <option key={d.doctorId} value={d.doctorId}>{d.name} ({d.department})</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Doctor View Workspace */}
                  <div style={{ display: 'grid', gridTemplateColumns: activePatientForExam ? '1fr 1.3fr' : '1fr', gap: '20px' }}>
                    
                    {/* Patient Queue */}
                    <div className="royal-card" style={{ padding: '24px' }}>
                      <h3 style={{ margin: '0 0 14px 0', fontSize: '15px', fontWeight: '800' }}>
                        {doctorViewFilter === 'waiting' && `⏳ Patients in Waiting Queue (${displayedDoctorPatients.length})`}
                        {doctorViewFilter === 'all' && `📋 All Patients Assigned (${displayedDoctorPatients.length})`}
                        {doctorViewFilter === 'date-wise' && `📅 Patients on ${selectedDateFilter} (${displayedDoctorPatients.length})`}
                      </h3>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '560px', overflowY: 'auto' }}>
                        {displayedDoctorPatients.map((p, i) => (
                          <div key={p.patientId} onClick={() => inspectPatientTimeline(p)} className="royal-card royal-card-interactive" style={{ border: activePatientForExam?.patientId === p.patientId ? '2px solid #4f46e5' : '1px solid #e2e8f0', padding: '12px 14px', backgroundColor: activePatientForExam?.patientId === p.patientId ? '#eef2ff' : '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <strong style={{ fontSize: '14px' }}>#{i + 1} {p.name}</strong>
                              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{p.patientId} • {p.age}y {p.gender}</div>
                            </div>
                            <span style={{ padding: '3px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: '700', backgroundColor: '#eef2ff', color: '#4f46e5' }}>
                              {p.currentStatus.replace(/_/g, ' ')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Examination Desk */}
                    {activePatientForExam && (
                      <div className="royal-card" style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '14px' }}>
                          <div>
                            <span style={{ fontSize: '11px', color: '#4f46e5', fontWeight: '800' }}>Active Examination File</span>
                            <h3 style={{ margin: '2px 0 0 0', fontSize: '16px', fontWeight: '800' }}>{activePatientForExam.name} ({activePatientForExam.patientId})</h3>
                          </div>
                          <button onClick={() => setActivePatientForExam(null)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer' }}>✕</button>
                        </div>

                        {/* Action Tabs */}
                        <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', flexWrap: 'wrap' }}>
                          <button onClick={() => setDoctorActionTab('lab')} style={{ padding: '6px 12px', fontSize: '12px', border: 'none', borderRadius: '9999px', backgroundColor: doctorActionTab === 'lab' ? '#4f46e5' : '#f1f5f9', color: doctorActionTab === 'lab' ? 'white' : '#475569', cursor: 'pointer', fontWeight: '700' }}>🧪 Order Lab</button>
                          <button onClick={() => setDoctorActionTab('rx')} style={{ padding: '6px 12px', fontSize: '12px', border: 'none', borderRadius: '9999px', backgroundColor: doctorActionTab === 'rx' ? '#4f46e5' : '#f1f5f9', color: doctorActionTab === 'rx' ? 'white' : '#475569', cursor: 'pointer', fontWeight: '700' }}>💊 Prescribe</button>
                          <button onClick={() => setDoctorActionTab('discharge')} style={{ padding: '6px 12px', fontSize: '12px', border: 'none', borderRadius: '9999px', backgroundColor: doctorActionTab === 'discharge' ? '#059669' : '#ecfdf5', color: doctorActionTab === 'discharge' ? 'white' : '#065f46', cursor: 'pointer', fontWeight: '800' }}>🏁 Discharge</button>
                        </div>

                        {doctorActionTab === 'lab' && (
                          <form onSubmit={handleDoctorOrderLab}>
                            <select style={{ width: '100%', padding: '10px', borderRadius: '12px', border: '1px solid #cbd5e1', marginBottom: '10px', fontSize: '13px' }} value={selectedTest} onChange={e => setSelectedTest(e.target.value)}>
                              <option>Complete Blood Count (CBC)</option>
                              <option>Serum Creatinine & Urea</option>
                              <option>Lipid Profile</option>
                              <option>Chest X-Ray (PA View)</option>
                            </select>
                            <button type="submit" style={{ width: '100%', padding: '10px', backgroundColor: '#0284c7', color: 'white', border: 'none', borderRadius: '9999px', fontWeight: '800', cursor: 'pointer', fontSize: '13px' }}>
                              Order Diagnostic Test ➔
                            </button>
                          </form>
                        )}

                        {doctorActionTab === 'rx' && (
                          <form onSubmit={handleDoctorPrescribe}>
                            <input type="text" style={{ width: '100%', padding: '10px', borderRadius: '12px', border: '1px solid #cbd5e1', marginBottom: '10px', fontSize: '13px' }} value={rxMedicines} onChange={e => setRxMedicines(e.target.value)} />
                            <button type="submit" style={{ width: '100%', padding: '10px', backgroundColor: '#059669', color: 'white', border: 'none', borderRadius: '9999px', fontWeight: '800', cursor: 'pointer', fontSize: '13px' }}>
                              Send Prescription to Pharmacy ➔
                            </button>
                          </form>
                        )}

                        {doctorActionTab === 'discharge' && (
                          <form onSubmit={handleDoctorDischargeSubmit}>
                            <textarea rows={3} style={{ width: '100%', padding: '10px', borderRadius: '12px', border: '1px solid #cbd5e1', marginBottom: '10px', fontSize: '13px', boxSizing: 'border-box' }} value={dischargeSummaryText} onChange={e => setDischargeSummaryText(e.target.value)} />
                            <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#059669', color: 'white', border: 'none', borderRadius: '9999px', fontWeight: '800', cursor: 'pointer', fontSize: '13px' }}>
                              🏁 Authorize Discharge & Complete ➔
                            </button>
                          </form>
                        )}
                      </div>
                    )}

                  </div>
                </div>
              )}

              {/* 2.3 LAB VIEWPORT */}
              {currentUser.role === 'lab' && (
                <div style={{ width: '100%', maxWidth: '880px' }} className="animate-fade-in">
                  <div className="royal-card" style={{ padding: '24px', borderLeft: '6px solid #0284c7', marginBottom: '20px' }}>
                    <h2 style={{ margin: '0 0 4px 0', fontSize: '20px' }}>🔬 Diagnostic Laboratory Monitor</h2>
                    <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>Verify sample collections and publish diagnostic report films with live camera proof.</p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {labOrders.map(order => (
                      <div key={order._id} className="royal-card" style={{ padding: '18px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <div>
                            <strong style={{ fontSize: '15px' }}>{order.testName}</strong>
                            <div style={{ fontSize: '12px', color: '#64748b' }}>Patient: {order.patientId} • Ordered by: {order.doctorName}</div>
                          </div>
                          <span style={{ padding: '3px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: '700', backgroundColor: order.status === 'REPORT_READY' ? '#ecfdf5' : '#fffbeb', color: order.status === 'REPORT_READY' ? '#059669' : '#d97706' }}>
                            {order.status}
                          </span>
                        </div>

                        {order.status === 'PENDING' && (
                          <button onClick={() => openCameraModal(`📸 Sample Tube Proof (${order.testName})`, 'lab', order._id, (p) => executeLabCollectWithPhoto(order._id, p))} style={{ padding: '8px 18px', backgroundColor: '#0284c7', color: 'white', border: 'none', borderRadius: '9999px', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>
                            <span>📷</span> Collect Sample with Camera Proof
                          </button>
                        )}

                        {order.status === 'SAMPLE_COLLECTED' && (
                          <div>
                            <input type="text" placeholder="Enter findings e.g. Hb 13.8 g/dL" style={{ width: '100%', padding: '10px', borderRadius: '12px', border: '1px solid #cbd5e1', marginBottom: '8px' }} onChange={e => setLabFindingsInput({...labFindingsInput, [order._id]: e.target.value})} />
                            <button onClick={() => openCameraModal(`📸 Diagnostic Sheet Proof (${order.testName})`, 'lab', order._id, (p) => executeLabPublishWithPhoto(order._id, p))} style={{ padding: '8px 18px', backgroundColor: '#059669', color: 'white', border: 'none', borderRadius: '9999px', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>
                              <span>📷</span> Publish Report with Camera Proof
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 2.4 PHARMACY VIEWPORT */}
              {currentUser.role === 'pharmacy' && (
                <div style={{ width: '100%', maxWidth: '880px' }} className="animate-fade-in">
                  <div className="royal-card" style={{ padding: '24px', borderLeft: '6px solid #059669', marginBottom: '20px' }}>
                    <h2 style={{ margin: '0 0 4px 0', fontSize: '20px' }}>💊 Pharmacy Dispensing Counter</h2>
                    <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>Dispense prescribed medications with mandatory live camera handover evidence.</p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {prescriptions.map(rx => (
                      <div key={rx._id} className="royal-card" style={{ padding: '18px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <strong style={{ fontSize: '14px' }}>Patient: {rx.patientId} (Dr: {rx.doctorName})</strong>
                          <span style={{ padding: '3px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: '700', backgroundColor: rx.status === 'COMPLETELY_DISPENSED' || rx.status === 'DISPENSED' ? '#ecfdf5' : '#fffbeb', color: rx.status === 'COMPLETELY_DISPENSED' || rx.status === 'DISPENSED' ? '#059669' : '#d97706' }}>
                            {rx.status}
                          </span>
                        </div>
                        <ul style={{ margin: '0 0 10px 0', paddingLeft: '20px', fontSize: '13px' }}>
                          {rx.medicines.map((m, i) => <li key={i}>{m.name} - {m.dosage}</li>)}
                        </ul>

                        {rx.status !== 'COMPLETELY_DISPENSED' && rx.status !== 'DISPENSED' && (
                          <button onClick={() => openCameraModal(`📸 Dispensing Proof (${rx.patientId})`, 'pharmacy', rx._id, (p) => executeDispenseWithPhoto(rx._id, p))} style={{ padding: '8px 18px', backgroundColor: '#059669', color: 'white', border: 'none', borderRadius: '9999px', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>
                            <span>📷</span> Dispense with Camera Proof
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 2.5 WARD VIEWPORT */}
              {currentUser.role === 'ward' && (
                <div style={{ width: '100%', maxWidth: '880px' }} className="animate-fade-in">
                  <div className="royal-card" style={{ padding: '24px', borderLeft: '6px solid #7c3aed', marginBottom: '20px' }}>
                    <h2 style={{ margin: '0 0 4px 0', fontSize: '20px' }}>🛏️ Inpatient Ward & Supply Tracker</h2>
                    <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>Track bed allocations and consumable items with live camera verification.</p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {displayedWardList.map(adm => (
                      <div key={adm._id} className="royal-card" style={{ padding: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <div>
                            <strong style={{ fontSize: '15px' }}>{adm.patientName || adm.patientId}</strong> ({adm.wardType} - {adm.bedNumber})
                          </div>
                          {adm.status === 'ADMITTED' && (
                            <button onClick={() => handleDischarge(adm._id)} style={{ padding: '6px 14px', backgroundColor: '#059669', color: 'white', border: 'none', borderRadius: '9999px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                              🏁 Discharge Bed
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 2.6 O/P DESK VIEWPORT */}
              {currentUser.role === 'op-desk' && (
                <div style={{ width: '100%', maxWidth: '600px' }} className="animate-fade-in">
                  <div className="royal-card" style={{ padding: '32px', borderLeft: '6px solid #d97706' }}>
                    <h2 style={{ margin: '0 0 4px 0', fontSize: '20px' }}>🎫 O/P Registration Desk</h2>
                    <p style={{ margin: '0 0 20px 0', color: '#64748b', fontSize: '13px' }}>Create new outpatient record and send credentials via WhatsApp.</p>

                    <form onSubmit={handleOpRegister}>
                      <div style={{ marginBottom: '12px' }}>
                        <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>Patient Full Name</label>
                        <input required type="text" placeholder="e.g. Rahul Sharma" style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} value={opForm.name} onChange={e => setOpForm({...opForm, name: e.target.value})} />
                      </div>

                      <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>Age</label>
                          <input required type="number" placeholder="42" style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} value={opForm.age} onChange={e => setOpForm({...opForm, age: e.target.value})} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>Gender</label>
                          <select style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid #cbd5e1', backgroundColor: 'white', boxSizing: 'border-box' }} value={opForm.gender} onChange={e => setOpForm({...opForm, gender: e.target.value})}>
                            <option>Male</option>
                            <option>Female</option>
                            <option>Other</option>
                          </select>
                        </div>
                      </div>

                      <div style={{ marginBottom: '16px' }}>
                        <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>WhatsApp Mobile Number</label>
                        <input required type="tel" placeholder="e.g. 9876543210" style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} value={opForm.phoneNumber} onChange={e => setOpForm({...opForm, phoneNumber: e.target.value})} />
                      </div>

                      <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#d97706', color: 'white', border: 'none', borderRadius: '9999px', fontSize: '14px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 4px 14px rgba(217,119,6,0.3)' }}>
                        Register Patient & Auto-Assign Desk ➔
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* 2.7 ADMIN VIEWPORT */}
              {currentUser.role === 'admin' && (
                <div style={{ width: '100%', maxWidth: '1040px' }} className="animate-fade-in">
                  
                  {/* Admin Header */}
                  <div className="royal-card" style={{ padding: '24px 32px', marginBottom: '24px', borderLeft: '6px solid #e11d48', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800' }}>📊 Hospital Administration Console</h2>
                        <span style={{ backgroundColor: '#ecfdf5', color: '#059669', padding: '3px 12px', borderRadius: '9999px', fontSize: '11px', fontWeight: '800', border: '1px solid #a7f3d0' }}>● Live Sync</span>
                      </div>
                      <p style={{ margin: '2px 0 0 0', color: '#64748b', fontSize: '13px' }}>
                        Full transparency oversight across Patients, Doctors on Shift, Diagnostic Labs, Photos, Discharges, and Video Grievances.
                      </p>
                    </div>

                    <button onClick={() => { fetchHospitalStats(); fetchHospitalAuditTrail(); fetchDoctors(); fetchPatientsList(); fetchLabOrders(); fetchPrescriptions(); fetchAdmissions(); fetchAllHospitalGrievances(); }} style={{ padding: '8px 18px', backgroundColor: '#070e1e', color: 'white', border: 'none', borderRadius: '9999px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
                      <span>🔄</span> Refresh Data
                    </button>
                  </div>

                  {/* SECTION 1: REGISTERED PATIENTS */}
                  {adminActiveTab === 'registered-patients' && (
                    <div className="royal-card" style={{ padding: '24px' }}>
                      <h3 style={{ margin: '0 0 14px 0', fontSize: '16px' }}>👥 Registered Patients</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {filteredAdminRegisteredPatients.map((p, idx) => (
                          <div key={p.patientId} onClick={() => handleAdminInspectPatient(p.patientId)} className="royal-card royal-card-interactive" style={{ padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <strong>#{idx + 1} {p.name}</strong> ({p.patientId})
                              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Mobile: +91 {p.phoneNumber} • Reg: {formatDateTime(p.createdAt)}</div>
                            </div>
                            <span style={{ fontSize: '12px', color: '#2563eb', fontWeight: '800' }}>Open Patient File ➔</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* SECTION 2: DOCTORS ON DUTY */}
                  {adminActiveTab === 'doctors-duty' && (
                    <div className="royal-card" style={{ padding: '24px' }}>
                      <h3 style={{ margin: '0 0 14px 0', fontSize: '16px' }}>👨‍⚕️ Doctors on Duty</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                        {doctorsList.map(doc => (
                          <div key={doc.doctorId} onClick={() => setAdminSelectedDoctor(doc)} className="royal-card royal-card-interactive" style={{ padding: '16px' }}>
                            <strong style={{ fontSize: '15px' }}>{doc.name}</strong>
                            <div style={{ fontSize: '12px', color: '#4f46e5', fontWeight: '700' }}>{doc.department}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* SECTION 3: LABS */}
                  {adminActiveTab === 'labs' && (
                    <div className="royal-card" style={{ padding: '24px' }}>
                      <h3 style={{ margin: '0 0 14px 0', fontSize: '16px' }}>🔬 Diagnostic Laboratory Orders</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {labOrders.map(lab => (
                          <div key={lab._id} className="royal-card" style={{ padding: '14px' }}>
                            <strong>{lab.testName}</strong> (Patient: {lab.patientId})
                            <div style={{ fontSize: '11px', color: '#64748b' }}>Status: {lab.status}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* SECTION 4: PHOTOS */}
                  {adminActiveTab === 'photos' && (
                    <div className="royal-card" style={{ padding: '24px' }}>
                      <h3 style={{ margin: '0 0 14px 0', fontSize: '16px' }}>📸 Verified Photographic Proofs</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
                        {adminCategorizedPhotos.map((item, idx) => (
                          <div key={idx} className="royal-card" style={{ overflow: 'hidden' }}>
                            <img src={item.photoProof} alt="Proof" style={{ width: '100%', height: '160px', objectFit: 'cover' }} />
                            <div style={{ padding: '12px' }}>
                              <strong style={{ fontSize: '12px', display: 'block' }}>{item.itemSummary}</strong>
                              <span style={{ fontSize: '11px', color: '#64748b' }}>Patient: {item.patientId}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* SECTION 5: DISCHARGES */}
                  {adminActiveTab === 'discharged-patients' && (
                    <div className="royal-card" style={{ padding: '24px' }}>
                      <h3 style={{ margin: '0 0 14px 0', fontSize: '16px' }}>🏁 Discharged Patients Permanent Archive</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {filteredAdminDischargedPatients.map((p, idx) => (
                          <div key={p.patientId} onClick={() => handleAdminInspectPatient(p.patientId)} className="royal-card royal-card-interactive" style={{ border: '1px solid #a7f3d0', padding: '14px', backgroundColor: '#ecfdf5' }}>
                            <strong>#{idx + 1} {p.name}</strong> ({p.patientId}) - Discharged
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* SECTION 6: 🚨 GRIEVANCE OVERSIGHT */}
                  {adminActiveTab === 'grievances' && (
                    <div className="royal-card" style={{ padding: '24px' }}>
                      <h3 style={{ margin: '0 0 14px 0', color: '#9f1239', fontSize: '16px' }}>🚨 Patient Video / Photo Grievances</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {allHospitalGrievances.map(grv => {
                          const isGreen = grv.status === 'RESOLVED' && grv.patientConfirmedResolved
                          return (
                            <div key={grv.grievanceId} className="royal-card" style={{ border: `1.5px solid ${isGreen ? '#6ee7b7' : '#fde68a'}`, padding: '16px', backgroundColor: isGreen ? '#ecfdf5' : '#fffbeb' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                  <strong>{grv.patientName} ({grv.patientId})</strong> - {grv.category}
                                  <div style={{ fontSize: '12px', color: '#64748b' }}>"{grv.description}"</div>
                                </div>
                                <button onClick={() => { setSelectedAdminGrievance(grv); setAdminGrievanceReplyText(grv.adminReply || ''); }} style={{ padding: '6px 14px', backgroundColor: '#070e1e', color: 'white', border: 'none', borderRadius: '9999px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                                  🔍 Watch & Reply
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                </div>
              )}

            </main>
          </div>
        </div>
      )}

      {/* MODALS (ADMIN VIDEO WATCH & RESOLUTION, DETAIL INSPECTOR, LOGIN, WEBCAM) */}
      {selectedAdminGrievance && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(7, 14, 30, 0.75)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 14000, padding: '20px' }}>
          <div className="royal-card animate-fade-in" style={{ backgroundColor: 'white', width: '100%', maxWidth: '600px', borderRadius: '24px', padding: '30px', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
            <button onClick={() => setSelectedAdminGrievance(null)} style={{ position: 'absolute', top: '18px', right: '18px', background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer' }}>✕</button>
            <h3 style={{ margin: '0 0 6px 0' }}>{selectedAdminGrievance.category}</h3>
            <p style={{ margin: '0 0 14px 0', fontSize: '13px', color: '#64748b' }}>Patient: {selectedAdminGrievance.patientName} ({selectedAdminGrievance.patientId})</p>

            {selectedAdminGrievance.mediaUrl && (
              <div style={{ backgroundColor: '#070e1e', padding: '8px', borderRadius: '16px', textAlign: 'center', marginBottom: '14px' }}>
                {selectedAdminGrievance.mediaType === 'video' ? (
                  <video src={selectedAdminGrievance.mediaUrl} controls autoPlay style={{ width: '100%', maxHeight: '240px', borderRadius: '10px' }} />
                ) : (
                  <img src={selectedAdminGrievance.mediaUrl} alt="Evidence" style={{ width: '100%', maxHeight: '240px', borderRadius: '10px', objectFit: 'contain' }} />
                )}
              </div>
            )}

            <form onSubmit={handleAdminRespondToGrievance}>
              <label style={{ fontSize: '12px', fontWeight: '700', display: 'block', marginBottom: '4px' }}>Official Response to Patient:</label>
              <textarea rows={3} required placeholder="Type the action taken e.g. Staff reprimanded, medicine issued immediately..." style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid #cbd5e1', marginBottom: '14px', boxSizing: 'border-box' }} value={adminGrievanceReplyText} onChange={e => setAdminGrievanceReplyText(e.target.value)} />
              <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#059669', color: 'white', border: 'none', borderRadius: '9999px', fontWeight: '800', fontSize: '13px', cursor: 'pointer' }}>
                Send Response to Patient ➔
              </button>
            </form>
          </div>
        </div>
      )}

      {adminInspectedPatientFile && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(7, 14, 30, 0.75)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 12000, padding: '20px' }}>
          <div className="royal-card animate-fade-in" style={{ backgroundColor: 'white', width: '100%', maxWidth: '820px', borderRadius: '24px', padding: '32px', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
            <button onClick={() => setAdminInspectedPatientFile(null)} style={{ position: 'absolute', top: '18px', right: '18px', background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer' }}>✕</button>
            <h2 style={{ margin: '0 0 4px 0' }}>{adminInspectedPatientFile.patient?.name}</h2>
            <span style={{ fontSize: '13px', color: '#64748b' }}>ID: {adminInspectedPatientFile.patient?.patientId} • Mobile: +91 {adminInspectedPatientFile.patient?.phoneNumber}</span>

            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {adminInspectedPatientFile.timeline?.map((item, idx) => (
                <div key={idx} style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '13px' }}>
                  <strong>{item.stage}</strong> - {item.details}
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{formatDateTime(item.timestamp)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {cameraModal.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(7, 14, 30, 0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 12000, padding: '20px' }}>
          <div className="royal-card animate-fade-in" style={{ backgroundColor: 'white', width: '100%', maxWidth: '580px', borderRadius: '24px', padding: '28px', position: 'relative' }}>
            <button onClick={() => { if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop()); setCameraModal({ isOpen: false }); }} style={{ position: 'absolute', top: '18px', right: '18px', background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer' }}>✕</button>
            <h3 style={{ margin: '0 0 12px 0' }}>{cameraModal.title}</h3>

            {!capturedPhotoPreview ? (
              <div>
                <div style={{ backgroundColor: '#070e1e', borderRadius: '16px', overflow: 'hidden', height: '240px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '14px' }}>
                  <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <button onClick={snapWebcamPhoto} style={{ width: '100%', padding: '12px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '9999px', fontWeight: '800', fontSize: '13px', cursor: 'pointer' }}>
                  📸 Snap Live Photo Proof
                </button>
              </div>
            ) : (
              <div>
                <img src={capturedPhotoPreview} alt="Proof" style={{ width: '100%', maxHeight: '240px', borderRadius: '14px', objectFit: 'contain', marginBottom: '14px' }} />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => { setCapturedPhotoPreview(null); startWebcam(); }} style={{ flex: 1, padding: '10px', backgroundColor: '#f1f5f9', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '9999px', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>🔄 Retake</button>
                  <button onClick={confirmCapturedPhoto} style={{ flex: 1.4, padding: '10px', backgroundColor: '#059669', color: 'white', border: 'none', borderRadius: '9999px', fontWeight: '800', fontSize: '12px', cursor: 'pointer' }}>✅ Confirm Proof</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showLoginModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(7, 14, 30, 0.75)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 }}>
          <div className="royal-card animate-fade-in" style={{ backgroundColor: 'white', width: '100%', maxWidth: '480px', borderRadius: '24px', padding: '32px', position: 'relative' }}>
            <button onClick={() => setShowLoginModal(false)} style={{ position: 'absolute', top: '18px', right: '18px', background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer' }}>✕</button>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '18px' }}>Portal Authentication</h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b' }}>Select your station role to log in:</p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '18px' }}>
              {[
                { key: 'patient', label: '👤 Patient' },
                { key: 'op-desk', label: '🎫 O/P Staff' },
                { key: 'doctor', label: '👨‍⚕️ Doctor' },
                { key: 'lab', label: '🔬 Lab' },
                { key: 'pharmacy', label: '💊 Pharmacy' },
                { key: 'ward', label: '🛏️ Ward' },
                { key: 'admin', label: '📊 Admin' }
              ].map(r => (
                <button
                  key={r.key}
                  onClick={() => {
                    if (r.key === 'lab' || r.key === 'pharmacy' || r.key === 'ward' || r.key === 'admin') {
                      handleRoleSelectLogin(r.key, { name: r.label })
                    } else {
                      setLoginRole(r.key)
                    }
                  }}
                  style={{
                    padding: '8px 4px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: loginRole === r.key ? '#070e1e' : '#f8fafc',
                    color: loginRole === r.key ? 'white' : '#334155',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}>
                  {r.label}
                </button>
              ))}
            </div>

            {loginRole === 'patient' && (
              <div>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
                  <button onClick={() => setPatientLoginMode('password')} style={{ flex: 1, padding: '6px', fontSize: '11px', border: '1px solid #cbd5e1', borderRadius: '9999px', backgroundColor: patientLoginMode === 'password' ? '#070e1e' : '#f8fafc', color: patientLoginMode === 'password' ? 'white' : '#334155', cursor: 'pointer', fontWeight: '700' }}>PIN Login</button>
                  <button onClick={() => setPatientLoginMode('quick')} style={{ flex: 1, padding: '6px', fontSize: '11px', border: '1px solid #cbd5e1', borderRadius: '9999px', backgroundColor: patientLoginMode === 'quick' ? '#070e1e' : '#f8fafc', color: patientLoginMode === 'quick' ? 'white' : '#334155', cursor: 'pointer', fontWeight: '700' }}>⚡ Quick Select</button>
                </div>

                {patientLoginMode === 'password' && (
                  <form onSubmit={handlePatientPasswordLogin}>
                    <input required type="text" placeholder="Patient ID (e.g. PT-1001)" style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid #cbd5e1', marginBottom: '10px', boxSizing: 'border-box' }} value={loginId} onChange={e => setLoginId(e.target.value)} />
                    <input required type="password" placeholder="Passcode PIN" style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid #cbd5e1', marginBottom: '14px', boxSizing: 'border-box' }} value={loginPassword} onChange={e => setLoginPassword(e.target.value)} />
                    <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '9999px', fontWeight: '800', cursor: 'pointer', fontSize: '13px' }}>Log In ➔</button>
                  </form>
                )}

                {patientLoginMode === 'quick' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                    {registeredPatients.map(p => (
                      <button key={p.patientId} onClick={() => handleDirectPatientSelect(p)} style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '10px', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}>
                        <span>{p.name} ({p.patientId})</span>
                        <span style={{ color: '#2563eb', fontWeight: '800' }}>Enter ➔</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {loginRole === 'op-desk' && (
              <div>
                <form onSubmit={handleOpStaffLogin} style={{ marginBottom: '10px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>Staff Username:</label>
                  <input type="text" placeholder="e.g. op_staff" style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid #cbd5e1', marginBottom: '10px', boxSizing: 'border-box' }} value={opStaffUser} onChange={e => setOpStaffUser(e.target.value)} />
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>Staff Passcode:</label>
                  <input type="password" placeholder="Passcode (gandhi2026)" style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid #cbd5e1', marginBottom: '10px', boxSizing: 'border-box' }} value={opStaffPass} onChange={e => setOpStaffPass(e.target.value)} />
                  {staffLoginError && <div style={{ color: '#e11d48', fontSize: '12px', marginBottom: '8px' }}>{staffLoginError}</div>}
                  <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#d97706', color: 'white', border: 'none', borderRadius: '9999px', fontWeight: '800', cursor: 'pointer', fontSize: '13px', marginBottom: '8px' }}>Log In as Staff ➔</button>
                </form>
                <div style={{ textAlign: 'center', margin: '6px 0', fontSize: '11px', color: '#94a3b8' }}>— OR —</div>
                <button 
                  onClick={() => persistLogin('op-desk', { name: 'O/P Receptionist (Desk #1)', staffId: 'STAFF-OP-01' })}
                  style={{ width: '100%', padding: '10px', backgroundColor: '#fffbeb', color: '#92400e', border: '1px solid #fde68a', borderRadius: '9999px', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>
                  ⚡ 1-Click Quick Enter as O/P Desk #1
                </button>
              </div>
            )}

            {loginRole === 'doctor' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {doctorsList.map(doc => (
                  <button key={doc.doctorId} onClick={() => handleRoleSelectLogin('doctor', doc)} style={{ padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '12px', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}>
                    <strong>{doc.name} ({doc.department})</strong>
                    <span style={{ color: '#4f46e5', fontWeight: '800' }}>Enter ➔</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}

export default App
