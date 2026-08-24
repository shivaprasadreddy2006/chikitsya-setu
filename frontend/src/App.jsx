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

  // Soft Nordic Background
  ctx.fillStyle = type === 'pharmacy' ? '#14532d' : type === 'lab' ? '#0369a1' : type === 'grievance' ? '#9f1239' : '#475569'
  ctx.fillRect(0, 0, 600, 400)

  // Inner card
  ctx.fillStyle = '#ffffff'
  ctx.roundRect(20, 20, 560, 360, 20)
  ctx.fill()

  // Header Banner
  ctx.fillStyle = type === 'pharmacy' ? '#16a34a' : type === 'lab' ? '#0284c7' : '#e11d48'
  ctx.fillRect(20, 20, 560, 60)

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 20px sans-serif'
  ctx.fillText('🏥 GANDHI HOSPITAL - VERIFIED AUDIT PROOF', 40, 58)

  // Icon
  ctx.font = '50px sans-serif'
  ctx.fillText(type === 'pharmacy' ? '💊' : type === 'lab' ? '🧪' : type === 'grievance' ? '🚨' : '💉', 40, 146)

  // Content
  ctx.fillStyle = '#18181b'
  ctx.font = 'bold 20px sans-serif'
  ctx.fillText(title, 110, 126)

  ctx.fillStyle = '#71717a'
  ctx.font = '15px sans-serif'
  ctx.fillText(subtitle, 110, 154)

  // Details box
  ctx.fillStyle = '#f7f7f5'
  ctx.fillRect(40, 185, 520, 115)
  ctx.strokeStyle = '#e4e4e7'
  ctx.strokeRect(40, 185, 520, 115)

  ctx.fillStyle = '#27272a'
  ctx.font = '13px monospace'
  ctx.fillText(`STATUS: VERIFIED ON-SITE EVIDENCE`, 55, 215)
  ctx.fillText(`TIMESTAMP: ${new Date().toLocaleString('en-IN')}`, 55, 240)
  ctx.fillText(`AUDIT: ZERO-CORRUPTION DIGITAL WATERMARK`, 55, 265)

  // Official Stamp
  ctx.fillStyle = '#15803d'
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

  // ---------- CAMERA / WEBCAM CAPTURE MODAL STATE ----------
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

  // ---------- STAFF / OP DESK LOGIN STATE ----------
  const [opStaffUser, setOpStaffUser] = useState('')
  const [opStaffPass, setOpStaffPass] = useState('')
  const [staffLoginError, setStaffLoginError] = useState('')

  // ---------- PATIENT STATE ----------
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

  // ---------- PATIENT VIDEO / PHOTO GRIEVANCE STATE ----------
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

  // ---------- DOCTOR STATE ----------
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

  // ---------- LAB STATE ----------
  const [labOrders, setLabOrders] = useState([])
  const [labFindingsInput, setLabFindingsInput] = useState({})
  const [labMessage, setLabMessage] = useState('')

  // ---------- PHARMACY STATE ----------
  const [prescriptions, setPrescriptions] = useState([])
  const [pharmacyMessage, setPharmacyMessage] = useState('')

  // ---------- INPATIENT WARD STATE ----------
  const [admissionsList, setAdmissionsList] = useState([])
  const [wardViewFilter, setWardViewFilter] = useState('admitted')
  const [resourceItemName, setResourceItemName] = useState('IV Cannula 20G & Normal Saline')
  const [wardResourcePhotoProof, setWardResourcePhotoProof] = useState(null)
  const [wardMessage, setWardMessage] = useState('')

  // ---------- O/P DESK STATE ----------
  const [opForm, setOpForm] = useState({
    name: '',
    age: '',
    gender: 'Male',
    phoneNumber: '',
    registrationDate: new Date().toISOString().slice(0, 16)
  })
  const [opTicket, setOpTicket] = useState(null)
  const [opError, setOpError] = useState('')

  // ---------- ADMIN / OVERSIGHT STATE ----------
  const [hospitalStats, setHospitalStats] = useState(null)
  const [hospitalAuditTrail, setHospitalAuditTrail] = useState(null)
  const [allHospitalGrievances, setAllHospitalGrievances] = useState([])
  const [adminActiveTab, setAdminActiveTab] = useState('registered-patients')
  const [photoServiceFilter, setPhotoServiceFilter] = useState('ALL')
  const [adminSearchQuery, setAdminSearchQuery] = useState('')
  const [adminInspectedPatientFile, setAdminInspectedPatientFile] = useState(null)
  const [adminInspectedPatientTab, setAdminInspectedPatientTab] = useState('overview')
  const [adminSelectedDoctor, setAdminSelectedDoctor] = useState(null)
  const [selectedAdminGrievance, setSelectedAdminGrievance] = useState(null)
  const [adminGrievanceReplyText, setAdminGrievanceReplyText] = useState('')
  const [adminGrievanceStatusSelect, setAdminGrievanceStatusSelect] = useState('UNDER_REVIEW')

  // ---------- NOTIFICATION BANNER ----------
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
      setCameraError('Camera permission denied. You can use medical presets to test!')
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
    
    ctx.fillStyle = 'rgba(24, 24, 27, 0.7)'
    ctx.fillRect(10, canvas.height - 40, canvas.width - 20, 30)
    ctx.fillStyle = '#ffffff'
    ctx.font = '13px sans-serif'
    ctx.fillText(`🏥 GANDHI HOSPITAL PHOTO AUDIT | ${new Date().toLocaleString('en-IN')}`, 20, canvas.height - 20)

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

  // Grievance Camera / Video
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

  // Data fetchers
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
      setAdminInspectedPatientTab('overview')
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

  // Doctor Action Handlers
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

  // Lab & Pharmacy & Ward executions
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

  const executeLogResourceWithPhoto = async (admissionId, photoProof) => {
    try {
      const res = await axios.post(`${API_BASE}/admissions/resource/${admissionId}`, { 
        itemName: resourceItemName,
        photoProof: photoProof || wardResourcePhotoProof
      })
      setWardMessage(`✅ ${res.data.message}`)
      setWardResourcePhotoProof(null)
      fetchAdmissions()
    } catch (err) { setWardMessage(`⚠️ ${err.message}`) }
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

  // Smart resolution of active assigned doctor & physical location
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
          doctorName: rx.doctorName || 'Doctor',
          staffName: rx.dispensedByStaff || 'Duty Pharmacist',
          itemSummary: rx.medicines?.map(m => m.name).join(', ') || 'Prescribed Medications',
          timestamp: new Date(rx.dispensedAt || rx.updatedAt || rx.createdAt),
          photoProof: rx.photoProof,
          rawData: rx
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
          doctorName: lab.doctorName || 'Doctor',
          staffName: 'Pathology Lab In-Charge',
          itemSummary: `${lab.testName} (${lab.findings || 'Sample in Analysis'})`,
          timestamp: new Date(lab.updatedAt || lab.sampleCollectedAt || lab.createdAt),
          photoProof: lab.photoProof,
          rawData: lab
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
            patientName: adm.patientName,
            doctorName: adm.admittingDoctorName || 'Admitting Physician',
            staffName: res.loggedByStaff || 'Duty Ward Sister',
            itemSummary: `${res.itemName} (Qty: ${res.quantity}) - Bed: ${adm.bedNumber}`,
            timestamp: new Date(res.loggedAt || adm.createdAt),
            photoProof: res.photoProof,
            rawData: adm
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#f7f7f5', color: '#18181b', margin: 0 }}>
      
      {/* NOTIFICATION TOAST (SERENE NORDIC PILL) */}
      {whatsAppNotification && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          backgroundColor: '#ffffff',
          color: '#18181b',
          padding: '18px 22px',
          borderRadius: '20px',
          boxShadow: '0 12px 36px -4px rgba(24,24,27,0.12), 0 4px 12px -2px rgba(24,24,27,0.06)',
          maxWidth: '380px',
          zIndex: 99999,
          border: '1px solid #e4e4e7'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>💬</span>
              <strong style={{ fontSize: '14px', color: '#15803d' }}>WhatsApp Notification</strong>
            </div>
            <button onClick={() => setWhatsAppNotification(null)} style={{ background: '#f4f4f5', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', fontSize: '12px', color: '#71717a' }}>✕</button>
          </div>
          <div style={{ fontSize: '11px', color: '#71717a', marginBottom: '6px' }}>To: +91 {whatsAppNotification.recipient}</div>
          <div style={{ backgroundColor: '#f7f7f5', padding: '12px', borderRadius: '12px', fontSize: '13px', whiteSpace: 'pre-line', lineHeight: '1.45', border: '1px solid #e8e7e1' }}>
            {whatsAppNotification.message}
          </div>
        </div>
      )}

      {/* HEADER: FLOATING CLEAN NORDIC BAR */}
      <header style={{
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #ebeae5',
        padding: '16px 40px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 2px 12px -2px rgba(24,24,27,0.03)',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div onClick={() => !currentUser && setActiveView('home')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '14px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>
            🌿
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#18181b', letterSpacing: '-0.03em' }}>
              Chikitsya Setu
            </h1>
            <span style={{ fontSize: '11px', color: '#71717a', fontWeight: '600', letterSpacing: '0.4px' }}>GANDHI HOSPITAL TRANSPARENCY ECOSYSTEM</span>
          </div>
        </div>

        <div>
          {currentUser ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ padding: '8px 16px', backgroundColor: '#f4f4f5', borderRadius: '9999px', fontSize: '13px', fontWeight: '600', color: '#27272a', border: '1px solid #e4e4e7' }}>
                {currentUser.role === 'patient' && `👤 ${currentUser.data.name} (${currentUser.data.patientId})`}
                {currentUser.role === 'doctor' && `👨‍⚕️ ${currentUser.data.name} • ${currentUser.data.department}`}
                {currentUser.role === 'lab' && `🔬 Diagnostic Lab`}
                {currentUser.role === 'pharmacy' && `💊 Pharmacy Counter`}
                {currentUser.role === 'ward' && `🛏️ Ward Station`}
                {currentUser.role === 'op-desk' && `🎫 O/P Desk #1`}
                {currentUser.role === 'admin' && `📊 Hospital Admin`}
              </div>
              <button onClick={handleLogout} style={{ padding: '8px 18px', backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: '9999px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
                Logout
              </button>
            </div>
          ) : (
            <button onClick={() => { fetchPatientsList(); setShowLoginModal(true); }} style={{ padding: '10px 24px', backgroundColor: '#15803d', color: '#ffffff', border: 'none', borderRadius: '9999px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 14px rgba(21,128,61,0.25)' }}>
              Enter Portals ➔
            </button>
          )}
        </div>
      </header>

      {/* MAIN VIEW CONTENT */}
      <main style={{ flex: 1, padding: '36px 20px', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>

        {/* 1. HOME LANDING VIEW (NORDIC SERENE) */}
        {activeView === 'home' && (
          <div style={{ width: '100%', maxWidth: '1080px' }}>
            
            {/* Hero Card */}
            <div style={{ backgroundColor: '#ffffff', padding: '48px 40px', borderRadius: '24px', boxShadow: '0 4px 24px -2px rgba(24,24,27,0.04)', border: '1px solid #ebeae5', textAlign: 'center', marginBottom: '28px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 16px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '9999px', fontSize: '13px', color: '#15803d', fontWeight: '700', marginBottom: '18px' }}>
                <span>🛡️</span> Zero Neglect • Zero Exploitation • Zero Leakage
              </div>
              
              <h2 style={{ fontSize: '34px', color: '#18181b', margin: '0 0 16px 0', fontWeight: '800', letterSpacing: '-0.03em', lineHeight: '1.25' }}>
                Gandhi Hospital Public Healthcare Transparency Engine
              </h2>
              
              <p style={{ fontSize: '15px', color: '#71717a', maxWidth: '760px', margin: '0 auto 28px auto', lineHeight: '1.65' }}>
                Gandhi Hospital (Secunderabad) is a premier tertiary government hospital serving over 3,500 patients daily. Chikitsya Setu provides an end-to-end digital accountability ecosystem to eliminate queue manipulation, prevent illegal diagnostic charges, and track every single medical consumable with 100% transparency.
              </p>

              {/* Humane Badges */}
              <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '32px' }}>
                <span style={{ padding: '8px 18px', backgroundColor: '#f7f7f5', border: '1px solid #e4e4e7', borderRadius: '9999px', fontSize: '13px', fontWeight: '600', color: '#3f3f46' }}>
                  🏥 1,200+ Inpatient Bed Capacity
                </span>
                <span style={{ padding: '8px 18px', backgroundColor: '#f7f7f5', border: '1px solid #e4e4e7', borderRadius: '9999px', fontSize: '13px', fontWeight: '600', color: '#3f3f46' }}>
                  👥 3,500+ Daily Outpatients
                </span>
                <span style={{ padding: '8px 18px', backgroundColor: '#f7f7f5', border: '1px solid #e4e4e7', borderRadius: '9999px', fontSize: '13px', fontWeight: '600', color: '#3f3f46' }}>
                  🚨 24/7 Emergency & Casualty
                </span>
                <span style={{ padding: '8px 18px', backgroundColor: '#f0fdf4', border: '1px solid #86efac', borderRadius: '9999px', fontSize: '13px', fontWeight: '700', color: '#15803d' }}>
                  ✅ 100% Free Public Healthcare Policy
                </span>
              </div>

              {/* Live Statistics Cards */}
              {hospitalStats && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', textAlign: 'center' }}>
                  <div style={{ backgroundColor: '#fcfcfb', padding: '20px', borderRadius: '18px', border: '1px solid #ebeae5' }}>
                    <div style={{ fontSize: '28px', fontWeight: '800', color: '#18181b' }}>{hospitalStats.totalPatients}</div>
                    <div style={{ fontSize: '12px', color: '#71717a', marginTop: '4px', fontWeight: '600' }}>Patients Registered</div>
                  </div>
                  <div style={{ backgroundColor: '#f0f9ff', padding: '20px', borderRadius: '18px', border: '1px solid #bae6fd' }}>
                    <div style={{ fontSize: '28px', fontWeight: '800', color: '#0284c7' }}>{hospitalStats.totalDoctors}</div>
                    <div style={{ fontSize: '12px', color: '#0369a1', marginTop: '4px', fontWeight: '600' }}>Doctors on Shift</div>
                  </div>
                  <div style={{ backgroundColor: '#fefce8', padding: '20px', borderRadius: '18px', border: '1px solid #fef08a' }}>
                    <div style={{ fontSize: '28px', fontWeight: '800', color: '#ca8a04' }}>{hospitalStats.pendingLabs}</div>
                    <div style={{ fontSize: '12px', color: '#854d0e', marginTop: '4px', fontWeight: '600' }}>Diagnostic Orders</div>
                  </div>
                  <div style={{ backgroundColor: '#f0fdf4', padding: '20px', borderRadius: '18px', border: '1px solid #bbf7d0' }}>
                    <div style={{ fontSize: '28px', fontWeight: '800', color: '#15803d' }}>{hospitalStats.transparencyScore}</div>
                    <div style={{ fontSize: '12px', color: '#166534', marginTop: '4px', fontWeight: '600' }}>Transparency Index</div>
                  </div>
                </div>
              )}
            </div>

            {/* The 3 Pillars of Reform */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '18px' }}>
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #ebeae5', padding: '26px', borderRadius: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: '#f0f9ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', marginBottom: '12px' }}>⚖️</div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#0369a1', fontWeight: '700' }}>1. Zero Neglect</h4>
                <p style={{ fontSize: '13px', color: '#71717a', margin: 0, lineHeight: '1.55' }}>
                  Eliminates doctor cherry-picking. Smart algorithms distribute outpatients automatically across on-shift doctors with the shortest wait times.
                </p>
              </div>

              <div style={{ backgroundColor: '#ffffff', border: '1px solid #ebeae5', padding: '26px', borderRadius: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', marginBottom: '12px' }}>🚫</div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#15803d', fontWeight: '700' }}>2. Zero Exploitation</h4>
                <p style={{ fontSize: '13px', color: '#71717a', margin: 0, lineHeight: '1.55' }}>
                  No more paying bribes to lab attendants. All diagnostic findings are published directly to the patient's phone with live camera proofs.
                </p>
              </div>

              <div style={{ backgroundColor: '#ffffff', border: '1px solid #ebeae5', padding: '26px', borderRadius: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', marginBottom: '12px' }}>📦</div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#b45309', fontWeight: '700' }}>3. Zero Supply Leakage</h4>
                <p style={{ fontSize: '13px', color: '#71717a', margin: 0, lineHeight: '1.55' }}>
                  Every syringe, IV set, and blood unit is tracked digitally to the patient's bed ledger before discharge, stopping black-market diversion.
                </p>
              </div>
            </div>

          </div>
        )}

        {/* 2. COMPLETE PATIENT EHR PORTAL (NORDIC HUMANE DESIGN) */}
        {activeView === 'patient' && currentUser?.role === 'patient' && (
          <div style={{ width: '100%', maxWidth: '880px', backgroundColor: '#ffffff', padding: '36px', borderRadius: '24px', boxShadow: '0 4px 24px -2px rgba(24,24,27,0.04)', border: '1px solid #ebeae5' }}>
            
            {/* Header Profile Card */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f4f4f5', paddingBottom: '18px', marginBottom: '22px' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Electronic Health Record</span>
                <h2 style={{ margin: '4px 0 2px 0', color: '#18181b', fontSize: '22px', fontWeight: '800' }}>{currentUser.data.name}</h2>
                <span style={{ fontSize: '13px', color: '#71717a' }}>Patient ID: <strong>{currentUser.data.patientId}</strong> | Mobile: +91 {currentUser.data.phoneNumber}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '11px', color: '#71717a', display: 'block' }}>Registered Date:</span>
                <strong style={{ fontSize: '13px', color: '#18181b' }}>{formatDateTime(currentUser.data.createdAt)}</strong>
              </div>
            </div>

            {/* Nordic Sub-tab Navigation (Soft Rounded Pills) */}
            <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #f4f4f5', paddingBottom: '14px', marginBottom: '24px', flexWrap: 'wrap' }}>
              <button 
                onClick={() => setPatientTab('overview')} 
                style={{ padding: '8px 18px', borderRadius: '9999px', border: 'none', backgroundColor: patientTab === 'overview' ? '#18181b' : '#f4f4f5', color: patientTab === 'overview' ? '#ffffff' : '#52525b', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}>
                📍 Journey Timeline
              </button>
              <button 
                onClick={() => setPatientTab('labs')} 
                style={{ padding: '8px 18px', borderRadius: '9999px', border: 'none', backgroundColor: patientTab === 'labs' ? '#18181b' : '#f4f4f5', color: patientTab === 'labs' ? '#ffffff' : '#52525b', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}>
                🧪 Lab Reports ({patientFullFile?.labRequests?.length || 0})
              </button>
              <button 
                onClick={() => setPatientTab('medicines')} 
                style={{ padding: '8px 18px', borderRadius: '9999px', border: 'none', backgroundColor: patientTab === 'medicines' ? '#18181b' : '#f4f4f5', color: patientTab === 'medicines' ? '#ffffff' : '#52525b', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}>
                💊 Prescriptions ({patientFullFile?.prescriptions?.length || 0})
              </button>
              <button 
                onClick={() => setPatientTab('admissions')} 
                style={{ padding: '8px 18px', borderRadius: '9999px', border: 'none', backgroundColor: patientTab === 'admissions' ? '#18181b' : '#f4f4f5', color: patientTab === 'admissions' ? '#ffffff' : '#52525b', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}>
                🛏️ Inpatient Ward
              </button>
              <button 
                onClick={() => setPatientTab('grievance')} 
                style={{ padding: '8px 18px', borderRadius: '9999px', border: 'none', backgroundColor: patientTab === 'grievance' ? '#e11d48' : '#ffe4e6', color: patientTab === 'grievance' ? '#ffffff' : '#be123c', fontWeight: '700', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>🚨</span> Raise Grievance ({patientGrievances.length})
              </button>
            </div>

            {/* TAB 1: OVERVIEW TIMELINE */}
            {patientTab === 'overview' && (
              <div>
                {/* Official Discharge Certificate Banner */}
                {(patientFullFile?.patient?.currentStatus === 'COMPLETED' || patientFullFile?.patient?.dischargeSummary) && (
                  <div style={{ backgroundColor: '#f0fdf4', border: '1.5px solid #86efac', padding: '20px', borderRadius: '18px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '24px' }}>🏁</span>
                        <div>
                          <strong style={{ color: '#15803d', fontSize: '15px' }}>
                            Outpatient Consultation Completed & Discharge Authorized
                          </strong>
                          <div style={{ fontSize: '12px', color: '#166534' }}>
                            Discharged by: <strong>{patientFullFile?.patient?.dischargedByDoctorName || activeDoctorName}</strong> • {formatDateTime(patientFullFile?.patient?.dischargedAt || new Date())}
                          </div>
                        </div>
                      </div>
                      <span style={{ padding: '4px 12px', backgroundColor: '#dcfce7', color: '#15803d', borderRadius: '9999px', fontSize: '12px', fontWeight: '700' }}>
                        {patientFullFile?.patient?.dischargeType || 'Routine Outpatient Completion'}
                      </span>
                    </div>

                    <div style={{ backgroundColor: 'white', padding: '14px', borderRadius: '12px', border: '1px solid #bbf7d0', marginTop: '10px' }}>
                      <div style={{ fontSize: '13px', color: '#18181b', marginBottom: '6px' }}>
                        <strong>Doctor Summary:</strong> {patientFullFile?.patient?.dischargeSummary || 'Patient examined. Vitals normal.'}
                      </div>
                      <div style={{ fontSize: '12px', color: '#0284c7' }}>
                        <strong>📅 Follow-up:</strong> {patientFullFile?.patient?.followUpAdvice || 'Follow-up after 5-7 days if symptoms persist.'}
                      </div>
                    </div>
                  </div>
                )}

                {/* Current Action Banner */}
                <div style={{ backgroundColor: '#f7f7f5', padding: '20px', borderRadius: '18px', border: '1px solid #ebeae5', marginBottom: '20px' }}>
                  <span style={{ fontSize: '11px', color: '#71717a', textTransform: 'uppercase', fontWeight: '700' }}>Current Action</span>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: '#0284c7', marginTop: '4px' }}>
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

                {/* Assigned Doctor & Location Card */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '24px' }}>
                  <div style={{ padding: '18px', border: '1px solid #ebeae5', borderRadius: '16px', backgroundColor: '#fcfcfb' }}>
                    <div style={{ fontSize: '11px', color: '#71717a', fontWeight: '700', textTransform: 'uppercase' }}>Assigned Physician</div>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: '#18181b', marginTop: '4px' }}>
                      👨‍⚕️ {activeDoctorName}
                    </div>
                    <div style={{ fontSize: '12px', color: '#15803d', fontWeight: '600', marginTop: '2px' }}>
                      Department: {activeDoctorDept}
                    </div>
                  </div>

                  <div style={{ padding: '18px', border: '1px solid #ebeae5', borderRadius: '16px', backgroundColor: '#fcfcfb' }}>
                    <div style={{ fontSize: '11px', color: '#71717a', fontWeight: '700', textTransform: 'uppercase' }}>Physical Location</div>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: '#d97706', marginTop: '4px' }}>
                      📍 {activeDoctorLocation.room}
                    </div>
                    <div style={{ fontSize: '12px', color: '#71717a', fontWeight: '500', marginTop: '2px' }}>
                      {activeDoctorLocation.block}
                    </div>
                  </div>
                </div>

                {/* Live Chronological Journey Timeline */}
                <div style={{ backgroundColor: '#ffffff', border: '1px solid #ebeae5', padding: '24px', borderRadius: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0, fontSize: '15px', color: '#18181b', fontWeight: '700' }}>
                      📅 Patient Journey & Audit Trail
                    </h3>
                    <span style={{ fontSize: '12px', color: '#15803d', fontWeight: '600' }}>
                      💡 Click event to open full details & photo proof
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {patientFullFile?.timeline?.map((item, idx) => (
                      <div 
                        key={idx} 
                        onClick={() => setSelectedDetailItem(item)}
                        style={{ 
                          display: 'flex', 
                          gap: '12px', 
                          alignItems: 'flex-start', 
                          padding: '14px',
                          borderRadius: '14px',
                          border: '1px solid #f4f4f5',
                          backgroundColor: '#fafaf9',
                          cursor: 'pointer'
                        }}>
                        <div style={{ fontSize: '18px', width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid #ebeae5' }}>
                          {item.icon}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                            <strong style={{ fontSize: '13px', color: '#18181b' }}>{item.stage}</strong>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              {item.photoProof && (
                                <span style={{ fontSize: '11px', backgroundColor: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', padding: '2px 8px', borderRadius: '9999px', fontWeight: '700' }}>
                                  📸 Photo Proof
                                </span>
                              )}
                              <span style={{ fontSize: '11px', fontWeight: '600', color: '#0284c7', backgroundColor: '#f0f9ff', padding: '2px 8px', borderRadius: '9999px' }}>
                                🕒 {formatDateTime(item.timestamp)}
                              </span>
                            </div>
                          </div>
                          <p style={{ margin: '2px 0', fontSize: '12px', color: '#52525b', lineHeight: '1.45' }}>{item.details}</p>
                          <div style={{ fontSize: '11px', color: '#71717a', marginTop: '4px' }}>
                            Staff: <strong>{item.performedBy || item.doctorName}</strong>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: LAB REPORTS */}
            {patientTab === 'labs' && (
              <div>
                <h3 style={{ margin: '0 0 16px 0', color: '#18181b', fontSize: '16px' }}>Diagnostic Laboratory Reports</h3>
                {patientFullFile?.labRequests?.map(lab => (
                  <div key={lab._id} style={{ border: '1px solid #ebeae5', padding: '18px', borderRadius: '16px', backgroundColor: '#fcfcfb', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <strong style={{ fontSize: '15px' }}>{lab.testName}</strong>
                      <span style={{ padding: '3px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: '700', backgroundColor: lab.status === 'REPORT_READY' ? '#dcfce7' : '#fef3c7', color: lab.status === 'REPORT_READY' ? '#15803d' : '#b45309' }}>
                        {lab.status === 'REPORT_READY' ? '✅ Report Published' : '⏳ Processing'}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#71717a' }}>Ordered by {lab.doctorName} • {formatDateTime(lab.createdAt)}</div>
                    {lab.findings && (
                      <div style={{ marginTop: '8px', padding: '10px 14px', backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #ebeae5', fontSize: '13px' }}>
                        <strong>Findings:</strong> {lab.findings}
                      </div>
                    )}
                    {lab.photoProof && (
                      <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <img src={lab.photoProof} alt="Lab Proof" style={{ height: '50px', borderRadius: '8px' }} />
                        <span style={{ fontSize: '11px', color: '#15803d', fontWeight: '700' }}>✓ Verified diagnostic film attached</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* TAB 3: MEDICINES */}
            {patientTab === 'medicines' && (
              <div>
                <h3 style={{ margin: '0 0 16px 0', color: '#18181b', fontSize: '16px' }}>Prescribed Medications</h3>
                {patientFullFile?.prescriptions?.map(rx => (
                  <div key={rx._id} style={{ border: '1px solid #ebeae5', padding: '18px', borderRadius: '16px', backgroundColor: '#fcfcfb', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <strong style={{ fontSize: '14px' }}>Prescription by {rx.doctorName}</strong>
                      <span style={{ padding: '3px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: '700', backgroundColor: rx.status === 'COMPLETELY_DISPENSED' || rx.status === 'DISPENSED' ? '#dcfce7' : '#fef3c7', color: rx.status === 'COMPLETELY_DISPENSED' || rx.status === 'DISPENSED' ? '#15803d' : '#b45309' }}>
                        {rx.status}
                      </span>
                    </div>
                    <ul style={{ margin: '0 0 8px 0', paddingLeft: '20px', fontSize: '13px', color: '#3f3f46' }}>
                      {rx.medicines?.map((m, i) => (
                        <li key={i}>{m.name} - {m.dosage} ({m.durationDays} days)</li>
                      ))}
                    </ul>
                    {rx.photoProof && (
                      <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <img src={rx.photoProof} alt="Rx Proof" style={{ height: '50px', borderRadius: '8px' }} />
                        <span style={{ fontSize: '11px', color: '#15803d', fontWeight: '700' }}>✓ Medicine handover photo recorded</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* TAB 4: WARD INPATIENT */}
            {patientTab === 'admissions' && (
              <div>
                <h3 style={{ margin: '0 0 16px 0', color: '#18181b', fontSize: '16px' }}>Inpatient Ward & Bed Ledger</h3>
                {patientFullFile?.admission ? (
                  <div style={{ border: '1px solid #ebeae5', padding: '20px', borderRadius: '16px', backgroundColor: '#fcfcfb' }}>
                    <strong>Ward: {patientFullFile.admission.wardType} ({patientFullFile.admission.bedNumber})</strong>
                    <div style={{ fontSize: '12px', color: '#71717a', marginTop: '2px' }}>Admitted on: {formatDateTime(patientFullFile.admission.admittedAt)}</div>
                    <h4 style={{ margin: '14px 0 6px 0', fontSize: '13px' }}>Consumables Logged:</h4>
                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#3f3f46' }}>
                      {patientFullFile.admission.resourcesAllocated?.map((res, i) => (
                        <li key={i}>{res.itemName} (Qty: {res.quantity}) - {res.loggedByStaff} • {formatDateTime(res.loggedAt)}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p style={{ color: '#71717a', fontSize: '13px' }}>Outpatient record (no ward admission).</p>
                )}
              </div>
            )}

            {/* TAB 5: 🚨 RAISE GRIEVANCE & PATIENT RESOLUTION VERIFICATION */}
            {patientTab === 'grievance' && (
              <div>
                <div style={{ backgroundColor: '#fff1f2', border: '1px solid #fecdd3', padding: '18px 24px', borderRadius: '18px', marginBottom: '22px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '22px' }}>🚨</span>
                    <div>
                      <h3 style={{ margin: '0 0 2px 0', color: '#9f1239', fontSize: '16px', fontWeight: '700' }}>
                        Gandhi Hospital Anti-Corruption & Vigilance Cell
                      </h3>
                      <p style={{ margin: 0, fontSize: '12px', color: '#881337', lineHeight: '1.45' }}>
                        Record live video or snap camera evidence of counter bribes, doctor absence, or delays. Monitored directly by the Chief Superintendent.
                      </p>
                    </div>
                  </div>
                </div>

                {grievanceMessage && (
                  <div style={{ marginBottom: '16px', padding: '12px 16px', backgroundColor: '#f0fdf4', color: '#166534', borderRadius: '12px', border: '1px solid #bbf7d0', fontWeight: '700', fontSize: '13px' }}>
                    {grievanceMessage}
                  </div>
                )}

                {/* Submission Form */}
                <div style={{ backgroundColor: '#fcfcfb', border: '1px solid #ebeae5', padding: '24px', borderRadius: '18px', marginBottom: '26px' }}>
                  <h4 style={{ margin: '0 0 14px 0', color: '#18181b', fontSize: '15px', fontWeight: '700' }}>📝 Submit New Video / Photo Complaint</h4>

                  <form onSubmit={handleGrievanceSubmit}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                      <div>
                        <label style={{ fontSize: '12px', fontWeight: '600', display: 'block', marginBottom: '4px', color: '#3f3f46' }}>Problem Category:</label>
                        <select 
                          style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid #e4e4e7', fontSize: '13px', backgroundColor: '#ffffff' }}
                          value={grievanceForm.category}
                          onChange={e => setGrievanceForm({ ...grievanceForm, category: e.target.value })}>
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
                        <label style={{ fontSize: '12px', fontWeight: '600', display: 'block', marginBottom: '4px', color: '#3f3f46' }}>Department / Location:</label>
                        <select 
                          style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid #e4e4e7', fontSize: '13px', backgroundColor: '#ffffff' }}
                          value={grievanceForm.department}
                          onChange={e => setGrievanceForm({ ...grievanceForm, department: e.target.value })}>
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
                      <label style={{ fontSize: '12px', fontWeight: '600', display: 'block', marginBottom: '4px', color: '#3f3f46' }}>Detailed Description:</label>
                      <textarea
                        rows={3}
                        required
                        placeholder="Describe the issue, staff involved, or room number..."
                        style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid #e4e4e7', fontSize: '13px', backgroundColor: '#ffffff', boxSizing: 'border-box' }}
                        value={grievanceForm.description}
                        onChange={e => setGrievanceForm({ ...grievanceForm, description: e.target.value })}
                      />
                    </div>

                    {/* Camera / Video Viewfinder */}
                    <div style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '14px', border: '1px solid #ebeae5', marginBottom: '16px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#18181b', display: 'block', marginBottom: '8px' }}>
                        📷 Video & Photo Evidence Attachment:
                      </span>

                      {grievanceCameraActive && (
                        <div style={{ marginBottom: '12px', backgroundColor: '#18181b', borderRadius: '14px', overflow: 'hidden', padding: '8px', textAlign: 'center' }}>
                          <video ref={grievanceVideoRef} autoPlay playsInline muted style={{ maxWidth: '100%', height: '220px', borderRadius: '10px', objectFit: 'cover' }} />
                          
                          {isRecordingGrievanceVideo && (
                            <div style={{ color: '#fb7185', fontWeight: '700', fontSize: '13px', marginTop: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                              <span>🔴</span> RECORDING: 00:{recordingSeconds < 10 ? `0${recordingSeconds}` : recordingSeconds} / 00:30 max
                            </div>
                          )}

                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '10px' }}>
                            {!isRecordingGrievanceVideo ? (
                              <>
                                <button type="button" onClick={snapGrievancePhoto} style={{ padding: '8px 18px', backgroundColor: '#0284c7', color: 'white', border: 'none', borderRadius: '9999px', fontWeight: '700', cursor: 'pointer', fontSize: '12px' }}>
                                  📸 Snap Photo
                                </button>
                                <button type="button" onClick={startGrievanceVideoRecording} style={{ padding: '8px 18px', backgroundColor: '#e11d48', color: 'white', border: 'none', borderRadius: '9999px', fontWeight: '700', cursor: 'pointer', fontSize: '12px' }}>
                                  🎥 Record Video
                                </button>
                                <button type="button" onClick={stopGrievanceCamera} style={{ padding: '8px 14px', backgroundColor: '#71717a', color: 'white', border: 'none', borderRadius: '9999px', cursor: 'pointer', fontSize: '12px' }}>
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <button type="button" onClick={stopGrievanceVideoRecording} style={{ padding: '8px 22px', backgroundColor: '#15803d', color: 'white', border: 'none', borderRadius: '9999px', fontWeight: '700', cursor: 'pointer', fontSize: '13px' }}>
                                ⏹️ Stop Recording & Attach ➔
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {grievanceForm.mediaUrl ? (
                        <div style={{ backgroundColor: '#fcfcfb', padding: '12px', borderRadius: '12px', border: '1px solid #e4e4e7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {grievanceForm.mediaType === 'photo' ? (
                              <img src={grievanceForm.mediaUrl} alt="Evidence" style={{ height: '60px', borderRadius: '8px' }} />
                            ) : (
                              <video src={grievanceForm.mediaUrl} controls style={{ height: '60px', borderRadius: '8px' }} />
                            )}
                            <div>
                              <strong style={{ fontSize: '13px', color: '#15803d' }}>
                                {grievanceForm.mediaType === 'video' ? '🎥 Video Attached' : '📸 Photo Attached'}
                              </strong>
                            </div>
                          </div>

                          <button 
                            type="button" 
                            onClick={() => setGrievanceForm({ ...grievanceForm, mediaType: 'none', mediaUrl: '' })}
                            style={{ padding: '6px 12px', backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: '9999px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                            Remove
                          </button>
                        </div>
                      ) : (
                        !grievanceCameraActive && (
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              onClick={startGrievanceCamera}
                              style={{ padding: '8px 16px', backgroundColor: '#18181b', color: 'white', border: 'none', borderRadius: '9999px', fontWeight: '600', fontSize: '12px', cursor: 'pointer' }}>
                              <span>📷</span> Turn on Camera (Photo / Video)
                            </button>
                            <button
                              type="button"
                              onClick={() => setGrievanceForm({ ...grievanceForm, mediaType: 'photo', mediaUrl: generateMedicalPresetImage('grievance', 'Counter Overcharge Demo', 'Pharmacy Counter #3') })}
                              style={{ padding: '8px 14px', backgroundColor: '#f4f4f5', color: '#3f3f46', border: '1px solid #e4e4e7', borderRadius: '9999px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                              ⚡ Preset Demo Evidence
                            </button>
                          </div>
                        )
                      )}
                    </div>

                    <button
                      type="submit"
                      style={{ width: '100%', padding: '12px', backgroundColor: '#e11d48', color: 'white', border: 'none', borderRadius: '9999px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 14px rgba(225,29,72,0.25)' }}>
                      🚨 Submit Grievance to Vigilance Cell ➔
                    </button>
                  </form>
                </div>

                {/* Patient Grievance History List */}
                <div>
                  <h4 style={{ margin: '0 0 12px 0', color: '#18181b', fontSize: '15px', fontWeight: '700' }}>
                    📊 My Grievance Status & Signals ({patientGrievances.length})
                  </h4>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {patientGrievances.map(grv => {
                      const isRed = grv.status === 'SUBMITTED'
                      const isGreen = grv.status === 'RESOLVED' && grv.patientConfirmedResolved
                      const isOrange = !isRed && !isGreen

                      return (
                        <div
                          key={grv.grievanceId}
                          style={{
                            border: `1.5px solid ${isGreen ? '#86efac' : isOrange ? '#fde68a' : '#fecdd3'}`,
                            borderRadius: '18px',
                            padding: '18px',
                            backgroundColor: isGreen ? '#f0fdf4' : isOrange ? '#fffbeb' : '#fff1f2'
                          }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                            <div>
                              <span style={{ fontSize: '11px', color: '#71717a', fontWeight: '700' }}>{grv.grievanceId} • {grv.department}</span>
                              <h4 style={{ margin: '2px 0 0 0', color: '#18181b', fontSize: '15px' }}>{grv.category}</h4>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'white', padding: '4px 12px', borderRadius: '9999px', border: `1px solid ${isGreen ? '#bbf7d0' : isOrange ? '#fef08a' : '#fecdd3'}` }}>
                              <span>{isGreen ? '🟢' : isOrange ? '🟠' : '🔴'}</span>
                              <strong style={{ fontSize: '11px', color: isGreen ? '#15803d' : isOrange ? '#b45309' : '#be123c' }}>
                                {isGreen ? 'RESOLVED (APPROVED BY YOU)' : isOrange ? (grv.adminReply ? 'ACTION TAKEN (CONFIRM BELOW)' : 'UNDER INVESTIGATION') : 'SUBMITTED (AWAITING REVIEW)'}
                              </strong>
                            </div>
                          </div>

                          <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#3f3f46', lineHeight: '1.45' }}>
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
                            <div style={{ backgroundColor: '#ffffff', padding: '14px', borderRadius: '14px', border: '1px solid #e4e4e7', marginTop: '10px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                <strong style={{ fontSize: '12px', color: '#15803d' }}>💬 Hospital Administration Response:</strong>
                                <span style={{ fontSize: '11px', color: '#0284c7' }}>🕒 {formatDateTime(grv.adminRepliedAt)}</span>
                              </div>
                              <p style={{ margin: '2px 0 6px 0', fontSize: '13px', color: '#18181b' }}>"{grv.adminReply}"</p>
                              <span style={{ fontSize: '11px', color: '#71717a', display: 'block' }}>Officer: {grv.adminRepliedBy}</span>

                              {!grv.patientConfirmedResolved ? (
                                <div style={{ backgroundColor: '#fff7ed', border: '1px solid #fed7aa', padding: '12px 14px', borderRadius: '12px', marginTop: '10px' }}>
                                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#9a3412', marginBottom: '4px' }}>
                                    🛡️ Resolution Confirmation: Has your issue been fixed on the ground?
                                  </div>
                                  <p style={{ fontSize: '11px', color: '#7c2d12', margin: '0 0 8px 0' }}>
                                    Only YOU have the authority to grant permission to close this issue as Green 🟢.
                                  </p>
                                  <div style={{ display: 'flex', gap: '8px' }}>
                                    <button 
                                      onClick={() => handlePatientConfirmResolution(grv.grievanceId, true)}
                                      style={{ padding: '6px 14px', backgroundColor: '#15803d', color: 'white', border: 'none', borderRadius: '9999px', fontWeight: '700', fontSize: '11px', cursor: 'pointer' }}>
                                      ✅ Yes, Issue Fixed (Turn Green 🟢)
                                    </button>
                                    <button 
                                      onClick={() => handlePatientConfirmResolution(grv.grievanceId, false)}
                                      style={{ padding: '6px 14px', backgroundColor: '#e11d48', color: 'white', border: 'none', borderRadius: '9999px', fontWeight: '700', fontSize: '11px', cursor: 'pointer' }}>
                                      ❌ No, Still Pending (Stay Orange 🟠)
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#f0fdf4', padding: '8px 12px', borderRadius: '10px', border: '1px solid #bbf7d0', marginTop: '10px' }}>
                                  <span style={{ fontSize: '14px' }}>🟢</span>
                                  <strong style={{ fontSize: '11px', color: '#15803d' }}>
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

        {/* 3. DOCTOR STATION (NORDIC SERENE DESIGN) */}
        {activeView === 'doctor' && currentUser?.role === 'doctor' && (
          <div style={{ width: '100%', maxWidth: '1040px' }}>
            
            {/* Doctor Profile Header */}
            <div style={{ backgroundColor: '#ffffff', padding: '22px 28px', borderRadius: '20px', boxShadow: '0 4px 20px -2px rgba(24,24,27,0.04)', border: '1px solid #ebeae5', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
              <div>
                <span style={{ fontSize: '11px', color: '#71717a', textTransform: 'uppercase', fontWeight: '700' }}>Physician Desk</span>
                <h2 style={{ margin: '2px 0 0 0', color: '#18181b', fontSize: '20px', fontWeight: '800' }}>{currentUser.data.name}</h2>
                <span style={{ fontSize: '13px', color: '#15803d', fontWeight: '600' }}>
                  {currentUser.data.department} • 📍 {DEPARTMENT_LOCATIONS[currentUser.data.department]?.room} ({DEPARTMENT_LOCATIONS[currentUser.data.department]?.block})
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#71717a' }}>Switch Doctor:</label>
                <select
                  style={{ padding: '8px 14px', borderRadius: '9999px', border: '1px solid #e4e4e7', backgroundColor: '#fcfcfb', fontSize: '13px' }}
                  value={selectedDoctorId}
                  onChange={e => {
                    const doc = doctorsList.find(d => d.doctorId === e.target.value)
                    if (doc) persistLogin('doctor', doc)
                    setSelectedDoctorId(e.target.value)
                    setActivePatientForExam(null)
                    setInspectedPatientFullFile(null)
                  }}>
                  {doctorsList.map(d => (
                    <option key={d.doctorId} value={d.doctorId}>{d.name} ({d.department})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Doctor Queue Controls */}
            <div style={{ backgroundColor: '#ffffff', padding: '14px 20px', borderRadius: '16px', border: '1px solid #ebeae5', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setDoctorViewFilter('waiting')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '9999px',
                    border: 'none',
                    backgroundColor: doctorViewFilter === 'waiting' ? '#18181b' : '#f4f4f5',
                    color: doctorViewFilter === 'waiting' ? '#ffffff' : '#52525b',
                    fontWeight: '700',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}>
                  ⏳ Waiting Queue ({doctorQueueData.waitingCount || 0})
                </button>

                <button
                  onClick={() => setDoctorViewFilter('all')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '9999px',
                    border: 'none',
                    backgroundColor: doctorViewFilter === 'all' ? '#18181b' : '#f4f4f5',
                    color: doctorViewFilter === 'all' ? '#ffffff' : '#52525b',
                    fontWeight: '700',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}>
                  📋 All Assigned ({doctorQueueData.totalAssigned || 0})
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#71717a' }}>📅 Date Filter:</label>
                <select
                  style={{ padding: '6px 12px', borderRadius: '9999px', border: '1px solid #e4e4e7', fontSize: '12px' }}
                  value={selectedDateFilter}
                  onChange={e => {
                    setSelectedDateFilter(e.target.value)
                    setDoctorViewFilter('date-wise')
                  }}>
                  <option value="ALL">All Dates</option>
                  {(doctorQueueData.dateStats || []).map(ds => (
                    <option key={ds.date} value={ds.date}>{ds.date} ({ds.total})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Queue & Examination Workspace */}
            <div style={{ display: 'grid', gridTemplateColumns: activePatientForExam ? '1fr 1.3fr' : '1fr', gap: '20px' }}>
              
              {/* Left Column: Queue List */}
              <div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.02)', border: '1px solid #ebeae5' }}>
                <h3 style={{ margin: '0 0 14px 0', color: '#18181b', fontSize: '15px', fontWeight: '700' }}>
                  {doctorViewFilter === 'waiting' && `⏳ Patients in Waiting Queue (${displayedDoctorPatients.length})`}
                  {doctorViewFilter === 'all' && `📋 All Patients Assigned (${displayedDoctorPatients.length})`}
                  {doctorViewFilter === 'date-wise' && `📅 Patients on ${selectedDateFilter} (${displayedDoctorPatients.length})`}
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '560px', overflowY: 'auto' }}>
                  {displayedDoctorPatients.map((p, i) => (
                    <div
                      key={p.patientId}
                      onClick={() => inspectPatientTimeline(p)}
                      style={{
                        border: activePatientForExam?.patientId === p.patientId ? '1.5px solid #15803d' : '1px solid #ebeae5',
                        padding: '12px 14px',
                        borderRadius: '14px',
                        backgroundColor: activePatientForExam?.patientId === p.patientId ? '#f0fdf4' : '#fcfcfb',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer'
                      }}>
                      <div>
                        <strong style={{ fontSize: '14px', color: '#18181b' }}>#{i + 1} {p.name}</strong>
                        <div style={{ fontSize: '11px', color: '#71717a', marginTop: '2px' }}>
                          {p.patientId} • {p.age}y {p.gender} • Reg: {formatDateTime(p.createdAt)}
                        </div>
                      </div>

                      <span style={{
                        padding: '3px 10px',
                        borderRadius: '9999px',
                        fontSize: '11px',
                        fontWeight: '700',
                        backgroundColor: p.currentStatus === 'WAITING_FOR_DOCTOR' ? '#e0f2fe' : p.currentStatus === 'IN_LAB' ? '#fef3c7' : '#dcfce7',
                        color: p.currentStatus === 'WAITING_FOR_DOCTOR' ? '#0369a1' : p.currentStatus === 'IN_LAB' ? '#92400e' : '#15803d'
                      }}>
                        {p.currentStatus.replace(/_/g, ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: Active Examination */}
              {activePatientForExam && (
                <div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.02)', border: '1px solid #ebeae5' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f4f4f5', paddingBottom: '12px', marginBottom: '14px' }}>
                    <div>
                      <span style={{ fontSize: '11px', color: '#15803d', fontWeight: '700' }}>Active Examination File</span>
                      <h3 style={{ margin: '2px 0 0 0', color: '#18181b', fontSize: '16px', fontWeight: '800' }}>{activePatientForExam.name} ({activePatientForExam.patientId})</h3>
                    </div>
                    <button onClick={() => { setActivePatientForExam(null); setInspectedPatientFullFile(null); }} style={{ background: '#f4f4f5', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', color: '#71717a' }}>✕</button>
                  </div>

                  {/* Doctor Action Tabs */}
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', borderBottom: '1px solid #f4f4f5', paddingBottom: '8px', flexWrap: 'wrap' }}>
                    <button onClick={() => setDoctorActionTab('lab')} style={{ padding: '6px 12px', fontSize: '12px', border: 'none', borderRadius: '9999px', backgroundColor: doctorActionTab === 'lab' ? '#18181b' : '#f4f4f5', color: doctorActionTab === 'lab' ? 'white' : '#52525b', cursor: 'pointer', fontWeight: '600' }}>🧪 Order Lab</button>
                    <button onClick={() => setDoctorActionTab('rx')} style={{ padding: '6px 12px', fontSize: '12px', border: 'none', borderRadius: '9999px', backgroundColor: doctorActionTab === 'rx' ? '#18181b' : '#f4f4f5', color: doctorActionTab === 'rx' ? 'white' : '#52525b', cursor: 'pointer', fontWeight: '600' }}>💊 Prescribe</button>
                    <button onClick={() => setDoctorActionTab('referral')} style={{ padding: '6px 12px', fontSize: '12px', border: 'none', borderRadius: '9999px', backgroundColor: doctorActionTab === 'referral' ? '#18181b' : '#f4f4f5', color: doctorActionTab === 'referral' ? 'white' : '#52525b', cursor: 'pointer', fontWeight: '600' }}>🔄 Refer</button>
                    <button onClick={() => setDoctorActionTab('admit')} style={{ padding: '6px 12px', fontSize: '12px', border: 'none', borderRadius: '9999px', backgroundColor: doctorActionTab === 'admit' ? '#18181b' : '#f4f4f5', color: doctorActionTab === 'admit' ? 'white' : '#52525b', cursor: 'pointer', fontWeight: '600' }}>🛏️ Admit</button>
                    <button onClick={() => setDoctorActionTab('discharge')} style={{ padding: '6px 12px', fontSize: '12px', border: 'none', borderRadius: '9999px', backgroundColor: doctorActionTab === 'discharge' ? '#15803d' : '#dcfce7', color: doctorActionTab === 'discharge' ? 'white' : '#166534', cursor: 'pointer', fontWeight: '700' }}>🏁 Discharge</button>
                  </div>

                  {doctorActionTab === 'lab' && (
                    <form onSubmit={handleDoctorOrderLab}>
                      <select style={{ width: '100%', padding: '10px', borderRadius: '12px', border: '1px solid #e4e4e7', marginBottom: '10px', fontSize: '13px' }} value={selectedTest} onChange={e => setSelectedTest(e.target.value)}>
                        <option>Complete Blood Count (CBC)</option>
                        <option>Serum Creatinine & Urea</option>
                        <option>Lipid Profile</option>
                        <option>Chest X-Ray (PA View)</option>
                        <option>Ultrasound Abdomen</option>
                        <option>ECG & 2D Echo (Cardiology)</option>
                      </select>
                      <button type="submit" style={{ width: '100%', padding: '10px', backgroundColor: '#0284c7', color: 'white', border: 'none', borderRadius: '9999px', fontWeight: '700', cursor: 'pointer', fontSize: '13px' }}>
                        Order Diagnostic Test ➔
                      </button>
                    </form>
                  )}

                  {doctorActionTab === 'rx' && (
                    <form onSubmit={handleDoctorPrescribe}>
                      <input type="text" style={{ width: '100%', padding: '10px', borderRadius: '12px', border: '1px solid #e4e4e7', marginBottom: '10px', fontSize: '13px' }} value={rxMedicines} onChange={e => setRxMedicines(e.target.value)} />
                      <button type="submit" style={{ width: '100%', padding: '10px', backgroundColor: '#15803d', color: 'white', border: 'none', borderRadius: '9999px', fontWeight: '700', cursor: 'pointer', fontSize: '13px' }}>
                        Send Prescription to Pharmacy ➔
                      </button>
                    </form>
                  )}

                  {doctorActionTab === 'discharge' && (
                    <form onSubmit={handleDoctorDischargeSubmit}>
                      <textarea rows={3} style={{ width: '100%', padding: '10px', borderRadius: '12px', border: '1px solid #e4e4e7', marginBottom: '10px', fontSize: '13px', boxSizing: 'border-box' }} value={dischargeSummaryText} onChange={e => setDischargeSummaryText(e.target.value)} />
                      <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#15803d', color: 'white', border: 'none', borderRadius: '9999px', fontWeight: '700', cursor: 'pointer', fontSize: '13px' }}>
                        🏁 Authorize Discharge & Complete ➔
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 4. DIAGNOSTIC LAB STATION */}
        {activeView === 'lab' && currentUser?.role === 'lab' && (
          <div style={{ width: '100%', maxWidth: '880px', backgroundColor: '#ffffff', padding: '32px', borderRadius: '24px', boxShadow: '0 4px 24px -2px rgba(24,24,27,0.04)', border: '1px solid #ebeae5' }}>
            <h2 style={{ margin: '0 0 6px 0', color: '#18181b', fontSize: '20px' }}>🔬 Diagnostic Laboratory Monitor</h2>
            <p style={{ margin: '0 0 18px 0', color: '#71717a', fontSize: '13px' }}>Verify sample collections and publish diagnostic report films with live camera proof.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {labOrders.map(order => (
                <div key={order._id} style={{ border: '1px solid #ebeae5', padding: '18px', borderRadius: '18px', backgroundColor: '#fcfcfb' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div>
                      <strong style={{ fontSize: '15px' }}>{order.testName}</strong>
                      <div style={{ fontSize: '12px', color: '#71717a' }}>Patient: {order.patientId} • Ordered by: {order.doctorName}</div>
                    </div>
                    <span style={{ padding: '3px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: '700', backgroundColor: order.status === 'REPORT_READY' ? '#dcfce7' : '#fef3c7', color: order.status === 'REPORT_READY' ? '#15803d' : '#b45309' }}>
                      {order.status}
                    </span>
                  </div>

                  {order.status === 'PENDING' && (
                    <button 
                      onClick={() => openCameraModal(`📸 Sample Tube Proof (${order.testName})`, 'lab', order._id, (p) => executeLabCollectWithPhoto(order._id, p))}
                      style={{ padding: '8px 18px', backgroundColor: '#0284c7', color: 'white', border: 'none', borderRadius: '9999px', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>
                      <span>📷</span> Collect Sample with Camera Proof
                    </button>
                  )}

                  {order.status === 'SAMPLE_COLLECTED' && (
                    <div>
                      <input type="text" placeholder="Enter findings e.g. Hb 13.8 g/dL" style={{ width: '100%', padding: '10px', borderRadius: '12px', border: '1px solid #e4e4e7', marginBottom: '8px' }} onChange={e => setLabFindingsInput({...labFindingsInput, [order._id]: e.target.value})} />
                      <button 
                        onClick={() => openCameraModal(`📸 Diagnostic Sheet Proof (${order.testName})`, 'lab', order._id, (p) => executeLabPublishWithPhoto(order._id, p))}
                        style={{ padding: '8px 18px', backgroundColor: '#15803d', color: 'white', border: 'none', borderRadius: '9999px', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>
                        <span>📷</span> Publish Report with Camera Proof
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. PHARMACY STATION */}
        {activeView === 'pharmacy' && currentUser?.role === 'pharmacy' && (
          <div style={{ width: '100%', maxWidth: '880px', backgroundColor: '#ffffff', padding: '32px', borderRadius: '24px', boxShadow: '0 4px 24px -2px rgba(24,24,27,0.04)', border: '1px solid #ebeae5' }}>
            <h2 style={{ margin: '0 0 6px 0', color: '#18181b', fontSize: '20px' }}>💊 Pharmacy Dispensing Counter</h2>
            <p style={{ margin: '0 0 18px 0', color: '#71717a', fontSize: '13px' }}>Dispense prescribed medications with mandatory live camera handover evidence.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {prescriptions.map(rx => (
                <div key={rx._id} style={{ border: '1px solid #ebeae5', padding: '18px', borderRadius: '18px', backgroundColor: '#fcfcfb' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <strong style={{ fontSize: '14px' }}>Patient: {rx.patientId} (Dr: {rx.doctorName})</strong>
                    <span style={{ padding: '3px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: '700', backgroundColor: rx.status === 'COMPLETELY_DISPENSED' || rx.status === 'DISPENSED' ? '#dcfce7' : '#fef3c7', color: rx.status === 'COMPLETELY_DISPENSED' || rx.status === 'DISPENSED' ? '#15803d' : '#b45309' }}>
                      {rx.status}
                    </span>
                  </div>
                  <ul style={{ margin: '0 0 10px 0', paddingLeft: '20px', fontSize: '13px' }}>
                    {rx.medicines.map((m, i) => <li key={i}>{m.name} - {m.dosage}</li>)}
                  </ul>

                  {rx.status !== 'COMPLETELY_DISPENSED' && rx.status !== 'DISPENSED' && (
                    <button 
                      onClick={() => openCameraModal(`📸 Dispensing Proof (${rx.patientId})`, 'pharmacy', rx._id, (p) => executeDispenseWithPhoto(rx._id, p))}
                      style={{ padding: '8px 18px', backgroundColor: '#15803d', color: 'white', border: 'none', borderRadius: '9999px', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>
                      <span>📷</span> Dispense with Camera Proof
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 6. INPATIENT WARD STATION */}
        {activeView === 'ward' && currentUser?.role === 'ward' && (
          <div style={{ width: '100%', maxWidth: '880px', backgroundColor: '#ffffff', padding: '32px', borderRadius: '24px', boxShadow: '0 4px 24px -2px rgba(24,24,27,0.04)', border: '1px solid #ebeae5' }}>
            <h2 style={{ margin: '0 0 6px 0', color: '#18181b', fontSize: '20px' }}>🛏️ Inpatient Ward & Supply Tracker</h2>
            <p style={{ margin: '0 0 18px 0', color: '#71717a', fontSize: '13px' }}>Track bed allocations and consumable items with live camera verification.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {displayedWardList.map(adm => (
                <div key={adm._id} style={{ border: '1px solid #ebeae5', padding: '20px', borderRadius: '18px', backgroundColor: '#fcfcfb' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div>
                      <strong style={{ fontSize: '15px' }}>{adm.patientName || adm.patientId}</strong> ({adm.wardType} - {adm.bedNumber})
                    </div>
                    {adm.status === 'ADMITTED' && (
                      <button onClick={() => handleDischarge(adm._id)} style={{ padding: '6px 14px', backgroundColor: '#15803d', color: 'white', border: 'none', borderRadius: '9999px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                        🏁 Discharge Bed
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 7. O/P COUNTER DESK */}
        {activeView === 'op-desk' && currentUser?.role === 'op-desk' && (
          <div style={{ width: '100%', maxWidth: '600px', backgroundColor: '#ffffff', padding: '36px', borderRadius: '24px', boxShadow: '0 4px 24px -2px rgba(24,24,27,0.04)', border: '1px solid #ebeae5' }}>
            <h2 style={{ margin: '0 0 4px 0', color: '#18181b', fontSize: '20px' }}>🎫 O/P Registration Desk</h2>
            <p style={{ margin: '0 0 20px 0', color: '#71717a', fontSize: '13px' }}>Create new outpatient record and send credentials via WhatsApp.</p>

            <form onSubmit={handleOpRegister}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#3f3f46', display: 'block', marginBottom: '4px' }}>Patient Full Name</label>
                <input required type="text" placeholder="e.g. Rahul Sharma" style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid #e4e4e7', boxSizing: 'border-box' }} value={opForm.name} onChange={e => setOpForm({...opForm, name: e.target.value})} />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#3f3f46', display: 'block', marginBottom: '4px' }}>Age</label>
                  <input required type="number" placeholder="42" style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid #e4e4e7', boxSizing: 'border-box' }} value={opForm.age} onChange={e => setOpForm({...opForm, age: e.target.value})} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#3f3f46', display: 'block', marginBottom: '4px' }}>Gender</label>
                  <select style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid #e4e4e7', backgroundColor: 'white', boxSizing: 'border-box' }} value={opForm.gender} onChange={e => setOpForm({...opForm, gender: e.target.value})}>
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#3f3f46', display: 'block', marginBottom: '4px' }}>WhatsApp Mobile Number (10 Digits)</label>
                <input required type="tel" placeholder="e.g. 9876543210" style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid #e4e4e7', boxSizing: 'border-box' }} value={opForm.phoneNumber} onChange={e => setOpForm({...opForm, phoneNumber: e.target.value})} />
              </div>

              <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#15803d', color: 'white', border: 'none', borderRadius: '9999px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 14px rgba(21,128,61,0.25)' }}>
                Register Patient & Auto-Assign Desk ➔
              </button>
            </form>
          </div>
        )}

        {/* 8. EXECUTIVE HOSPITAL ADMINISTRATION CONSOLE (NORDIC SERENE) */}
        {activeView === 'admin' && currentUser?.role === 'admin' && (
          <div style={{ width: '100%', maxWidth: '1060px' }}>
            
            {/* Header */}
            <div style={{ backgroundColor: '#ffffff', padding: '24px 32px', borderRadius: '24px', boxShadow: '0 4px 24px -2px rgba(24,24,27,0.04)', border: '1px solid #ebeae5', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h2 style={{ margin: 0, color: '#18181b', fontSize: '20px', fontWeight: '800' }}>📊 Hospital Administration Console</h2>
                  <span style={{ backgroundColor: '#f0fdf4', color: '#15803d', padding: '3px 12px', borderRadius: '9999px', fontSize: '11px', fontWeight: '700', border: '1px solid #bbf7d0' }}>● Live Sync</span>
                </div>
                <p style={{ margin: '2px 0 0 0', color: '#71717a', fontSize: '13px' }}>
                  Complete oversight across Patients, Doctors on Shift, Diagnostic Labs, Photos, Discharges, and Video Grievances.
                </p>
              </div>

              <button 
                onClick={() => {
                  fetchHospitalStats()
                  fetchHospitalAuditTrail()
                  fetchDoctors()
                  fetchPatientsList()
                  fetchLabOrders()
                  fetchPrescriptions()
                  fetchAdmissions()
                  fetchAllHospitalGrievances()
                }} 
                style={{ padding: '8px 18px', backgroundColor: '#18181b', color: 'white', border: 'none', borderRadius: '9999px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
                <span>🔄</span> Refresh Data
              </button>
            </div>

            {/* Clean 6-Section Nordic Navigation Pills */}
            <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid #ebeae5', paddingBottom: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
              {[
                { key: 'registered-patients', label: `👥 1. Patients (${registeredPatients.length})` },
                { key: 'doctors-duty', label: `👨‍⚕️ 2. Doctors (${doctorsList.length})` },
                { key: 'labs', label: `🔬 3. Labs (${labOrders.length})` },
                { key: 'photos', label: `📸 4. Photos (${adminCategorizedPhotos.length})` },
                { key: 'discharged-patients', label: `🏁 5. Discharges (${dischargedPatientsList.length})` },
                { key: 'grievances', label: `🚨 6. Grievances (${allHospitalGrievances.length})` }
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => { setAdminActiveTab(tab.key); setAdminSearchQuery(''); }}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '9999px',
                    border: 'none',
                    backgroundColor: adminActiveTab === tab.key ? '#18181b' : '#f4f4f5',
                    color: adminActiveTab === tab.key ? '#ffffff' : '#52525b',
                    fontWeight: '700',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* SECTION 1: REGISTERED PATIENTS */}
            {adminActiveTab === 'registered-patients' && (
              <div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '20px', border: '1px solid #ebeae5' }}>
                <h3 style={{ margin: '0 0 14px 0', fontSize: '16px' }}>👥 Registered Patients</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {filteredAdminRegisteredPatients.map((p, idx) => (
                    <div
                      key={p.patientId}
                      onClick={() => handleAdminInspectPatient(p.patientId)}
                      style={{ border: '1px solid #f4f4f5', padding: '14px', borderRadius: '14px', backgroundColor: '#fafaf9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                      <div>
                        <strong>#{idx + 1} {p.name}</strong> ({p.patientId})
                        <div style={{ fontSize: '11px', color: '#71717a', marginTop: '2px' }}>Mobile: +91 {p.phoneNumber} • Reg: {formatDateTime(p.createdAt)}</div>
                      </div>
                      <span style={{ fontSize: '12px', color: '#15803d', fontWeight: '700' }}>Open File ➔</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SECTION 2: DOCTORS ON DUTY */}
            {adminActiveTab === 'doctors-duty' && (
              <div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '20px', border: '1px solid #ebeae5' }}>
                <h3 style={{ margin: '0 0 14px 0', fontSize: '16px' }}>👨‍⚕️ Doctors on Duty</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                  {doctorsList.map(doc => (
                    <div key={doc.doctorId} onClick={() => setAdminSelectedDoctor(doc)} style={{ padding: '16px', border: '1px solid #ebeae5', borderRadius: '14px', backgroundColor: '#fafaf9', cursor: 'pointer' }}>
                      <strong style={{ fontSize: '15px' }}>{doc.name}</strong>
                      <div style={{ fontSize: '12px', color: '#15803d', fontWeight: '600' }}>{doc.department}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SECTION 3: LABS */}
            {adminActiveTab === 'labs' && (
              <div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '20px', border: '1px solid #ebeae5' }}>
                <h3 style={{ margin: '0 0 14px 0', fontSize: '16px' }}>🔬 Diagnostic Laboratory Orders</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {labOrders.map(lab => (
                    <div key={lab._id} style={{ border: '1px solid #ebeae5', padding: '14px', borderRadius: '14px', backgroundColor: '#fafaf9' }}>
                      <strong>{lab.testName}</strong> (Patient: {lab.patientId})
                      <div style={{ fontSize: '11px', color: '#71717a' }}>Status: {lab.status}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SECTION 4: PHOTOS */}
            {adminActiveTab === 'photos' && (
              <div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '20px', border: '1px solid #ebeae5' }}>
                <h3 style={{ margin: '0 0 14px 0', fontSize: '16px' }}>📸 Verified Photographic Proofs</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
                  {adminCategorizedPhotos.map((item, idx) => (
                    <div key={idx} style={{ border: '1px solid #ebeae5', borderRadius: '14px', overflow: 'hidden', backgroundColor: '#fafaf9' }}>
                      <img src={item.photoProof} alt="Proof" style={{ width: '100%', height: '160px', objectFit: 'cover' }} />
                      <div style={{ padding: '12px' }}>
                        <strong style={{ fontSize: '12px', display: 'block' }}>{item.itemSummary}</strong>
                        <span style={{ fontSize: '11px', color: '#71717a' }}>Patient: {item.patientId}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SECTION 5: DISCHARGES */}
            {adminActiveTab === 'discharged-patients' && (
              <div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '20px', border: '1px solid #ebeae5' }}>
                <h3 style={{ margin: '0 0 14px 0', fontSize: '16px' }}>🏁 Discharged Patients Permanent Archive</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {filteredAdminDischargedPatients.map((p, idx) => (
                    <div key={p.patientId} onClick={() => handleAdminInspectPatient(p.patientId)} style={{ border: '1px solid #bbf7d0', padding: '14px', borderRadius: '14px', backgroundColor: '#f0fdf4', cursor: 'pointer' }}>
                      <strong>#{idx + 1} {p.name}</strong> ({p.patientId}) - Discharged
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SECTION 6: 🚨 GRIEVANCE OVERSIGHT */}
            {adminActiveTab === 'grievances' && (
              <div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '20px', border: '1px solid #ebeae5' }}>
                <h3 style={{ margin: '0 0 14px 0', color: '#9f1239', fontSize: '16px' }}>🚨 Patient Video / Photo Grievances</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {allHospitalGrievances.map(grv => {
                    const isGreen = grv.status === 'RESOLVED' && grv.patientConfirmedResolved
                    return (
                      <div key={grv.grievanceId} style={{ border: `1.5px solid ${isGreen ? '#86efac' : '#fde68a'}`, padding: '16px', borderRadius: '16px', backgroundColor: isGreen ? '#f0fdf4' : '#fffbeb' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <strong>{grv.patientName} ({grv.patientId})</strong> - {grv.category}
                            <div style={{ fontSize: '12px', color: '#71717a' }}>"{grv.description}"</div>
                          </div>
                          <button onClick={() => { setSelectedAdminGrievance(grv); setAdminGrievanceReplyText(grv.adminReply || ''); }} style={{ padding: '6px 14px', backgroundColor: '#18181b', color: 'white', border: 'none', borderRadius: '9999px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
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

      {/* ADMIN GRIEVANCE ACTION & VIDEO WATCH MODAL */}
      {selectedAdminGrievance && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(24, 24, 27, 0.65)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 14000, padding: '20px' }}>
          <div style={{ backgroundColor: 'white', width: '100%', maxWidth: '600px', borderRadius: '24px', padding: '30px', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
            <button onClick={() => setSelectedAdminGrievance(null)} style={{ position: 'absolute', top: '18px', right: '18px', background: '#f4f4f5', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer' }}>✕</button>
            <h3 style={{ margin: '0 0 6px 0' }}>{selectedAdminGrievance.category}</h3>
            <p style={{ margin: '0 0 14px 0', fontSize: '13px', color: '#71717a' }}>Patient: {selectedAdminGrievance.patientName} ({selectedAdminGrievance.patientId})</p>

            {selectedAdminGrievance.mediaUrl && (
              <div style={{ backgroundColor: '#18181b', padding: '8px', borderRadius: '16px', textAlign: 'center', marginBottom: '14px' }}>
                {selectedAdminGrievance.mediaType === 'video' ? (
                  <video src={selectedAdminGrievance.mediaUrl} controls autoPlay style={{ width: '100%', maxHeight: '240px', borderRadius: '10px' }} />
                ) : (
                  <img src={selectedAdminGrievance.mediaUrl} alt="Evidence" style={{ width: '100%', maxHeight: '240px', borderRadius: '10px', objectFit: 'contain' }} />
                )}
              </div>
            )}

            <form onSubmit={handleAdminRespondToGrievance}>
              <label style={{ fontSize: '12px', fontWeight: '700', display: 'block', marginBottom: '4px' }}>Official Response to Patient:</label>
              <textarea rows={3} required placeholder="Type the action taken e.g. Staff reprimanded, medicine issued immediately..." style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid #e4e4e7', marginBottom: '14px', boxSizing: 'border-box' }} value={adminGrievanceReplyText} onChange={e => setAdminGrievanceReplyText(e.target.value)} />
              <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#15803d', color: 'white', border: 'none', borderRadius: '9999px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>
                Send Response to Patient ➔
              </button>
            </form>
          </div>
        </div>
      )}

      {/* DEDICATED ADMIN FULL PATIENT EHR INSPECTION MODAL */}
      {adminInspectedPatientFile && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(24, 24, 27, 0.65)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 12000, padding: '20px' }}>
          <div style={{ backgroundColor: 'white', width: '100%', maxWidth: '820px', borderRadius: '24px', padding: '32px', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
            <button onClick={() => setAdminInspectedPatientFile(null)} style={{ position: 'absolute', top: '18px', right: '18px', background: '#f4f4f5', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer' }}>✕</button>
            <h2 style={{ margin: '0 0 4px 0' }}>{adminInspectedPatientFile.patient?.name}</h2>
            <span style={{ fontSize: '13px', color: '#71717a' }}>ID: {adminInspectedPatientFile.patient?.patientId} • Mobile: +91 {adminInspectedPatientFile.patient?.phoneNumber}</span>

            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {adminInspectedPatientFile.timeline?.map((item, idx) => (
                <div key={idx} style={{ padding: '12px', backgroundColor: '#fafaf9', borderRadius: '12px', border: '1px solid #ebeae5', fontSize: '13px' }}>
                  <strong>{item.stage}</strong> - {item.details}
                  <div style={{ fontSize: '11px', color: '#71717a', marginTop: '2px' }}>{formatDateTime(item.timestamp)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* WEBCAM CAPTURE MODAL */}
      {cameraModal.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(24, 24, 27, 0.75)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 12000, padding: '20px' }}>
          <div style={{ backgroundColor: 'white', width: '100%', maxWidth: '580px', borderRadius: '24px', padding: '28px', position: 'relative' }}>
            <button onClick={() => { if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop()); setCameraModal({ isOpen: false }); }} style={{ position: 'absolute', top: '18px', right: '18px', background: '#f4f4f5', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer' }}>✕</button>
            <h3 style={{ margin: '0 0 12px 0' }}>{cameraModal.title}</h3>

            {!capturedPhotoPreview ? (
              <div>
                <div style={{ backgroundColor: '#18181b', borderRadius: '16px', overflow: 'hidden', height: '240px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '14px' }}>
                  <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <button onClick={snapWebcamPhoto} style={{ width: '100%', padding: '12px', backgroundColor: '#15803d', color: 'white', border: 'none', borderRadius: '9999px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>
                  📸 Snap Live Photo Proof
                </button>
              </div>
            ) : (
              <div>
                <img src={capturedPhotoPreview} alt="Proof" style={{ width: '100%', maxHeight: '240px', borderRadius: '14px', objectFit: 'contain', marginBottom: '14px' }} />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => { setCapturedPhotoPreview(null); startWebcam(); }} style={{ flex: 1, padding: '10px', backgroundColor: '#f4f4f5', color: '#18181b', border: '1px solid #e4e4e7', borderRadius: '9999px', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>🔄 Retake</button>
                  <button onClick={confirmCapturedPhoto} style={{ flex: 1.4, padding: '10px', backgroundColor: '#15803d', color: 'white', border: 'none', borderRadius: '9999px', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>✅ Confirm Proof</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* LOGIN MODAL */}
      {showLoginModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(24, 24, 27, 0.65)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 }}>
          <div style={{ backgroundColor: 'white', width: '100%', maxWidth: '480px', borderRadius: '24px', padding: '32px', position: 'relative' }}>
            <button onClick={() => setShowLoginModal(false)} style={{ position: 'absolute', top: '18px', right: '18px', background: '#f4f4f5', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer' }}>✕</button>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '18px' }}>Login to Chikitsya Setu</h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#71717a' }}>Select portal role to continue:</p>

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
                    border: '1px solid #e4e4e7',
                    backgroundColor: loginRole === r.key ? '#18181b' : '#fafaf9',
                    color: loginRole === r.key ? 'white' : '#3f3f46',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}>
                  {r.label}
                </button>
              ))}
            </div>

            {loginRole === 'patient' && (
              <div>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
                  <button onClick={() => setPatientLoginMode('password')} style={{ flex: 1, padding: '6px', fontSize: '11px', border: '1px solid #e4e4e7', borderRadius: '9999px', backgroundColor: patientLoginMode === 'password' ? '#18181b' : '#fafaf9', color: patientLoginMode === 'password' ? 'white' : '#3f3f46', cursor: 'pointer', fontWeight: '600' }}>PIN Login</button>
                  <button onClick={() => setPatientLoginMode('quick')} style={{ flex: 1, padding: '6px', fontSize: '11px', border: '1px solid #e4e4e7', borderRadius: '9999px', backgroundColor: patientLoginMode === 'quick' ? '#18181b' : '#fafaf9', color: patientLoginMode === 'quick' ? 'white' : '#3f3f46', cursor: 'pointer', fontWeight: '600' }}>⚡ Quick Select</button>
                </div>

                {patientLoginMode === 'password' && (
                  <form onSubmit={handlePatientPasswordLogin}>
                    <input required type="text" placeholder="Patient ID (e.g. PT-1001)" style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid #e4e4e7', marginBottom: '10px', boxSizing: 'border-box' }} value={loginId} onChange={e => setLoginId(e.target.value)} />
                    <input required type="password" placeholder="Passcode PIN" style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid #e4e4e7', marginBottom: '14px', boxSizing: 'border-box' }} value={loginPassword} onChange={e => setLoginPassword(e.target.value)} />
                    <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#15803d', color: 'white', border: 'none', borderRadius: '9999px', fontWeight: '700', cursor: 'pointer', fontSize: '13px' }}>Log In ➔</button>
                  </form>
                )}

                {patientLoginMode === 'quick' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                    {registeredPatients.map(p => (
                      <button key={p.patientId} onClick={() => handleDirectPatientSelect(p)} style={{ padding: '8px 12px', border: '1px solid #e4e4e7', borderRadius: '10px', backgroundColor: '#fafaf9', display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}>
                        <span>{p.name} ({p.patientId})</span>
                        <span style={{ color: '#15803d', fontWeight: '700' }}>Enter ➔</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {loginRole === 'doctor' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {doctorsList.map(doc => (
                  <button key={doc.doctorId} onClick={() => handleRoleSelectLogin('doctor', doc)} style={{ padding: '10px 14px', border: '1px solid #e4e4e7', borderRadius: '12px', backgroundColor: '#fafaf9', display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}>
                    <strong>{doc.name} ({doc.department})</strong>
                    <span style={{ color: '#15803d', fontWeight: '700' }}>Enter ➔</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer style={{ backgroundColor: '#ffffff', borderTop: '1px solid #ebeae5', color: '#71717a', textAlign: 'center', padding: '18px', fontSize: '12px' }}>
        &copy; 2026 Chikitsya Setu - Gandhi Hospital Public Healthcare Transparency Engine
      </footer>

    </div>
  )
}

export default App
