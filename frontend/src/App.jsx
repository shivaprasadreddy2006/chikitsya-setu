import { useState, useEffect } from 'react'
import axios from 'axios'

const API_BASE = 'http://localhost:5000/api'

function App() {
  // Navigation View: 'home' | 'patient' | 'doctor' | 'lab' | 'pharmacy' | 'ward' | 'op-desk' | 'admin'
  const [activeView, setActiveView] = useState('home')

  // Login Modal
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [loginRole, setLoginRole] = useState('patient') // 'patient' | 'doctor' | 'lab' | 'pharmacy' | 'ward' | 'op-desk' | 'admin'
  const [currentUser, setCurrentUser] = useState(null)

  // ---------- PATIENT STATE ----------
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

  // ---------- DOCTOR STATE ----------
  const [doctorsList, setDoctorsList] = useState([])
  const [selectedDoctorId, setSelectedDoctorId] = useState('DR-GEN-01')
  const [doctorQueue, setDoctorQueue] = useState([])
  const [activePatientForExam, setActivePatientForExam] = useState(null)
  const [doctorActionTab, setDoctorActionTab] = useState('lab') // 'lab' | 'rx' | 'referral' | 'admit'
  const [selectedTest, setSelectedTest] = useState('Complete Blood Count (CBC)')
  const [selectedLabRoom, setSelectedLabRoom] = useState('Pathology Lab 1 (Room 105)')
  const [rxMedicines, setRxMedicines] = useState('Paracetamol 650mg (1-0-1), Cetirizine 10mg (0-0-1)')
  const [referralDept, setReferralDept] = useState('Cardiology')
  const [referralReason, setReferralReason] = useState('Pre-operative specialist opinion required')
  const [admitWard, setAdmitWard] = useState('General Ward (Male)')
  const [admitBed, setAdmitBed] = useState('BED-GW-14')
  const [clinicalNotes, setClinicalNotes] = useState('')
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
  const [resourceItemName, setResourceItemName] = useState('IV Cannula 20G & Normal Saline')
  const [wardMessage, setWardMessage] = useState('')

  // ---------- O/P DESK STATE ----------
  const [opForm, setOpForm] = useState({ name: '', age: '', gender: 'Male', phoneNumber: '' })
  const [opTicket, setOpTicket] = useState(null)
  const [opError, setOpError] = useState('')

  // ---------- ADMIN / OVERSIGHT STATE ----------
  const [hospitalStats, setHospitalStats] = useState(null)

  // ---------- NOTIFICATION SIMULATOR ----------
  const [whatsAppNotification, setWhatsAppNotification] = useState(null)

  const showWhatsAppAlert = (notification) => {
    setWhatsAppNotification(notification)
    setTimeout(() => setWhatsAppNotification(null), 12000)
  }

  useEffect(() => {
    fetchDoctors()
    fetchHospitalStats()
  }, [])

  useEffect(() => {
    if (activeView === 'doctor' && selectedDoctorId) fetchDoctorQueue(selectedDoctorId)
    if (activeView === 'lab') fetchLabOrders()
    if (activeView === 'pharmacy') fetchPrescriptions()
    if (activeView === 'ward') fetchAdmissions()
    if (activeView === 'admin') fetchHospitalStats()
    if (activeView === 'patient' && currentUser?.role === 'patient') fetchPatientFullFile(currentUser.data.patientId)
  }, [activeView, selectedDoctorId])

  const fetchDoctors = async () => {
    try {
      const res = await axios.get(`${API_BASE}/doctors`)
      setDoctorsList(res.data)
    } catch (err) { console.error(err) }
  }

  const fetchHospitalStats = async () => {
    try {
      const res = await axios.get(`${API_BASE}/hospital/stats`)
      setHospitalStats(res.data)
    } catch (err) { console.error(err) }
  }

  const fetchDoctorQueue = async (docId) => {
    try {
      const res = await axios.get(`${API_BASE}/doctors/${docId}/patients`)
      setDoctorQueue(res.data)
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

  // ---------- AUTH HANDLERS ----------
  const handlePatientPasswordLogin = async (e) => {
    e.preventDefault()
    setLoginError('')
    try {
      const res = await axios.post(`${API_BASE}/patients/login`, { patientId: loginId, password: loginPassword })
      setCurrentUser({ role: 'patient', data: res.data.patient })
      fetchPatientFullFile(res.data.patient.patientId)
      setActiveView('patient')
      setShowLoginModal(false)
      setLoginId('')
      setLoginPassword('')
    } catch (err) {
      setLoginError(err.response?.data?.message || 'Invalid credentials.')
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
      setOtpError(err.response?.data?.message || 'Failed to send OTP.')
    }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    setOtpError('')
    try {
      const res = await axios.post(`${API_BASE}/patients/verify-otp`, { identifier: otpIdentifier, otp: enteredOtp })
      setCurrentUser({ role: 'patient', data: res.data.patient })
      fetchPatientFullFile(res.data.patient.patientId)
      setActiveView('patient')
      setShowLoginModal(false)
      setOtpSent(false)
      setEnteredOtp('')
      setOtpIdentifier('')
    } catch (err) {
      setOtpError(err.response?.data?.message || 'Invalid OTP.')
    }
  }

  const handleRoleSelectLogin = (role, data) => {
    setCurrentUser({ role, data })
    setActiveView(role)
    setShowLoginModal(false)
  }

  const handleLogout = () => {
    setCurrentUser(null)
    setActiveView('home')
    setLoginError('')
    setOtpError('')
    setOtpSent(false)
    setPatientFullFile(null)
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
      setOpForm({ name: '', age: '', gender: 'Male', phoneNumber: '' })
      fetchHospitalStats()
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
        notes: clinicalNotes
      })
      setDoctorMessage(`✅ ${res.data.message}`)
      setActivePatientForExam(null)
      fetchDoctorQueue(selectedDoctorId)
    } catch (err) { setDoctorMessage(`⚠️ ${err.response?.data?.message || 'Failed'}`) }
  }

  const handleDoctorPrescribe = async (e) => {
    e.preventDefault()
    if (!activePatientForExam) return
    try {
      const medArray = rxMedicines.split(',').map(m => ({ name: m.trim(), dosage: '1-0-1 after food', durationDays: 5 }))
      const res = await axios.post(`${API_BASE}/pharmacy/create`, {
        doctorId: selectedDoctorId,
        patientId: activePatientForExam.patientId,
        medicines: medArray,
        notes: clinicalNotes
      })
      setDoctorMessage(`✅ ${res.data.message}`)
      setActivePatientForExam(null)
      fetchDoctorQueue(selectedDoctorId)
    } catch (err) { setDoctorMessage(`⚠️ ${err.response?.data?.message || 'Failed'}`) }
  }

  const handleDoctorReferral = async (e) => {
    e.preventDefault()
    if (!activePatientForExam) return
    try {
      const res = await axios.post(`${API_BASE}/referrals/create`, {
        fromDoctorId: selectedDoctorId,
        fromDoctorName: doctorsList.find(d => d.doctorId === selectedDoctorId)?.name,
        patientId: activePatientForExam.patientId,
        toDepartment: referralDept,
        reason: referralReason
      })
      setDoctorMessage(`✅ ${res.data.message}`)
      setActivePatientForExam(null)
      fetchDoctorQueue(selectedDoctorId)
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
      setActivePatientForExam(null)
      fetchDoctorQueue(selectedDoctorId)
    } catch (err) { setDoctorMessage(`⚠️ ${err.response?.data?.message || 'Failed'}`) }
  }

  // ---------- LAB ACTIONS ----------
  const handleLabCollect = async (reqId) => {
    try {
      const res = await axios.put(`${API_BASE}/labs/collect/${reqId}`)
      setLabMessage(`✅ ${res.data.message}`)
      fetchLabOrders()
    } catch (err) { setLabMessage(`⚠️ ${err.message}`) }
  }

  const handleLabPublish = async (reqId) => {
    try {
      const findings = labFindingsInput[reqId] || 'Normal biological reference intervals maintained.'
      const res = await axios.put(`${API_BASE}/labs/publish/${reqId}`, { findings })
      setLabMessage(`✅ ${res.data.message}`)
      fetchLabOrders()
    } catch (err) { setLabMessage(`⚠️ ${err.message}`) }
  }

  // ---------- PHARMACY ACTIONS ----------
  const handleDispense = async (rxId) => {
    try {
      const res = await axios.put(`${API_BASE}/pharmacy/dispense/${rxId}`)
      setPharmacyMessage(`✅ ${res.data.message}`)
      fetchPrescriptions()
    } catch (err) { setPharmacyMessage(`⚠️ ${err.message}`) }
  }

  // ---------- WARD ACTIONS ----------
  const handleLogResource = async (admissionId) => {
    try {
      const res = await axios.post(`${API_BASE}/admissions/resource/${admissionId}`, { itemName: resourceItemName })
      setWardMessage(`✅ ${res.data.message}`)
      fetchAdmissions()
    } catch (err) { setWardMessage(`⚠️ ${err.message}`) }
  }

  const handleDischarge = async (admissionId) => {
    try {
      const res = await axios.put(`${API_BASE}/admissions/discharge/${admissionId}`, { dischargeSummary: 'Vitals stable. Home medications advised.' })
      setWardMessage(`✅ ${res.data.message}`)
      fetchAdmissions()
    } catch (err) { setWardMessage(`⚠️ ${err.message}`) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', fontFamily: 'Segoe UI, Arial, sans-serif', margin: 0, backgroundColor: '#f8fafc' }}>
      
      {/* WhatsApp Popup */}
      {whatsAppNotification && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', backgroundColor: '#25D366', color: 'white', padding: '16px 20px', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.25)', maxWidth: '380px', zIndex: 9999 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <strong style={{ fontSize: '15px' }}>💬 WhatsApp Delivered</strong>
            <button onClick={() => setWhatsAppNotification(null)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontSize: '16px' }}>✕</button>
          </div>
          <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '6px' }}>To: +91 {whatsAppNotification.recipient}</div>
          <div style={{ backgroundColor: '#ffffff', color: '#111', padding: '12px', borderRadius: '8px', fontSize: '13px', whiteSpace: 'pre-line', lineHeight: '1.4' }}>
            {whatsAppNotification.message}
          </div>
        </div>
      )}

      {/* HEADER (MATCHING DRAWING) */}
      <header style={{ backgroundColor: '#ffffff', borderBottom: '2px solid #e2e8f0', padding: '18px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
        <div onClick={() => !currentUser && setActiveView('home')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#0f172a', letterSpacing: '-0.5px' }}>
            Chikitsya Setu
          </h1>
        </div>

        <div>
          {currentUser ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <span style={{ fontSize: '14px', color: '#334155', fontWeight: '600' }}>
                {currentUser.role === 'patient' && `👤 Patient: ${currentUser.data.name}`}
                {currentUser.role === 'doctor' && `👨‍⚕️ ${currentUser.data.name}`}
                {currentUser.role === 'lab' && `🔬 Lab Staff`}
                {currentUser.role === 'pharmacy' && `💊 Pharmacy Staff`}
                {currentUser.role === 'ward' && `🛏️ Ward Nurse`}
                {currentUser.role === 'op-desk' && `🎫 O/P Counter`}
                {currentUser.role === 'admin' && `📊 Hospital Admin`}
              </span>
              <button onClick={handleLogout} style={{ padding: '8px 16px', backgroundColor: '#f1f5f9', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '6px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>
                Log Out 🚪
              </button>
            </div>
          ) : (
            <button onClick={() => setShowLoginModal(true)} style={{ padding: '10px 24px', backgroundColor: '#0f172a', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer' }}>
              Login
            </button>
          )}
        </div>
      </header>

      {/* MAIN BODY CONTENT */}
      <main style={{ flex: 1, padding: '36px 20px', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>

        {/* 1. HOME LANDING VIEW */}
        {activeView === 'home' && (
          <div style={{ width: '100%', maxWidth: '880px', textAlign: 'center' }}>
            <div style={{ backgroundColor: 'white', padding: '48px 36px', borderRadius: '20px', boxShadow: '0 4px 28px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '56px', display: 'block', marginBottom: '14px' }}>🏥</span>
              <h2 style={{ fontSize: '32px', color: '#0f172a', margin: '0 0 14px 0', fontWeight: 'bold' }}>
                Gandhi Hospital Transparency Engine
              </h2>
              <p style={{ fontSize: '16px', color: '#64748b', maxWidth: '640px', margin: '0 auto 28px auto', lineHeight: '1.6' }}>
                End-to-end digital tracking from O/P registration to doctor consultation, diagnostic laboratories, pharmacy dispensing, inpatient wards, and discharge.
              </p>

              <button onClick={() => setShowLoginModal(true)} style={{ padding: '14px 36px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 14px rgba(15, 23, 42, 0.25)' }}>
                Login to Access Your Dashboard ➔
              </button>

              {hospitalStats && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginTop: '40px', textAlign: 'center' }}>
                  <div style={{ backgroundColor: '#f8fafc', padding: '18px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f172a' }}>{hospitalStats.totalPatients}</span>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Total Registered</div>
                  </div>
                  <div style={{ backgroundColor: '#f8fafc', padding: '18px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#2563eb' }}>{hospitalStats.totalDoctors}</span>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>On-Duty Doctors</div>
                  </div>
                  <div style={{ backgroundColor: '#f8fafc', padding: '18px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#d97706' }}>{hospitalStats.pendingLabs}</span>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Active Lab Tests</div>
                  </div>
                  <div style={{ backgroundColor: '#f8fafc', padding: '18px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#16a34a' }}>{hospitalStats.transparencyScore}</span>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Transparency Rating</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2. COMPLETE PATIENT PORTAL */}
        {activeView === 'patient' && currentUser?.role === 'patient' && (
          <div style={{ width: '100%', maxWidth: '820px', backgroundColor: 'white', padding: '36px', borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
            
            {/* Header Profile */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '16px', marginBottom: '20px' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#2563eb', textTransform: 'uppercase', letterSpacing: '1px' }}>Electronic Health Record</span>
                <h2 style={{ margin: '4px 0 2px 0', color: '#0f172a' }}>{currentUser.data.name}</h2>
                <span style={{ fontSize: '13px', color: '#64748b' }}>Patient ID: <strong>{currentUser.data.patientId}</strong> | WhatsApp: +91 {currentUser.data.phoneNumber}</span>
              </div>
            </div>

            {/* Sub-tab Navigation */}
            <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid #f1f5f9', paddingBottom: '12px', marginBottom: '24px' }}>
              <button onClick={() => setPatientTab('overview')} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: patientTab === 'overview' ? '#0f172a' : '#f1f5f9', color: patientTab === 'overview' ? 'white' : '#475569', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}>
                📍 Live Journey Track
              </button>
              <button onClick={() => setPatientTab('labs')} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: patientTab === 'labs' ? '#0f172a' : '#f1f5f9', color: patientTab === 'labs' ? 'white' : '#475569', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}>
                🔬 Lab Reports ({patientFullFile?.labRequests?.length || 0})
              </button>
              <button onClick={() => setPatientTab('medicines')} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: patientTab === 'medicines' ? '#0f172a' : '#f1f5f9', color: patientTab === 'medicines' ? 'white' : '#475569', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}>
                💊 Pharmacy Prescriptions
              </button>
              <button onClick={() => setPatientTab('admissions')} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: patientTab === 'admissions' ? '#0f172a' : '#f1f5f9', color: patientTab === 'admissions' ? 'white' : '#475569', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}>
                🛏️ Inpatient Ward & Items
              </button>
            </div>

            {/* Tab A: Overview & Directions */}
            {patientTab === 'overview' && (
              <div>
                <div style={{ backgroundColor: currentUser.data.currentStatus === 'IN_LAB' ? '#fffbeb' : currentUser.data.currentStatus === 'ADMITTED' ? '#fdf4ff' : '#eff6ff', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '18px', marginBottom: '24px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', color: '#1e40af' }}>Current Hospital Step</span>
                  <h3 style={{ margin: '4px 0 0 0', color: '#0f172a', fontSize: '18px' }}>
                    {currentUser.data.currentStatus === 'WAITING_FOR_DOCTOR' && 'Step 1: Consultation - Waiting for Doctor'}
                    {currentUser.data.currentStatus === 'IN_LAB' && 'Step 2: Diagnostics - Please Walk to Room 105'}
                    {currentUser.data.currentStatus === 'ADMITTED' && 'Step 3: Inpatient Care - General Ward'}
                    {currentUser.data.currentStatus === 'DISCHARGED' && '✅ Visit Complete / Discharged'}
                  </h3>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                  <div style={{ backgroundColor: '#f8fafc', padding: '18px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Assigned Physician</span>
                    <h4 style={{ margin: '4px 0 2px 0', color: '#0f172a' }}>{patientFullFile?.doctor ? patientFullFile.doctor.name : 'Dr. Ramesh Sharma'}</h4>
                    <span style={{ fontSize: '13px', color: '#2563eb' }}>{patientFullFile?.doctor?.department || 'General Medicine'}</span>
                  </div>
                  <div style={{ backgroundColor: '#f8fafc', padding: '18px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Room & Floor</span>
                    <h4 style={{ margin: '4px 0 2px 0', color: '#0f172a' }}>Room 102 (Block A, 1st Floor)</h4>
                    <span style={{ fontSize: '13px', color: '#d97706' }}>Queue: Active In Line</span>
                  </div>
                </div>

                <div style={{ backgroundColor: '#f0fdf4', padding: '14px 18px', borderRadius: '8px', border: '1px solid #bbf7d0', fontSize: '13px', color: '#166534' }}>
                  🛡️ <strong>Zero Bribery & Accountability Guarantee:</strong> Your visit is digitally monitored by hospital administration. If any staff requests money or delays reports, warnings are automatically sent.
                </div>
              </div>
            )}

            {/* Tab B: Lab Reports */}
            {patientTab === 'labs' && (
              <div>
                <h3 style={{ margin: '0 0 16px 0', color: '#0f172a' }}>Diagnostic Laboratory Reports</h3>
                {patientFullFile?.labRequests?.length === 0 ? (
                  <p style={{ color: '#64748b' }}>No diagnostic tests ordered yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {patientFullFile?.labRequests?.map(lab => (
                      <div key={lab._id} style={{ border: '1px solid #e2e8f0', padding: '18px', borderRadius: '10px', backgroundColor: '#f8fafc' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <strong style={{ fontSize: '16px', color: '#0f172a' }}>{lab.testName}</strong>
                          <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', backgroundColor: lab.status === 'REPORT_READY' ? '#dcfce7' : '#fef3c7', color: lab.status === 'REPORT_READY' ? '#15803d' : '#b45309' }}>
                            {lab.status === 'REPORT_READY' ? '✅ Report Published' : lab.status === 'SAMPLE_COLLECTED' ? '🧪 Sample in Analysis' : '⏳ Sample Pending'}
                          </span>
                        </div>
                        <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '6px' }}>Location: {lab.labRoom}</div>
                        {lab.findings && (
                          <div style={{ marginTop: '10px', backgroundColor: 'white', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px' }}>
                            <strong>Clinical Findings:</strong> {lab.findings}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab C: Medicines */}
            {patientTab === 'medicines' && (
              <div>
                <h3 style={{ margin: '0 0 16px 0', color: '#0f172a' }}>Prescribed Medications</h3>
                {patientFullFile?.prescriptions?.length === 0 ? (
                  <p style={{ color: '#64748b' }}>No active prescriptions.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {patientFullFile?.prescriptions?.map(rx => (
                      <div key={rx._id} style={{ border: '1px solid #e2e8f0', padding: '18px', borderRadius: '10px', backgroundColor: '#f8fafc' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                          <span style={{ fontSize: '13px', color: '#64748b' }}>Status: <strong>{rx.status}</strong></span>
                        </div>
                        <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px' }}>
                          {rx.medicines.map((m, idx) => (
                            <li key={idx} style={{ marginBottom: '6px' }}>
                              <strong>{m.name}</strong> - {m.dosage} ({m.durationDays} days) {m.isDispensed && '✅ [Dispensed by Pharmacy]'}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab D: Inpatient / Ward */}
            {patientTab === 'admissions' && (
              <div>
                <h3 style={{ margin: '0 0 16px 0', color: '#0f172a' }}>Inpatient Ward & Micro-Resource Logs</h3>
                {patientFullFile?.admission ? (
                  <div style={{ border: '1px solid #e2e8f0', padding: '20px', borderRadius: '10px', backgroundColor: '#f8fafc' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
                      <div>
                        <strong>Ward: {patientFullFile.admission.wardType}</strong>
                        <div style={{ fontSize: '13px', color: '#64748b' }}>Bed Allocation: {patientFullFile.admission.bedNumber}</div>
                      </div>
                      <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', backgroundColor: '#dcfce7', color: '#15803d' }}>
                        {patientFullFile.admission.status}
                      </span>
                    </div>

                    <h4 style={{ margin: '14px 0 8px 0', fontSize: '14px', color: '#334155' }}>Items & Consumables Logged (Zero Leakage):</h4>
                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#475569' }}>
                      {patientFullFile.admission.resourcesAllocated?.map((res, i) => (
                        <li key={i} style={{ marginBottom: '4px' }}>
                          {res.itemName} (Qty: {res.quantity}) - Logged by {res.loggedByStaff}
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
          <div style={{ width: '100%', maxWidth: '960px' }}>
            <div style={{ backgroundColor: 'white', padding: '20px 24px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold' }}>Physician Station</span>
                <h2 style={{ margin: '2px 0 0 0', color: '#0f172a' }}>{currentUser.data.name} ({currentUser.data.department})</h2>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600' }}>Switch Doctor:</label>
                <select style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }} value={selectedDoctorId} onChange={e => { setSelectedDoctorId(e.target.value); setActivePatientForExam(null) }}>
                  {doctorsList.map(d => (
                    <option key={d.doctorId} value={d.doctorId}>{d.name} ({d.department})</option>
                  ))}
                </select>
              </div>
            </div>

            {doctorMessage && <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#f0fdf4', color: '#166534', borderRadius: '8px', border: '1px solid #bbf7d0', fontWeight: '600' }}>{doctorMessage}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: activePatientForExam ? '1fr 1.3fr' : '1fr', gap: '24px' }}>
              {/* Queue */}
              <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                <h3 style={{ margin: '0 0 16px 0', color: '#0f172a' }}>Patient Queue ({doctorQueue.length})</h3>
                {doctorQueue.length === 0 ? <p style={{ color: '#94a3b8' }}>Queue is empty.</p> : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {doctorQueue.map((p, i) => (
                      <div key={p.patientId} style={{ border: activePatientForExam?.patientId === p.patientId ? '2px solid #2563eb' : '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong>#{i + 1} {p.name}</strong>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>{p.patientId} | {p.age}y, {p.gender}</div>
                        </div>
                        <button onClick={() => setActivePatientForExam(p)} style={{ padding: '6px 14px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                          Examine ➔
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Examination Desk */}
              {activePatientForExam && (
                <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                  <h3 style={{ margin: '0 0 6px 0', color: '#0f172a' }}>Examining: {activePatientForExam.name}</h3>
                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>ID: {activePatientForExam.patientId} | Phone: {activePatientForExam.phoneNumber}</div>

                  <div style={{ display: 'flex', gap: '6px', marginBottom: '18px' }}>
                    <button onClick={() => setDoctorActionTab('lab')} style={{ flex: 1, padding: '6px', fontSize: '12px', fontWeight: '600', borderRadius: '4px', border: 'none', backgroundColor: doctorActionTab === 'lab' ? '#0f172a' : '#f1f5f9', color: doctorActionTab === 'lab' ? 'white' : '#475569', cursor: 'pointer' }}>🔬 Order Lab</button>
                    <button onClick={() => setDoctorActionTab('rx')} style={{ flex: 1, padding: '6px', fontSize: '12px', fontWeight: '600', borderRadius: '4px', border: 'none', backgroundColor: doctorActionTab === 'rx' ? '#0f172a' : '#f1f5f9', color: doctorActionTab === 'rx' ? 'white' : '#475569', cursor: 'pointer' }}>💊 Prescribe</button>
                    <button onClick={() => setDoctorActionTab('referral')} style={{ flex: 1, padding: '6px', fontSize: '12px', fontWeight: '600', borderRadius: '4px', border: 'none', backgroundColor: doctorActionTab === 'referral' ? '#0f172a' : '#f1f5f9', color: doctorActionTab === 'referral' ? 'white' : '#475569', cursor: 'pointer' }}>👥 Refer</button>
                    <button onClick={() => setDoctorActionTab('admit')} style={{ flex: 1, padding: '6px', fontSize: '12px', fontWeight: '600', borderRadius: '4px', border: 'none', backgroundColor: doctorActionTab === 'admit' ? '#0f172a' : '#f1f5f9', color: doctorActionTab === 'admit' ? 'white' : '#475569', cursor: 'pointer' }}>🛏️ Admit</button>
                  </div>

                  {doctorActionTab === 'lab' && (
                    <form onSubmit={handleDoctorOrderLab}>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>Test Name</label>
                      <select style={{ width: '100%', padding: '8px', marginBottom: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }} value={selectedTest} onChange={e => setSelectedTest(e.target.value)}>
                        <option>Complete Blood Count (CBC)</option>
                        <option>Kidney Function Test (KFT)</option>
                        <option>Chest X-Ray (PA View)</option>
                        <option>Liver Function Test (LFT)</option>
                      </select>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>Target Lab Room</label>
                      <select style={{ width: '100%', padding: '8px', marginBottom: '16px', borderRadius: '6px', border: '1px solid #cbd5e1' }} value={selectedLabRoom} onChange={e => setSelectedLabRoom(e.target.value)}>
                        <option>Pathology Lab 1 (Room 105)</option>
                        <option>Radiology Wing (Room 12)</option>
                        <option>Biochemistry Lab (Room 108)</option>
                      </select>
                      <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#d97706', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>Dispatch Digital Lab Order ➔</button>
                    </form>
                  )}

                  {doctorActionTab === 'rx' && (
                    <form onSubmit={handleDoctorPrescribe}>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>Medicines (comma-separated)</label>
                      <textarea rows={3} style={{ width: '100%', padding: '8px', marginBottom: '14px', borderRadius: '6px', border: '1px solid #cbd5e1' }} value={rxMedicines} onChange={e => setRxMedicines(e.target.value)} />
                      <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>Send Prescription to Pharmacy ➔</button>
                    </form>
                  )}

                  {doctorActionTab === 'referral' && (
                    <form onSubmit={handleDoctorReferral}>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>Target Specialty Department</label>
                      <select style={{ width: '100%', padding: '8px', marginBottom: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }} value={referralDept} onChange={e => setReferralDept(e.target.value)}>
                        <option>Cardiology</option>
                        <option>Orthopedics</option>
                        <option>Pulmonology</option>
                        <option>Nephrology</option>
                        <option>General Surgery</option>
                      </select>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>Consultation Reason</label>
                      <input type="text" style={{ width: '100%', padding: '8px', marginBottom: '16px', borderRadius: '6px', border: '1px solid #cbd5e1' }} value={referralReason} onChange={e => setReferralReason(e.target.value)} />
                      <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#7c3aed', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>Request Specialist Consultation ➔</button>
                    </form>
                  )}

                  {doctorActionTab === 'admit' && (
                    <form onSubmit={handleDoctorAdmit}>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>Ward Type</label>
                      <select style={{ width: '100%', padding: '8px', marginBottom: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }} value={admitWard} onChange={e => setAdmitWard(e.target.value)}>
                        <option>General Ward (Male)</option>
                        <option>General Ward (Female)</option>
                        <option>ICU</option>
                        <option>Post-Operative Care</option>
                      </select>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>Bed Number</label>
                      <input type="text" style={{ width: '100%', padding: '8px', marginBottom: '16px', borderRadius: '6px', border: '1px solid #cbd5e1' }} value={admitBed} onChange={e => setAdmitBed(e.target.value)} />
                      <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>Admit to Inpatient Ward ➔</button>
                    </form>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 4. LAB TECHNICIAN DASHBOARD */}
        {activeView === 'lab' && currentUser?.role === 'lab' && (
          <div style={{ width: '100%', maxWidth: '880px', backgroundColor: 'white', padding: '32px', borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
            <h2 style={{ margin: '0 0 6px 0', color: '#0f172a' }}>🔬 Diagnostic Laboratory Monitor</h2>
            <p style={{ margin: '0 0 20px 0', color: '#64748b', fontSize: '14px' }}>All incoming doctor test requests appear here in real-time. No manual paper requisitions.</p>

            {labMessage && <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#f0fdf4', color: '#166534', borderRadius: '8px' }}>{labMessage}</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {labOrders.map(order => (
                <div key={order._id} style={{ border: '1px solid #e2e8f0', padding: '20px', borderRadius: '10px', backgroundColor: '#f8fafc' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div>
                      <strong style={{ fontSize: '16px', color: '#0f172a' }}>{order.testName}</strong>
                      <span style={{ fontSize: '13px', color: '#64748b', marginLeft: '12px' }}>Patient: <strong>{order.patientId}</strong></span>
                    </div>
                    <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', backgroundColor: order.status === 'REPORT_READY' ? '#dcfce7' : '#fef3c7', color: order.status === 'REPORT_READY' ? '#15803d' : '#b45309' }}>
                      {order.status}
                    </span>
                  </div>

                  <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '14px' }}>
                    Target Room: {order.labRoom} | Notes: {order.notes || 'None'}
                  </div>

                  {order.status === 'PENDING' && (
                    <button onClick={() => handleLabCollect(order._id)} style={{ padding: '10px 18px', backgroundColor: '#d97706', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>
                      🧪 Record Sample Collected
                    </button>
                  )}

                  {order.status === 'SAMPLE_COLLECTED' && (
                    <div style={{ marginTop: '10px' }}>
                      <input 
                        type="text" 
                        placeholder="Enter clinical report findings (e.g. Hb: 13.5 g/dL, Platelets: Normal)..."
                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '10px' }}
                        onChange={e => setLabFindingsInput({ ...labFindingsInput, [order._id]: e.target.value })}
                      />
                      <button onClick={() => handleLabPublish(order._id)} style={{ padding: '10px 18px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>
                        ✅ Upload & Publish Report to Patient & Doctor
                      </button>
                    </div>
                  )}

                  {order.status === 'REPORT_READY' && (
                    <div style={{ backgroundColor: 'white', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', color: '#166534' }}>
                      Published Findings: {order.findings}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. PHARMACY DASHBOARD */}
        {activeView === 'pharmacy' && currentUser?.role === 'pharmacy' && (
          <div style={{ width: '100%', maxWidth: '820px', backgroundColor: 'white', padding: '32px', borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
            <h2 style={{ margin: '0 0 6px 0', color: '#0f172a' }}>💊 Pharmacy Dispensing Station</h2>
            <p style={{ margin: '0 0 20px 0', color: '#64748b', fontSize: '14px' }}>Digital prescriptions sent directly from doctors. Zero leakage tracking.</p>

            {pharmacyMessage && <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#f0fdf4', color: '#166534', borderRadius: '8px' }}>{pharmacyMessage}</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {prescriptions.map(rx => (
                <div key={rx._id} style={{ border: '1px solid #e2e8f0', padding: '20px', borderRadius: '10px', backgroundColor: '#f8fafc' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <strong>Patient ID: {rx.patientId}</strong>
                    <span style={{ fontSize: '13px', color: rx.status === 'COMPLETELY_DISPENSED' ? '#16a34a' : '#d97706', fontWeight: 'bold' }}>{rx.status}</span>
                  </div>
                  <ul style={{ margin: '0 0 14px 0', paddingLeft: '20px', fontSize: '14px' }}>
                    {rx.medicines.map((m, i) => (
                      <li key={i}>{m.name} - {m.dosage} ({m.durationDays}d)</li>
                    ))}
                  </ul>

                  {rx.status !== 'COMPLETELY_DISPENSED' && (
                    <button onClick={() => handleDispense(rx._id)} style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>
                      Dispense & Log Digitally ➔
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 6. INPATIENT WARD DASHBOARD */}
        {activeView === 'ward' && currentUser?.role === 'ward' && (
          <div style={{ width: '100%', maxWidth: '860px', backgroundColor: 'white', padding: '32px', borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
            <h2 style={{ margin: '0 0 6px 0', color: '#0f172a' }}>🛏️ Inpatient Ward & Micro-Resource Tracker</h2>
            <p style={{ margin: '0 0 20px 0', color: '#64748b', fontSize: '14px' }}>Log bed allocations, surgical consumables, blood units, and patient discharges.</p>

            {wardMessage && <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#f0fdf4', color: '#166534', borderRadius: '8px' }}>{wardMessage}</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {admissionsList.map(adm => (
                <div key={adm._id} style={{ border: '1px solid #e2e8f0', padding: '20px', borderRadius: '10px', backgroundColor: '#f8fafc' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div>
                      <strong style={{ fontSize: '16px', color: '#0f172a' }}>Patient: {adm.patientId}</strong>
                      <div style={{ fontSize: '13px', color: '#64748b' }}>{adm.wardType} - {adm.bedNumber}</div>
                    </div>
                    <button onClick={() => handleDischarge(adm._id)} style={{ padding: '6px 14px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>
                      Discharge Patient ➔
                    </button>
                  </div>

                  <div style={{ backgroundColor: 'white', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '12px' }}>
                    <strong style={{ fontSize: '13px', color: '#334155' }}>Items & Consumables Logged:</strong>
                    <ul style={{ margin: '6px 0 0 0', paddingLeft: '20px', fontSize: '13px', color: '#64748b' }}>
                      {adm.resourcesAllocated.map((res, i) => (
                        <li key={i}>{res.itemName} (Qty: {res.quantity}) - by {res.loggedByStaff}</li>
                      ))}
                    </ul>
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input type="text" placeholder="e.g. Blood Unit O+ / Syringe 10ml / Dressing..." style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} value={resourceItemName} onChange={e => setResourceItemName(e.target.value)} />
                    <button onClick={() => handleLogResource(adm._id)} style={{ padding: '8px 16px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                      + Log Resource
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 7. O/P COUNTER DESK */}
        {activeView === 'op-desk' && currentUser?.role === 'op-desk' && (
          <div style={{ width: '100%', maxWidth: '620px', backgroundColor: 'white', padding: '36px', borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
            <h2 style={{ margin: '0 0 6px 0', color: '#0f172a' }}>O/P Reception Registration</h2>
            <p style={{ margin: '0 0 20px 0', color: '#64748b', fontSize: '14px' }}>Register new patient & send credentials directly to their WhatsApp.</p>

            <form onSubmit={handleOpRegister}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '600' }}>Patient Name</label>
                <input required type="text" style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }} value={opForm.name} onChange={e => setOpForm({...opForm, name: e.target.value})} />
              </div>

              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '600' }}>Age</label>
                  <input required type="number" style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }} value={opForm.age} onChange={e => setOpForm({...opForm, age: e.target.value})} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '600' }}>Gender</label>
                  <select style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: 'white' }} value={opForm.gender} onChange={e => setOpForm({...opForm, gender: e.target.value})}>
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '600' }}>WhatsApp Mobile Number</label>
                <input required type="tel" style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }} value={opForm.phoneNumber} onChange={e => setOpForm({...opForm, phoneNumber: e.target.value})} />
              </div>

              <button type="submit" style={{ width: '100%', padding: '14px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer' }}>
                Create File & Dispatch Credentials 🚀
              </button>
            </form>

            {opTicket && (
              <div style={{ marginTop: '20px', padding: '16px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px' }}>
                <strong>✅ Registered: {opTicket.patient.name} ({opTicket.credentials.patientId})</strong>
                <div style={{ fontSize: '13px', color: '#166534', marginTop: '4px' }}>
                  Passcode: {opTicket.credentials.password} | Assigned to {opTicket.assignedTo.doctorName}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 8. HOSPITAL MANAGEMENT & OVERSIGHT */}
        {activeView === 'admin' && currentUser?.role === 'admin' && (
          <div style={{ width: '100%', maxWidth: '880px', backgroundColor: 'white', padding: '36px', borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
            <h2 style={{ margin: '0 0 6px 0', color: '#0f172a' }}>📊 Hospital Administration & Anti-Corruption Oversight</h2>
            <p style={{ margin: '0 0 24px 0', color: '#64748b', fontSize: '14px' }}>Live metrics, turnaround times, and automated accountability warnings.</p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '28px' }}>
              <div style={{ padding: '20px', borderRadius: '10px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe' }}>
                <span style={{ fontSize: '12px', color: '#1e40af', fontWeight: 'bold' }}>Average Wait Time</span>
                <h3 style={{ margin: '6px 0 0 0', color: '#1d4ed8', fontSize: '24px' }}>14 Mins</h3>
                <span style={{ fontSize: '12px', color: '#16a34a' }}>↓ 72% faster than manual queue</span>
              </div>

              <div style={{ padding: '20px', borderRadius: '10px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                <span style={{ fontSize: '12px', color: '#15803d', fontWeight: 'bold' }}>Bribery Prevention</span>
                <h3 style={{ margin: '6px 0 0 0', color: '#16a34a', fontSize: '24px' }}>100% Digital</h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Zero cash transactions allowed</span>
              </div>

              <div style={{ padding: '20px', borderRadius: '10px', backgroundColor: '#fef3c7', border: '1px solid #fde68a' }}>
                <span style={{ fontSize: '12px', color: '#92400e', fontWeight: 'bold' }}>Active SLA Warnings</span>
                <h3 style={{ margin: '6px 0 0 0', color: '#b45309', fontSize: '24px' }}>0 Delayed</h3>
                <span style={{ fontSize: '12px', color: '#16a34a' }}>All labs within timeframe</span>
              </div>
            </div>

            <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#0f172a' }}>Real-time Audit Logs</h4>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#64748b', lineHeight: '1.8' }}>
                <li>✅ PT-1001 auto-assigned to Dr. Ramesh Sharma based on shortest waiting queue.</li>
                <li>✅ Complete Blood Count test digitally dispatched to Pathology Lab 1 (Room 105).</li>
                <li>✅ Sister Mary logged 1x IV Infusion set for PT-1004 (Zero Leakage verification).</li>
              </ul>
            </div>
          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer style={{ backgroundColor: '#ffffff', borderTop: '1px solid #e2e8f0', color: '#64748b', textAlign: 'center', padding: '20px', fontSize: '13px' }}>
        &copy; 2026 Chikitsya Setu - Gandhi Hospital Transparency Platform
      </footer>

      {/* UNIFIED ROLE LOGIN MODAL */}
      {showLoginModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 }}>
          <div style={{ backgroundColor: 'white', width: '100%', maxWidth: '480px', borderRadius: '16px', padding: '32px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', position: 'relative' }}>
            <button onClick={() => setShowLoginModal(false)} style={{ position: 'absolute', top: '18px', right: '18px', background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>✕</button>

            <h3 style={{ margin: '0 0 6px 0', fontSize: '20px', color: '#0f172a' }}>Login to Chikitsya Setu</h3>
            <p style={{ margin: '0 0 18px 0', fontSize: '13px', color: '#64748b' }}>Select your portal role to continue.</p>

            {/* Role Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '20px' }}>
              {[
                { key: 'patient', label: '👤 Patient' },
                { key: 'doctor', label: '👨‍⚕️ Doctor' },
                { key: 'lab', label: '🔬 Lab' },
                { key: 'pharmacy', label: '💊 Pharmacy' },
                { key: 'ward', label: '🛏️ Ward' },
                { key: 'op-desk', label: '🎫 O/P Desk' },
                { key: 'admin', label: '📊 Admin' }
              ].map(r => (
                <button
                  key={r.key}
                  onClick={() => {
                    if (r.key === 'lab' || r.key === 'pharmacy' || r.key === 'ward' || r.key === 'op-desk' || r.key === 'admin') {
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

            {/* Patient Login Form */}
            {loginRole === 'patient' && (
              <div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                  <button onClick={() => setPatientLoginMode('password')} style={{ flex: 1, padding: '6px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: patientLoginMode === 'password' ? '#e2e8f0' : 'white', cursor: 'pointer' }}>Passcode</button>
                  <button onClick={() => setPatientLoginMode('otp')} style={{ flex: 1, padding: '6px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: patientLoginMode === 'otp' ? '#e2e8f0' : 'white', cursor: 'pointer' }}>WhatsApp OTP</button>
                </div>

                {patientLoginMode === 'password' ? (
                  <form onSubmit={handlePatientPasswordLogin}>
                    <input required type="text" placeholder="Patient ID (e.g. PT-1001)" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '12px' }} value={loginId} onChange={e => setLoginId(e.target.value)} />
                    <input required type="password" placeholder="Passcode (e.g. pass1)" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '16px' }} value={loginPassword} onChange={e => setLoginPassword(e.target.value)} />
                    <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>Log In as Patient ➔</button>
                  </form>
                ) : (
                  <div>
                    {!otpSent ? (
                      <form onSubmit={handleSendOtp}>
                        <input required type="text" placeholder="Patient ID or Mobile" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '14px' }} value={otpIdentifier} onChange={e => setOtpIdentifier(e.target.value)} />
                        <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#25D366', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>💬 Send OTP to WhatsApp</button>
                      </form>
                    ) : (
                      <form onSubmit={handleVerifyOtp}>
                        <input required type="text" maxLength={6} placeholder="123456" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', textAlign: 'center', fontSize: '18px', letterSpacing: '4px', marginBottom: '14px' }} value={enteredOtp} onChange={e => setEnteredOtp(e.target.value)} />
                        <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>Verify & Log In ➔</button>
                      </form>
                    )}
                  </div>
                )}
                {loginError && <p style={{ color: '#dc2626', fontSize: '13px', marginTop: '10px' }}>⚠️ {loginError}</p>}
                {otpError && <p style={{ color: '#dc2626', fontSize: '13px', marginTop: '10px' }}>⚠️ {otpError}</p>}
              </div>
            )}

            {/* Doctor Select */}
            {loginRole === 'doctor' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
                {doctorsList.map(doc => (
                  <button key={doc.doctorId} onClick={() => handleRoleSelectLogin('doctor', doc)} style={{ padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: 'white', textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div><strong>{doc.name}</strong><div style={{ fontSize: '12px', color: '#64748b' }}>{doc.department}</div></div>
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
