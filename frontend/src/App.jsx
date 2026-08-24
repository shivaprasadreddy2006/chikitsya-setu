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

// Department Location Map in Hospital
const DEPARTMENT_LOCATIONS = {
  'General Medicine': { room: 'Room 102', block: 'OPD Block A (Ground Floor, Wing 1)' },
  'Cardiology': { room: 'Room 201', block: 'Specialty Wing C (2nd Floor)' },
  'Orthopedics': { room: 'Room 204', block: 'Trauma Wing (2nd Floor)' },
  'Pulmonology': { room: 'Room 302', block: 'Chest Clinic (3rd Floor)' },
  'Nephrology': { room: 'Room 401', block: 'Dialysis Unit (4th Floor)' },
  'General Surgery': { room: 'Room 108', block: 'Surgical Block (1st Floor)' }
}

// Preset Avatars for Optional Patient Selection
const PRESET_AVATARS = [
  { id: '1', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80', label: 'Male 1' },
  { id: '2', url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&auto=format&fit=crop&q=80', label: 'Female 1' },
  { id: '3', url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80', label: 'Male 2' },
  { id: '4', url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=300&auto=format&fit=crop&q=80', label: 'Female 2' },
  { id: '5', url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&auto=format&fit=crop&q=80', label: 'Male Senior' },
  { id: '6', url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&auto=format&fit=crop&q=80', label: 'Female Pro' },
  { id: '7', url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=300&auto=format&fit=crop&q=80', label: 'Male Pro' },
  { id: '8', url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&auto=format&fit=crop&q=80', label: 'Female 3' }
]

// Fallback Doctor Avatar
const DEFAULT_DOC_AVATAR = 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300&auto=format&fit=crop&q=80'

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
  ctx.fillStyle = type === 'pharmacy' ? '#047857' : type === 'lab' ? '#0369a1' : type === 'grievance' ? '#be123c' : '#4338ca'
  ctx.fillRect(20, 20, 560, 60)

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 20px sans-serif'
  ctx.fillText('🏥 CHIKITSYA SETU - VERIFIED DIGITAL EVIDENCE', 40, 58)

  // Icon
  ctx.font = '48px sans-serif'
  ctx.fillText(type === 'pharmacy' ? '💊' : type === 'lab' ? '🧪' : type === 'grievance' ? '🚨' : '💉', 40, 146)

  // Content
  ctx.fillStyle = '#070e1e'
  ctx.font = 'bold 20px sans-serif'
  ctx.fillText(title, 110, 126)

  ctx.fillStyle = '#64748b'
  ctx.font = '15px sans-serif'
  ctx.fillText(subtitle, 110, 154)

  // Details box
  ctx.fillStyle = '#f1f5f9'
  ctx.fillRect(40, 185, 520, 115)
  ctx.strokeStyle = '#cbd5e1'
  ctx.strokeRect(40, 185, 520, 115)

  ctx.fillStyle = '#1e293b'
  ctx.font = '13px monospace'
  ctx.fillText(`STATUS: VERIFIED ON-SITE EVIDENCE`, 55, 215)
  ctx.fillText(`TIMESTAMP: ${new Date().toLocaleString('en-IN')}`, 55, 240)
  ctx.fillText(`AUDIT: ZERO-CORRUPTION DIGITAL WATERMARK`, 55, 265)

  // Official Stamp
  ctx.fillStyle = '#047857'
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

  // Patient Profile Settings Form State
  const [patientEditForm, setPatientEditForm] = useState({
    name: '',
    phoneNumber: '',
    password: '',
    photoUrl: '',
    age: '',
    gender: 'Male'
  })
  const [profileUpdateMsg, setProfileUpdateMsg] = useState('')
  const [showAvatarPickerModal, setShowAvatarPickerModal] = useState(false)

  // Sync patient edit form on session load/update
  useEffect(() => {
    if (currentUser?.role === 'patient' && currentUser.data) {
      setPatientEditForm({
        name: currentUser.data.name || '',
        phoneNumber: currentUser.data.phoneNumber || '',
        password: currentUser.data.password || '',
        photoUrl: currentUser.data.photoUrl || '',
        age: currentUser.data.age || '',
        gender: currentUser.data.gender || 'Male'
      })
    }
  }, [currentUser])

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
    photoUrl: '',
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

  // Helper function to render patient avatar or dynamic initials badge
  const renderPatientAvatar = (patient, size = 42, border = '1.5px solid #cbd5e1') => {
    if (patient?.photoUrl) {
      return (
        <img
          src={patient.photoUrl}
          alt={patient.name || 'Patient'}
          style={{
            width: `${size}px`,
            height: `${size}px`,
            borderRadius: '50%',
            objectFit: 'cover',
            border,
            flexShrink: 0
          }}
        />
      )
    }
    const initials = patient?.name
      ? patient.name
          .split(' ')
          .map(n => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2)
      : 'PT'
    return (
      <div
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: '800',
          fontSize: `${Math.round(size * 0.38)}px`,
          border,
          flexShrink: 0,
          boxShadow: '0 2px 8px rgba(30,58,138,0.25)'
        }}>
        {initials}
      </div>
    )
  }

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
    ctx.fillText(`🏥 CHIKITSYA SETU AUDIT PROOF | ${new Date().toLocaleString('en-IN')}`, 20, canvas.height - 20)

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
    
    ctx.fillStyle = 'rgba(190, 18, 60, 0.85)'
    ctx.fillRect(10, canvas.height - 40, canvas.width - 20, 30)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 13px sans-serif'
    ctx.fillText(`🚨 CHIKITSYA SETU GRIEVANCE EVIDENCE | ${new Date().toLocaleString('en-IN')}`, 20, canvas.height - 20)

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
      fetchAllHospitalGrievances()
      stopGrievanceCamera()
    } catch (err) {
      setGrievanceMessage(`⚠️ ${err.response?.data?.message || 'Failed to submit grievance.'}`)
    }
  }

  // Patient Confirms Resolution & Instantly Syncs with Admin & Patient Views
  const handlePatientConfirmResolution = async (grievanceId, isResolved) => {
    try {
      const res = await axios.put(`${API_BASE}/grievances/patient-confirm/${grievanceId}`, {
        isResolved,
        feedback: isResolved ? 'Verified & satisfied with action taken on the ground.' : 'Issue still pending on the ground.',
        reopenReason: isResolved ? '' : 'Patient indicated that issue remains unresolved on the ground.'
      })
      if (res.data.whatsAppNotification) showWhatsAppAlert(res.data.whatsAppNotification)
      
      // Real-time synchronization across both Patient and Admin datasets
      if (currentUser?.data?.patientId) {
        await fetchPatientGrievances(currentUser.data.patientId)
      }
      await fetchAllHospitalGrievances()
    } catch (err) {
      console.error('Error confirming resolution:', err)
    }
  }

  // Patient Updates Own Profile (Photo, Phone, Password, Info)
  const handlePatientUpdateProfile = async (e) => {
    e.preventDefault()
    if (!currentUser?.data?.patientId) return
    try {
      const res = await axios.put(`${API_BASE}/patients/profile/${currentUser.data.patientId}`, patientEditForm)
      setProfileUpdateMsg(`✅ ${res.data.message}`)
      if (res.data.whatsAppNotification) showWhatsAppAlert(res.data.whatsAppNotification)
      
      const updatedPatient = res.data.patient
      const updatedUser = { ...currentUser, data: updatedPatient }
      setCurrentUser(updatedUser)
      localStorage.setItem('chikitsya_session', JSON.stringify(updatedUser))

      fetchPatientFullFile(updatedPatient.patientId)
      fetchPatientsList()
      if (selectedDoctorId) fetchDoctorQueue(selectedDoctorId)
      fetchAllHospitalGrievances()
    } catch (err) {
      setProfileUpdateMsg(`⚠️ ${err.response?.data?.message || 'Update failed'}`)
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
      await fetchAllHospitalGrievances()
      if (currentUser?.role === 'patient' && currentUser.data?.patientId) {
        await fetchPatientGrievances(currentUser.data.patientId)
      }
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
    if (opStaffUser.trim() === 'op_staff' && (opStaffPass.trim() === 'setu2026' || opStaffPass.trim() === 'gandhi2026')) {
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

  const handleSendOtp = async (e) => {
    e.preventDefault()
    setOtpError('')
    try {
      const res = await axios.post(`${API_BASE}/patients/send-otp`, { identifier: otpIdentifier })
      setOtpSent(true)
      setOtpInfo(res.data)
      if (res.data.whatsAppNotification) showWhatsAppAlert(res.data.whatsAppNotification)
    } catch (err) {
      setOtpError(err.response?.data?.message || 'Failed to dispatch OTP. Please check the ID/Phone.')
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
      setOtpIdentifier('')
      setEnteredOtp('')
      setOtpSent(false)
    } catch (err) {
      setOtpError(err.response?.data?.message || 'Invalid or expired OTP.')
    }
  }

  const handleDirectPatientSelect = async (patient) => {
    persistLogin('patient', patient)
    await fetchPatientFullFile(patient.patientId)
    await fetchPatientGrievances(patient.patientId)
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
    setStaffLoginError('')
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

  // O/P Desk Registration with Optional Live Photo Capture
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
        photoUrl: '',
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
      inspectPatientTimeline(activePatientForExam)
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
      fetchAdmissions()
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
  const activeDoctorPhoto = resolvedDoctor?.photoUrl || DEFAULT_DOC_AVATAR
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
    <div style={{ minHeight: '100vh', backgroundColor: currentUser ? '#f1f5f9' : '#070e1e', color: currentUser ? '#070e1e' : '#ffffff', display: 'flex', flexDirection: 'column' }}>
      
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
          boxShadow: '0 20px 40px -8px rgba(0,0,0,0.5)',
          maxWidth: '380px',
          zIndex: 99999,
          border: '1px solid #1e3a8a'
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
      {/* 1. BEFORE LOGIN: UNIFIED ROYAL MIDNIGHT LANDING PAGE & INTERACTIVE PPT */}
      {/* ========================================================================= */}
      {!currentUser && (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#070e1e', background: 'radial-gradient(circle at 50% 0%, #0f1c3f 0%, #070e1e 70%)', color: '#ffffff' }}>
          
          {/* Top Navbar */}
          <header style={{
            backgroundColor: 'rgba(7, 14, 30, 0.85)',
            backdropFilter: 'blur(16px)',
            borderBottom: '1px solid rgba(30, 58, 138, 0.4)',
            padding: '18px 48px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'sticky',
            top: 0,
            zIndex: 100
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', boxShadow: '0 0 24px rgba(37,99,235,0.5)' }}>
                🏥
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: '#ffffff', letterSpacing: '-0.03em' }}>
                  Chikitsya Setu
                </h1>
                <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: '700', letterSpacing: '0.8px' }}>PUBLIC HEALTHCARE TRANSPARENCY ECOSYSTEM</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8', fontSize: '13px', fontWeight: '700', backgroundColor: 'rgba(15, 28, 63, 0.8)', padding: '6px 14px', borderRadius: '9999px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block', boxShadow: '0 0 8px #10b981' }}></span>
                Live Hospital Network Active
              </div>

              <button
                onClick={() => { fetchPatientsList(); setShowLoginModal(true); }}
                style={{
                  padding: '12px 28px',
                  background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
                  color: '#ffffff',
                  border: '1px solid rgba(59, 130, 246, 0.5)',
                  borderRadius: '9999px',
                  fontSize: '14px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  boxShadow: '0 8px 24px rgba(37, 99, 235, 0.45)',
                  transition: 'all 0.3s ease'
                }}>
                🔐 Access Portals ➔
              </button>
            </div>
          </header>

          {/* MAIN PRESENTATION BODY (UNIFIED THEME + INTERACTIVE SLIDES) */}
          <main style={{ flex: 1, padding: '48px 24px', display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: '100%', maxWidth: '1160px' }}>
              
              {/* SLIDE 1: EXECUTIVE HERO BANNER */}
              <div className="animate-fade-in" style={{
                padding: '56px 44px',
                borderRadius: '28px',
                textAlign: 'center',
                marginBottom: '40px',
                background: 'linear-gradient(180deg, rgba(15, 28, 63, 0.85) 0%, rgba(7, 14, 30, 0.95) 100%)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)'
              }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 22px', backgroundColor: 'rgba(30, 58, 138, 0.4)', border: '1px solid rgba(59, 130, 246, 0.4)', borderRadius: '9999px', fontSize: '13px', color: '#93c5fd', fontWeight: '800', marginBottom: '22px' }}>
                  <span>👑</span> Sovereign Public Healthcare Transformation Framework
                </div>

                <h2 style={{ fontSize: '42px', color: '#ffffff', margin: '0 0 20px 0', fontWeight: '800', letterSpacing: '-0.03em', lineHeight: '1.2' }}>
                  Zero-Corruption Healthcare Engine <br/>
                  <span style={{ background: 'linear-gradient(90deg, #38bdf8, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    for Government Tertiary Hospitals
                  </span>
                </h2>

                <p style={{ fontSize: '16px', color: '#94a3b8', maxWidth: '820px', margin: '0 auto 36px auto', lineHeight: '1.7' }}>
                  Designed specifically to dismantle middlemen extortion, stop medicine diversion, enforce doctor punctuality, and restore dignity to poor citizens receiving free public healthcare.
                </p>

                {/* Animated Stat Badges */}
                <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '38px' }}>
                  <span style={{ padding: '10px 20px', backgroundColor: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '9999px', fontSize: '13px', fontWeight: '700', color: '#e2e8f0' }}>
                    🏥 1,200+ Bed Inpatient Capacity
                  </span>
                  <span style={{ padding: '10px 20px', backgroundColor: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '9999px', fontSize: '13px', fontWeight: '700', color: '#e2e8f0' }}>
                    👥 3,500+ Daily Outpatients
                  </span>
                  <span style={{ padding: '10px 20px', backgroundColor: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '9999px', fontSize: '13px', fontWeight: '700', color: '#e2e8f0' }}>
                    🚨 24/7 Citizen Vigilance Cell
                  </span>
                  <span style={{ padding: '10px 20px', backgroundColor: 'rgba(6, 78, 59, 0.4)', border: '1px solid rgba(16, 185, 129, 0.4)', borderRadius: '9999px', fontSize: '13px', fontWeight: '800', color: '#34d399' }}>
                    ✅ 100% Free Public Health Policy
                  </span>
                </div>

                {/* Live Real-time Stats Grid */}
                {hospitalStats && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '18px', textAlign: 'center' }}>
                    <div style={{ padding: '24px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(15, 23, 42, 0.7)' }}>
                      <div style={{ fontSize: '34px', fontWeight: '800', color: '#ffffff' }}>{hospitalStats.totalPatients}</div>
                      <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '6px', fontWeight: '700' }}>Patients Registered</div>
                    </div>
                    <div style={{ padding: '24px', borderRadius: '20px', border: '1px solid rgba(59, 130, 246, 0.3)', background: 'rgba(30, 58, 138, 0.25)' }}>
                      <div style={{ fontSize: '34px', fontWeight: '800', color: '#60a5fa' }}>{hospitalStats.totalDoctors}</div>
                      <div style={{ fontSize: '13px', color: '#93c5fd', marginTop: '6px', fontWeight: '700' }}>Doctors On Shift</div>
                    </div>
                    <div style={{ padding: '24px', borderRadius: '20px', border: '1px solid rgba(245, 158, 11, 0.3)', background: 'rgba(180, 83, 9, 0.2)' }}>
                      <div style={{ fontSize: '34px', fontWeight: '800', color: '#fbbf24' }}>{hospitalStats.pendingLabs}</div>
                      <div style={{ fontSize: '13px', color: '#fde68a', marginTop: '6px', fontWeight: '700' }}>Diagnostic Orders</div>
                    </div>
                    <div style={{ padding: '24px', borderRadius: '20px', border: '1px solid rgba(16, 185, 129, 0.3)', background: 'rgba(4, 120, 87, 0.2)' }}>
                      <div style={{ fontSize: '34px', fontWeight: '800', color: '#34d399' }}>{hospitalStats.transparencyScore}</div>
                      <div style={{ fontSize: '13px', color: '#a7f3d0', marginTop: '6px', fontWeight: '700' }}>Integrity Index</div>
                    </div>
                  </div>
                )}
              </div>

              {/* SLIDE 2: THE GROUND REALITY (THE PROBLEMS WE ARE ELIMINATING) */}
              <div style={{ marginBottom: '44px' }}>
                <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '800', color: '#f87171', letterSpacing: '1px', textTransform: 'uppercase' }}>Current Broken State in Public Healthcare</span>
                  <h3 style={{ fontSize: '28px', margin: '6px 0 0 0', fontWeight: '800' }}>Why Public Hospitals Fail & How Corruption Happens</h3>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '18px' }}>
                  <div style={{ padding: '24px', borderRadius: '20px', background: 'rgba(15, 23, 42, 0.65)', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
                    <div style={{ fontSize: '28px', marginBottom: '12px' }}>🛑</div>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#fca5a5', fontWeight: '800' }}>Doctor Cherry-Picking</h4>
                    <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0, lineHeight: '1.5' }}>
                      Senior doctors skip shifts or leave queues crowded, while patients wait 5+ hours with zero visibility into queue progression.
                    </p>
                  </div>

                  <div style={{ padding: '24px', borderRadius: '20px', background: 'rgba(15, 23, 42, 0.65)', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                    <div style={{ fontSize: '28px', marginBottom: '12px' }}>💸</div>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#fde68a', fontWeight: '800' }}>Diagnostic Bribes</h4>
                    <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0, lineHeight: '1.5' }}>
                      Attendants intentionally delay paper test results to solicit illegal speed money from vulnerable families.
                    </p>
                  </div>

                  <div style={{ padding: '24px', borderRadius: '20px', background: 'rgba(15, 23, 42, 0.65)', border: '1px solid rgba(168, 85, 247, 0.25)' }}>
                    <div style={{ fontSize: '28px', marginBottom: '12px' }}>📦</div>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#d8b4fe', fontWeight: '800' }}>Medicine Black-Market</h4>
                    <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0, lineHeight: '1.5' }}>
                      Free government medicines are claimed on paper but diverted to private pharmacies, leaving poor patients with "Out of Stock".
                    </p>
                  </div>

                  <div style={{ padding: '24px', borderRadius: '20px', background: 'rgba(15, 23, 42, 0.65)', border: '1px solid rgba(59, 130, 246, 0.25)' }}>
                    <div style={{ fontSize: '28px', marginBottom: '12px' }}>🔇</div>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#93c5fd', fontWeight: '800' }}>Grievance Impunity</h4>
                    <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0, lineHeight: '1.5' }}>
                      Complaint boxes are ignored. Hospital authorities close corruption reports unilaterally without patient consent or verification.
                    </p>
                  </div>
                </div>
              </div>

              {/* SLIDE 3: THE 6 PILLARS OF REFORM (INTERACTIVE DEEP DIVE) */}
              <div style={{ marginBottom: '44px' }}>
                <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '800', color: '#38bdf8', letterSpacing: '1px', textTransform: 'uppercase' }}>The Architectural Blueprint</span>
                  <h3 style={{ fontSize: '28px', margin: '6px 0 0 0', fontWeight: '800' }}>6 Structural Reforms Delivered by Chikitsya Setu</h3>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '22px' }}>
                  
                  <div style={{ padding: '28px', borderRadius: '22px', background: 'rgba(15, 28, 63, 0.6)', border: '1px solid rgba(56, 189, 248, 0.25)', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '14px', backgroundColor: 'rgba(37,99,235,0.3)', color: '#60a5fa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', marginBottom: '16px' }}>⚖️</div>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '18px', color: '#93c5fd', fontWeight: '800' }}>1. Equal-Queue Load Balancer</h4>
                    <p style={{ fontSize: '13.5px', color: '#cbd5e1', margin: 0, lineHeight: '1.6' }}>
                      Automated algorithm assigns outpatients equally across duty doctors with the shortest queue. Eliminates favoritism and stops doctors from cherry-picking light cases.
                    </p>
                  </div>

                  <div style={{ padding: '28px', borderRadius: '22px', background: 'rgba(15, 28, 63, 0.6)', border: '1px solid rgba(56, 189, 248, 0.25)', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '14px', backgroundColor: 'rgba(16, 185, 129, 0.3)', color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', marginBottom: '16px' }}>📸</div>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '18px', color: '#6ee7b7', fontWeight: '800' }}>2. Photo-Verified Diagnostic Chain</h4>
                    <p style={{ fontSize: '13.5px', color: '#cbd5e1', margin: 0, lineHeight: '1.6' }}>
                      Mandatory live camera snapshot of sample vials and report sheets directly published to the patient's WhatsApp/phone. Zero extortion by lab attendants.
                    </p>
                  </div>

                  <div style={{ padding: '28px', borderRadius: '22px', background: 'rgba(15, 28, 63, 0.6)', border: '1px solid rgba(56, 189, 248, 0.25)', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '14px', backgroundColor: 'rgba(245, 158, 11, 0.3)', color: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', marginBottom: '16px' }}>💊</div>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '18px', color: '#fde68a', fontWeight: '800' }}>3. Tamper-Proof Pharmacy Ledger</h4>
                    <p style={{ fontSize: '13.5px', color: '#cbd5e1', margin: 0, lineHeight: '1.6' }}>
                      Pharmacists must snap the medicine pack during patient handover. Every batch is stamped digitally, stopping diversion to external private markets.
                    </p>
                  </div>

                  <div style={{ padding: '28px', borderRadius: '22px', background: 'rgba(15, 28, 63, 0.6)', border: '1px solid rgba(56, 189, 248, 0.25)', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '14px', backgroundColor: 'rgba(168, 85, 247, 0.3)', color: '#c084fc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', marginBottom: '16px' }}>🛏️</div>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '18px', color: '#e9d5ff', fontWeight: '800' }}>4. Bedside Consumable Tracking</h4>
                    <p style={{ fontSize: '13.5px', color: '#cbd5e1', margin: 0, lineHeight: '1.6' }}>
                      Every IV cannula, syringe, and antibiotic vial administered in wards is recorded on the patient's digital bed ledger with staff accountability logs before discharge.
                    </p>
                  </div>

                  <div style={{ padding: '28px', borderRadius: '22px', background: 'rgba(15, 28, 63, 0.6)', border: '1px solid rgba(56, 189, 248, 0.25)', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '14px', backgroundColor: 'rgba(239, 68, 68, 0.3)', color: '#f87171', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', marginBottom: '16px' }}>🚨</div>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '18px', color: '#fca5a5', fontWeight: '800' }}>5. Citizen-Consent Vigilance</h4>
                    <p style={{ fontSize: '13.5px', color: '#cbd5e1', margin: 0, lineHeight: '1.6' }}>
                      Patients can record live video/photo grievances of corruption. Crucially: Admin CANNOT unilaterally mark a complaint Green 🟢 without the patient's ground verification!
                    </p>
                  </div>

                  <div style={{ padding: '28px', borderRadius: '22px', background: 'rgba(15, 28, 63, 0.6)', border: '1px solid rgba(56, 189, 248, 0.25)', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '14px', backgroundColor: 'rgba(56, 189, 248, 0.3)', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', marginBottom: '16px' }}>📱</div>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '18px', color: '#bae6fd', fontWeight: '800' }}>6. Direct SMS & WhatsApp EHR</h4>
                    <p style={{ fontSize: '13.5px', color: '#cbd5e1', margin: 0, lineHeight: '1.6' }}>
                      Every token, room location, test result, and prescription is sent in real-time to the citizen's phone via Fast2SMS and WhatsApp, eliminating confusion.
                    </p>
                  </div>

                </div>
              </div>

              {/* SLIDE 4: FULL HOSPITAL LIFECYCLE MAP */}
              <div style={{
                padding: '36px',
                borderRadius: '24px',
                background: 'linear-gradient(180deg, rgba(15, 28, 63, 0.7) 0%, rgba(7, 14, 30, 0.9) 100%)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                marginBottom: '44px'
              }}>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '800', color: '#38bdf8', letterSpacing: '1px', textTransform: 'uppercase' }}>End-to-End Transparency Loop</span>
                  <h3 style={{ fontSize: '24px', margin: '4px 0 0 0', fontWeight: '800' }}>Chronological Patient Accountability Flow</h3>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', textAlign: 'center' }}>
                  <div style={{ padding: '16px', borderRadius: '16px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ fontSize: '24px' }}>🎫</div>
                    <strong style={{ fontSize: '13px', display: 'block', margin: '6px 0 2px 0' }}>1. O/P Desk</strong>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>Auto Load-Balance Token + SMS</span>
                  </div>
                  <div style={{ padding: '16px', borderRadius: '16px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ fontSize: '24px' }}>👨‍⚕️</div>
                    <strong style={{ fontSize: '13px', display: 'block', margin: '6px 0 2px 0' }}>2. Doctor Desk</strong>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>Clinical Exam + Direct Lab/Rx</span>
                  </div>
                  <div style={{ padding: '16px', borderRadius: '16px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ fontSize: '24px' }}>🔬</div>
                    <strong style={{ fontSize: '13px', display: 'block', margin: '6px 0 2px 0' }}>3. Diagnostic Lab</strong>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>Photo-Verified Report Release</span>
                  </div>
                  <div style={{ padding: '16px', borderRadius: '16px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ fontSize: '24px' }}>💊</div>
                    <strong style={{ fontSize: '13px', display: 'block', margin: '6px 0 2px 0' }}>4. Pharmacy</strong>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>Camera-Stamped Handover</span>
                  </div>
                  <div style={{ padding: '16px', borderRadius: '16px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ fontSize: '24px' }}>🏁</div>
                    <strong style={{ fontSize: '13px', display: 'block', margin: '6px 0 2px 0' }}>5. Discharge / Audit</strong>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>Permanent Timeline Archive</span>
                  </div>
                </div>
              </div>

              {/* SLIDE 5: DIRECT ACCESS PORTALS CTA */}
              <div style={{ textAlign: 'center', padding: '40px', borderRadius: '28px', background: 'linear-gradient(135deg, rgba(30,58,138,0.5) 0%, rgba(7,14,30,0.9) 100%)', border: '1px solid rgba(59,130,246,0.4)' }}>
                <h3 style={{ fontSize: '28px', fontWeight: '800', margin: '0 0 12px 0' }}>Ready to Experience Public Healthcare Accountability?</h3>
                <p style={{ fontSize: '15px', color: '#94a3b8', margin: '0 0 24px 0' }}>Log in to any station role to test real-time patient queues, live photo proofs, or grievance governance.</p>
                <button
                  onClick={() => { fetchPatientsList(); setShowLoginModal(true); }}
                  style={{
                    padding: '16px 40px',
                    background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
                    color: '#ffffff',
                    border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: '9999px',
                    fontSize: '16px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    boxShadow: '0 10px 30px rgba(37,99,235,0.5)'
                  }}>
                  🚀 Launch Station Portals Now ➔
                </button>
              </div>

            </div>
          </main>

          <footer style={{ backgroundColor: '#070e1e', borderTop: '1px solid rgba(30,58,138,0.3)', color: '#64748b', textAlign: 'center', padding: '28px', fontSize: '13px' }}>
            &copy; 2026 Chikitsya Setu - Sovereign Public Healthcare Transparency & Anti-Corruption Framework
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', paddingLeft: '6px' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: `linear-gradient(135deg, ${roleTheme.accent} 0%, #1e1b4b 100%)`, color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', boxShadow: `0 0 16px ${roleTheme.accent}66` }}>
                {roleTheme.icon}
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#ffffff', letterSpacing: '-0.02em' }}>Chikitsya Setu</h2>
                <span style={{ fontSize: '10px', color: '#38bdf8', fontWeight: '700', letterSpacing: '0.5px' }}>HEALTHCARE PLATFORM</span>
              </div>
            </div>

            {/* User Profile Card with Live Photo Avatar or Initials */}
            <div style={{ backgroundColor: '#0f172a', border: `1px solid ${roleTheme.accent}44`, borderRadius: '16px', padding: '14px', marginBottom: '22px', boxShadow: '0 4px 14px rgba(0,0,0,0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {renderPatientAvatar(currentUser.data, 38, `2px solid ${roleTheme.accent}`)}
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ color: '#ffffff', fontSize: '13px', fontWeight: '800', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {currentUser.data?.name || roleTheme.name}
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '600' }}>
                    {currentUser.data?.patientId || currentUser.data?.doctorId || currentUser.data?.staffId || currentUser.role.toUpperCase()}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', color: '#10b981', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }}></span>
                  Session Active
                </span>
                <span style={{ fontSize: '10px', color: '#38bdf8', fontWeight: '700' }}>
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
                    { key: 'grievance', icon: '🚨', label: `Raise Grievance (${patientGrievances.length})` },
                    { key: 'settings', icon: '⚙️', label: 'Account & Profile' }
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
                        backgroundColor: patientTab === tab.key ? '#1e3a8a' : 'transparent',
                        color: patientTab === tab.key ? '#ffffff' : '#94a3b8',
                        fontWeight: patientTab === tab.key ? '800' : '600',
                        fontSize: '13px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        boxShadow: patientTab === tab.key ? '0 4px 14px rgba(30,58,138,0.4)' : 'none'
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
                        backgroundColor: doctorViewFilter === filter.key ? '#312e81' : 'transparent',
                        color: doctorViewFilter === filter.key ? '#ffffff' : '#94a3b8',
                        fontWeight: doctorViewFilter === filter.key ? '800' : '600',
                        fontSize: '13px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        boxShadow: doctorViewFilter === filter.key ? '0 4px 14px rgba(49,46,129,0.4)' : 'none'
                      }}>
                      <span>{filter.icon}</span> {filter.label}
                    </button>
                  ))}
                </>
              )}

              {/* Lab Navigation */}
              {currentUser.role === 'lab' && (
                <div style={{ color: '#38bdf8', padding: '10px', fontSize: '13px', fontWeight: '700' }}>
                  🧪 Diagnostic Orders ({labOrders.length})
                </div>
              )}

              {/* Pharmacy Navigation */}
              {currentUser.role === 'pharmacy' && (
                <div style={{ color: '#10b981', padding: '10px', fontSize: '13px', fontWeight: '700' }}>
                  💊 Active Prescriptions ({prescriptions.length})
                </div>
              )}

              {/* Ward Navigation */}
              {currentUser.role === 'ward' && (
                <div style={{ color: '#c084fc', padding: '10px', fontSize: '13px', fontWeight: '700' }}>
                  🛏️ Ward Admissions ({admissionsList.length})
                </div>
              )}

              {/* O/P Desk Navigation */}
              {currentUser.role === 'op-desk' && (
                <div style={{ color: '#fbbf24', padding: '10px', fontSize: '13px', fontWeight: '700' }}>
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
                        backgroundColor: adminActiveTab === tab.key ? '#881337' : 'transparent',
                        color: adminActiveTab === tab.key ? '#ffffff' : '#94a3b8',
                        fontWeight: adminActiveTab === tab.key ? '800' : '600',
                        fontSize: '12px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        boxShadow: adminActiveTab === tab.key ? '0 4px 14px rgba(136,19,55,0.4)' : 'none'
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
                  fontWeight: '800',
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
              borderBottom: '1px solid #cbd5e1',
              padding: '16px 36px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
            }}>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase' }}>Hospital Operational Console</span>
                <div style={{ fontSize: '16px', fontWeight: '800', color: roleTheme.accent }}>
                  {roleTheme.name}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span style={{ fontSize: '12px', color: '#64748b', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', padding: '6px 14px', borderRadius: '9999px', fontWeight: '700' }}>
                  🕒 {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
                <span style={{ fontSize: '12px', color: '#047857', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', padding: '6px 14px', borderRadius: '9999px', fontWeight: '800' }}>
                  ● 100% Free Public Care
                </span>
              </div>
            </div>

            {/* Viewport Content */}
            <main style={{ flex: 1, padding: '32px 36px', display: 'flex', justifyContent: 'center' }}>
              
              {/* 2.1 PATIENT VIEWPORT */}
              {currentUser.role === 'patient' && (
                <div style={{ width: '100%', maxWidth: '920px' }}>
                  
                  {/* Header Card with Patient Photo Avatar or Initials */}
                  <div className="royal-card animate-fade-in" style={{ padding: '24px 30px', marginBottom: '24px', borderLeft: `6px solid ${roleTheme.accent}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ position: 'relative' }}>
                          {renderPatientAvatar(currentUser.data, 64, '3px solid #1e3a8a')}
                          <button
                            onClick={() => setPatientTab('settings')}
                            style={{
                              position: 'absolute',
                              bottom: '-4px',
                              right: '-4px',
                              backgroundColor: '#1e3a8a',
                              color: 'white',
                              border: '2px solid white',
                              borderRadius: '50%',
                              width: '24px',
                              height: '24px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '12px'
                            }}>
                            📷
                          </button>
                        </div>

                        <div>
                          <span style={{ fontSize: '11px', fontWeight: '800', color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Patient Health Record (EHR)</span>
                          <h2 style={{ margin: '2px 0 2px 0', fontSize: '22px', fontWeight: '800', color: '#070e1e' }}>{currentUser.data.name}</h2>
                          <span style={{ fontSize: '13px', color: '#64748b' }}>Patient ID: <strong>{currentUser.data.patientId}</strong> | Mobile: +91 {currentUser.data.phoneNumber}</span>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <button
                          onClick={() => setPatientTab('settings')}
                          style={{
                            padding: '6px 14px',
                            backgroundColor: '#eff6ff',
                            color: '#1d4ed8',
                            border: '1px solid #bfdbfe',
                            borderRadius: '9999px',
                            fontSize: '12px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}>
                          <span>⚙️</span> Edit Profile
                        </button>
                        <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginTop: '6px' }}>Reg: {formatDateTime(currentUser.data.createdAt)}</span>
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
                            <div style={{ fontSize: '12px', color: '#0369a1' }}>
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

                      {/* Doctor & Location Info with Doctor Photo */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                        <div className="royal-card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <img
                            src={activeDoctorPhoto}
                            alt={activeDoctorName}
                            style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #1e3a8a' }}
                          />
                          <div>
                            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase' }}>Assigned Physician</div>
                            <div style={{ fontSize: '16px', fontWeight: '800', color: '#070e1e', marginTop: '2px' }}>{activeDoctorName}</div>
                            <div style={{ fontSize: '12px', color: '#1d4ed8', fontWeight: '700' }}>Department: {activeDoctorDept}</div>
                          </div>
                        </div>

                        <div className="royal-card" style={{ padding: '20px' }}>
                          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase' }}>Physical Room Location</div>
                          <div style={{ fontSize: '17px', fontWeight: '800', color: '#b45309', marginTop: '4px' }}>📍 {activeDoctorLocation.room}</div>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{activeDoctorLocation.block}</div>
                        </div>
                      </div>

                      {/* Chronological Journey Timeline */}
                      <div className="royal-card" style={{ padding: '26px' }}>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '800', color: '#070e1e' }}>
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
                                  <strong style={{ fontSize: '14px', color: '#070e1e' }}>{item.stage}</strong>
                                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    {item.photoProof && (
                                      <span style={{ fontSize: '11px', backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '2px 8px', borderRadius: '9999px', fontWeight: '800' }}>
                                        📸 Photo Proof
                                      </span>
                                    )}
                                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#1d4ed8', backgroundColor: '#eff6ff', padding: '2px 10px', borderRadius: '9999px' }}>
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
                      <h3 style={{ margin: '0 0 16px 0', color: '#070e1e', fontSize: '17px' }}>Diagnostic Laboratory Reports</h3>
                      {patientFullFile?.labRequests?.map(lab => (
                        <div
                          key={lab._id}
                          onClick={() => setSelectedDetailItem({
                            stage: `Diagnostic Lab: ${lab.testName}`,
                            icon: '🔬',
                            timestamp: lab.updatedAt || lab.createdAt,
                            performedBy: `Lab Attendant (Ordered by ${lab.doctorName})`,
                            doctorName: lab.doctorName,
                            details: `Diagnostic test ${lab.testName} (Status: ${lab.status})`,
                            clinicalFindings: lab.findings || 'Findings recorded and signed digitally.',
                            deliveryMode: lab.deliveryMode || 'DIGITAL_EHR',
                            photoProof: lab.photoProof
                          })}
                          className="royal-card royal-card-interactive"
                          style={{ padding: '20px', marginBottom: '14px', cursor: 'pointer' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <strong style={{ fontSize: '15px' }}>{lab.testName}</strong>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              {lab.photoProof && (
                                <span style={{ fontSize: '11px', backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '2px 8px', borderRadius: '9999px', fontWeight: '800' }}>
                                  📸 Photo Proof
                                </span>
                              )}
                              <span style={{ padding: '4px 12px', borderRadius: '9999px', fontSize: '11px', fontWeight: '800', backgroundColor: lab.status === 'REPORT_READY' ? '#ecfdf5' : '#fffbeb', color: lab.status === 'REPORT_READY' ? '#047857' : '#b45309' }}>
                                {lab.status === 'REPORT_READY' ? '✅ Report Ready' : '⏳ Processing'}
                              </span>
                            </div>
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>Ordered by {lab.doctorName} • {formatDateTime(lab.createdAt)}</div>
                          {lab.findings && (
                            <div style={{ marginTop: '10px', padding: '12px 16px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '13px' }}>
                              <strong>Findings:</strong> {lab.findings}
                            </div>
                          )}
                          {lab.photoProof && (
                            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <img src={lab.photoProof} alt="Proof" style={{ height: '54px', borderRadius: '8px' }} />
                              <span style={{ fontSize: '11px', color: '#047857', fontWeight: '800' }}>✓ Verified diagnostic film attached (Click to expand)</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* MEDICINES TAB */}
                  {patientTab === 'medicines' && (
                    <div className="animate-fade-in">
                      <h3 style={{ margin: '0 0 16px 0', color: '#070e1e', fontSize: '17px' }}>Prescribed Medications</h3>
                      {patientFullFile?.prescriptions?.map(rx => (
                        <div
                          key={rx._id}
                          onClick={() => setSelectedDetailItem({
                            stage: `Pharmacy Prescription`,
                            icon: '💊',
                            timestamp: rx.updatedAt || rx.createdAt,
                            performedBy: `Chief Pharmacist (Authorized by ${rx.doctorName})`,
                            doctorName: rx.doctorName,
                            details: rx.notes || `Prescription with ${rx.medicines?.length || 0} medicines.`,
                            prescribedMedicines: rx.medicines,
                            photoProof: rx.photoProof,
                            dispenseStatus: rx.status
                          })}
                          className="royal-card royal-card-interactive"
                          style={{ padding: '20px', marginBottom: '14px', cursor: 'pointer' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <strong style={{ fontSize: '14px' }}>Prescription by {rx.doctorName}</strong>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              {rx.photoProof && (
                                <span style={{ fontSize: '11px', backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '2px 8px', borderRadius: '9999px', fontWeight: '800' }}>
                                  📸 Handover Proof
                                </span>
                              )}
                              <span style={{ padding: '4px 12px', borderRadius: '9999px', fontSize: '11px', fontWeight: '800', backgroundColor: rx.status === 'COMPLETELY_DISPENSED' || rx.status === 'DISPENSED' ? '#ecfdf5' : '#fffbeb', color: rx.status === 'COMPLETELY_DISPENSED' || rx.status === 'DISPENSED' ? '#047857' : '#b45309' }}>
                                {rx.status}
                              </span>
                            </div>
                          </div>
                          <ul style={{ margin: '0 0 10px 0', paddingLeft: '20px', fontSize: '13px' }}>
                            {rx.medicines?.map((m, i) => <li key={i}>{m.name} - {m.dosage} ({m.durationDays} days)</li>)}
                          </ul>
                          {rx.photoProof && (
                            <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <img src={rx.photoProof} alt="Proof" style={{ height: '50px', borderRadius: '8px' }} />
                              <span style={{ fontSize: '11px', color: '#047857', fontWeight: '800' }}>✓ Verified medicines dispensing photo attached</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ADMISSIONS TAB */}
                  {patientTab === 'admissions' && (
                    <div className="animate-fade-in">
                      <h3 style={{ margin: '0 0 16px 0', color: '#070e1e', fontSize: '17px' }}>Inpatient Ward & Bed Ledger</h3>
                      {patientFullFile?.admission ? (
                        <div
                          onClick={() => setSelectedDetailItem({
                            stage: `Inpatient Ward Admission`,
                            icon: '🛏️',
                            timestamp: patientFullFile.admission.admittedAt,
                            performedBy: `Ward Staff (Authorized by ${patientFullFile.admission.admittingDoctorName || 'Duty Physician'})`,
                            details: `Admitted to ${patientFullFile.admission.wardType} - Bed ${patientFullFile.admission.bedNumber}`,
                            wardAllocation: {
                              ward: patientFullFile.admission.wardType,
                              bed: patientFullFile.admission.bedNumber,
                              resources: patientFullFile.admission.resourcesAllocated
                            }
                          })}
                          className="royal-card royal-card-interactive"
                          style={{ padding: '22px', cursor: 'pointer' }}>
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

                  {/* GRIEVANCE TAB */}
                  {patientTab === 'grievance' && (
                    <div className="animate-fade-in">
                      <div className="royal-card" style={{ backgroundColor: '#fff1f2', border: '1px solid #fecdd3', padding: '20px 24px', marginBottom: '22px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '24px' }}>🚨</span>
                          <div>
                            <h3 style={{ margin: '0 0 2px 0', color: '#9f1239', fontSize: '16px', fontWeight: '800' }}>
                              Hospital Anti-Corruption & Vigilance Cell
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
                          <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '16px', border: '1px solid #cbd5e1', marginBottom: '16px' }}>
                            <span style={{ fontSize: '12px', fontWeight: '800', color: '#070e1e', display: 'block', marginBottom: '8px' }}>
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
                                      <button type="button" onClick={snapGrievancePhoto} style={{ padding: '8px 18px', backgroundColor: '#1d4ed8', color: 'white', border: 'none', borderRadius: '9999px', fontWeight: '700', cursor: 'pointer', fontSize: '12px' }}>
                                        📸 Snap Photo
                                      </button>
                                      <button type="button" onClick={startGrievanceVideoRecording} style={{ padding: '8px 18px', backgroundColor: '#be123c', color: 'white', border: 'none', borderRadius: '9999px', fontWeight: '700', cursor: 'pointer', fontSize: '12px' }}>
                                        🎥 Record Video
                                      </button>
                                      <button type="button" onClick={stopGrievanceCamera} style={{ padding: '8px 14px', backgroundColor: '#64748b', color: 'white', border: 'none', borderRadius: '9999px', cursor: 'pointer', fontSize: '12px' }}>
                                        Cancel
                                      </button>
                                    </>
                                  ) : (
                                    <button type="button" onClick={stopGrievanceVideoRecording} style={{ padding: '8px 22px', backgroundColor: '#047857', color: 'white', border: 'none', borderRadius: '9999px', fontWeight: '700', cursor: 'pointer', fontSize: '13px' }}>
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
                                    <strong style={{ fontSize: '13px', color: '#047857' }}>
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

                          <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#be123c', color: 'white', border: 'none', borderRadius: '9999px', fontSize: '14px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 4px 16px rgba(190,18,60,0.3)' }}>
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
                                    <h4 style={{ margin: '2px 0 0 0', color: '#070e1e', fontSize: '15px' }}>{grv.category}</h4>
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'white', padding: '4px 12px', borderRadius: '9999px', border: `1px solid ${isGreen ? '#a7f3d0' : isOrange ? '#fde68a' : '#fecdd3'}` }}>
                                    <span>{isGreen ? '🟢' : isOrange ? '🟠' : '🔴'}</span>
                                    <strong style={{ fontSize: '11px', color: isGreen ? '#047857' : isOrange ? '#b45309' : '#be123c' }}>
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
                                      <strong style={{ fontSize: '12px', color: '#047857' }}>💬 Superintendent Response:</strong>
                                      <span style={{ fontSize: '11px', color: '#1d4ed8' }}>🕒 {formatDateTime(grv.adminRepliedAt)}</span>
                                    </div>
                                    <p style={{ margin: '2px 0 6px 0', fontSize: '13px', color: '#070e1e' }}>"{grv.adminReply}"</p>
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
                                          <button onClick={() => handlePatientConfirmResolution(grv.grievanceId, true)} style={{ padding: '6px 14px', backgroundColor: '#047857', color: 'white', border: 'none', borderRadius: '9999px', fontWeight: '700', fontSize: '11px', cursor: 'pointer' }}>
                                            ✅ Yes, Issue Fixed (Turn Green 🟢)
                                          </button>
                                          <button onClick={() => handlePatientConfirmResolution(grv.grievanceId, false)} style={{ padding: '6px 14px', backgroundColor: '#be123c', color: 'white', border: 'none', borderRadius: '9999px', fontWeight: '700', fontSize: '11px', cursor: 'pointer' }}>
                                            ❌ No, Still Pending (Stay Orange 🟠)
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#ecfdf5', padding: '8px 12px', borderRadius: '10px', border: '1px solid #a7f3d0', marginTop: '10px' }}>
                                        <span style={{ fontSize: '14px' }}>🟢</span>
                                        <strong style={{ fontSize: '11px', color: '#047857' }}>
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

                  {/* TAB 6: ⚙️ MY PROFILE & ACCOUNT SETTINGS */}
                  {patientTab === 'settings' && (
                    <div className="animate-fade-in">
                      <div className="royal-card" style={{ padding: '32px', marginBottom: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px', marginBottom: '24px' }}>
                          <div>
                            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#070e1e' }}>
                              ⚙️ My Profile & Account Settings
                            </h3>
                            <span style={{ fontSize: '13px', color: '#64748b' }}>
                              Update your live profile photo, WhatsApp phone number, and login PIN. Syncs across the entire hospital network!
                            </span>
                          </div>
                        </div>

                        {profileUpdateMsg && (
                          <div style={{ marginBottom: '20px', padding: '12px 16px', backgroundColor: '#ecfdf5', color: '#065f46', borderRadius: '12px', border: '1px solid #a7f3d0', fontWeight: '700', fontSize: '13px' }}>
                            {profileUpdateMsg}
                          </div>
                        )}

                        <form onSubmit={handlePatientUpdateProfile}>
                          
                          {/* Profile Photo Customizer */}
                          <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '18px', border: '1px solid #cbd5e1', marginBottom: '24px' }}>
                            <label style={{ fontSize: '13px', fontWeight: '800', color: '#070e1e', display: 'block', marginBottom: '10px' }}>
                              📸 Profile Photo:
                            </label>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
                              {renderPatientAvatar(patientEditForm, 76, '3px solid #1e3a8a')}

                              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                <button
                                  type="button"
                                  onClick={() => openCameraModal(
                                    '📸 Capture Live Profile Photo',
                                    'profile',
                                    currentUser.data.patientId,
                                    (photo) => setPatientEditForm({ ...patientEditForm, photoUrl: photo })
                                  )}
                                  style={{
                                    padding: '10px 18px',
                                    backgroundColor: '#1e3a8a',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '9999px',
                                    fontSize: '13px',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                  }}>
                                  <span>📷</span> Take Live Camera Photo
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setShowAvatarPickerModal(true)}
                                  style={{
                                    padding: '10px 18px',
                                    backgroundColor: '#ffffff',
                                    color: '#070e1e',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '9999px',
                                    fontSize: '13px',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                  }}>
                                  <span>🎭</span> Choose Preset Avatar
                                </button>

                                {patientEditForm.photoUrl && (
                                  <button
                                    type="button"
                                    onClick={() => setPatientEditForm({ ...patientEditForm, photoUrl: '' })}
                                    style={{
                                      padding: '10px 14px',
                                      backgroundColor: '#fee2e2',
                                      color: '#991b1b',
                                      border: '1px solid #fecaca',
                                      borderRadius: '9999px',
                                      fontSize: '12px',
                                      fontWeight: '700',
                                      cursor: 'pointer'
                                    }}>
                                    Remove Photo (Use Initials)
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Personal & Account Credentials */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                            <div>
                              <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>
                                Patient Full Name:
                              </label>
                              <input
                                required
                                type="text"
                                style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                                value={patientEditForm.name}
                                onChange={e => setPatientEditForm({ ...patientEditForm, name: e.target.value })}
                              />
                            </div>

                            <div>
                              <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>
                                WhatsApp Mobile Number (10 Digits):
                              </label>
                              <input
                                required
                                type="tel"
                                style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                                value={patientEditForm.phoneNumber}
                                onChange={e => setPatientEditForm({ ...patientEditForm, phoneNumber: e.target.value })}
                              />
                              <span style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', display: 'block' }}>All hospital notifications are sent here.</span>
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                            <div>
                              <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>
                                Login PIN / Passcode:
                              </label>
                              <input
                                required
                                type="text"
                                style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                                value={patientEditForm.password}
                                onChange={e => setPatientEditForm({ ...patientEditForm, password: e.target.value })}
                              />
                            </div>

                            <div style={{ display: 'flex', gap: '10px' }}>
                              <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>
                                  Age:
                                </label>
                                <input
                                  type="number"
                                  style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                                  value={patientEditForm.age}
                                  onChange={e => setPatientEditForm({ ...patientEditForm, age: e.target.value })}
                                />
                              </div>
                              <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>
                                  Gender:
                                </label>
                                <select
                                  style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: 'white', boxSizing: 'border-box' }}
                                  value={patientEditForm.gender}
                                  onChange={e => setPatientEditForm({ ...patientEditForm, gender: e.target.value })}>
                                  <option>Male</option>
                                  <option>Female</option>
                                  <option>Other</option>
                                </select>
                              </div>
                            </div>
                          </div>

                          <button
                            type="submit"
                            style={{
                              width: '100%',
                              padding: '14px',
                              background: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 100%)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '9999px',
                              fontSize: '14px',
                              fontWeight: '800',
                              cursor: 'pointer',
                              boxShadow: '0 6px 20px rgba(30,58,138,0.3)'
                            }}>
                            💾 Save Account Changes & Sync Everywhere ➔
                          </button>
                        </form>
                      </div>
                    </div>
                  )}

                </div>
              )}

              {/* 2.2 DOCTOR VIEWPORT */}
              {currentUser.role === 'doctor' && (
                <div style={{ width: '100%', maxWidth: '1040px' }} className="animate-fade-in">
                  
                  {/* Doctor Profile Card with Photo */}
                  <div className="royal-card" style={{ padding: '22px 28px', marginBottom: '20px', borderLeft: '6px solid #4338ca', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <img
                        src={currentUser.data?.photoUrl || activeDoctorPhoto}
                        alt={currentUser.data.name}
                        style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #4338ca' }}
                      />
                      <div>
                        <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>Physician On Duty</span>
                        <h2 style={{ margin: '2px 0 0 0', color: '#070e1e', fontSize: '20px', fontWeight: '800' }}>{currentUser.data.name}</h2>
                        <span style={{ fontSize: '13px', color: '#4338ca', fontWeight: '700' }}>
                          {currentUser.data.department} • 📍 {DEPARTMENT_LOCATIONS[currentUser.data.department]?.room} ({DEPARTMENT_LOCATIONS[currentUser.data.department]?.block})
                        </span>
                      </div>
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
                    
                    {/* Patient Queue with Real Patient Photos / Badges */}
                    <div className="royal-card" style={{ padding: '24px' }}>
                      <h3 style={{ margin: '0 0 14px 0', fontSize: '15px', fontWeight: '800' }}>
                        {doctorViewFilter === 'waiting' && `⏳ Patients in Waiting Queue (${displayedDoctorPatients.length})`}
                        {doctorViewFilter === 'all' && `📋 All Patients Assigned (${displayedDoctorPatients.length})`}
                        {doctorViewFilter === 'date-wise' && `📅 Patients on ${selectedDateFilter} (${displayedDoctorPatients.length})`}
                      </h3>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '560px', overflowY: 'auto' }}>
                        {displayedDoctorPatients.map((p, i) => (
                          <div key={p.patientId} onClick={() => inspectPatientTimeline(p)} className="royal-card royal-card-interactive" style={{ border: activePatientForExam?.patientId === p.patientId ? '2px solid #4338ca' : '1px solid #cbd5e1', padding: '12px 14px', backgroundColor: activePatientForExam?.patientId === p.patientId ? '#eef2ff' : '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              {renderPatientAvatar(p, 36, '1px solid #cbd5e1')}
                              <div>
                                <strong style={{ fontSize: '14px' }}>#{i + 1} {p.name}</strong>
                                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{p.patientId} • {p.age}y {p.gender}</div>
                              </div>
                            </div>
                            <span style={{ padding: '3px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: '700', backgroundColor: '#eef2ff', color: '#4338ca' }}>
                              {p.currentStatus.replace(/_/g, ' ')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Examination Desk */}
                    {/* Examination Desk & Complete Medical History */}
                    {activePatientForExam && (
                      <div className="royal-card" style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #cbd5e1', paddingBottom: '12px', marginBottom: '14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {renderPatientAvatar(activePatientForExam, 48, '2px solid #4338ca')}
                            <div>
                              <span style={{ fontSize: '11px', color: '#4338ca', fontWeight: '800', textTransform: 'uppercase' }}>Active Examination File</span>
                              <h3 style={{ margin: '2px 0 0 0', fontSize: '17px', fontWeight: '800' }}>{activePatientForExam.name}</h3>
                              <span style={{ fontSize: '12px', color: '#64748b' }}>{activePatientForExam.patientId} • {activePatientForExam.age}y {activePatientForExam.gender} • Mobile: +91 {activePatientForExam.phoneNumber}</span>
                            </div>
                          </div>
                          <button onClick={() => { setActivePatientForExam(null); setInspectedPatientFullFile(null); }} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer' }}>✕</button>
                        </div>

                        {doctorMessage && (
                          <div style={{ marginBottom: '14px', padding: '10px 14px', backgroundColor: '#ecfdf5', color: '#065f46', borderRadius: '10px', border: '1px solid #a7f3d0', fontSize: '12px', fontWeight: '700' }}>
                            {doctorMessage}
                          </div>
                        )}

                        {/* Complete Journey Timeline & Previous History */}
                        <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '14px', border: '1px solid #cbd5e1', marginBottom: '18px', maxHeight: '240px', overflowY: 'auto' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <strong style={{ fontSize: '13px', color: '#070e1e' }}>
                              🕒 Complete Journey & Previous Medical History:
                            </strong>
                            <span style={{ fontSize: '11px', color: '#1d4ed8', fontWeight: '700' }}>Click milestone for details</span>
                          </div>

                          {!inspectedPatientFullFile?.timeline || inspectedPatientFullFile.timeline.length === 0 ? (
                            <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>Loading patient history...</p>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {inspectedPatientFullFile.timeline.map((evt, idx) => (
                                <div
                                  key={idx}
                                  onClick={() => setSelectedDetailItem(evt)}
                                  className="royal-card-interactive"
                                  style={{
                                    display: 'flex',
                                    gap: '10px',
                                    fontSize: '12px',
                                    padding: '10px 12px',
                                    borderRadius: '10px',
                                    backgroundColor: 'white',
                                    border: '1px solid #cbd5e1',
                                    cursor: 'pointer',
                                    alignItems: 'flex-start'
                                  }}>
                                  <span style={{ fontSize: '16px' }}>{evt.icon}</span>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <strong style={{ color: '#070e1e' }}>{evt.stage}</strong>
                                      <span style={{ fontSize: '10px', color: '#1d4ed8', fontWeight: '700' }}>🕒 {formatDateTime(evt.timestamp)}</span>
                                    </div>
                                    <p style={{ margin: '2px 0 0 0', color: '#475569', fontSize: '11.5px' }}>{evt.details}</p>
                                    <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '2px' }}>
                                      By: <strong>{evt.performedBy || evt.doctorName}</strong>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Action Tabs */}
                        <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', borderBottom: '1px solid #cbd5e1', paddingBottom: '8px', flexWrap: 'wrap' }}>
                          <button onClick={() => setDoctorActionTab('lab')} style={{ padding: '6px 12px', fontSize: '12px', border: 'none', borderRadius: '9999px', backgroundColor: doctorActionTab === 'lab' ? '#4338ca' : '#f1f5f9', color: doctorActionTab === 'lab' ? 'white' : '#475569', cursor: 'pointer', fontWeight: '700' }}>🧪 Order Lab</button>
                          <button onClick={() => setDoctorActionTab('rx')} style={{ padding: '6px 12px', fontSize: '12px', border: 'none', borderRadius: '9999px', backgroundColor: doctorActionTab === 'rx' ? '#4338ca' : '#f1f5f9', color: doctorActionTab === 'rx' ? 'white' : '#475569', cursor: 'pointer', fontWeight: '700' }}>💊 Prescribe</button>
                          <button onClick={() => setDoctorActionTab('referral')} style={{ padding: '6px 12px', fontSize: '12px', border: 'none', borderRadius: '9999px', backgroundColor: doctorActionTab === 'referral' ? '#4338ca' : '#f1f5f9', color: doctorActionTab === 'referral' ? 'white' : '#475569', cursor: 'pointer', fontWeight: '700' }}>🔄 Transfer/Refer</button>
                          <button onClick={() => setDoctorActionTab('admit')} style={{ padding: '6px 12px', fontSize: '12px', border: 'none', borderRadius: '9999px', backgroundColor: doctorActionTab === 'admit' ? '#4338ca' : '#f1f5f9', color: doctorActionTab === 'admit' ? 'white' : '#475569', cursor: 'pointer', fontWeight: '700' }}>🛏️ Admit Bed</button>
                          <button onClick={() => setDoctorActionTab('discharge')} style={{ padding: '6px 12px', fontSize: '12px', border: 'none', borderRadius: '9999px', backgroundColor: doctorActionTab === 'discharge' ? '#047857' : '#ecfdf5', color: doctorActionTab === 'discharge' ? 'white' : '#065f46', cursor: 'pointer', fontWeight: '800' }}>🏁 Discharge</button>
                        </div>

                        {doctorActionTab === 'lab' && (
                          <form onSubmit={handleDoctorOrderLab}>
                            <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>Select Diagnostic Test:</label>
                            <select style={{ width: '100%', padding: '10px', borderRadius: '12px', border: '1px solid #cbd5e1', marginBottom: '10px', fontSize: '13px' }} value={selectedTest} onChange={e => setSelectedTest(e.target.value)}>
                              <option>Complete Blood Count (CBC)</option>
                              <option>Serum Creatinine & Urea</option>
                              <option>Lipid Profile</option>
                              <option>Chest X-Ray (PA View)</option>
                              <option>Ultrasound Abdomen</option>
                              <option>ECG & 2D Echo (Cardiology)</option>
                              <option>Bone Mineral Density Scan</option>
                            </select>

                            <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>Delivery Channel:</label>
                            <select style={{ width: '100%', padding: '10px', borderRadius: '12px', border: '1px solid #cbd5e1', marginBottom: '12px', fontSize: '13px' }} value={labDeliveryMode} onChange={e => setLabDeliveryMode(e.target.value)}>
                              <option value="DIGITAL_EHR">⚡ Instant Digital Report to Patient EHR (Zero Bribery)</option>
                              <option value="PHYSICAL_COUNTER">📄 Physical Hard-Copy Report (Room 105 Counter #1)</option>
                              <option value="BOTH">📱 Digital EHR + Physical Hard-Copy</option>
                            </select>

                            <button type="submit" style={{ width: '100%', padding: '10px', backgroundColor: '#0369a1', color: 'white', border: 'none', borderRadius: '9999px', fontWeight: '800', cursor: 'pointer', fontSize: '13px' }}>
                              Order Diagnostic Test ➔
                            </button>
                          </form>
                        )}

                        {doctorActionTab === 'rx' && (
                          <form onSubmit={handleDoctorPrescribe}>
                            <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>Prescribed Medicines (Comma separated):</label>
                            <input type="text" style={{ width: '100%', padding: '10px', borderRadius: '12px', border: '1px solid #cbd5e1', marginBottom: '10px', fontSize: '13px' }} value={rxMedicines} onChange={e => setRxMedicines(e.target.value)} />
                            <button type="submit" style={{ width: '100%', padding: '10px', backgroundColor: '#047857', color: 'white', border: 'none', borderRadius: '9999px', fontWeight: '800', cursor: 'pointer', fontSize: '13px' }}>
                              Send Prescription to Pharmacy ➔
                            </button>
                          </form>
                        )}

                        {doctorActionTab === 'referral' && (
                          <form onSubmit={handleDoctorReferral}>
                            <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>Transfer to Super-Specialty:</label>
                            <select style={{ width: '100%', padding: '10px', borderRadius: '12px', border: '1px solid #cbd5e1', marginBottom: '10px', fontSize: '13px' }} value={referralDept} onChange={e => setReferralDept(e.target.value)}>
                              <option value="Cardiology">Cardiology (Specialty Wing C - Room 201)</option>
                              <option value="Orthopedics">Orthopedics (Trauma Wing - Room 204)</option>
                              <option value="Pulmonology">Pulmonology (Chest Clinic - Room 302)</option>
                              <option value="Nephrology">Nephrology (Dialysis Unit - Room 401)</option>
                              <option value="General Surgery">General Surgery (Surgical Block - Room 108)</option>
                            </select>

                            <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>Reason for Referral:</label>
                            <input type="text" style={{ width: '100%', padding: '10px', borderRadius: '12px', border: '1px solid #cbd5e1', marginBottom: '12px', boxSizing: 'border-box' }} value={referralReason} onChange={e => setReferralReason(e.target.value)} />

                            <button type="submit" style={{ width: '100%', padding: '10px', backgroundColor: '#b45309', color: 'white', border: 'none', borderRadius: '9999px', fontWeight: '800', cursor: 'pointer', fontSize: '13px' }}>
                              Auto-Assign to Specialist (Shortest Queue) ➔
                            </button>
                          </form>
                        )}

                        {doctorActionTab === 'admit' && (
                          <form onSubmit={handleDoctorAdmit}>
                            <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>Ward Selection:</label>
                            <select style={{ width: '100%', padding: '10px', borderRadius: '12px', border: '1px solid #cbd5e1', marginBottom: '12px', fontSize: '13px' }} value={admitWard} onChange={e => setAdmitWard(e.target.value)}>
                              <option>General Ward (Male)</option>
                              <option>General Ward (Female)</option>
                              <option>Emergency ICU</option>
                              <option>Post-Operative Ward</option>
                            </select>
                            <button type="submit" style={{ width: '100%', padding: '10px', backgroundColor: '#6d28d9', color: 'white', border: 'none', borderRadius: '9999px', fontWeight: '800', cursor: 'pointer', fontSize: '13px' }}>
                              Admit Patient to Inpatient Bed ➔
                            </button>
                          </form>
                        )}

                        {doctorActionTab === 'discharge' && (
                          <form onSubmit={handleDoctorDischargeSubmit}>
                            <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>Discharge Clinical Summary:</label>
                            <textarea rows={3} style={{ width: '100%', padding: '10px', borderRadius: '12px', border: '1px solid #cbd5e1', marginBottom: '10px', fontSize: '13px', boxSizing: 'border-box' }} value={dischargeSummaryText} onChange={e => setDischargeSummaryText(e.target.value)} />
                            <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#047857', color: 'white', border: 'none', borderRadius: '9999px', fontWeight: '800', cursor: 'pointer', fontSize: '13px' }}>
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
                  <div className="royal-card" style={{ padding: '24px', borderLeft: '6px solid #0369a1', marginBottom: '20px' }}>
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
                          <span style={{ padding: '3px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: '700', backgroundColor: order.status === 'REPORT_READY' ? '#ecfdf5' : '#fffbeb', color: order.status === 'REPORT_READY' ? '#047857' : '#b45309' }}>
                            {order.status}
                          </span>
                        </div>

                        {order.status === 'PENDING' && (
                          <button onClick={() => openCameraModal(`📸 Sample Tube Proof (${order.testName})`, 'lab', order._id, (p) => executeLabCollectWithPhoto(order._id, p))} style={{ padding: '8px 18px', backgroundColor: '#0369a1', color: 'white', border: 'none', borderRadius: '9999px', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>
                            <span>📷</span> Collect Sample with Camera Proof
                          </button>
                        )}

                        {order.status === 'SAMPLE_COLLECTED' && (
                          <div>
                            <input type="text" placeholder="Enter findings e.g. Hb 13.8 g/dL" style={{ width: '100%', padding: '10px', borderRadius: '12px', border: '1px solid #cbd5e1', marginBottom: '8px' }} onChange={e => setLabFindingsInput({...labFindingsInput, [order._id]: e.target.value})} />
                            <button onClick={() => openCameraModal(`📸 Diagnostic Sheet Proof (${order.testName})`, 'lab', order._id, (p) => executeLabPublishWithPhoto(order._id, p))} style={{ padding: '8px 18px', backgroundColor: '#047857', color: 'white', border: 'none', borderRadius: '9999px', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>
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
                  <div className="royal-card" style={{ padding: '24px', borderLeft: '6px solid #047857', marginBottom: '20px' }}>
                    <h2 style={{ margin: '0 0 4px 0', fontSize: '20px' }}>💊 Pharmacy Dispensing Counter</h2>
                    <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>Dispense prescribed medications with mandatory live camera handover evidence.</p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {prescriptions.map(rx => (
                      <div key={rx._id} className="royal-card" style={{ padding: '18px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <strong style={{ fontSize: '14px' }}>Patient: {rx.patientId} (Dr: {rx.doctorName})</strong>
                          <span style={{ padding: '3px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: '700', backgroundColor: rx.status === 'COMPLETELY_DISPENSED' || rx.status === 'DISPENSED' ? '#ecfdf5' : '#fffbeb', color: rx.status === 'COMPLETELY_DISPENSED' || rx.status === 'DISPENSED' ? '#047857' : '#b45309' }}>
                            {rx.status}
                          </span>
                        </div>
                        <ul style={{ margin: '0 0 10px 0', paddingLeft: '20px', fontSize: '13px' }}>
                          {rx.medicines.map((m, i) => <li key={i}>{m.name} - {m.dosage}</li>)}
                        </ul>

                        {rx.status !== 'COMPLETELY_DISPENSED' && rx.status !== 'DISPENSED' && (
                          <button onClick={() => openCameraModal(`📸 Dispensing Proof (${rx.patientId})`, 'pharmacy', rx._id, (p) => executeDispenseWithPhoto(rx._id, p))} style={{ padding: '8px 18px', backgroundColor: '#047857', color: 'white', border: 'none', borderRadius: '9999px', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>
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
                  <div className="royal-card" style={{ padding: '24px', borderLeft: '6px solid #6d28d9', marginBottom: '20px' }}>
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
                            <button onClick={() => handleDischarge(adm._id)} style={{ padding: '6px 14px', backgroundColor: '#047857', color: 'white', border: 'none', borderRadius: '9999px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                              🏁 Discharge Bed
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 2.6 O/P DESK VIEWPORT WITH DIRECT PHOTO CAPTURE */}
              {currentUser.role === 'op-desk' && (
                <div style={{ width: '100%', maxWidth: '640px' }} className="animate-fade-in">
                  <div className="royal-card" style={{ padding: '32px', borderLeft: '6px solid #b45309' }}>
                    <h2 style={{ margin: '0 0 4px 0', fontSize: '20px' }}>🎫 O/P Registration Desk</h2>
                    <p style={{ margin: '0 0 20px 0', color: '#64748b', fontSize: '13px' }}>Create new outpatient record with optional live photo snapshot.</p>

                    {opTicket && (
                      <div style={{ marginBottom: '24px', padding: '20px', backgroundColor: '#ecfdf5', borderRadius: '18px', border: '1.5px solid #6ee7b7', boxShadow: '0 8px 24px rgba(16, 185, 129, 0.15)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {renderPatientAvatar(opTicket.patient, 46, '2px solid #047857')}
                            <div>
                              <span style={{ fontSize: '11px', color: '#047857', fontWeight: '800', textTransform: 'uppercase' }}>✅ Patient Registered Successfully</span>
                              <h3 style={{ margin: '2px 0 0 0', fontSize: '18px', color: '#065f46', fontWeight: '800' }}>{opTicket.patient?.name}</h3>
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <span style={{ padding: '4px 12px', backgroundColor: '#a7f3d0', color: '#065f46', borderRadius: '9999px', fontSize: '12px', fontWeight: '800' }}>
                              Room 102
                            </span>
                          </div>
                        </div>

                        {/* Credentials Display Box */}
                        <div style={{ backgroundColor: '#ffffff', padding: '14px', borderRadius: '14px', border: '1px solid #a7f3d0', marginBottom: '14px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <div>
                              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700' }}>Patient ID:</span>
                              <div style={{ fontSize: '16px', fontWeight: '800', color: '#1e3a8a' }}>{opTicket.credentials?.patientId}</div>
                            </div>
                            <div>
                              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700' }}>Login Passcode PIN:</span>
                              <div style={{ fontSize: '16px', fontWeight: '800', color: '#047857' }}>{opTicket.credentials?.password}</div>
                            </div>
                          </div>
                          <div style={{ fontSize: '12px', color: '#475569', marginTop: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '6px' }}>
                            👨‍⚕️ Assigned Doctor: <strong>{opTicket.assignedTo?.doctorName}</strong> (Queue Position: #{opTicket.assignedTo?.currentQueue})
                          </div>
                        </div>

                        {/* WhatsApp Action Buttons */}
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            onClick={() => {
                              const text = `🏥 *Chikitsya Setu O/P Registration*\nHello *${opTicket.patient?.name}*,\nYour digital OPD token has been generated.\n\n🆔 *Patient ID:* ${opTicket.credentials?.patientId}\n🔑 *Login Passcode PIN:* ${opTicket.credentials?.password}\n👨‍⚕️ *Assigned Physician:* ${opTicket.assignedTo?.doctorName} (Room 102)\n\n👉 Track your live queue & digital reports: http://localhost:5173`;
                              window.open(`https://api.whatsapp.com/send?phone=91${opTicket.patient?.phoneNumber}&text=${encodeURIComponent(text)}`, '_blank');
                            }}
                            style={{
                              flex: 1,
                              padding: '10px 16px',
                              backgroundColor: '#25D366',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '9999px',
                              fontSize: '12.5px',
                              fontWeight: '800',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              boxShadow: '0 4px 12px rgba(37, 211, 102, 0.3)'
                            }}>
                            <span>📲</span> Send to WhatsApp (+91 {opTicket.patient?.phoneNumber})
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const text = `🏥 *Chikitsya Setu O/P Registration*\nHello *${opTicket.patient?.name}*,\nYour digital OPD token has been generated.\n\n🆔 *Patient ID:* ${opTicket.credentials?.patientId}\n🔑 *Login Passcode PIN:* ${opTicket.credentials?.password}\n👨‍⚕️ *Assigned Physician:* ${opTicket.assignedTo?.doctorName} (Room 102)\n\n👉 Track your live queue & digital reports: http://localhost:5173`;
                              navigator.clipboard.writeText(text);
                              alert('✅ WhatsApp message copied to clipboard!');
                            }}
                            style={{
                              padding: '10px 16px',
                              backgroundColor: '#ffffff',
                              color: '#065f46',
                              border: '1px solid #a7f3d0',
                              borderRadius: '9999px',
                              fontSize: '12px',
                              fontWeight: '700',
                              cursor: 'pointer'
                            }}>
                            📋 Copy Message
                          </button>
                        </div>
                      </div>
                    )}

                    <form onSubmit={handleOpRegister}>
                      <div style={{ marginBottom: '14px' }}>
                        <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>Patient Full Name</label>
                        <input required type="text" placeholder="e.g. Rahul Sharma" style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} value={opForm.name} onChange={e => setOpForm({...opForm, name: e.target.value})} />
                      </div>

                      <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
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

                      <div style={{ marginBottom: '14px' }}>
                        <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>WhatsApp Mobile Number</label>
                        <input required type="tel" placeholder="e.g. 9876543210" style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} value={opForm.phoneNumber} onChange={e => setOpForm({...opForm, phoneNumber: e.target.value})} />
                      </div>

                      {/* Photo Capture at Registration */}
                      <div style={{ backgroundColor: '#f8fafc', padding: '14px', borderRadius: '14px', border: '1px solid #cbd5e1', marginBottom: '18px' }}>
                        <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                          📸 Patient Photo Snapshot (Optional):
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {renderPatientAvatar(opForm, 48, '2px solid #b45309')}
                          <button
                            type="button"
                            onClick={() => openCameraModal(
                              '📸 Patient Registration Photo',
                              'op-register',
                              'NEW_PATIENT',
                              (photo) => setOpForm({ ...opForm, photoUrl: photo })
                            )}
                            style={{
                              padding: '8px 14px',
                              backgroundColor: '#070e1e',
                              color: 'white',
                              border: 'none',
                              borderRadius: '9999px',
                              fontSize: '12px',
                              fontWeight: '700',
                              cursor: 'pointer'
                            }}>
                            <span>📷</span> Snap Patient Photo
                          </button>
                          {opForm.photoUrl && (
                            <button
                              type="button"
                              onClick={() => setOpForm({ ...opForm, photoUrl: '' })}
                              style={{
                                padding: '8px 12px',
                                backgroundColor: '#fee2e2',
                                color: '#991b1b',
                                border: '1px solid #fecaca',
                                borderRadius: '9999px',
                                fontSize: '11px',
                                fontWeight: '700',
                                cursor: 'pointer'
                              }}>
                              Remove
                            </button>
                          )}
                        </div>
                      </div>

                      <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#b45309', color: 'white', border: 'none', borderRadius: '9999px', fontSize: '14px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 4px 14px rgba(180,83,9,0.3)' }}>
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
                  <div className="royal-card" style={{ padding: '24px 32px', marginBottom: '24px', borderLeft: '6px solid #be123c', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800' }}>📊 Hospital Administration Console</h2>
                        <span style={{ backgroundColor: '#ecfdf5', color: '#047857', padding: '3px 12px', borderRadius: '9999px', fontSize: '11px', fontWeight: '800', border: '1px solid #a7f3d0' }}>● Live Sync</span>
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
                      <h3 style={{ margin: '0 0 14px 0', fontSize: '16px' }}>👥 Registered Patients ({filteredAdminRegisteredPatients.length})</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {filteredAdminRegisteredPatients.map((p, idx) => (
                          <div key={p.patientId} onClick={() => handleAdminInspectPatient(p.patientId)} className="royal-card royal-card-interactive" style={{ padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              {renderPatientAvatar(p, 40, '1.5px solid #cbd5e1')}
                              <div>
                                <strong>#{idx + 1} {p.name}</strong> ({p.patientId})
                                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Mobile: +91 {p.phoneNumber} • Reg: {formatDateTime(p.createdAt)}</div>
                              </div>
                            </div>
                            <span style={{ fontSize: '12px', color: '#1d4ed8', fontWeight: '800' }}>Open Patient File ➔</span>
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
                          <div key={doc.doctorId} onClick={() => setAdminSelectedDoctor(doc)} className="royal-card royal-card-interactive" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <img src={doc.photoUrl || DEFAULT_DOC_AVATAR} alt={doc.name} style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #4338ca' }} />
                            <div>
                              <strong style={{ fontSize: '15px' }}>{doc.name}</strong>
                              <div style={{ fontSize: '12px', color: '#4338ca', fontWeight: '700' }}>{doc.department}</div>
                            </div>
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
                          <div key={p.patientId} onClick={() => handleAdminInspectPatient(p.patientId)} className="royal-card royal-card-interactive" style={{ border: '1px solid #a7f3d0', padding: '14px', backgroundColor: '#ecfdf5', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {renderPatientAvatar(p, 38, '1.5px solid #a7f3d0')}
                            <div>
                              <strong>#{idx + 1} {p.name}</strong> ({p.patientId}) - Discharged
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* SECTION 6: 🚨 GRIEVANCE OVERSIGHT WITH PERFECT REAL-TIME SYNC */}
                  {adminActiveTab === 'grievances' && (
                    <div className="royal-card" style={{ padding: '24px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <h3 style={{ margin: 0, color: '#9f1239', fontSize: '16px' }}>🚨 Patient Video / Photo Grievances ({allHospitalGrievances.length})</h3>
                        <span style={{ fontSize: '12px', color: '#64748b' }}>Ground truth verified by patient consent</span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {allHospitalGrievances.map(grv => {
                          const isGreen = grv.status === 'RESOLVED' && grv.patientConfirmedResolved
                          const isOrange = grv.adminReply && !isGreen
                          const isRed = grv.status === 'SUBMITTED'

                          return (
                            <div key={grv.grievanceId} className="royal-card" style={{ border: `1.5px solid ${isGreen ? '#6ee7b7' : isOrange ? '#fde68a' : '#fecdd3'}`, padding: '18px', backgroundColor: isGreen ? '#ecfdf5' : isOrange ? '#fffbeb' : '#fff1f2' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span>{isGreen ? '🟢' : isOrange ? '🟠' : '🔴'}</span>
                                    <strong>{grv.patientName} ({grv.patientId})</strong> - <span style={{ color: '#070e1e', fontWeight: '700' }}>{grv.category}</span>
                                  </div>
                                  <div style={{ fontSize: '12px', color: '#475569', marginTop: '3px' }}>"{grv.description}"</div>
                                  
                                  {isGreen && (
                                    <div style={{ fontSize: '11px', color: '#047857', fontWeight: '800', marginTop: '4px' }}>
                                      ✅ Ground-verified and confirmed resolved by patient on {formatDateTime(grv.patientResolvedAt)}
                                    </div>
                                  )}

                                  {isOrange && (
                                    <div style={{ fontSize: '11px', color: '#b45309', fontWeight: '700', marginTop: '4px' }}>
                                      ⏳ Action replied by Vigilance: "{grv.adminReply}". Awaiting patient ground verification.
                                    </div>
                                  )}
                                </div>

                                <div>
                                  {isGreen ? (
                                    <button onClick={() => { setSelectedAdminGrievance(grv); setAdminGrievanceReplyText(grv.adminReply || ''); }} style={{ padding: '6px 14px', backgroundColor: '#047857', color: 'white', border: 'none', borderRadius: '9999px', fontSize: '11px', fontWeight: '800', cursor: 'pointer' }}>
                                      👁️ View Resolved Case (Green)
                                    </button>
                                  ) : (
                                    <button onClick={() => { setSelectedAdminGrievance(grv); setAdminGrievanceReplyText(grv.adminReply || ''); }} style={{ padding: '6px 14px', backgroundColor: '#070e1e', color: 'white', border: 'none', borderRadius: '9999px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                                      🔍 Review & Respond ➔
                                    </button>
                                  )}
                                </div>
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

      {/* MODAL: PRESET AVATAR PICKER */}
      {showAvatarPickerModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(7, 14, 30, 0.75)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 15000, padding: '20px' }}>
          <div className="royal-card animate-fade-in" style={{ backgroundColor: 'white', width: '100%', maxWidth: '520px', borderRadius: '24px', padding: '28px', position: 'relative' }}>
            <button onClick={() => setShowAvatarPickerModal(false)} style={{ position: 'absolute', top: '18px', right: '18px', background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer' }}>✕</button>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: '800' }}>🎭 Choose Profile Avatar</h3>
            <p style={{ margin: '0 0 18px 0', fontSize: '13px', color: '#64748b' }}>Select your preferred photo avatar:</p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '20px' }}>
              {PRESET_AVATARS.map(avatar => (
                <div
                  key={avatar.id}
                  onClick={() => {
                    setPatientEditForm({ ...patientEditForm, photoUrl: avatar.url })
                    setShowAvatarPickerModal(false)
                  }}
                  style={{
                    padding: '8px',
                    borderRadius: '16px',
                    border: patientEditForm.photoUrl === avatar.url ? '3px solid #1e3a8a' : '1px solid #cbd5e1',
                    cursor: 'pointer',
                    textAlign: 'center',
                    backgroundColor: '#f8fafc'
                  }}>
                  <img src={avatar.url} alt={avatar.label} style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover' }} />
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#334155', display: 'block', marginTop: '4px' }}>{avatar.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADMIN VIDEO WATCH & RESOLUTION */}
      {selectedAdminGrievance && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(7, 14, 30, 0.75)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 14000, padding: '20px' }}>
          <div className="royal-card animate-fade-in" style={{ backgroundColor: 'white', width: '100%', maxWidth: '600px', borderRadius: '24px', padding: '30px', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
            <button onClick={() => setSelectedAdminGrievance(null)} style={{ position: 'absolute', top: '18px', right: '18px', background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer' }}>✕</button>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ margin: 0 }}>{selectedAdminGrievance.category}</h3>
              <span style={{ padding: '4px 12px', borderRadius: '9999px', fontSize: '11px', fontWeight: '800', backgroundColor: selectedAdminGrievance.patientConfirmedResolved ? '#ecfdf5' : '#fffbeb', color: selectedAdminGrievance.patientConfirmedResolved ? '#047857' : '#b45309' }}>
                {selectedAdminGrievance.patientConfirmedResolved ? '🟢 RESOLVED & PATIENT VERIFIED' : '🟠 INVESTIGATION IN PROGRESS'}
              </span>
            </div>

            <p style={{ margin: '0 0 14px 0', fontSize: '13px', color: '#64748b' }}>Patient: {selectedAdminGrievance.patientName} ({selectedAdminGrievance.patientId}) • Dept: {selectedAdminGrievance.department}</p>

            {selectedAdminGrievance.mediaUrl && (
              <div style={{ backgroundColor: '#070e1e', padding: '8px', borderRadius: '16px', textAlign: 'center', marginBottom: '14px' }}>
                {selectedAdminGrievance.mediaType === 'video' ? (
                  <video src={selectedAdminGrievance.mediaUrl} controls autoPlay style={{ width: '100%', maxHeight: '240px', borderRadius: '10px' }} />
                ) : (
                  <img src={selectedAdminGrievance.mediaUrl} alt="Evidence" style={{ width: '100%', maxHeight: '240px', borderRadius: '10px', objectFit: 'contain' }} />
                )}
              </div>
            )}

            {selectedAdminGrievance.patientConfirmedResolved ? (
              <div style={{ padding: '16px', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '14px', marginBottom: '14px' }}>
                <strong style={{ color: '#047857', fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                  ✅ Case Officially Closed by Patient Permission
                </strong>
                <p style={{ margin: '0 0 6px 0', fontSize: '12px', color: '#065f46' }}>
                  The citizen verified on the ground that this grievance was addressed to their satisfaction.
                </p>
                <div style={{ fontSize: '11px', color: '#047857' }}>
                  Admin Action Recorded: "{selectedAdminGrievance.adminReply}"
                </div>
              </div>
            ) : (
              <form onSubmit={handleAdminRespondToGrievance}>
                <label style={{ fontSize: '12px', fontWeight: '700', display: 'block', marginBottom: '4px' }}>Official Response / Action Taken to Patient:</label>
                <textarea rows={3} required placeholder="Type the action taken e.g. Staff reprimanded, medicine issued immediately..." style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid #cbd5e1', marginBottom: '14px', boxSizing: 'border-box' }} value={adminGrievanceReplyText} onChange={e => setAdminGrievanceReplyText(e.target.value)} />
                <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#047857', color: 'white', border: 'none', borderRadius: '9999px', fontWeight: '800', fontSize: '13px', cursor: 'pointer' }}>
                  Send Response to Patient Phone ➔
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL: ADMIN FULL PATIENT EHR INSPECTION */}
      {adminInspectedPatientFile && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(7, 14, 30, 0.75)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 12000, padding: '20px' }}>
          <div className="royal-card animate-fade-in" style={{ backgroundColor: 'white', width: '100%', maxWidth: '820px', borderRadius: '24px', padding: '32px', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
            <button onClick={() => setAdminInspectedPatientFile(null)} style={{ position: 'absolute', top: '18px', right: '18px', background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer' }}>✕</button>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
              {renderPatientAvatar(adminInspectedPatientFile.patient, 56, '2px solid #1e3a8a')}
              <div>
                <h2 style={{ margin: '0 0 2px 0' }}>{adminInspectedPatientFile.patient?.name}</h2>
                <span style={{ fontSize: '13px', color: '#64748b' }}>ID: {adminInspectedPatientFile.patient?.patientId} • Mobile: +91 {adminInspectedPatientFile.patient?.phoneNumber}</span>
              </div>
            </div>

            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {adminInspectedPatientFile.timeline?.map((item, idx) => (
                <div key={idx} style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '13px' }}>
                  <strong>{item.stage}</strong> - {item.details}
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{formatDateTime(item.timestamp)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: WEBCAM CAPTURE */}
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
                <button onClick={snapWebcamPhoto} style={{ width: '100%', padding: '12px', backgroundColor: '#1e3a8a', color: 'white', border: 'none', borderRadius: '9999px', fontWeight: '800', fontSize: '13px', cursor: 'pointer' }}>
                  📸 Snap Live Photo
                </button>
              </div>
            ) : (
              <div>
                <img src={capturedPhotoPreview} alt="Proof" style={{ width: '100%', maxHeight: '240px', borderRadius: '14px', objectFit: 'contain', marginBottom: '14px' }} />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => { setCapturedPhotoPreview(null); startWebcam(); }} style={{ flex: 1, padding: '10px', backgroundColor: '#f1f5f9', color: '#070e1e', border: '1px solid #cbd5e1', borderRadius: '9999px', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>🔄 Retake</button>
                  <button onClick={confirmCapturedPhoto} style={{ flex: 1.4, padding: '10px', backgroundColor: '#047857', color: 'white', border: 'none', borderRadius: '9999px', fontWeight: '800', fontSize: '12px', cursor: 'pointer' }}>✅ Confirm Photo</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: LOGIN */}
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
                  <button onClick={() => setPatientLoginMode('otp')} style={{ flex: 1.4, padding: '6px', fontSize: '11px', border: '1px solid #cbd5e1', borderRadius: '9999px', backgroundColor: patientLoginMode === 'otp' ? '#070e1e' : '#f8fafc', color: patientLoginMode === 'otp' ? 'white' : '#334155', cursor: 'pointer', fontWeight: '700' }}>📲 WhatsApp OTP / PIN</button>
                  <button onClick={() => setPatientLoginMode('quick')} style={{ flex: 1, padding: '6px', fontSize: '11px', border: '1px solid #cbd5e1', borderRadius: '9999px', backgroundColor: patientLoginMode === 'quick' ? '#070e1e' : '#f8fafc', color: patientLoginMode === 'quick' ? 'white' : '#334155', cursor: 'pointer', fontWeight: '700' }}>⚡ Quick Select</button>
                </div>

                {patientLoginMode === 'password' && (
                  <form onSubmit={handlePatientPasswordLogin}>
                    <input required type="text" placeholder="Patient ID (e.g. PT-1001)" style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid #cbd5e1', marginBottom: '10px', boxSizing: 'border-box' }} value={loginId} onChange={e => setLoginId(e.target.value)} />
                    <input required type="password" placeholder="Passcode PIN" style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid #cbd5e1', marginBottom: '14px', boxSizing: 'border-box' }} value={loginPassword} onChange={e => setLoginPassword(e.target.value)} />
                    {loginError && <div style={{ color: '#be123c', fontSize: '12px', marginBottom: '8px' }}>{loginError}</div>}
                    <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#1e3a8a', color: 'white', border: 'none', borderRadius: '9999px', fontWeight: '800', cursor: 'pointer', fontSize: '13px' }}>Log In ➔</button>
                  </form>
                )}

                {patientLoginMode === 'otp' && (
                  <div>
                    {!otpSent ? (
                      <form onSubmit={handleSendOtp}>
                        <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>Registered Mobile or Patient ID:</label>
                        <input required type="text" placeholder="e.g. 9876543210 or PT-1001" style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid #cbd5e1', marginBottom: '10px', boxSizing: 'border-box' }} value={otpIdentifier} onChange={e => setOtpIdentifier(e.target.value)} />
                        {otpError && <div style={{ color: '#be123c', fontSize: '12px', marginBottom: '8px' }}>{otpError}</div>}
                        <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#25D366', color: 'white', border: 'none', borderRadius: '9999px', fontWeight: '800', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          <span>📲</span> Send Login PIN & OTP to WhatsApp ➔
                        </button>
                      </form>
                    ) : (
                      <form onSubmit={handleVerifyOtp}>
                        <div style={{ backgroundColor: '#ecfdf5', padding: '10px', borderRadius: '10px', border: '1px solid #a7f3d0', fontSize: '12px', color: '#065f46', marginBottom: '10px' }}>
                          ✅ OTP and credentials dispatched to WhatsApp / SMS!
                        </div>
                        <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>Enter 6-Digit OTP:</label>
                        <input required type="text" placeholder="e.g. 123456" style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid #cbd5e1', marginBottom: '10px', boxSizing: 'border-box' }} value={enteredOtp} onChange={e => setEnteredOtp(e.target.value)} />
                        {otpError && <div style={{ color: '#be123c', fontSize: '12px', marginBottom: '8px' }}>{otpError}</div>}
                        <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#047857', color: 'white', border: 'none', borderRadius: '9999px', fontWeight: '800', cursor: 'pointer', fontSize: '13px', marginBottom: '8px' }}>
                          ✅ Verify OTP & Enter Portal ➔
                        </button>
                        <button type="button" onClick={() => setOtpSent(false)} style={{ width: '100%', background: 'none', border: 'none', color: '#64748b', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline' }}>
                          Resend to another number
                        </button>
                      </form>
                    )}
                  </div>
                )}

                {patientLoginMode === 'quick' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                    {registeredPatients.map(p => (
                      <button key={p.patientId} onClick={() => handleDirectPatientSelect(p)} style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '10px', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {renderPatientAvatar(p, 28, '1px solid #cbd5e1')}
                          <span>{p.name} ({p.patientId})</span>
                        </div>
                        <span style={{ color: '#1d4ed8', fontWeight: '800' }}>Enter ➔</span>
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
                  <input type="password" placeholder="Passcode (setu2026)" style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid #cbd5e1', marginBottom: '10px', boxSizing: 'border-box' }} value={opStaffPass} onChange={e => setOpStaffPass(e.target.value)} />
                  {staffLoginError && <div style={{ color: '#be123c', fontSize: '12px', marginBottom: '8px' }}>{staffLoginError}</div>}
                  <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#b45309', color: 'white', border: 'none', borderRadius: '9999px', fontWeight: '800', cursor: 'pointer', fontSize: '13px', marginBottom: '8px' }}>Log In as Staff ➔</button>
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
                  <button key={doc.doctorId} onClick={() => handleRoleSelectLogin('doctor', doc)} style={{ padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '12px', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <img src={doc.photoUrl || DEFAULT_DOC_AVATAR} alt={doc.name} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                      <strong>{doc.name} ({doc.department})</strong>
                    </div>
                    <span style={{ color: '#4338ca', fontWeight: '800' }}>Enter ➔</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* INTERACTIVE CLINICAL DETAIL INSPECTION MODAL */}
      {selectedDetailItem && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(7, 14, 30, 0.75)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 11000, padding: '20px' }}>
          <div className="royal-card animate-fade-in" style={{ backgroundColor: 'white', width: '100%', maxWidth: '640px', borderRadius: '24px', padding: '32px', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
            <button onClick={() => setSelectedDetailItem(null)} style={{ position: 'absolute', top: '20px', right: '20px', background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', fontSize: '16px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <span style={{ fontSize: '28px', width: '48px', height: '48px', borderRadius: '14px', backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #bfdbfe' }}>{selectedDetailItem.icon || '📋'}</span>
              <div>
                <span style={{ fontSize: '11px', fontWeight: '800', color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Official Clinical Record</span>
                <h3 style={{ margin: '2px 0 0 0', color: '#070e1e', fontSize: '20px', fontWeight: '800' }}>{selectedDetailItem.stage || 'Clinical Activity Details'}</h3>
              </div>
            </div>

            {/* Timestamp & Clinician Banner */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', backgroundColor: '#f8fafc', padding: '14px 18px', borderRadius: '14px', border: '1px solid #cbd5e1', marginBottom: '18px' }}>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block', fontWeight: '700' }}>Date & Time</span>
                <strong style={{ fontSize: '13px', color: '#070e1e' }}>🕒 {formatDateTime(selectedDetailItem.timestamp)}</strong>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block', fontWeight: '700' }}>Authorizing Clinician / Staff</span>
                <strong style={{ fontSize: '13px', color: '#1d4ed8' }}>👨‍⚕️ {selectedDetailItem.performedBy || selectedDetailItem.doctorName || 'Attending Physician'}</strong>
              </div>
            </div>

            {/* Anti-Bribery Delivery Mode Notice */}
            {selectedDetailItem.deliveryMode && (
              <div style={{ backgroundColor: selectedDetailItem.deliveryMode === 'PHYSICAL_COUNTER' ? '#fffbeb' : '#ecfdf5', border: `1px solid ${selectedDetailItem.deliveryMode === 'PHYSICAL_COUNTER' ? '#fde68a' : '#a7f3d0'}`, padding: '14px 18px', borderRadius: '14px', marginBottom: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '18px' }}>{selectedDetailItem.deliveryMode === 'PHYSICAL_COUNTER' ? '📄' : '⚡'}</span>
                  <strong style={{ color: selectedDetailItem.deliveryMode === 'PHYSICAL_COUNTER' ? '#92400e' : '#047857', fontSize: '14px' }}>
                    {selectedDetailItem.deliveryMode === 'PHYSICAL_COUNTER' ? 'Physical Hard-Copy Collection Notice' : 'Digital Direct EHR Upload (Zero Bribery)'}
                  </strong>
                </div>
                <p style={{ margin: 0, fontSize: '12px', color: selectedDetailItem.deliveryMode === 'PHYSICAL_COUNTER' ? '#78350f' : '#065f46', lineHeight: '1.4' }}>
                  {selectedDetailItem.deliveryInstructions || (selectedDetailItem.deliveryMode === 'PHYSICAL_COUNTER' ? 'Present your Patient ID at Diagnostic Counter 1 (Room 105) to collect the printed diagnostic film.' : 'This report is digitally signed and uploaded to your EHR portal automatically, eliminating middleman bribery.')}
                </p>
              </div>
            )}

            {/* Diagnostic Findings */}
            {selectedDetailItem.clinicalFindings && (
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '14px', padding: '16px', marginBottom: '18px' }}>
                <strong style={{ fontSize: '13px', color: '#070e1e', display: 'block', marginBottom: '8px' }}>🔬 Clinical Diagnostic Findings:</strong>
                <div style={{ padding: '12px 14px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '13px', color: '#070e1e', lineHeight: '1.5', fontWeight: '600' }}>
                  {selectedDetailItem.clinicalFindings}
                </div>
              </div>
            )}

            {/* Prescribed Medications */}
            {selectedDetailItem.prescribedMedicines && selectedDetailItem.prescribedMedicines.length > 0 && (
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '14px', padding: '16px', marginBottom: '18px' }}>
                <strong style={{ fontSize: '13px', color: '#070e1e', display: 'block', marginBottom: '8px' }}>💊 Prescribed Medication Regimen:</strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedDetailItem.prescribedMedicines.map((m, idx) => (
                    <div key={idx} style={{ padding: '10px 12px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong style={{ fontSize: '13px', color: '#070e1e' }}>{m.name}</strong>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Timing: {m.timing || 'As directed'} • Duration: {m.durationDays || 5} days</div>
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: '800', color: '#047857', backgroundColor: '#ecfdf5', padding: '2px 10px', borderRadius: '9999px', border: '1px solid #a7f3d0' }}>
                        {m.dosage}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ward Bed & Consumables */}
            {selectedDetailItem.wardAllocation && (
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '14px', padding: '16px', marginBottom: '18px' }}>
                <strong style={{ fontSize: '13px', color: '#070e1e', display: 'block', marginBottom: '8px' }}>🛏️ Inpatient Bed & Administered Supplies:</strong>
                <div style={{ padding: '10px 14px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #cbd5e1', marginBottom: '8px', fontSize: '13px' }}>
                  Ward: <strong>{selectedDetailItem.wardAllocation.ward}</strong> • Bed: <strong>{selectedDetailItem.wardAllocation.bed}</strong>
                </div>
                {selectedDetailItem.wardAllocation.resources?.length > 0 && (
                  <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', color: '#334155' }}>
                    {selectedDetailItem.wardAllocation.resources.map((r, i) => (
                      <li key={i}>{r.itemName} (Qty: {r.quantity}) - Logged by {r.loggedByStaff}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* General Activity Details */}
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '14px', padding: '16px', marginBottom: '18px' }}>
              <strong style={{ fontSize: '13px', color: '#070e1e', display: 'block', marginBottom: '6px' }}>📝 Clinical Statement / Event Summary:</strong>
              <p style={{ margin: 0, fontSize: '13px', color: '#334155', lineHeight: '1.5' }}>
                {selectedDetailItem.details}
              </p>
            </div>

            {/* Attached Photo Proof */}
            {selectedDetailItem.photoProof && (
              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '14px', padding: '16px', marginBottom: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <strong style={{ fontSize: '13px', color: '#047857' }}>📸 Photographic Handover / Diagnostic Film Proof:</strong>
                  <span style={{ fontSize: '11px', color: '#047857', backgroundColor: '#ecfdf5', padding: '2px 8px', borderRadius: '9999px', fontWeight: '800' }}>✓ Verified Audit Record</span>
                </div>
                <img src={selectedDetailItem.photoProof} alt="Proof" style={{ width: '100%', maxHeight: '280px', objectFit: 'contain', borderRadius: '10px', backgroundColor: '#070e1e' }} />
              </div>
            )}

            {/* Digital Authenticity Stamp */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '14px', fontSize: '11px', color: '#64748b' }}>
              <span>🔒 Cryptographically Signed EHR Record</span>
              <span style={{ color: '#047857', fontWeight: '800' }}>● Tamper-Proof Audit Active</span>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default App
