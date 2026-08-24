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

// Helper: File to Base64 reader for Photo Proofs
const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
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

  // Background
  ctx.fillStyle = type === 'pharmacy' ? '#064e3b' : type === 'lab' ? '#1e3a8a' : '#581c87'
  ctx.fillRect(0, 0, 600, 400)

  // Inner card
  ctx.fillStyle = '#ffffff'
  ctx.roundRect(20, 20, 560, 360, 16)
  ctx.fill()

  // Header Banner
  ctx.fillStyle = type === 'pharmacy' ? '#10b981' : type === 'lab' ? '#3b82f6' : '#a855f7'
  ctx.fillRect(20, 20, 560, 60)

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 20px sans-serif'
  ctx.fillText('🏥 GANDHI HOSPITAL - PHOTO PROOF AUDIT', 40, 58)

  // Icon
  ctx.font = '54px sans-serif'
  ctx.fillText(type === 'pharmacy' ? '💊' : type === 'lab' ? '🧪' : '💉', 40, 150)

  // Content
  ctx.fillStyle = '#0f172a'
  ctx.font = 'bold 22px sans-serif'
  ctx.fillText(title, 110, 130)

  ctx.fillStyle = '#475569'
  ctx.font = '16px sans-serif'
  ctx.fillText(subtitle, 110, 160)

  // Details box
  ctx.fillStyle = '#f8fafc'
  ctx.fillRect(40, 190, 520, 110)
  ctx.strokeStyle = '#e2e8f0'
  ctx.strokeRect(40, 190, 520, 110)

  ctx.fillStyle = '#334155'
  ctx.font = '14px monospace'
  ctx.fillText(`STATUS: VERIFIED & PHYSICALLY HANDED OVER`, 55, 220)
  ctx.fillText(`TIMESTAMP: ${new Date().toLocaleString('en-IN')}`, 55, 245)
  ctx.fillText(`SECURITY: ZERO-LEAKAGE DIGITAL WATERMARK`, 55, 270)

  // Official Stamp
  ctx.fillStyle = '#16a34a'
  ctx.font = 'bold 16px sans-serif'
  ctx.fillText('✅ OFFICIAL AUDIT EVIDENCE CAPTURED', 120, 345)

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
    purpose: '', // 'pharmacy' | 'lab' | 'ward'
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
  const [patientTab, setPatientTab] = useState('overview') // 'overview' | 'labs' | 'medicines' | 'admissions'
  const [selectedDetailItem, setSelectedDetailItem] = useState(null) // Detailed Interactive Modal Item

  // ---------- DOCTOR STATE ----------
  const [doctorsList, setDoctorsList] = useState([])
  const [selectedDoctorId, setSelectedDoctorId] = useState(
    savedSession?.role === 'doctor' && savedSession?.data?.doctorId ? savedSession.data.doctorId : 'DR-GEN-01'
  )
  const [doctorQueueData, setDoctorQueueData] = useState({ waitingQueue: [], allAssignedPatients: [], totalAssigned: 0, waitingCount: 0, dateStats: [] })
  const [doctorViewFilter, setDoctorViewFilter] = useState('waiting') // 'waiting' | 'all' | 'date-wise'
  const [selectedDateFilter, setSelectedDateFilter] = useState('ALL')
  const [activePatientForExam, setActivePatientForExam] = useState(null)
  const [inspectedPatientFullFile, setInspectedPatientFullFile] = useState(null)
  const [doctorActionTab, setDoctorActionTab] = useState('lab') // 'lab' | 'rx' | 'referral' | 'admit' | 'discharge'
  const [selectedTest, setSelectedTest] = useState('Complete Blood Count (CBC)')
  const [selectedLabRoom, setSelectedLabRoom] = useState('Pathology Lab 1 (Room 105)')
  const [labDeliveryMode, setLabDeliveryMode] = useState('DIGITAL_EHR') // 'DIGITAL_EHR' | 'PHYSICAL_COUNTER'
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

  // ---------- LAB STATE & PHOTO PROOF ----------
  const [labOrders, setLabOrders] = useState([])
  const [labFindingsInput, setLabFindingsInput] = useState({})
  const [labPhotoProofs, setLabPhotoProofs] = useState({}) // { [orderId]: base64 }
  const [labMessage, setLabMessage] = useState('')

  // ---------- PHARMACY STATE & PHOTO PROOF ----------
  const [prescriptions, setPrescriptions] = useState([])
  const [pharmacyPhotoProofs, setPharmacyPhotoProofs] = useState({}) // { [rxId]: base64 }
  const [pharmacyMessage, setPharmacyMessage] = useState('')

  // ---------- INPATIENT WARD STATE & PHOTO PROOF ----------
  const [admissionsList, setAdmissionsList] = useState([])
  const [wardViewFilter, setWardViewFilter] = useState('admitted') // 'admitted' | 'discharged'
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
  const [auditFilterType, setAuditFilterType] = useState('ALL')
  const [auditSearchQuery, setAuditSearchQuery] = useState('')

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
    }
    if (activeView === 'patient' && currentUser?.role === 'patient' && currentUser.data?.patientId) {
      fetchPatientFullFile(currentUser.data.patientId)
    }
  }, [activeView, selectedDoctorId, currentUser])

  // Stop camera when modal is closed
  useEffect(() => {
    if (!cameraModal.isOpen && streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
      setCameraStreamActive(false)
    }
  }, [cameraModal.isOpen])

  // Start Laptop Webcam Stream
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
        setCameraError('Camera access not supported on this browser. You can upload an image or use a 1-click preset!')
      }
    } catch (err) {
      console.warn('Webcam permission error:', err)
      setCameraError('Laptop camera permission denied or camera not found. You can upload a photo file or select a 1-click medical sample preset!')
    }
  }

  // Snap photo from live Laptop Webcam
  const snapWebcamPhoto = () => {
    if (!videoRef.current) return
    const video = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    
    // Add date & time watermark to proof
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(10, canvas.height - 40, canvas.width - 20, 30)
    ctx.fillStyle = '#ffffff'
    ctx.font = '14px sans-serif'
    ctx.fillText(`🏥 GANDHI HOSPITAL PHOTO PROOF | ${new Date().toLocaleString('en-IN')}`, 20, canvas.height - 20)

    const base64 = canvas.toDataURL('image/jpeg', 0.85)
    setCapturedPhotoPreview(base64)
  }

  const openCameraModal = (title, purpose, targetId, onSuccess) => {
    setCapturedPhotoPreview(null)
    setCameraError('')
    setCameraModal({
      isOpen: true,
      title,
      purpose,
      targetId,
      onSuccess
    })
    setTimeout(() => {
      startWebcam()
    }, 200)
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
    } catch (err) { console.error(err) }
  }

  const inspectPatientTimeline = async (patient) => {
    setActivePatientForExam(patient)
    try {
      const res = await axios.get(`${API_BASE}/hospital/patient-file/${patient.patientId}`)
      setInspectedPatientFullFile(res.data)
    } catch (err) { console.error(err) }
  }

  // ---------- PERSISTENT LOGIN HELPER ----------
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

  // ---------- AUTH HANDLERS ----------
  const handleOpStaffLogin = (e) => {
    e.preventDefault()
    setStaffLoginError('')
    if (opStaffUser.trim() === 'op_staff' && opStaffPass.trim() === 'gandhi2026') {
      persistLogin('op-desk', { name: 'O/P Receptionist (Desk #1)', staffId: 'STAFF-OP-01' })
      setOpStaffUser('')
      setOpStaffPass('')
    } else {
      setStaffLoginError('Invalid Staff ID or Password. Access restricted to authorized personnel.')
    }
  }

  const handlePatientPasswordLogin = async (e) => {
    e.preventDefault()
    setLoginError('')
    try {
      const res = await axios.post(`${API_BASE}/patients/login`, { patientId: loginId, password: loginPassword })
      persistLogin('patient', res.data.patient)
      await fetchPatientFullFile(res.data.patient.patientId)
      setLoginId('')
      setLoginPassword('')
    } catch (err) {
      setLoginError(err.response?.data?.message || 'Invalid credentials. Please verify your Patient ID and Passcode.')
    }
  }

  const handleDirectPatientSelect = async (patient) => {
    persistLogin('patient', patient)
    await fetchPatientFullFile(patient.patientId)
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
    setActivePatientForExam(null)
    setInspectedPatientFullFile(null)
    setSelectedDetailItem(null)
    fetchPatientsList()
  }

  // ---------- O/P REGISTRATION ----------
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

  // ---------- DOCTOR ACTIONS ----------
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
      setDoctorMessage(`✅ ${res.data.message} [Time: ${formatDateTime(new Date())}]`)
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
      setDoctorMessage(`✅ ${res.data.message} [Time: ${formatDateTime(new Date())}]`)
      fetchDoctorQueue(selectedDoctorId)
      inspectPatientTimeline(activePatientForExam)
    } catch (err) { setDoctorMessage(`⚠️ ${err.response?.data?.message || 'Failed'}`) }
  }

  // REVIEWS & TRANSFERS TO SPECIALIST (LOAD-BALANCED BY SHORTEST QUEUE)
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
      setDoctorMessage(`✅ ${res.data.message} [Time: ${formatDateTime(new Date())}]`)
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
      setDoctorMessage(`✅ ${res.data.message} [Time: ${formatDateTime(new Date())}]`)
      fetchDoctorQueue(selectedDoctorId)
      inspectPatientTimeline(activePatientForExam)
    } catch (err) { setDoctorMessage(`⚠️ ${err.response?.data?.message || 'Failed'}`) }
  }

  // DEDICATED DISCHARGE / COMPLETE OUTPATIENT ACTION (SYNCHRONIZED WITH WARDS)
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
      setDoctorMessage(`✅ ${res.data.message} [Time: ${formatDateTime(new Date())}]`)
      fetchDoctorQueue(selectedDoctorId)
      inspectPatientTimeline(activePatientForExam)
      fetchAdmissions()
      fetchHospitalStats()
    } catch (err) { setDoctorMessage(`⚠️ ${err.response?.data?.message || 'Failed'}`) }
  }

  // ---------- LAB ACTIONS (WITH PHOTO PROOF MODAL) ----------
  const executeLabCollectWithPhoto = async (reqId, photoProof) => {
    try {
      const res = await axios.put(`${API_BASE}/labs/collect/${reqId}`, { photoProof })
      setLabMessage(`✅ ${res.data.message} [Time: ${formatDateTime(new Date())}]`)
      fetchLabOrders()
    } catch (err) { setLabMessage(`⚠️ ${err.message}`) }
  }

  const executeLabPublishWithPhoto = async (reqId, photoProof) => {
    try {
      const findings = labFindingsInput[reqId] || 'Normal biological reference intervals maintained.'
      const res = await axios.put(`${API_BASE}/labs/publish/${reqId}`, { findings, photoProof })
      setLabMessage(`✅ ${res.data.message} [Time: ${formatDateTime(new Date())}]`)
      fetchLabOrders()
    } catch (err) { setLabMessage(`⚠️ ${err.message}`) }
  }

  // ---------- PHARMACY ACTIONS (WITH PHOTO PROOF MODAL) ----------
  const executeDispenseWithPhoto = async (rxId, photoProof) => {
    try {
      const res = await axios.put(`${API_BASE}/pharmacy/dispense/${rxId}`, { photoProof })
      setPharmacyMessage(`✅ ${res.data.message} [Time: ${formatDateTime(new Date())}]`)
      fetchPrescriptions()
    } catch (err) { setPharmacyMessage(`⚠️ ${err.message}`) }
  }

  // ---------- WARD ACTIONS (WITH PHOTO PROOF MODAL) ----------
  const executeLogResourceWithPhoto = async (admissionId, photoProof) => {
    try {
      const res = await axios.post(`${API_BASE}/admissions/resource/${admissionId}`, { 
        itemName: resourceItemName,
        photoProof: photoProof || wardResourcePhotoProof
      })
      setWardMessage(`✅ ${res.data.message} [Time: ${formatDateTime(new Date())}]`)
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
      setWardMessage(`✅ ${res.data.message} [Time: ${formatDateTime(new Date())}]`)
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

  // Filter Doctor Patients based on view (waiting queue, all assigned, date-wise)
  const displayedDoctorPatients = (() => {
    if (doctorViewFilter === 'waiting') return doctorQueueData.waitingQueue || []
    if (doctorViewFilter === 'date-wise' && selectedDateFilter !== 'ALL') {
      const group = (doctorQueueData.dateStats || []).find(d => d.date === selectedDateFilter)
      return group ? group.patients : []
    }
    return doctorQueueData.allAssignedPatients || []
  })()

  // Filter Ward Patients (Active Admitted vs Discharged Archives)
  const activeAdmittedList = admissionsList.filter(a => a.status === 'ADMITTED')
  const dischargedAdmittedList = admissionsList.filter(a => a.status === 'DISCHARGED')
  const displayedWardList = wardViewFilter === 'admitted' ? activeAdmittedList : dischargedAdmittedList

  // Filter Admin Audit Trail
  const filteredAuditLogs = (hospitalAuditTrail?.allLogs || []).filter(log => {
    const matchesType = auditFilterType === 'ALL' || log.type.startsWith(auditFilterType)
    const matchesSearch = !auditSearchQuery || 
      log.title.toLowerCase().includes(auditSearchQuery.toLowerCase()) ||
      log.details.toLowerCase().includes(auditSearchQuery.toLowerCase()) ||
      (log.patientId && log.patientId.toLowerCase().includes(auditSearchQuery.toLowerCase())) ||
      (log.actor && log.actor.toLowerCase().includes(auditSearchQuery.toLowerCase()))
    return matchesType && matchesSearch
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', fontFamily: 'Segoe UI, Arial, sans-serif', margin: 0, backgroundColor: '#f8fafc', color: '#0f172a' }}>
      
      {/* NOTIFICATION BANNER */}
      {whatsAppNotification && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          backgroundColor: '#0f172a',
          color: 'white',
          padding: '16px 20px',
          borderRadius: '12px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          maxWidth: '380px',
          zIndex: 9999,
          border: '1px solid #3b82f6'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <strong style={{ fontSize: '15px' }}>📱 SMS / WhatsApp Notification</strong>
            <button onClick={() => setWhatsAppNotification(null)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontSize: '16px' }}>✕</button>
          </div>
          <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '6px' }}>To: +91 {whatsAppNotification.recipient}</div>
          <div style={{ backgroundColor: '#ffffff', color: '#111', padding: '12px', borderRadius: '8px', fontSize: '13px', whiteSpace: 'pre-line', lineHeight: '1.4' }}>
            {whatsAppNotification.message}
          </div>
        </div>
      )}

      {/* HEADER */}
      <header style={{ backgroundColor: '#ffffff', borderBottom: '2px solid #e2e8f0', padding: '16px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.03)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div onClick={() => !currentUser && setActiveView('home')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#0f172a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>
            🏥
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 'bold', color: '#0f172a', letterSpacing: '-0.5px' }}>
              Chikitsya Setu
            </h1>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', letterSpacing: '0.5px' }}>GANDHI HOSPITAL TRANSPARENCY ECOSYSTEM</span>
          </div>
        </div>

        <div>
          {currentUser ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ padding: '6px 14px', backgroundColor: '#f1f5f9', borderRadius: '20px', fontSize: '13px', fontWeight: '600', color: '#334155' }}>
                {currentUser.role === 'patient' && `👤 Patient: ${currentUser.data.name} (${currentUser.data.patientId})`}
                {currentUser.role === 'doctor' && `👨‍⚕️ ${currentUser.data.name} (${currentUser.data.department})`}
                {currentUser.role === 'lab' && `🔬 Lab Station`}
                {currentUser.role === 'pharmacy' && `💊 Pharmacy Station`}
                {currentUser.role === 'ward' && `🛏️ Ward Nurse`}
                {currentUser.role === 'op-desk' && `🎫 O/P Desk (#1)`}
                {currentUser.role === 'admin' && `📊 Hospital Admin`}
              </div>
              <button onClick={handleLogout} style={{ padding: '8px 18px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                Logout
              </button>
            </div>
          ) : (
            <button onClick={() => { fetchPatientsList(); setShowLoginModal(true); }} style={{ padding: '10px 24px', backgroundColor: '#0f172a', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.15)' }}>
              Login to Portals ➔
            </button>
          )}
        </div>
      </header>

      {/* MAIN BODY CONTENT */}
      <main style={{ flex: 1, padding: '36px 20px', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>

        {/* 1. HOME LANDING VIEW */}
        {activeView === 'home' && (
          <div style={{ width: '100%', maxWidth: '1080px' }}>
            
            {/* Hero Section */}
            <div style={{ backgroundColor: 'white', padding: '48px 40px', borderRadius: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.04)', border: '1px solid #e2e8f0', textAlign: 'center', marginBottom: '32px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 16px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '20px', fontSize: '13px', color: '#1d4ed8', fontWeight: 'bold', marginBottom: '18px' }}>
                <span>🛡️</span> Zero Neglect • Zero Exploitation • Zero Leakage
              </div>
              
              <h2 style={{ fontSize: '36px', color: '#0f172a', margin: '0 0 16px 0', fontWeight: '800', lineHeight: '1.2' }}>
                Gandhi Hospital Public Healthcare Transparency Engine
              </h2>
              
              <p style={{ fontSize: '16px', color: '#64748b', maxWidth: '780px', margin: '0 auto 24px auto', lineHeight: '1.6' }}>
                Gandhi Hospital (Secunderabad) is a premier tertiary government hospital serving over 3,500 patients daily. Chikitsya Setu provides an end-to-end digital accountability ecosystem to eradicate queue manipulation, eliminate illegal diagnostic charges, and track every single medical consumable with 100% transparency.
              </p>

              {/* Hospital Key Badges */}
              <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '32px' }}>
                <span style={{ padding: '8px 16px', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: '#334155' }}>
                  🏥 1,200+ Inpatient Bed Capacity
                </span>
                <span style={{ padding: '8px 16px', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: '#334155' }}>
                  👥 3,500+ Daily Outpatients
                </span>
                <span style={{ padding: '8px 16px', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: '#334155' }}>
                  🚨 24/7 Emergency & Casualty
                </span>
                <span style={{ padding: '8px 16px', backgroundColor: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: '#166534' }}>
                  ✅ 100% Free Public Healthcare Policy
                </span>
              </div>

              {/* Live Statistics */}
              {hospitalStats && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', textAlign: 'center' }}>
                  <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a' }}>{hospitalStats.totalPatients}</div>
                    <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px', fontWeight: '600' }}>Patients Registered</div>
                  </div>
                  <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '28px', fontWeight: '800', color: '#2563eb' }}>{hospitalStats.totalDoctors}</div>
                    <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px', fontWeight: '600' }}>Doctors on Shift</div>
                  </div>
                  <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '28px', fontWeight: '800', color: '#d97706' }}>{hospitalStats.pendingLabs}</div>
                    <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px', fontWeight: '600' }}>Digital Lab Orders</div>
                  </div>
                  <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '28px', fontWeight: '800', color: '#16a34a' }}>{hospitalStats.transparencyScore}</div>
                    <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px', fontWeight: '600' }}>Transparency Index</div>
                  </div>
                </div>
              )}
            </div>

            {/* Department Capabilities Overview */}
            <div style={{ backgroundColor: 'white', padding: '32px 36px', borderRadius: '24px', boxShadow: '0 6px 24px rgba(0,0,0,0.03)', border: '1px solid #e2e8f0', marginBottom: '32px' }}>
              <h3 style={{ margin: '0 0 6px 0', fontSize: '20px', color: '#0f172a' }}>
                🏥 Active Super-Specialty Departments on Shift
              </h3>
              <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 20px 0' }}>
                Load-balanced clinical desks providing specialized diagnosis and outpatient care with zero wait-time inflation.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
                {[
                  { name: 'General Medicine', desc: 'Comprehensive fever, infection & acute illness triage', room: 'OPD Block A (Rooms 101-105)' },
                  { name: 'Cardiology', desc: 'ECG, 2D-Echo & hypertension management', room: 'Specialty Wing C (Room 201)' },
                  { name: 'Orthopedics', desc: 'Fracture management, trauma & joint care', room: 'Trauma Wing (Room 204)' },
                  { name: 'Pulmonology', desc: 'Respiratory care, asthma & chest diagnostics', room: 'Chest Clinic (Room 302)' },
                  { name: 'Nephrology', desc: 'Renal clearance, dialysis & electrolyte analysis', room: 'Dialysis Unit (Room 401)' },
                  { name: 'General Surgery', desc: 'Pre-op assessments, wound care & emergency surgery', room: 'Surgical Block (Room 108)' }
                ].map((dept, i) => (
                  <div key={i} style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <strong style={{ fontSize: '15px', color: '#0f172a', display: 'block', marginBottom: '4px' }}>{dept.name}</strong>
                    <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 8px 0', lineHeight: '1.4' }}>{dept.desc}</p>
                    <span style={{ fontSize: '11px', color: '#2563eb', fontWeight: 'bold' }}>📍 {dept.room}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* The 3 Pillars of Reform */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
              <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', padding: '24px', borderRadius: '16px' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>⚖️</div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#1e40af' }}>1. Zero Neglect</h4>
                <p style={{ fontSize: '13px', color: '#334155', margin: 0, lineHeight: '1.5' }}>
                  Eliminates doctor cherry-picking. Algorithms distribute outpatients automatically across on-shift doctors with the shortest wait times.
                </p>
              </div>

              <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '24px', borderRadius: '16px' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>🚫</div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#15803d' }}>2. Zero Exploitation</h4>
                <p style={{ fontSize: '13px', color: '#334155', margin: 0, lineHeight: '1.5' }}>
                  No more paying bribes to lab attendants to collect reports. All diagnostic findings are published directly to the patient's phone.
                </p>
              </div>

              <div style={{ backgroundColor: '#fef3c7', border: '1px solid #fde68a', padding: '24px', borderRadius: '16px' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>📦</div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#92400e' }}>3. Zero Supply Leakage</h4>
                <p style={{ fontSize: '13px', color: '#334155', margin: 0, lineHeight: '1.5' }}>
                  Every syringe, IV set, and blood unit is tracked digitally to the patient's bed ledger before discharge, stopping black-market diversion.
                </p>
              </div>
            </div>

          </div>
        )}

        {/* 2. COMPLETE PATIENT EHR PORTAL (WITH PHOTO PROOFS) */}
        {activeView === 'patient' && currentUser?.role === 'patient' && (
          <div style={{ width: '100%', maxWidth: '860px', backgroundColor: 'white', padding: '36px', borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
            
            {/* Header Profile */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '16px', marginBottom: '20px' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#2563eb', textTransform: 'uppercase', letterSpacing: '1px' }}>Electronic Health Record</span>
                <h2 style={{ margin: '4px 0 2px 0', color: '#0f172a' }}>{currentUser.data.name}</h2>
                <span style={{ fontSize: '13px', color: '#64748b' }}>Patient ID: <strong>{currentUser.data.patientId}</strong> | WhatsApp: +91 {currentUser.data.phoneNumber}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Registered On:</span>
                <strong style={{ fontSize: '13px', color: '#0f172a' }}>{formatDateTime(currentUser.data.createdAt)}</strong>
              </div>
            </div>

            {/* Sub-tab Navigation */}
            <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid #f1f5f9', paddingBottom: '12px', marginBottom: '24px' }}>
              <button onClick={() => setPatientTab('overview')} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: patientTab === 'overview' ? '#0f172a' : '#f1f5f9', color: patientTab === 'overview' ? 'white' : '#475569', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}>
                📍 Live Journey Timeline
              </button>
              <button onClick={() => setPatientTab('labs')} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: patientTab === 'labs' ? '#0f172a' : '#f1f5f9', color: patientTab === 'labs' ? 'white' : '#475569', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}>
                🧪 Lab Reports ({patientFullFile?.labRequests?.length || 0})
              </button>
              <button onClick={() => setPatientTab('medicines')} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: patientTab === 'medicines' ? '#0f172a' : '#f1f5f9', color: patientTab === 'medicines' ? 'white' : '#475569', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}>
                💊 Prescriptions ({patientFullFile?.prescriptions?.length || 0})
              </button>
              <button onClick={() => setPatientTab('admissions')} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: patientTab === 'admissions' ? '#0f172a' : '#f1f5f9', color: patientTab === 'admissions' ? 'white' : '#475569', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}>
                🛏️ Ward & Micro-Resources
              </button>
            </div>

            {/* TAB: OVERVIEW & COMPLETE CHRONOLOGICAL JOURNEY TIMELINE */}
            {patientTab === 'overview' && (
              <div>
                
                {/* Official Discharge Certificate Banner (If Completed/Discharged) */}
                {(patientFullFile?.patient?.currentStatus === 'COMPLETED' || patientFullFile?.patient?.dischargeSummary) && (
                  <div style={{ backgroundColor: '#f0fdf4', border: '2px solid #22c55e', padding: '20px', borderRadius: '12px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '24px' }}>🏁</span>
                        <div>
                          <strong style={{ color: '#15803d', fontSize: '16px' }}>
                            Outpatient Consultation Completed & Discharge Authorized
                          </strong>
                          <div style={{ fontSize: '12px', color: '#166534' }}>
                            Discharged by: <strong>{patientFullFile?.patient?.dischargedByDoctorName || activeDoctorName}</strong> • {formatDateTime(patientFullFile?.patient?.dischargedAt || new Date())}
                          </div>
                        </div>
                      </div>
                      <span style={{ padding: '4px 10px', backgroundColor: '#dcfce7', color: '#15803d', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>
                        {patientFullFile?.patient?.dischargeType || 'Routine Outpatient Completion'}
                      </span>
                    </div>

                    <div style={{ backgroundColor: 'white', padding: '14px', borderRadius: '8px', border: '1px solid #bbf7d0', marginTop: '10px' }}>
                      <div style={{ fontSize: '13px', color: '#0f172a', marginBottom: '6px' }}>
                        <strong>Doctor Clinical Summary:</strong> {patientFullFile?.patient?.dischargeSummary || 'Patient examined. Vitals normal. Prescribed medications advised.'}
                      </div>
                      <div style={{ fontSize: '12px', color: '#2563eb' }}>
                        <strong>📅 Follow-up Instructions:</strong> {patientFullFile?.patient?.followUpAdvice || 'Follow-up after 5-7 days if symptoms persist.'}
                      </div>
                    </div>
                  </div>
                )}

                {/* Active Specialist Referral Banner (If Referred) */}
                {latestReferral && (
                  <div style={{ backgroundColor: '#fef2f2', border: '2px dashed #ef4444', padding: '16px 20px', borderRadius: '12px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span style={{ fontSize: '20px' }}>🔄</span>
                      <strong style={{ color: '#b91c1c', fontSize: '16px' }}>
                        Specialist Referral Active: {activeDoctorDept} Department
                      </strong>
                    </div>
                    <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#7f1d1d', lineHeight: '1.4' }}>
                      <strong>Referred By:</strong> {latestReferral.fromDoctorName} • <strong>Clinical Reason:</strong> "{latestReferral.reason}"
                    </p>
                    <div style={{ backgroundColor: 'white', padding: '10px 14px', borderRadius: '8px', border: '1px solid #fecaca', fontSize: '13px', fontWeight: 'bold', color: '#991b1b' }}>
                      ➔ Assigned Specialist: <strong>{activeDoctorName}</strong> ({activeDoctorDept}) • 📍 <strong>{activeDoctorLocation.room}</strong> ({activeDoctorLocation.block})
                    </div>
                  </div>
                )}

                {/* Current Action Banner */}
                <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                  <span style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold' }}>Current Action Required</span>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#2563eb', marginTop: '4px' }}>
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
                  <div style={{ padding: '18px', border: '1px solid #e2e8f0', borderRadius: '10px', backgroundColor: '#f8fafc' }}>
                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Assigned Physician</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', marginTop: '4px' }}>
                      👨‍⚕️ {activeDoctorName}
                    </div>
                    <div style={{ fontSize: '13px', color: '#2563eb', fontWeight: 'bold', marginTop: '2px' }}>
                      Department: {activeDoctorDept}
                    </div>
                  </div>

                  <div style={{ padding: '18px', border: '1px solid #e2e8f0', borderRadius: '10px', backgroundColor: '#f8fafc' }}>
                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Physical Room & Floor</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#d97706', marginTop: '4px' }}>
                      📍 {activeDoctorLocation.room}
                    </div>
                    <div style={{ fontSize: '13px', color: '#475569', fontWeight: '600', marginTop: '2px' }}>
                      {activeDoctorLocation.block}
                    </div>
                  </div>
                </div>

                {/* Live Chronological Journey Timeline with Date & Time (Clickable for Detail View) */}
                <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', padding: '24px', borderRadius: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>
                      📅 Complete Patient Journey & Timestamped Audit Trail
                    </h3>
                    <span style={{ fontSize: '12px', color: '#2563eb', fontWeight: '600' }}>
                      💡 Click any event to open full clinical details & photo proof
                    </span>
                  </div>

                  {patientFullFile?.timeline?.length === 0 ? (
                    <p style={{ color: '#94a3b8' }}>No journey events logged yet.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {patientFullFile?.timeline?.map((item, idx) => (
                        <div 
                          key={idx} 
                          onClick={() => setSelectedDetailItem(item)}
                          style={{ 
                            display: 'flex', 
                            gap: '14px', 
                            alignItems: 'flex-start', 
                            padding: '12px',
                            borderRadius: '8px',
                            border: '1px solid #f1f5f9',
                            backgroundColor: '#fafafa',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}>
                          <div style={{ fontSize: '20px', width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid #e2e8f0' }}>
                            {item.icon}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                              <strong style={{ fontSize: '14px', color: '#0f172a' }}>{item.stage}</strong>
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                {item.photoProof && (
                                  <span style={{ fontSize: '11px', backgroundColor: '#f0fdf4', color: '#166534', border: '1px solid #86efac', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                                    📸 Photo Proof
                                  </span>
                                )}
                                <span style={{ fontSize: '12px', fontWeight: '600', color: '#2563eb', backgroundColor: '#eff6ff', padding: '2px 8px', borderRadius: '6px' }}>
                                  🕒 {formatDateTime(item.timestamp)}
                                </span>
                              </div>
                            </div>
                            <p style={{ margin: '2px 0 4px 0', fontSize: '13px', color: '#475569', lineHeight: '1.4' }}>{item.details}</p>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                              <span style={{ fontSize: '11px', color: '#64748b' }}>
                                Clinician/Staff: <strong>{item.performedBy || item.doctorName}</strong>
                              </span>
                              <span style={{ fontSize: '11px', color: '#2563eb', fontWeight: 'bold' }}>
                                View Full Clinical File & Photos ➔
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB: LAB REPORTS */}
            {patientTab === 'labs' && (
              <div>
                <h3 style={{ margin: '0 0 16px 0', color: '#0f172a' }}>Diagnostic Laboratory Reports</h3>
                {patientFullFile?.labRequests?.length === 0 ? (
                  <p style={{ color: '#64748b' }}>No lab tests ordered yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {patientFullFile?.labRequests?.map(lab => (
                      <div 
                        key={lab._id} 
                        onClick={() => setSelectedDetailItem({
                          type: 'LAB_REPORT',
                          stage: `Diagnostic Report: ${lab.testName}`,
                          doctorName: lab.doctorName,
                          doctorDepartment: lab.doctorDepartment,
                          performedBy: lab.doctorName,
                          timestamp: lab.updatedAt || lab.createdAt,
                          room: lab.labRoom,
                          deliveryMode: lab.deliveryMode,
                          deliveryInstructions: lab.deliveryInstructions,
                          clinicalFindings: lab.findings,
                          referenceRange: lab.referenceRange,
                          photoProof: lab.photoProof,
                          details: lab.findings ? `Findings: ${lab.findings}` : 'Sample in analysis',
                          status: lab.status,
                          rawData: lab
                        })}
                        style={{ border: '1px solid #e2e8f0', padding: '18px', borderRadius: '10px', backgroundColor: '#f8fafc', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <div>
                            <strong style={{ fontSize: '16px', color: '#0f172a' }}>{lab.testName}</strong>
                            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                              Ordered by: <strong>{lab.doctorName} ({lab.doctorDepartment})</strong> • Ordered: {formatDateTime(lab.createdAt)}
                            </div>
                            <div style={{ fontSize: '12px', color: '#2563eb', marginTop: '2px' }}>
                              Location: {lab.labRoom} • Delivery: <strong>{lab.deliveryMode === 'PHYSICAL_COUNTER' ? '📄 Physical Hard-Copy' : '⚡ Digital Direct'}</strong>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            {lab.photoProof && (
                              <span style={{ fontSize: '11px', backgroundColor: '#f0fdf4', color: '#166534', border: '1px solid #86efac', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold' }}>
                                📸 Photo Verified
                              </span>
                            )}
                            <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', backgroundColor: lab.status === 'REPORT_READY' ? '#dcfce7' : '#fef3c7', color: lab.status === 'REPORT_READY' ? '#15803d' : '#b45309' }}>
                              {lab.status === 'REPORT_READY' ? '✅ Report Published' : lab.status === 'SAMPLE_COLLECTED' ? '🧪 Sample in Analysis' : '⏳ Sample Pending'}
                            </span>
                          </div>
                        </div>

                        {lab.findings && (
                          <div style={{ marginTop: '10px', backgroundColor: 'white', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px' }}>
                            <strong>Clinical Findings:</strong> {lab.findings}
                            <div style={{ fontSize: '11px', color: '#16a34a', marginTop: '4px' }}>
                              🕒 Published Timestamp: {formatDateTime(lab.updatedAt || lab.completedAt)} (Click to view full report & photo proof)
                            </div>
                          </div>
                        )}

                        {lab.photoProof && (
                          <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <img src={lab.photoProof} alt="Lab Proof" style={{ height: '50px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                            <span style={{ fontSize: '11px', color: '#15803d', fontWeight: 'bold' }}>✓ Click card to open full-size photo audit</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: MEDICINES */}
            {patientTab === 'medicines' && (
              <div>
                <h3 style={{ margin: '0 0 16px 0', color: '#0f172a' }}>Prescribed Medications</h3>
                {patientFullFile?.prescriptions?.length === 0 ? (
                  <p style={{ color: '#64748b' }}>No active prescriptions yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {patientFullFile?.prescriptions?.map(rx => (
                      <div 
                        key={rx._id} 
                        onClick={() => setSelectedDetailItem({
                          type: 'PRESCRIPTION',
                          stage: `Prescription Record (${rx.medicines.length} Medicines)`,
                          doctorName: rx.doctorName,
                          doctorDepartment: rx.doctorDepartment,
                          performedBy: rx.doctorName,
                          timestamp: rx.createdAt,
                          medicines: rx.medicines,
                          notes: rx.notes,
                          status: rx.status,
                          photoProof: rx.photoProof,
                          details: `Prescribed by ${rx.doctorName} (${rx.doctorDepartment})`,
                          rawData: rx
                        })}
                        style={{ border: '1px solid #e2e8f0', padding: '18px', borderRadius: '10px', backgroundColor: '#f8fafc', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                          <div>
                            <span style={{ fontSize: '13px', color: '#0f172a', fontWeight: 'bold' }}>
                              Prescribed by: {rx.doctorName} ({rx.doctorDepartment})
                            </span>
                            <div style={{ fontSize: '12px', color: '#64748b' }}>Date & Time: {formatDateTime(rx.createdAt)}</div>
                          </div>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            {rx.photoProof && (
                              <span style={{ fontSize: '11px', backgroundColor: '#f0fdf4', color: '#166534', border: '1px solid #86efac', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold' }}>
                                📸 Handover Photo
                              </span>
                            )}
                            <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', backgroundColor: rx.status === 'COMPLETELY_DISPENSED' || rx.status === 'DISPENSED' ? '#dcfce7' : '#fef3c7', color: rx.status === 'COMPLETELY_DISPENSED' || rx.status === 'DISPENSED' ? '#15803d' : '#b45309' }}>
                              {rx.status}
                            </span>
                          </div>
                        </div>
                        <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px' }}>
                          {rx.medicines.map((m, idx) => (
                            <li key={idx} style={{ marginBottom: '6px' }}>
                              <strong>{m.name}</strong> - {m.dosage} ({m.durationDays} days) {m.isDispensed && '✅ [Dispensed at Pharmacy]'}
                            </li>
                          ))}
                        </ul>
                        {rx.dispensedAt && (
                          <div style={{ marginTop: '8px', fontSize: '12px', color: '#16a34a' }}>
                            🕒 Dispensed Timestamp: {formatDateTime(rx.dispensedAt)} (Click to view medicine packet photo proof)
                          </div>
                        )}
                        {rx.photoProof && (
                          <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <img src={rx.photoProof} alt="Rx Handover Proof" style={{ height: '50px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                            <span style={{ fontSize: '11px', color: '#15803d', fontWeight: 'bold' }}>✓ Click card to open full-size photo audit</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: WARD & MICRO-RESOURCES */}
            {patientTab === 'admissions' && (
              <div>
                <h3 style={{ margin: '0 0 16px 0', color: '#0f172a' }}>Inpatient Ward & Micro-Resource Logs</h3>
                {patientFullFile?.admission ? (
                  <div 
                    onClick={() => setSelectedDetailItem({
                      type: 'ADMISSION',
                      stage: `Inpatient Admission Record (${patientFullFile.admission.wardType})`,
                      doctorName: patientFullFile.admission.admittingDoctorName || patientFullFile.admission.admittingDoctorId,
                      timestamp: patientFullFile.admission.admittedAt || patientFullFile.admission.createdAt,
                      room: patientFullFile.admission.bedNumber,
                      block: patientFullFile.admission.wardType,
                      status: patientFullFile.admission.status,
                      details: `Bed Allocation: ${patientFullFile.admission.bedNumber}. Diagnosis: ${patientFullFile.admission.diagnosis}`,
                      rawData: patientFullFile.admission
                    })}
                    style={{ border: '1px solid #e2e8f0', padding: '20px', borderRadius: '10px', backgroundColor: '#f8fafc', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
                      <div>
                        <strong>Ward: {patientFullFile.admission.wardType}</strong>
                        <div style={{ fontSize: '13px', color: '#64748b' }}>Bed Allocation: {patientFullFile.admission.bedNumber}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>Admitted: {formatDateTime(patientFullFile.admission.admittedAt || patientFullFile.admission.createdAt)}</div>
                        {patientFullFile.admission.status === 'DISCHARGED' && (
                          <div style={{ fontSize: '12px', color: '#15803d', marginTop: '4px', fontWeight: 'bold' }}>
                            🏁 Discharged on: {formatDateTime(patientFullFile.admission.dischargedAt)} ({patientFullFile.admission.dischargedByDoctorName || 'Discharged'})
                          </div>
                        )}
                      </div>
                      <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', backgroundColor: patientFullFile.admission.status === 'DISCHARGED' ? '#dcfce7' : '#fee2e2', color: patientFullFile.admission.status === 'DISCHARGED' ? '#15803d' : '#991b1b' }}>
                        {patientFullFile.admission.status}
                      </span>
                    </div>

                    <h4 style={{ margin: '14px 0 8px 0', fontSize: '14px', color: '#334155' }}>Items & Consumables Logged (Zero Leakage):</h4>
                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#475569' }}>
                      {patientFullFile.admission.resourcesAllocated?.map((res, i) => (
                        <li key={i} style={{ marginBottom: '6px' }}>
                          <strong>{res.itemName}</strong> (Qty: {res.quantity}) - Logged by {res.loggedByStaff} • 🕒 {formatDateTime(res.loggedAt)} {res.photoProof && '📸 [Photo Proof Attached]'}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p style={{ color: '#64748b' }}>Patient is Outpatient (not admitted to ward).</p>
                )}
              </div>
            )}

          </div>
        )}

        {/* 3. DOCTOR STATION */}
        {activeView === 'doctor' && currentUser?.role === 'doctor' && (
          <div style={{ width: '100%', maxWidth: '1040px' }}>
            
            {/* Header & Doctor Switcher */}
            <div style={{ backgroundColor: 'white', padding: '20px 24px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
              <div>
                <span style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold' }}>Physician Station</span>
                <h2 style={{ margin: '2px 0 0 0', color: '#0f172a' }}>{currentUser.data.name}</h2>
                <span style={{ fontSize: '13px', color: '#2563eb', fontWeight: '600' }}>
                  Department: <strong>{currentUser.data.department}</strong> | Physical Location: <strong>{DEPARTMENT_LOCATIONS[currentUser.data.department]?.room || 'Room 102'} ({DEPARTMENT_LOCATIONS[currentUser.data.department]?.block || 'OPD Block A'})</strong>
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600' }}>Switch Doctor:</label>
                <select
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
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

            {/* Date-wise Summary Stats Banner */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '20px' }}>
              <div style={{ backgroundColor: 'white', padding: '16px 20px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>Active Waiting Queue</span>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2563eb', marginTop: '2px' }}>{doctorQueueData.waitingCount || 0}</div>
                <span style={{ fontSize: '11px', color: '#16a34a' }}>Patients awaiting examination</span>
              </div>

              <div style={{ backgroundColor: 'white', padding: '16px 20px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>Total Assigned Patients</span>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f172a', marginTop: '2px' }}>{doctorQueueData.totalAssigned || 0}</div>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Cumulative registrations & referrals</span>
              </div>

              <div style={{ backgroundColor: 'white', padding: '16px 20px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>Dates Active</span>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#16a34a', marginTop: '2px' }}>{doctorQueueData.dateStats?.length || 0}</div>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Date-wise patient records</span>
              </div>
            </div>

            {doctorMessage && <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#f0fdf4', color: '#166534', borderRadius: '8px', border: '1px solid #bbf7d0', fontWeight: '600' }}>{doctorMessage}</div>}

            {/* Doctor View Controls (Queue Filter & Date Tabs) */}
            <div style={{ backgroundColor: 'white', padding: '16px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setDoctorViewFilter('waiting')}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: doctorViewFilter === 'waiting' ? '#0f172a' : '#f1f5f9',
                    color: doctorViewFilter === 'waiting' ? 'white' : '#475569',
                    fontWeight: 'bold',
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}>
                  ⏳ Active Waiting Queue ({doctorQueueData.waitingCount || 0})
                </button>

                <button
                  onClick={() => setDoctorViewFilter('all')}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: doctorViewFilter === 'all' ? '#0f172a' : '#f1f5f9',
                    color: doctorViewFilter === 'all' ? 'white' : '#475569',
                    fontWeight: 'bold',
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}>
                  📋 All Assigned Patients ({doctorQueueData.totalAssigned || 0})
                </button>
              </div>

              {/* Date Filter Dropdown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b' }}>📅 Date-wise Breakdown:</label>
                <select
                  style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  value={selectedDateFilter}
                  onChange={e => {
                    setSelectedDateFilter(e.target.value)
                    setDoctorViewFilter('date-wise')
                  }}>
                  <option value="ALL">All Dates</option>
                  {(doctorQueueData.dateStats || []).map(ds => (
                    <option key={ds.date} value={ds.date}>{ds.date} ({ds.total} patients)</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Queue & Examination Workspace */}
            <div style={{ display: 'grid', gridTemplateColumns: activePatientForExam ? '1fr 1.3fr' : '1fr', gap: '24px' }}>
              
              {/* Left Column: Patient List with Timestamps */}
              <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, color: '#0f172a' }}>
                    {doctorViewFilter === 'waiting' && `⏳ Patients in Waiting Queue (${displayedDoctorPatients.length})`}
                    {doctorViewFilter === 'all' && `📋 All Patients Assigned (${displayedDoctorPatients.length})`}
                    {doctorViewFilter === 'date-wise' && `📅 Patients on ${selectedDateFilter} (${displayedDoctorPatients.length})`}
                  </h3>
                </div>

                {displayedDoctorPatients.length === 0 ? (
                  <p style={{ color: '#94a3b8' }}>No patients found for this view.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '600px', overflowY: 'auto' }}>
                    {displayedDoctorPatients.map((p, i) => (
                      <div
                        key={p.patientId}
                        onClick={() => inspectPatientTimeline(p)}
                        style={{
                          border: activePatientForExam?.patientId === p.patientId ? '2px solid #2563eb' : '1px solid #e2e8f0',
                          padding: '14px',
                          borderRadius: '8px',
                          backgroundColor: activePatientForExam?.patientId === p.patientId ? '#eff6ff' : '#f8fafc',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          cursor: 'pointer'
                        }}>
                        <div>
                          <strong>#{i + 1} {p.name}</strong>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                            {p.patientId} | {p.age}y {p.gender} • Ph: +91 {p.phoneNumber}
                          </div>
                          <div style={{ fontSize: '11px', color: '#2563eb', marginTop: '2px' }}>
                            🕒 Reg: {formatDateTime(p.createdAt)}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            backgroundColor: p.currentStatus === 'WAITING_FOR_DOCTOR' ? '#dbeafe' : p.currentStatus === 'IN_LAB' ? '#fef3c7' : '#dcfce7',
                            color: p.currentStatus === 'WAITING_FOR_DOCTOR' ? '#1e40af' : p.currentStatus === 'IN_LAB' ? '#92400e' : '#15803d'
                          }}>
                            {p.currentStatus.replace(/_/g, ' ')}
                          </span>
                          <span style={{ display: 'block', fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                            Click to Examine ➔
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right Column: Active Patient Examination & Complete Journey Timeline */}
              {activePatientForExam && (
                <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                  
                  {/* Patient Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '16px' }}>
                    <div>
                      <span style={{ fontSize: '11px', color: '#2563eb', fontWeight: 'bold', textTransform: 'uppercase' }}>Active File</span>
                      <h3 style={{ margin: '2px 0 0 0', color: '#0f172a' }}>{activePatientForExam.name} ({activePatientForExam.patientId})</h3>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>
                        {activePatientForExam.age}y {activePatientForExam.gender} • Ph: +91 {activePatientForExam.phoneNumber} • Reg: {formatDateTime(activePatientForExam.createdAt)}
                      </span>
                    </div>

                    <button onClick={() => { setActivePatientForExam(null); setInspectedPatientFullFile(null); }} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '18px' }}>✕</button>
                  </div>

                  {/* Complete Live Journey Timeline of Clicked Patient (Clickable for Details & Photo Proofs) */}
                  <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '20px', maxHeight: '220px', overflowY: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <strong style={{ fontSize: '13px', color: '#0f172a' }}>
                        🕒 Complete Journey & Previous History:
                      </strong>
                      <span style={{ fontSize: '11px', color: '#2563eb' }}>Click event for full details & photo proof</span>
                    </div>

                    {inspectedPatientFullFile?.timeline?.length === 0 ? (
                      <p style={{ fontSize: '12px', color: '#94a3b8' }}>Loading timeline...</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {inspectedPatientFullFile?.timeline?.map((evt, idx) => (
                          <div 
                            key={idx} 
                            onClick={() => setSelectedDetailItem(evt)}
                            style={{ display: 'flex', gap: '8px', fontSize: '12px', padding: '8px', borderRadius: '6px', backgroundColor: 'white', border: '1px solid #e2e8f0', cursor: 'pointer', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <span>{evt.icon}</span>
                              <div>
                                <strong>{evt.stage}</strong> - {evt.details}
                                <div style={{ fontSize: '11px', color: '#2563eb', marginTop: '2px' }}>
                                  By: <strong>{evt.performedBy || evt.doctorName}</strong> • {formatDateTime(evt.timestamp)}
                                </div>
                              </div>
                            </div>
                            {evt.photoProof && (
                              <span style={{ fontSize: '11px', backgroundColor: '#dcfce7', color: '#15803d', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', flexShrink: 0 }}>
                                📸 Photo Attached
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Doctor Clinical Actions Tab Bar */}
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '18px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', flexWrap: 'wrap' }}>
                    <button onClick={() => setDoctorActionTab('lab')} style={{ padding: '6px 12px', fontSize: '12px', border: 'none', borderRadius: '4px', backgroundColor: doctorActionTab === 'lab' ? '#0f172a' : '#f1f5f9', color: doctorActionTab === 'lab' ? 'white' : '#475569', cursor: 'pointer', fontWeight: '600' }}>🧪 Order Lab</button>
                    <button onClick={() => setDoctorActionTab('rx')} style={{ padding: '6px 12px', fontSize: '12px', border: 'none', borderRadius: '4px', backgroundColor: doctorActionTab === 'rx' ? '#0f172a' : '#f1f5f9', color: doctorActionTab === 'rx' ? 'white' : '#475569', cursor: 'pointer', fontWeight: '600' }}>💊 Prescribe</button>
                    <button onClick={() => setDoctorActionTab('referral')} style={{ padding: '6px 12px', fontSize: '12px', border: 'none', borderRadius: '4px', backgroundColor: doctorActionTab === 'referral' ? '#0f172a' : '#f1f5f9', color: doctorActionTab === 'referral' ? 'white' : '#475569', cursor: 'pointer', fontWeight: '600' }}>🔄 Transfer/Refer</button>
                    <button onClick={() => setDoctorActionTab('admit')} style={{ padding: '6px 12px', fontSize: '12px', border: 'none', borderRadius: '4px', backgroundColor: doctorActionTab === 'admit' ? '#0f172a' : '#f1f5f9', color: doctorActionTab === 'admit' ? 'white' : '#475569', cursor: 'pointer', fontWeight: '600' }}>🛏️ Admit Bed</button>
                    <button onClick={() => setDoctorActionTab('discharge')} style={{ padding: '6px 12px', fontSize: '12px', border: 'none', borderRadius: '4px', backgroundColor: doctorActionTab === 'discharge' ? '#16a34a' : '#dcfce7', color: doctorActionTab === 'discharge' ? 'white' : '#15803d', cursor: 'pointer', fontWeight: 'bold' }}>🏁 Discharge / Complete</button>
                  </div>

                  {/* ACTION 1: ORDER LAB WITH DELIVERY MODE NOTICE */}
                  {doctorActionTab === 'lab' && (
                    <form onSubmit={handleDoctorOrderLab}>
                      <label style={{ fontSize: '13px', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Diagnostic Test:</label>
                      <select style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '12px' }} value={selectedTest} onChange={e => setSelectedTest(e.target.value)}>
                        <option>Complete Blood Count (CBC)</option>
                        <option>Serum Creatinine & Urea</option>
                        <option>Lipid Profile</option>
                        <option>Chest X-Ray (PA View)</option>
                        <option>Ultrasound Abdomen</option>
                        <option>ECG & 2D Echo (Cardiology)</option>
                        <option>Bone Mineral Density Scan</option>
                      </select>

                      <label style={{ fontSize: '13px', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Report Delivery Channel:</label>
                      <select style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '14px' }} value={labDeliveryMode} onChange={e => setLabDeliveryMode(e.target.value)}>
                        <option value="DIGITAL_EHR">⚡ Instant Digital Report to Patient EHR (Zero Bribery)</option>
                        <option value="PHYSICAL_COUNTER">📄 Physical Hard-Copy Report (Collect at Room 105 Counter #1)</option>
                        <option value="BOTH">📱 Digital EHR + Physical Hard-Copy</option>
                      </select>

                      <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>
                        Dispatch Test to Lab (Signed by {currentUser.data.name}) ➔
                      </button>
                    </form>
                  )}

                  {/* ACTION 2: PRESCRIBE WITH DOCTOR SIGNATURE */}
                  {doctorActionTab === 'rx' && (
                    <form onSubmit={handleDoctorPrescribe}>
                      <label style={{ fontSize: '13px', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Medicines (Comma Separated):</label>
                      <input type="text" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '12px' }} value={rxMedicines} onChange={e => setRxMedicines(e.target.value)} />
                      <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>
                        Send to Pharmacy Counter (Signed by {currentUser.data.name}) ➔
                      </button>
                    </form>
                  )}

                  {/* ACTION 3: REFERRAL / TRANSFER */}
                  {doctorActionTab === 'referral' && (
                    <form onSubmit={handleDoctorReferral}>
                      <label style={{ fontSize: '13px', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Transfer to Super-Specialty:</label>
                      <select style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '12px' }} value={referralDept} onChange={e => setReferralDept(e.target.value)}>
                        <option value="Cardiology">Cardiology (Specialty Wing C - Room 201)</option>
                        <option value="Orthopedics">Orthopedics (Trauma Wing - Room 204)</option>
                        <option value="Pulmonology">Pulmonology (Chest Clinic - Room 302)</option>
                        <option value="Nephrology">Nephrology (Dialysis Unit - Room 401)</option>
                        <option value="General Surgery">General Surgery (Surgical Block - Room 108)</option>
                      </select>

                      <label style={{ fontSize: '13px', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Reason for Referral / Clinical Opinion:</label>
                      <input type="text" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '14px', boxSizing: 'border-box' }} value={referralReason} onChange={e => setReferralReason(e.target.value)} />

                      <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#d97706', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>
                        Auto-Assign to Specialist (Shortest Queue) ➔
                      </button>
                    </form>
                  )}

                  {/* ACTION 4: ADMIT */}
                  {doctorActionTab === 'admit' && (
                    <form onSubmit={handleDoctorAdmit}>
                      <label style={{ fontSize: '13px', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Ward Selection:</label>
                      <select style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '12px' }} value={admitWard} onChange={e => setAdmitWard(e.target.value)}>
                        <option>General Ward (Male)</option>
                        <option>General Ward (Female)</option>
                        <option>Emergency ICU</option>
                        <option>Post-Operative Ward</option>
                      </select>
                      <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>
                        Admit Patient to Inpatient Bed ➔
                      </button>
                    </form>
                  )}

                  {/* ACTION 5: DEDICATED DISCHARGE / COMPLETE OUTPATIENT ACTION */}
                  {doctorActionTab === 'discharge' && (
                    <form onSubmit={handleDoctorDischargeSubmit}>
                      <label style={{ fontSize: '13px', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Discharge Classification:</label>
                      <select style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '12px' }} value={dischargeTypeSelect} onChange={e => setDischargeTypeSelect(e.target.value)}>
                        <option value="Routine Outpatient Completion (Home Recovery)">Routine Outpatient Completion (Home Recovery)</option>
                        <option value="Home Recovery with Prescribed Medications">Home Recovery with Prescribed Medications</option>
                        <option value="Discharged after Diagnostic Review">Discharged after Diagnostic Review</option>
                        <option value="Referred for Home Rest & Quarantine">Referred for Home Rest & Quarantine</option>
                        <option value="Transferred to Local Primary Health Centre (PHC)">Transferred to Local Primary Health Centre (PHC)</option>
                      </select>

                      <label style={{ fontSize: '13px', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Doctor Discharge Advice & Clinical Summary:</label>
                      <textarea rows={3} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '12px', boxSizing: 'border-box', fontFamily: 'inherit' }} value={dischargeSummaryText} onChange={e => setDischargeSummaryText(e.target.value)} />

                      <label style={{ fontSize: '13px', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Follow-up Advice / Return to OPD:</label>
                      <input type="text" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '16px', boxSizing: 'border-box' }} value={followUpAdviceText} onChange={e => setFollowUpAdviceText(e.target.value)} />

                      <button type="submit" style={{ width: '100%', padding: '14px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px', boxShadow: '0 4px 12px rgba(22, 163, 74, 0.25)' }}>
                        🏁 Authorize Discharge & Complete Consultation (Signed by {currentUser.data.name}) ➔
                      </button>
                    </form>
                  )}

                </div>
              )}
            </div>
          </div>
        )}

        {/* 4. DIAGNOSTIC LAB DASHBOARD (WITH LIVE WEBCAM & PHOTO PROOF MODAL) */}
        {activeView === 'lab' && currentUser?.role === 'lab' && (
          <div style={{ width: '100%', maxWidth: '880px', backgroundColor: 'white', padding: '32px', borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <h2 style={{ margin: 0, color: '#0f172a' }}>🔬 Diagnostic Laboratory Monitor</h2>
              <span style={{ fontSize: '12px', backgroundColor: '#dcfce7', color: '#15803d', padding: '4px 10px', borderRadius: '12px', fontWeight: 'bold' }}>📸 Live Camera & Proof Verification</span>
            </div>
            <p style={{ margin: '0 0 20px 0', color: '#64748b', fontSize: '14px' }}>Capture live webcam proof of barcoded vials and diagnostic report films to guarantee Zero Exploitation.</p>

            {labMessage && <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#f0fdf4', color: '#166534', borderRadius: '8px' }}>{labMessage}</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {labOrders.map(order => (
                <div key={order._id} style={{ border: '1px solid #e2e8f0', padding: '20px', borderRadius: '10px', backgroundColor: '#f8fafc' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div>
                      <strong style={{ fontSize: '16px', color: '#0f172a' }}>{order.testName}</strong>
                      <div style={{ fontSize: '13px', color: '#64748b' }}>Patient: {order.patientId} | Room: {order.labRoom}</div>
                      <div style={{ fontSize: '12px', color: '#0f172a', marginTop: '2px' }}>
                        Ordered by: <strong>{order.doctorName || 'Doctor'} ({order.doctorDepartment || 'General Medicine'})</strong>
                      </div>
                      <div style={{ fontSize: '12px', color: '#2563eb', marginTop: '2px' }}>
                        🕒 Ordered: {formatDateTime(order.createdAt)} • Mode: <strong>{order.deliveryMode === 'PHYSICAL_COUNTER' ? '📄 Physical Copy' : '⚡ Digital EHR'}</strong>
                      </div>
                    </div>
                    <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', backgroundColor: order.status === 'REPORT_READY' ? '#dcfce7' : '#fef3c7', color: order.status === 'REPORT_READY' ? '#15803d' : '#b45309' }}>
                      {order.status}
                    </span>
                  </div>

                  {order.status === 'PENDING' && (
                    <div style={{ backgroundColor: 'white', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', color: '#334155', fontWeight: '600' }}>Patient awaiting sample collection in {order.labRoom}</span>
                      <button 
                        onClick={() => openCameraModal(
                          `📸 Capture Blood/Fluid Sample Proof (${order.testName})`,
                          'lab',
                          order._id,
                          (photo) => executeLabCollectWithPhoto(order._id, photo)
                        )}
                        style={{ padding: '10px 20px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(37,99,235,0.2)' }}>
                        <span>📷</span> Open Camera & Collect Sample ➔
                      </button>
                    </div>
                  )}

                  {order.status === 'SAMPLE_COLLECTED' && (
                    <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '12px', color: '#15803d', marginBottom: '8px', fontWeight: 'bold' }}>
                        ✓ Sample Collected at: {formatDateTime(order.sampleCollectedAt || order.updatedAt)}
                      </div>
                      
                      <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#334155', display: 'block', marginBottom: '4px' }}>Enter Clinical Findings:</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Hb: 13.8 g/dL, WBC: 7,200 /mcL, Platelets: 2.4 Lakhs (Normal Limits)" 
                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '12px', boxSizing: 'border-box' }} 
                        onChange={e => setLabFindingsInput({...labFindingsInput, [order._id]: e.target.value})} 
                      />

                      <button 
                        onClick={() => openCameraModal(
                          `📸 Capture Diagnostic Report Sheet / Film Proof (${order.testName})`,
                          'lab',
                          order._id,
                          (photo) => executeLabPublishWithPhoto(order._id, photo)
                        )}
                        style={{ width: '100%', padding: '12px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(22,163,74,0.25)' }}>
                        <span>📷</span> Open Camera & Publish Diagnostic Finding ➔
                      </button>
                    </div>
                  )}

                  {order.status === 'REPORT_READY' && (
                    <div style={{ marginTop: '8px', fontSize: '12px', color: '#166534', backgroundColor: 'white', padding: '14px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: order.photoProof ? '10px' : '0' }}>
                        <div>
                          <strong>Published Finding:</strong> {order.findings}
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Published: {formatDateTime(order.updatedAt)}</div>
                        </div>
                        {order.photoProof && (
                          <button 
                            onClick={() => setSelectedDetailItem({
                              type: 'LAB_REPORT',
                              stage: `Lab Report & Film: ${order.testName}`,
                              performedBy: 'Pathology Lab In-Charge',
                              timestamp: order.updatedAt,
                              clinicalFindings: order.findings,
                              photoProof: order.photoProof
                            })}
                            style={{ padding: '6px 12px', backgroundColor: '#dcfce7', color: '#15803d', border: '1px solid #86efac', borderRadius: '6px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>
                            👁️ View Photo Proof
                          </button>
                        )}
                      </div>

                      {/* Photo Thumbnail in Lab View */}
                      {order.photoProof && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <img src={order.photoProof} alt="Lab Proof Thumbnail" style={{ height: '60px', borderRadius: '6px', border: '1px solid #cbd5e1', cursor: 'pointer' }} onClick={() => setSelectedDetailItem({ type: 'LAB_REPORT', stage: order.testName, photoProof: order.photoProof, clinicalFindings: order.findings, timestamp: order.updatedAt })} />
                          <span style={{ fontSize: '11px', color: '#15803d', fontWeight: 'bold' }}>✓ Diagnostic Proof Stored in Permanent EHR Ledger</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. PHARMACY DASHBOARD (WITH LIVE WEBCAM & HANDOVER PHOTO PROOF) */}
        {activeView === 'pharmacy' && currentUser?.role === 'pharmacy' && (
          <div style={{ width: '100%', maxWidth: '880px', backgroundColor: 'white', padding: '32px', borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <h2 style={{ margin: 0, color: '#0f172a' }}>💊 Pharmacy Dispensing Counter</h2>
              <span style={{ fontSize: '12px', backgroundColor: '#dcfce7', color: '#15803d', padding: '4px 10px', borderRadius: '12px', fontWeight: 'bold' }}>📸 Live Handover Camera</span>
            </div>
            <p style={{ margin: '0 0 20px 0', color: '#64748b', fontSize: '14px' }}>Verify digital prescriptions, snap live webcam proof of medicine packets handed over, and prevent stock diversion.</p>

            {pharmacyMessage && <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#f0fdf4', color: '#166534', borderRadius: '8px' }}>{pharmacyMessage}</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {prescriptions.map(rx => (
                <div key={rx._id} style={{ border: '1px solid #e2e8f0', padding: '20px', borderRadius: '10px', backgroundColor: '#f8fafc' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div>
                      <strong style={{ fontSize: '16px', color: '#0f172a' }}>Patient: {rx.patientId}</strong>
                      <div style={{ fontSize: '13px', color: '#0f172a', fontWeight: '600' }}>
                        Doctor: {rx.doctorName || rx.doctorId} ({rx.doctorDepartment || 'General Medicine'})
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>Prescribed: {formatDateTime(rx.createdAt)}</div>
                    </div>
                    <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', backgroundColor: rx.status === 'COMPLETELY_DISPENSED' || rx.status === 'DISPENSED' ? '#dcfce7' : '#fef3c7', color: rx.status === 'COMPLETELY_DISPENSED' || rx.status === 'DISPENSED' ? '#15803d' : '#b45309' }}>
                      {rx.status}
                    </span>
                  </div>

                  <ul style={{ margin: '0 0 14px 0', paddingLeft: '20px', fontSize: '14px' }}>
                    {rx.medicines.map((m, idx) => (
                      <li key={idx} style={{ marginBottom: '4px' }}>{m.name} - {m.dosage} ({m.durationDays} days)</li>
                    ))}
                  </ul>

                  {rx.status !== 'COMPLETELY_DISPENSED' && rx.status !== 'DISPENSED' ? (
                    <div style={{ backgroundColor: 'white', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', color: '#334155', fontWeight: '600' }}>Patient at Counter #3 ready for physical collection</span>
                      <button 
                        onClick={() => openCameraModal(
                          `📸 Capture Live Medicine Handover Proof (Patient: ${rx.patientId})`,
                          'pharmacy',
                          rx._id,
                          (photo) => executeDispenseWithPhoto(rx._id, photo)
                        )}
                        style={{ padding: '12px 22px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(22,163,74,0.25)' }}>
                        <span>📷</span> Open Camera & Dispense Medicines ➔
                      </button>
                    </div>
                  ) : (
                    <div style={{ backgroundColor: 'white', padding: '14px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: rx.photoProof ? '10px' : '0' }}>
                        <span style={{ fontSize: '13px', color: '#15803d', fontWeight: 'bold' }}>
                          ✅ Dispensed on: {formatDateTime(rx.dispensedAt || rx.updatedAt)} by {rx.dispensedByStaff || 'Duty Pharmacist'}
                        </span>
                        {rx.photoProof && (
                          <button 
                            onClick={() => setSelectedDetailItem({
                              type: 'PRESCRIPTION',
                              stage: `Dispensed Medication Handover Proof`,
                              performedBy: rx.dispensedByStaff || 'Duty Pharmacist (Counter #3)',
                              timestamp: rx.dispensedAt || rx.updatedAt,
                              medicines: rx.medicines,
                              photoProof: rx.photoProof
                            })}
                            style={{ padding: '6px 12px', backgroundColor: '#dcfce7', color: '#15803d', border: '1px solid #86efac', borderRadius: '6px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>
                            👁️ View Handover Photo
                          </button>
                        )}
                      </div>

                      {/* Photo Thumbnail in Pharmacy View */}
                      {rx.photoProof && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <img src={rx.photoProof} alt="Rx Proof Thumbnail" style={{ height: '60px', borderRadius: '6px', border: '1px solid #cbd5e1', cursor: 'pointer' }} onClick={() => setSelectedDetailItem({ type: 'PRESCRIPTION', stage: 'Medication Handover Proof', photoProof: rx.photoProof, medicines: rx.medicines, timestamp: rx.dispensedAt })} />
                          <span style={{ fontSize: '11px', color: '#15803d', fontWeight: 'bold' }}>✓ Handover Proof Stored in Permanent EHR Ledger</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 6. INPATIENT WARD DASHBOARD (ACTIVE & DISCHARGED ARCHIVES WITH ZERO LEAKAGE RESOURCE LEDGER) */}
        {activeView === 'ward' && currentUser?.role === 'ward' && (
          <div style={{ width: '100%', maxWidth: '880px', backgroundColor: 'white', padding: '32px', borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <h2 style={{ margin: 0, color: '#0f172a' }}>🛏️ Inpatient Ward & Micro-Resource Tracker</h2>
              <span style={{ fontSize: '12px', backgroundColor: '#dbeafe', color: '#1e40af', padding: '4px 10px', borderRadius: '12px', fontWeight: 'bold' }}>Zero Supply Leakage</span>
            </div>
            <p style={{ margin: '0 0 20px 0', color: '#64748b', fontSize: '14px' }}>Track bed allocations, consumables consumed, blood units, and permanent discharged archives with live camera proofs.</p>

            {wardMessage && <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#f0fdf4', color: '#166534', borderRadius: '8px' }}>{wardMessage}</div>}

            {/* Ward Filter Switcher: Active vs Discharged Archives */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '2px solid #f1f5f9', paddingBottom: '12px' }}>
              <button
                onClick={() => setWardViewFilter('admitted')}
                style={{
                  padding: '10px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: wardViewFilter === 'admitted' ? '#0f172a' : '#f1f5f9',
                  color: wardViewFilter === 'admitted' ? 'white' : '#475569',
                  fontWeight: 'bold',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}>
                🛏️ Currently Admitted Patients ({activeAdmittedList.length})
              </button>

              <button
                onClick={() => setWardViewFilter('discharged')}
                style={{
                  padding: '10px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: wardViewFilter === 'discharged' ? '#0f172a' : '#f1f5f9',
                  color: wardViewFilter === 'discharged' ? 'white' : '#475569',
                  fontWeight: 'bold',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}>
                🏁 Discharged Inpatient Archives ({dischargedAdmittedList.length})
              </button>
            </div>

            {/* Inpatient Cards List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {displayedWardList.length === 0 ? (
                <p style={{ color: '#94a3b8', textAlign: 'center', padding: '30px' }}>
                  {wardViewFilter === 'admitted' ? 'No patients currently admitted in wards.' : 'No discharged inpatient records found.'}
                </p>
              ) : (
                displayedWardList.map(adm => (
                  <div key={adm._id} style={{ border: '1px solid #e2e8f0', padding: '22px', borderRadius: '12px', backgroundColor: adm.status === 'DISCHARGED' ? '#fcfcfd' : '#f8fafc', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                    
                    {/* Inpatient Card Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <strong style={{ fontSize: '18px', color: '#0f172a' }}>{adm.patientName || adm.patientId}</strong>
                          <span style={{ fontSize: '13px', color: '#64748b' }}>({adm.patientId})</span>
                          <span style={{ fontSize: '12px', padding: '2px 8px', backgroundColor: '#e2e8f0', borderRadius: '10px', color: '#334155', fontWeight: '600' }}>
                            {adm.age}y {adm.gender}
                          </span>
                        </div>
                        <div style={{ fontSize: '13px', color: '#0f172a', fontWeight: '600', marginTop: '4px' }}>
                          📱 Mobile: <strong>+91 {adm.phoneNumber}</strong> • Ward: <strong>{adm.wardType} ({adm.bedNumber})</strong>
                        </div>
                        <div style={{ fontSize: '12px', color: '#2563eb', marginTop: '2px' }}>
                          👨‍⚕️ Admitting Doctor: <strong>{adm.admittingDoctorName || adm.admittingDoctorId}</strong>
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                          🕒 Admitted On: <strong>{formatDateTime(adm.admittedAt || adm.createdAt)}</strong>
                        </div>

                        {adm.status === 'DISCHARGED' && (
                          <div style={{ marginTop: '8px', padding: '10px', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0', fontSize: '12px', color: '#15803d' }}>
                            <strong>🏁 Discharged On:</strong> {formatDateTime(adm.dischargedAt)} by <strong>{adm.dischargedByDoctorName || 'Physician'}</strong>
                            <div style={{ marginTop: '4px', color: '#166534' }}>
                              <strong>Discharge Summary:</strong> "{adm.dischargeSummary || 'Vitals stable. Home medications advised.'}"
                            </div>
                          </div>
                        )}
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <span style={{ padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', backgroundColor: adm.status === 'DISCHARGED' ? '#dcfce7' : '#fee2e2', color: adm.status === 'DISCHARGED' ? '#15803d' : '#991b1b' }}>
                          {adm.status}
                        </span>

                        {adm.status === 'ADMITTED' && (
                          <div style={{ marginTop: '10px' }}>
                            <button onClick={() => handleDischarge(adm._id)} style={{ padding: '8px 16px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                              🏁 Discharge Bed ➔
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Consumables and Resources Ledger (Zero Leakage) */}
                    <div style={{ backgroundColor: 'white', padding: '14px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <strong style={{ fontSize: '13px', color: '#334155' }}>
                          📦 Consumables & Micro-Resources Logged ({adm.resourcesAllocated?.length || 0} Items):
                        </strong>
                        <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 'bold' }}>✓ Anti-Theft Ledger Audited</span>
                      </div>

                      {adm.resourcesAllocated?.length === 0 ? (
                        <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>No items logged yet.</p>
                      ) : (
                        <ul style={{ margin: '6px 0 0 0', paddingLeft: '20px', fontSize: '13px', color: '#475569' }}>
                          {adm.resourcesAllocated?.map((res, i) => (
                            <li key={i} style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <strong>{res.itemName}</strong> (Qty: {res.quantity}) - Logged by <strong>{res.loggedByStaff}</strong> • 🕒 <span style={{ color: '#2563eb' }}>{formatDateTime(res.loggedAt)}</span>
                              </div>
                              {res.photoProof && (
                                <button 
                                  onClick={() => setSelectedDetailItem({
                                    type: 'RESOURCE_USAGE',
                                    stage: `Bedside Consumable: ${res.itemName}`,
                                    performedBy: res.loggedByStaff,
                                    timestamp: res.loggedAt,
                                    photoProof: res.photoProof
                                  })}
                                  style={{ padding: '3px 8px', backgroundColor: '#faf5ff', color: '#7e22ce', border: '1px solid #d8b4fe', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                                  📸 View Bedside Proof
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Nurse Log Resource Action Bar with Bedside Live Camera */}
                    {adm.status === 'ADMITTED' && (
                      <div style={{ backgroundColor: '#f1f5f9', padding: '14px', borderRadius: '8px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#334155', display: 'block', marginBottom: '6px' }}>
                          Log Medical Supply / Consumable to Bed Ledger:
                        </label>
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                          <input type="text" placeholder="e.g. Blood Unit O+ / Syringe 10ml / Surgical Dressing..." style={{ flex: 1, padding: '10px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }} value={resourceItemName} onChange={e => setResourceItemName(e.target.value)} />
                          <button 
                            onClick={() => openCameraModal(
                              `📸 Capture Bedside Consumable Proof (${resourceItemName})`,
                              'ward',
                              adm._id,
                              (photo) => executeLogResourceWithPhoto(adm._id, photo)
                            )}
                            style={{ padding: '10px 20px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>📷</span> Camera & Log Supply
                          </button>
                        </div>
                      </div>
                    )}

                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 7. O/P COUNTER DESK (STAFF AUTHENTICATED) */}
        {activeView === 'op-desk' && currentUser?.role === 'op-desk' && (
          <div style={{ width: '100%', maxWidth: '620px', backgroundColor: 'white', padding: '36px', borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <h2 style={{ margin: 0, color: '#0f172a' }}>🎫 O/P Reception Registration</h2>
              <span style={{ fontSize: '12px', backgroundColor: '#dbeafe', color: '#1e40af', padding: '4px 10px', borderRadius: '12px', fontWeight: 'bold' }}>Authenticated Staff</span>
            </div>
            <p style={{ margin: '0 0 20px 0', color: '#64748b', fontSize: '14px' }}>Register new outpatients with timestamp and dispatch credentials directly via WhatsApp.</p>

            <form onSubmit={handleOpRegister}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '600' }}>Patient Full Name</label>
                <input required type="text" placeholder="e.g. Rahul Sharma" style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} value={opForm.name} onChange={e => setOpForm({...opForm, name: e.target.value})} />
              </div>

              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '600' }}>Age</label>
                  <input required type="number" placeholder="42" style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} value={opForm.age} onChange={e => setOpForm({...opForm, age: e.target.value})} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '600' }}>Gender</label>
                  <select style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: 'white', boxSizing: 'border-box' }} value={opForm.gender} onChange={e => setOpForm({...opForm, gender: e.target.value})}>
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '600' }}>WhatsApp Mobile Number (10 Digits)</label>
                <input required type="tel" placeholder="e.g. 9876543210" style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} value={opForm.phoneNumber} onChange={e => setOpForm({...opForm, phoneNumber: e.target.value})} />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '600' }}>📅 Registration Date & Time</label>
                <input required type="datetime-local" style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} value={opForm.registrationDate} onChange={e => setOpForm({...opForm, registrationDate: e.target.value})} />
              </div>

              <button type="submit" style={{ width: '100%', padding: '14px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.2)' }}>
                Create File & Generate Token 🚀
              </button>
            </form>

            {opTicket && (
              <div style={{ marginTop: '24px', padding: '20px', backgroundColor: '#f0fdf4', border: '2px dashed #22c55e', borderRadius: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '20px' }}>✅</span>
                  <strong style={{ color: '#15803d', fontSize: '16px' }}>Patient Registered Successfully!</strong>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', backgroundColor: 'white', padding: '14px', borderRadius: '8px', border: '1px solid #bbf7d0', marginBottom: '16px' }}>
                  <div>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Patient ID</span>
                    <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#0f172a' }}>{opTicket.credentials.patientId}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Passcode</span>
                    <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#2563eb' }}>{opTicket.credentials.password}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Assigned Doctor</span>
                    <div style={{ fontWeight: '600', color: '#0f172a' }}>{opTicket.assignedTo.doctorName}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Room & Timestamp</span>
                    <div style={{ fontWeight: '600', color: '#d97706' }}>Room 102 ({formatDateTime(new Date())})</div>
                  </div>
                </div>

                {/* 1-Click WhatsApp Dispatch Button */}
                <a 
                  href={`https://api.whatsapp.com/send?phone=91${opTicket.patient.phoneNumber.replace(/[^0-9]/g, '').slice(-10)}&text=${encodeURIComponent(`🏥 *Chikitsya Setu (Gandhi Hospital)*\nHello *${opTicket.patient.name}*!\nYour O/P Registration is complete.\n\n🆔 *Patient ID:* ${opTicket.credentials.patientId}\n🔑 *Passcode:* ${opTicket.credentials.password}\n👨‍⚕️ *Assigned Doctor:* ${opTicket.assignedTo.doctorName} (Room 102)\n🕒 *Time:* ${formatDateTime(new Date())}\n\n📲 *Track your visit live:* http://localhost:5173`)}`}
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '14px',
                    backgroundColor: '#25D366',
                    color: 'white',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    fontWeight: 'bold',
                    fontSize: '15px',
                    boxShadow: '0 4px 12px rgba(37,211,102,0.3)',
                    boxSizing: 'border-box'
                  }}>
                  <span>💬</span> Send via WhatsApp to Patient (+91 {opTicket.patient.phoneNumber.replace(/[^0-9]/g, '').slice(-10)})
                </a>
              </div>
            )}
          </div>
        )}

        {/* 8. COMPREHENSIVE HOSPITAL ADMINISTRATION & EVERY DETAIL AUDIT TRAIL (WITH PHOTO AUDIT) */}
        {activeView === 'admin' && currentUser?.role === 'admin' && (
          <div style={{ width: '100%', maxWidth: '1040px' }}>
            <div style={{ backgroundColor: 'white', padding: '28px 36px', borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h2 style={{ margin: 0, color: '#0f172a' }}>📊 Hospital Administration & Full System Audit Trail</h2>
                <button onClick={fetchHospitalAuditTrail} style={{ padding: '8px 14px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                  🔄 Refresh Live Logs
                </button>
              </div>
              <p style={{ margin: '0 0 20px 0', color: '#64748b', fontSize: '14px' }}>
                Complete live stream of every single event in Gandhi Hospital with exact Date & Time timestamps and Photo Proof verification.
              </p>

              {/* Date-wise Activity Breakdown Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}>
                <div style={{ padding: '16px', borderRadius: '10px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe' }}>
                  <span style={{ fontSize: '11px', color: '#1e40af', fontWeight: 'bold', textTransform: 'uppercase' }}>Total System Events</span>
                  <h3 style={{ margin: '4px 0 0 0', color: '#1d4ed8', fontSize: '24px' }}>{hospitalAuditTrail?.totalEvents || 0}</h3>
                  <span style={{ fontSize: '11px', color: '#16a34a' }}>Logged in digital ledger</span>
                </div>

                <div style={{ padding: '16px', borderRadius: '10px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                  <span style={{ fontSize: '11px', color: '#15803d', fontWeight: 'bold', textTransform: 'uppercase' }}>Registrations</span>
                  <h3 style={{ margin: '4px 0 0 0', color: '#16a34a', fontSize: '24px' }}>{hospitalStats?.totalPatients || 0}</h3>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>With shortest-queue doc</span>
                </div>

                <div style={{ padding: '16px', borderRadius: '10px', backgroundColor: '#fef3c7', border: '1px solid #fde68a' }}>
                  <span style={{ fontSize: '11px', color: '#92400e', fontWeight: 'bold', textTransform: 'uppercase' }}>Diagnostic Labs</span>
                  <h3 style={{ margin: '4px 0 0 0', color: '#b45309', fontSize: '24px' }}>{hospitalStats?.completedReports || 0}</h3>
                  <span style={{ fontSize: '11px', color: '#16a34a' }}>100% Zero bribery verified</span>
                </div>

                <div style={{ padding: '16px', borderRadius: '10px', backgroundColor: '#faf5ff', border: '1px solid #e9d5ff' }}>
                  <span style={{ fontSize: '11px', color: '#7e22ce', fontWeight: 'bold', textTransform: 'uppercase' }}>Active Inpatients</span>
                  <h3 style={{ margin: '4px 0 0 0', color: '#9333ea', fontSize: '24px' }}>{hospitalStats?.activeAdmissions || 0}</h3>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Anti-theft tracked beds</span>
                </div>
              </div>

              {/* Filter and Search Bar for Audit Trail */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Search patient, ID, doctor, medicine, test name, or staff..."
                  style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  value={auditSearchQuery}
                  onChange={e => setAuditSearchQuery(e.target.value)}
                />

                <div style={{ display: 'flex', gap: '6px' }}>
                  {['ALL', 'REGISTRATION', 'REFERRAL', 'DISCHARGE', 'LAB', 'PRESCRIPTION', 'ADMISSION'].map(type => (
                    <button
                      key={type}
                      onClick={() => setAuditFilterType(type)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: auditFilterType === type ? '#0f172a' : '#f1f5f9',
                        color: auditFilterType === type ? 'white' : '#475569',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}>
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Comprehensive Live Audit Log Table with Exact Date & Time and Click-to-View Photos */}
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 2fr 1.2fr 1.2fr', backgroundColor: '#f8fafc', padding: '12px 16px', borderBottom: '1px solid #e2e8f0', fontWeight: 'bold', fontSize: '12px', color: '#475569' }}>
                  <span>EVENT TYPE & PATIENT</span>
                  <span>DESCRIPTION / CLINICAL ACTION</span>
                  <span>PERFORMED BY</span>
                  <span style={{ textAlign: 'right' }}>DATE & TIME</span>
                </div>

                <div style={{ maxHeight: '550px', overflowY: 'auto' }}>
                  {filteredAuditLogs.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>No matching audit records found.</div>
                  ) : (
                    filteredAuditLogs.map((log, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1.4fr 2fr 1.2fr 1.2fr',
                          padding: '14px 16px',
                          borderBottom: idx !== filteredAuditLogs.length - 1 ? '1px solid #f1f5f9' : 'none',
                          fontSize: '13px',
                          alignItems: 'center',
                          backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fcfcfd'
                        }}>
                        <div>
                          <strong style={{ color: log.color, display: 'block', fontSize: '13px' }}>{log.title}</strong>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>{log.patientId}</span>
                        </div>

                        <div style={{ color: '#334155', fontSize: '12px', lineHeight: '1.4' }}>
                          <div>{log.details}</div>
                          {log.photoProof && (
                            <button
                              onClick={() => setSelectedDetailItem({
                                type: log.type,
                                stage: log.title,
                                performedBy: log.actor,
                                timestamp: log.timestamp,
                                details: log.details,
                                photoProof: log.photoProof
                              })}
                              style={{ marginTop: '4px', padding: '3px 8px', backgroundColor: '#dcfce7', color: '#15803d', border: '1px solid #86efac', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <span>📸</span> Inspect Photo Proof
                            </button>
                          )}
                        </div>

                        <div style={{ fontSize: '12px', color: '#475569', fontWeight: '600' }}>
                          {log.actor}
                        </div>

                        <div style={{ textAlign: 'right', fontSize: '12px', color: '#2563eb', fontWeight: 'bold' }}>
                          🕒 {formatDateTime(log.timestamp)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* DEDICATED LAPTOP WEBCAM / CAMERA CAPTURE MODAL */}
      {cameraModal.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 12000, padding: '20px' }}>
          <div style={{ backgroundColor: 'white', width: '100%', maxWidth: '620px', borderRadius: '18px', padding: '28px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)', position: 'relative', maxHeight: '92vh', overflowY: 'auto' }}>
            <button 
              onClick={() => {
                if (streamRef.current) {
                  streamRef.current.getTracks().forEach(track => track.stop())
                  streamRef.current = null
                }
                setCameraModal({ isOpen: false, title: '', purpose: '', targetId: null, onSuccess: null })
              }} 
              style={{ position: 'absolute', top: '18px', right: '18px', background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', fontSize: '16px', cursor: 'pointer', color: '#64748b' }}>
              ✕
            </button>

            <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', color: '#0f172a' }}>{cameraModal.title}</h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b' }}>
              Mandatory live photographic verification required to confirm physical handover & eliminate theft.
            </p>

            {/* Video Viewfinder / Live Stream */}
            {!capturedPhotoPreview ? (
              <div>
                <div style={{ position: 'relative', backgroundColor: '#0f172a', borderRadius: '12px', overflow: 'hidden', height: '280px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '14px', border: '2px solid #3b82f6' }}>
                  <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  
                  {/* Viewfinder Target Box Overlay */}
                  <div style={{ position: 'absolute', top: '20px', left: '20px', right: '20px', bottom: '20px', border: '2px dashed rgba(255,255,255,0.7)', borderRadius: '10px', pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ backgroundColor: 'rgba(0,0,0,0.5)', color: 'white', padding: '4px 12px', borderRadius: '20px', fontSize: '12px' }}>
                      Position {cameraModal.purpose === 'pharmacy' ? 'Medicine Packet & ID' : cameraModal.purpose === 'lab' ? 'Sample Vial / Report Sheet' : 'Consumable Pack'} in Frame
                    </span>
                  </div>
                </div>

                {cameraError && (
                  <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', padding: '10px', borderRadius: '8px', fontSize: '12px', color: '#b91c1c', marginBottom: '12px' }}>
                    ⚠️ {cameraError}
                  </div>
                )}

                {/* Camera Actions */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                  <button 
                    onClick={snapWebcamPhoto}
                    style={{ padding: '12px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                    <span>📸</span> Snap with Laptop Camera
                  </button>

                  <label style={{ padding: '12px', backgroundColor: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', textAlign: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}>
                    <span>📁</span> Upload Image from Laptop
                    <input 
                      type="file" 
                      accept="image/*" 
                      style={{ display: 'none' }}
                      onChange={async (e) => {
                        if (e.target.files[0]) {
                          const b64 = await fileToBase64(e.target.files[0])
                          setCapturedPhotoPreview(b64)
                        }
                      }}
                    />
                  </label>
                </div>

                {/* 1-Click Fast Presets (To easily test without webcam) */}
                <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '6px' }}>
                    ⚡ Instant 1-Click Medical Sample Presets (For Fast Testing):
                  </span>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {cameraModal.purpose === 'pharmacy' && (
                      <button 
                        onClick={() => setCapturedPhotoPreview(generateMedicalPresetImage('pharmacy', 'Dispensed Medication Packet', 'Paracetamol 650mg + Cetirizine 10mg (Counter #3)'))}
                        style={{ padding: '6px 12px', fontSize: '12px', backgroundColor: '#dcfce7', color: '#15803d', border: '1px solid #86efac', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>
                        💊 Preset: Dispensed Meds Pack
                      </button>
                    )}
                    {cameraModal.purpose === 'lab' && (
                      <>
                        <button 
                          onClick={() => setCapturedPhotoPreview(generateMedicalPresetImage('lab', 'Barcoded Sample Tube (EDTA/Serum)', 'Pathology Lab 1 - Room 105'))}
                          style={{ padding: '6px 12px', fontSize: '12px', backgroundColor: '#dbeafe', color: '#1d4ed8', border: '1px solid #93c5fd', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>
                          🧪 Preset: Blood Sample Tube
                        </button>
                        <button 
                          onClick={() => setCapturedPhotoPreview(generateMedicalPresetImage('lab', 'Central Diagnostic Report Sheet', 'CBC & Bio-chemistry Analyzer Printout'))}
                          style={{ padding: '6px 12px', fontSize: '12px', backgroundColor: '#dcfce7', color: '#15803d', border: '1px solid #86efac', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>
                          📋 Preset: Lab Diagnostic Sheet
                        </button>
                      </>
                    )}
                    {cameraModal.purpose === 'ward' && (
                      <button 
                        onClick={() => setCapturedPhotoPreview(generateMedicalPresetImage('ward', 'Bedside Consumable Administration', 'IV Cannula 20G & 500ml Normal Saline Pack'))}
                        style={{ padding: '6px 12px', fontSize: '12px', backgroundColor: '#f3e8ff', color: '#7e22ce', border: '1px solid #d8b4fe', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>
                        💉 Preset: IV Cannula & Saline Pack
                      </button>
                    )}
                  </div>
                </div>

              </div>
            ) : (
              /* Photo Preview & Confirmation */
              <div>
                <div style={{ textAlign: 'center', backgroundColor: '#0f172a', padding: '10px', borderRadius: '12px', marginBottom: '16px' }}>
                  <img src={capturedPhotoPreview} alt="Captured Proof" style={{ maxWidth: '100%', maxHeight: '280px', borderRadius: '8px', objectFit: 'contain' }} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '10px' }}>
                  <button 
                    onClick={() => {
                      setCapturedPhotoPreview(null)
                      startWebcam()
                    }} 
                    style={{ padding: '12px', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>
                    🔄 Retake Photo
                  </button>

                  <button 
                    onClick={confirmCapturedPhoto} 
                    style={{ padding: '12px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)' }}>
                    ✅ Confirm & Submit Photo Proof ➔
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* INTERACTIVE CLINICAL DETAIL INSPECTION MODAL (WITH PHOTO PROOFS) */}
      {selectedDetailItem && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 11000, padding: '20px' }}>
          <div style={{ backgroundColor: 'white', width: '100%', maxWidth: '640px', borderRadius: '16px', padding: '32px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
            <button onClick={() => setSelectedDetailItem(null)} style={{ position: 'absolute', top: '20px', right: '20px', background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', fontSize: '16px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <span style={{ fontSize: '24px' }}>{selectedDetailItem.icon || '📋'}</span>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Official Clinical Record</span>
                <h3 style={{ margin: '2px 0 0 0', color: '#0f172a', fontSize: '20px' }}>{selectedDetailItem.stage || 'Clinical Activity Details'}</h3>
              </div>
            </div>

            {/* Timestamp & Clinician Banner */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', backgroundColor: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Date & Time</span>
                <strong style={{ fontSize: '13px', color: '#0f172a' }}>🕒 {formatDateTime(selectedDetailItem.timestamp)}</strong>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Authorizing Clinician / Staff</span>
                <strong style={{ fontSize: '13px', color: '#2563eb' }}>👨‍⚕️ {selectedDetailItem.performedBy || selectedDetailItem.doctorName || 'Attending Physician'}</strong>
              </div>
            </div>

            {/* PHOTOGRAPHIC PROOF OF DELIVERY / HANDOVER (Zero Exploitation & Anti-Theft) */}
            {selectedDetailItem.photoProof && (
              <div style={{ backgroundColor: '#f0fdf4', border: '2px solid #86efac', borderRadius: '12px', padding: '16px', marginBottom: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '18px' }}>📸</span>
                    <strong style={{ color: '#15803d', fontSize: '14px' }}>Photographic Proof of Handover / Delivery Verified</strong>
                  </div>
                  <span style={{ fontSize: '11px', backgroundColor: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                    ✓ Zero Exploitation Proof
                  </span>
                </div>
                <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#166534' }}>
                  Captured at station counter / patient bedside to verify physical handover and eliminate middleman theft.
                </p>
                <div style={{ textAlign: 'center', backgroundColor: '#ffffff', padding: '8px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                  <img src={selectedDetailItem.photoProof} alt="Photographic Proof" style={{ maxWidth: '100%', maxHeight: '240px', borderRadius: '6px', objectFit: 'contain' }} />
                </div>
              </div>
            )}

            {/* Discharge Summary in Detail Modal */}
            {selectedDetailItem.dischargeSummary && (
              <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '16px', marginBottom: '18px' }}>
                <strong style={{ fontSize: '14px', color: '#15803d', display: 'block', marginBottom: '8px' }}>🏁 Outpatient Clinical Discharge Summary:</strong>
                <div style={{ padding: '12px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #dcfce7', fontSize: '14px', color: '#0f172a', lineHeight: '1.5' }}>
                  {selectedDetailItem.dischargeSummary}
                </div>
                <div style={{ fontSize: '12px', color: '#166534', marginTop: '8px' }}>
                  <strong>Classification:</strong> {selectedDetailItem.dischargeType || 'Routine Outpatient Completion'}
                </div>
                <div style={{ fontSize: '12px', color: '#2563eb', marginTop: '4px' }}>
                  <strong>Follow-up Advice:</strong> {selectedDetailItem.followUpAdvice || 'Follow-up as needed.'}
                </div>
              </div>
            )}

            {/* Delivery Mode & Anti-Bribery Verification Notice */}
            {selectedDetailItem.deliveryMode && (
              <div style={{ backgroundColor: selectedDetailItem.deliveryMode === 'PHYSICAL_COUNTER' ? '#fffbeb' : '#f0fdf4', border: `1px solid ${selectedDetailItem.deliveryMode === 'PHYSICAL_COUNTER' ? '#fde68a' : '#bbf7d0'}`, padding: '14px', borderRadius: '10px', marginBottom: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '18px' }}>{selectedDetailItem.deliveryMode === 'PHYSICAL_COUNTER' ? '📄' : '⚡'}</span>
                  <strong style={{ color: selectedDetailItem.deliveryMode === 'PHYSICAL_COUNTER' ? '#92400e' : '#15803d', fontSize: '14px' }}>
                    {selectedDetailItem.deliveryMode === 'PHYSICAL_COUNTER' ? 'Physical Hard-Copy Collection Notice' : 'Digital Direct EHR Upload (Zero Bribery)'}
                  </strong>
                </div>
                <p style={{ margin: 0, fontSize: '12px', color: selectedDetailItem.deliveryMode === 'PHYSICAL_COUNTER' ? '#78350f' : '#166534', lineHeight: '1.4' }}>
                  {selectedDetailItem.deliveryInstructions || (selectedDetailItem.deliveryMode === 'PHYSICAL_COUNTER' ? 'Present your Patient ID at Diagnostic Counter 1 (Room 105) to collect the printed diagnostic film.' : 'This report is digitally signed and uploaded to your EHR portal automatically, eliminating middleman bribery.')}
                </p>
              </div>
            )}

            {/* Test Findings & Reference Range (For Lab Reports) */}
            {selectedDetailItem.clinicalFindings && (
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', marginBottom: '18px' }}>
                <strong style={{ fontSize: '14px', color: '#0f172a', display: 'block', marginBottom: '8px' }}>🔬 Clinical Diagnostic Findings:</strong>
                <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', color: '#0f172a', lineHeight: '1.5' }}>
                  {selectedDetailItem.clinicalFindings}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>
                  <strong>Biological Reference Interval:</strong> {selectedDetailItem.referenceRange || 'Within standard physiological ranges.'}
                </div>
                <div style={{ fontSize: '12px', color: '#16a34a', marginTop: '4px', fontWeight: 'bold' }}>
                  ✅ Verified by Gandhi Central Pathology Laboratory (Room 105)
                </div>
              </div>
            )}

            {/* Medicines Breakdown Table (For Prescriptions) */}
            {selectedDetailItem.medicines && selectedDetailItem.medicines.length > 0 && (
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', marginBottom: '18px' }}>
                <strong style={{ fontSize: '14px', color: '#0f172a', display: 'block', marginBottom: '10px' }}>💊 Prescribed Drug Schedule:</strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedDetailItem.medicines.map((med, idx) => (
                    <div key={idx} style={{ padding: '10px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong style={{ fontSize: '14px', color: '#0f172a' }}>{med.name}</strong>
                        <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
                          Dosage: <strong>{med.dosage}</strong> • Timing: {med.timing || 'After Food'} • Duration: {med.durationDays} Days
                        </div>
                      </div>
                      <span style={{ fontSize: '11px', fontWeight: 'bold', padding: '4px 8px', borderRadius: '6px', backgroundColor: med.isDispensed ? '#dcfce7' : '#fef3c7', color: med.isDispensed ? '#15803d' : '#b45309' }}>
                        {med.isDispensed ? '✅ Dispensed' : '⏳ Ready at Counter #3'}
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '10px' }}>
                  <strong>Doctor Instructions:</strong> {selectedDetailItem.notes || 'Take with warm water after meals.'}
                </div>
              </div>
            )}

            {/* Room & Physical Location */}
            {(selectedDetailItem.room || selectedDetailItem.block) && (
              <div style={{ padding: '12px 16px', backgroundColor: '#eff6ff', borderRadius: '10px', border: '1px solid #bfdbfe', marginBottom: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#1e40af', fontWeight: 'bold' }}>PHYSICAL LOCATION</span>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1d4ed8' }}>📍 {selectedDetailItem.room}</div>
                  <div style={{ fontSize: '12px', color: '#475569' }}>{selectedDetailItem.block}</div>
                </div>
                <span style={{ fontSize: '12px', backgroundColor: 'white', padding: '4px 10px', borderRadius: '6px', border: '1px solid #bfdbfe', fontWeight: 'bold', color: '#1e40af' }}>
                  Gandhi Hospital
                </span>
              </div>
            )}

            <button onClick={() => setSelectedDetailItem(null)} style={{ width: '100%', padding: '12px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}>
              Close Detail View
            </button>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer style={{ backgroundColor: '#ffffff', borderTop: '1px solid #e2e8f0', color: '#64748b', textAlign: 'center', padding: '20px', fontSize: '13px' }}>
        &copy; 2026 Chikitsya Setu - Gandhi Hospital Transparency Platform
      </footer>

      {/* UNIFIED ROLE LOGIN MODAL */}
      {showLoginModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 }}>
          <div style={{ backgroundColor: 'white', width: '100%', maxWidth: '500px', borderRadius: '16px', padding: '32px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
            <button onClick={() => setShowLoginModal(false)} style={{ position: 'absolute', top: '18px', right: '18px', background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>✕</button>

            <h3 style={{ margin: '0 0 6px 0', fontSize: '20px', color: '#0f172a' }}>Login to Chikitsya Setu</h3>
            <p style={{ margin: '0 0 18px 0', fontSize: '13px', color: '#64748b' }}>Select your portal role to continue.</p>

            {/* Role Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '20px' }}>
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
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: loginRole === r.key ? '#0f172a' : '#f8fafc',
                    color: loginRole === r.key ? 'white' : '#334155',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}>
                  {r.label}
                </button>
              ))}
            </div>

            {/* O/P Staff Login Form */}
            {loginRole === 'op-desk' && (
              <form onSubmit={handleOpStaffLogin}>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Staff User ID</label>
                  <input required type="text" placeholder="Enter Staff ID" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} value={opStaffUser} onChange={e => setOpStaffUser(e.target.value)} />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Password</label>
                  <input required type="password" placeholder="••••••••" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} value={opStaffPass} onChange={e => setOpStaffPass(e.target.value)} />
                </div>

                {staffLoginError && <p style={{ color: '#dc2626', fontSize: '13px', margin: '0 0 12px 0' }}>⚠️ {staffLoginError}</p>}

                <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>
                  Log In to O/P Desk ➔
                </button>
              </form>
            )}

            {/* Patient Login Form */}
            {loginRole === 'patient' && (
              <div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                  <button onClick={() => setPatientLoginMode('password')} style={{ flex: 1, padding: '6px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: patientLoginMode === 'password' ? '#0f172a' : '#f8fafc', color: patientLoginMode === 'password' ? 'white' : '#334155', cursor: 'pointer', fontWeight: '600' }}>Passcode Login</button>
                  <button onClick={() => setPatientLoginMode('otp')} style={{ flex: 1, padding: '6px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: patientLoginMode === 'otp' ? '#0f172a' : '#f8fafc', color: patientLoginMode === 'otp' ? 'white' : '#334155', cursor: 'pointer', fontWeight: '600' }}>WhatsApp OTP</button>
                  <button onClick={() => setPatientLoginMode('quick')} style={{ flex: 1, padding: '6px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: patientLoginMode === 'quick' ? '#0f172a' : '#f8fafc', color: patientLoginMode === 'quick' ? 'white' : '#334155', cursor: 'pointer', fontWeight: '600' }}>⚡ Quick Select</button>
                </div>

                {patientLoginMode === 'password' && (
                  <form onSubmit={handlePatientPasswordLogin}>
                    <input required type="text" placeholder="Patient ID (e.g. PT-1005)" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '12px', boxSizing: 'border-box' }} value={loginId} onChange={e => setLoginId(e.target.value)} />
                    <input required type="password" placeholder="Passcode (6-digit PIN)" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '16px', boxSizing: 'border-box' }} value={loginPassword} onChange={e => setLoginPassword(e.target.value)} />
                    <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>Log In to Patient EHR Portal ➔</button>
                  </form>
                )}

                {patientLoginMode === 'otp' && (
                  <div>
                    {!otpSent ? (
                      <form onSubmit={handleSendOtp}>
                        <input required type="text" placeholder="Patient ID or Mobile Number" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '14px', boxSizing: 'border-box' }} value={otpIdentifier} onChange={e => setOtpIdentifier(e.target.value)} />
                        <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#25D366', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>💬 Send OTP to WhatsApp</button>
                      </form>
                    ) : (
                      <form onSubmit={handleVerifyOtp}>
                        <input required type="text" maxLength={6} placeholder="123456" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', textAlign: 'center', fontSize: '18px', letterSpacing: '4px', marginBottom: '14px', boxSizing: 'border-box' }} value={enteredOtp} onChange={e => setEnteredOtp(e.target.value)} />
                        <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>Verify & Log In ➔</button>
                      </form>
                    )}
                  </div>
                )}

                {patientLoginMode === 'quick' && (
                  <div>
                    <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '8px' }}>Select any registered patient to test their live portal:</span>
                    {registeredPatients.length === 0 ? (
                      <p style={{ fontSize: '13px', color: '#94a3b8' }}>No registered patients found. Register at O/P counter first.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
                        {registeredPatients.map(p => (
                          <button key={p.patientId} onClick={() => handleDirectPatientSelect(p)} style={{ padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', textAlign: 'left' }}>
                            <div>
                              <strong style={{ fontSize: '14px', color: '#0f172a' }}>{p.name}</strong>
                              <div style={{ fontSize: '12px', color: '#64748b' }}>{p.patientId} • Passcode: {p.password}</div>
                            </div>
                            <span style={{ fontSize: '12px', color: '#2563eb', fontWeight: 'bold' }}>Open Portal ➔</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {loginError && <p style={{ color: '#dc2626', fontSize: '13px', marginTop: '12px', padding: '8px', backgroundColor: '#fef2f2', borderRadius: '6px' }}>⚠️ {loginError}</p>}
                {otpError && <p style={{ color: '#dc2626', fontSize: '13px', marginTop: '12px', padding: '8px', backgroundColor: '#fef2f2', borderRadius: '6px' }}>⚠️ {otpError}</p>}
              </div>
            )}

            {/* Doctor Select */}
            {loginRole === 'doctor' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
                {doctorsList.map(doc => (
                  <button key={doc.doctorId} onClick={() => handleRoleSelectLogin('doctor', doc)} style={{ padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: 'white', textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div><strong>{doc.name}</strong><div style={{ fontSize: '12px', color: '#64748b' }}>{doc.department} (ID: {doc.doctorId})</div></div>
                    <span style={{ fontSize: '13px', color: '#2563eb', fontWeight: 'bold' }}>Enter ➔</span>
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
