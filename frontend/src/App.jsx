import { useState, useEffect } from 'react'
import axios from 'axios'

const API_BASE = 'http://localhost:5000/api'

function App() {
  // Navigation State: 'default-home' | 'patient-dashboard' | 'doctor-dashboard' | 'op-desk'
  const [activeView, setActiveView] = useState('default-home')

  // Login Modal State
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [loginRole, setLoginRole] = useState('patient') // 'patient' | 'doctor' | 'op-desk'

  // Logged-in session object: { role: 'patient' | 'doctor' | 'op-desk', data: ... }
  const [currentUser, setCurrentUser] = useState(null)

  // ---------- PATIENT LOGIN STATE ----------
  const [patientLoginMode, setPatientLoginMode] = useState('password') // 'password' | 'otp'
  const [loginId, setLoginId] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  
  const [otpIdentifier, setOtpIdentifier] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [enteredOtp, setEnteredOtp] = useState('')
  const [otpInfo, setOtpInfo] = useState(null)
  const [otpError, setOtpError] = useState('')

  // ---------- O/P DESK STATE ----------
  const [opForm, setOpForm] = useState({ name: '', age: '', gender: 'Male', phoneNumber: '' })
  const [opTicket, setOpTicket] = useState(null)
  const [opError, setOpError] = useState('')

  // ---------- DOCTOR STATE ----------
  const [doctorsList, setDoctorsList] = useState([])
  const [selectedDoctorId, setSelectedDoctorId] = useState('DR-GEN-01')
  const [doctorQueue, setDoctorQueue] = useState([])
  const [activePatientForExam, setActivePatientForExam] = useState(null)
  const [selectedTest, setSelectedTest] = useState('Complete Blood Count (CBC)')
  const [selectedLabRoom, setSelectedLabRoom] = useState('Pathology Lab 1 (Room 105)')
  const [clinicalNotes, setClinicalNotes] = useState('')
  const [doctorActionMessage, setDoctorActionMessage] = useState('')

  // ---------- WHATSAPP SIMULATOR ----------
  const [whatsAppNotification, setWhatsAppNotification] = useState(null)

  const showWhatsAppAlert = (notification) => {
    setWhatsAppNotification(notification)
    setTimeout(() => {
      setWhatsAppNotification(null)
    }, 12000)
  }

  useEffect(() => {
    fetchDoctors()
  }, [])

  useEffect(() => {
    if (activeView === 'doctor-dashboard' && selectedDoctorId) {
      fetchDoctorQueue(selectedDoctorId)
    }
  }, [activeView, selectedDoctorId])

  const fetchDoctors = async () => {
    try {
      const res = await axios.get(`${API_BASE}/doctors`)
      setDoctorsList(res.data)
    } catch (err) {
      console.error('Error fetching doctors:', err)
    }
  }

  const fetchDoctorQueue = async (docId) => {
    try {
      const res = await axios.get(`${API_BASE}/doctors/${docId}/patients`)
      setDoctorQueue(res.data)
    } catch (err) {
      console.error('Error fetching queue:', err)
    }
  }

  // 1. Patient Password Login
  const handlePatientPasswordLogin = async (e) => {
    e.preventDefault()
    setLoginError('')
    try {
      const response = await axios.post(`${API_BASE}/patients/login`, {
        patientId: loginId,
        password: loginPassword
      })
      setCurrentUser({ role: 'patient', data: response.data.patient })
      setActiveView('patient-dashboard')
      setShowLoginModal(false)
      setLoginId('')
      setLoginPassword('')
    } catch (err) {
      setLoginError(err.response?.data?.message || 'Invalid credentials.')
    }
  }

  // 2. Send WhatsApp OTP
  const handleSendOtp = async (e) => {
    e.preventDefault()
    setOtpError('')
    try {
      const response = await axios.post(`${API_BASE}/patients/send-otp`, {
        identifier: otpIdentifier
      })
      setOtpSent(true)
      setOtpInfo(response.data)
      if (response.data.whatsAppNotification) {
        showWhatsAppAlert(response.data.whatsAppNotification)
      }
    } catch (err) {
      setOtpError(err.response?.data?.message || 'Failed to send OTP.')
    }
  }

  // 3. Verify OTP & Patient Login
  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    setOtpError('')
    try {
      const response = await axios.post(`${API_BASE}/patients/verify-otp`, {
        identifier: otpIdentifier,
        otp: enteredOtp
      })
      setCurrentUser({ role: 'patient', data: response.data.patient })
      setActiveView('patient-dashboard')
      setShowLoginModal(false)
      setOtpSent(false)
      setEnteredOtp('')
      setOtpIdentifier('')
      setOtpInfo(null)
    } catch (err) {
      setOtpError(err.response?.data?.message || 'Invalid OTP.')
    }
  }

  // 4. Doctor Login
  const handleDoctorLogin = (docId) => {
    const doc = doctorsList.find(d => d.doctorId === docId)
    setCurrentUser({ role: 'doctor', data: doc })
    setSelectedDoctorId(docId)
    setActiveView('doctor-dashboard')
    setShowLoginModal(false)
  }

  // 5. O/P Desk Registration
  const handleOpRegister = async (e) => {
    e.preventDefault()
    setOpError('')
    setOpTicket(null)
    try {
      const response = await axios.post(`${API_BASE}/patients/register`, opForm)
      setOpTicket(response.data)
      if (response.data.whatsAppNotification) {
        showWhatsAppAlert(response.data.whatsAppNotification)
      }
      setOpForm({ name: '', age: '', gender: 'Male', phoneNumber: '' })
      if (selectedDoctorId) fetchDoctorQueue(selectedDoctorId)
    } catch (err) {
      setOpError(err.response?.data?.message || 'Error registering patient.')
    }
  }

  // Logout
  const handleLogout = () => {
    setCurrentUser(null)
    setActiveView('default-home')
    setLoginError('')
    setOtpError('')
    setOtpSent(false)
  }

  // Doctor Order Lab Test
  const handleOrderLabTest = async (e) => {
    e.preventDefault()
    if (!activePatientForExam) return
    setDoctorActionMessage('')
    try {
      const res = await axios.post(`${API_BASE}/doctors/order-lab`, {
        doctorId: selectedDoctorId,
        patientId: activePatientForExam.patientId,
        testName: selectedTest,
        labRoom: selectedLabRoom,
        notes: clinicalNotes
      })
      setDoctorActionMessage(`✅ ${res.data.message}`)
      setActivePatientForExam(null)
      setClinicalNotes('')
      fetchDoctorQueue(selectedDoctorId)
    } catch (err) {
      setDoctorActionMessage(`⚠️ ${err.response?.data?.message || 'Failed to dispatch lab order.'}`)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', fontFamily: 'Segoe UI, Arial, sans-serif', margin: 0, backgroundColor: '#f8fafc' }}>
      
      {/* ----------------- WHATSAPP NOTIFICATION POPUP ----------------- */}
      {whatsAppNotification && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          backgroundColor: '#25D366',
          color: 'white',
          padding: '16px 20px',
          borderRadius: '12px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          maxWidth: '380px',
          zIndex: 9999
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <strong style={{ fontSize: '15px' }}>💬 WhatsApp Message Delivered</strong>
            <button onClick={() => setWhatsAppNotification(null)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontSize: '16px' }}>✕</button>
          </div>
          <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '6px' }}>To: +91 {whatsAppNotification.recipient}</div>
          <div style={{ backgroundColor: '#ffffff', color: '#111', padding: '12px', borderRadius: '8px', fontSize: '13px', whiteSpace: 'pre-line', lineHeight: '1.4' }}>
            {whatsAppNotification.message}
          </div>
        </div>
      )}

      {/* ----------------- HEADER (MATCHING USER SKETCH) ----------------- */}
      <header style={{
        backgroundColor: '#ffffff',
        borderBottom: '2px solid #e2e8f0',
        padding: '18px 48px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
      }}>
        {/* Left: Chikitsya Setu */}
        <div 
          onClick={() => {
            if (!currentUser) setActiveView('default-home')
          }}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#0f172a', letterSpacing: '-0.5px' }}>
            Chikitsya Setu
          </h1>
        </div>

        {/* Right: Login button OR Active User Profile */}
        <div>
          {currentUser ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <span style={{ fontSize: '14px', color: '#334155', fontWeight: '600' }}>
                {currentUser.role === 'patient' && `👤 Patient: ${currentUser.data.name}`}
                {currentUser.role === 'doctor' && `👨‍⚕️ ${currentUser.data.name}`}
                {currentUser.role === 'op-desk' && `🎫 O/P Counter Staff`}
              </span>
              <button 
                onClick={handleLogout}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f1f5f9',
                  color: '#dc2626',
                  border: '1px solid #fca5a5',
                  borderRadius: '6px',
                  fontWeight: '600',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}>
                Log Out 🚪
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setShowLoginModal(true)}
              style={{
                padding: '10px 24px',
                backgroundColor: '#0f172a',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: '600',
                cursor: 'pointer'
              }}>
              Login
            </button>
          )}
        </div>
      </header>

      {/* ----------------- MAIN BODY ----------------- */}
      <main style={{ flex: 1, padding: '48px 20px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>

        {/* =========================================================================
            DEFAULT VIEW: CLEAN HOSPITAL LANDING BODY
            ========================================================================= */}
        {activeView === 'default-home' && (
          <div style={{ width: '100%', maxWidth: '820px', textAlign: 'center' }}>
            <div style={{ backgroundColor: 'white', padding: '56px 40px', borderRadius: '20px', boxShadow: '0 4px 28px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '56px', display: 'block', marginBottom: '16px' }}>🏥</span>
              <h2 style={{ fontSize: '32px', color: '#0f172a', margin: '0 0 16px 0', fontWeight: 'bold' }}>
                Gandhi Hospital Digital Care Portal
              </h2>
              <p style={{ fontSize: '16px', color: '#64748b', maxWidth: '620px', margin: '0 auto 32px auto', lineHeight: '1.7' }}>
                Welcome to <strong>Chikitsya Setu</strong>, the unified transparent healthcare platform. 
                Digitally guiding patients from Outpatient registration to consultation, laboratory tests, and discharge without paper slips or delays.
              </p>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <button 
                  onClick={() => setShowLoginModal(true)}
                  style={{
                    padding: '14px 32px',
                    backgroundColor: '#0f172a',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(15, 23, 42, 0.25)'
                  }}>
                  Login to Access Portal ➔
                </button>
              </div>

              {/* Feature Highlights */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginTop: '48px', textAlign: 'left' }}>
                <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '24px' }}>📲</span>
                  <h4 style={{ margin: '10px 0 6px 0', color: '#0f172a' }}>Real-time Journey</h4>
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: '1.5' }}>
                    Track your doctor room number and queue status live on your phone.
                  </p>
                </div>

                <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '24px' }}>🛡️</span>
                  <h4 style={{ margin: '10px 0 6px 0', color: '#0f172a' }}>Zero Corruption</h4>
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: '1.5' }}>
                    100% digital test dispatch and automated reports. No bribes or middle-men.
                  </p>
                </div>

                <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '24px' }}>👨‍⚕️</span>
                  <h4 style={{ margin: '10px 0 6px 0', color: '#0f172a' }}>Balanced Care</h4>
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: '1.5' }}>
                    Automated patient load balancing across on-shift doctors.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            VIEW: PATIENT DASHBOARD (AFTER PATIENT LOGIN)
            ========================================================================= */}
        {activeView === 'patient-dashboard' && currentUser?.role === 'patient' && (
          <div style={{ width: '100%', maxWidth: '680px', backgroundColor: 'white', padding: '36px', borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '20px', marginBottom: '24px' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#2563eb', textTransform: 'uppercase', letterSpacing: '1px' }}>Active Hospital File</span>
                <h2 style={{ margin: '4px 0 2px 0', color: '#0f172a', fontSize: '24px' }}>{currentUser.data.name}</h2>
                <span style={{ fontSize: '13px', color: '#64748b' }}>ID: <strong>{currentUser.data.patientId}</strong> | Mobile: +91 {currentUser.data.phoneNumber}</span>
              </div>
            </div>

            {/* Current Stage Banner */}
            <div style={{
              backgroundColor: currentUser.data.currentStatus === 'IN_LAB' ? '#fffbeb' : '#eff6ff',
              border: '1px solid',
              borderColor: currentUser.data.currentStatus === 'IN_LAB' ? '#fde68a' : '#bfdbfe',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '28px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '18px' }}>📍</span>
                <strong style={{ fontSize: '13px', color: currentUser.data.currentStatus === 'IN_LAB' ? '#92400e' : '#1e40af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Live Hospital Stage
                </strong>
              </div>
              <h3 style={{ margin: '4px 0 0 0', color: currentUser.data.currentStatus === 'IN_LAB' ? '#b45309' : '#1d4ed8', fontSize: '18px' }}>
                {currentUser.data.currentStatus === 'WAITING_FOR_DOCTOR' && 'Step 1: Consultation - Waiting for Doctor'}
                {currentUser.data.currentStatus === 'IN_LAB' && 'Step 2: Diagnostics - Please Walk to the Lab'}
                {currentUser.data.currentStatus === 'DISCHARGED' && 'Step 3: Consultation Complete / Discharged'}
              </h3>
            </div>

            {/* Guidance Card */}
            {currentUser.data.currentStatus === 'WAITING_FOR_DOCTOR' && (
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', marginBottom: '28px', backgroundColor: '#f8fafc' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <span style={{ fontSize: '28px' }}>👨‍⚕️</span>
                  <div>
                    <h4 style={{ margin: 0, color: '#0f172a', fontSize: '17px' }}>
                      {currentUser.data.assignedDoctor ? currentUser.data.assignedDoctor.name : 'Dr. Ramesh Sharma'}
                    </h4>
                    <span style={{ fontSize: '13px', color: '#64748b' }}>Department of General Medicine</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Assigned Room</span>
                    <strong style={{ fontSize: '16px', color: '#0f172a' }}>Room 102 (Block A)</strong>
                  </div>
                  <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Queue Position</span>
                    <strong style={{ fontSize: '16px', color: '#d97706' }}>In Active Queue</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Stage 2 Lab Instructions */}
            {currentUser.data.currentStatus === 'IN_LAB' && (
              <div style={{ border: '2px solid #f59e0b', borderRadius: '12px', padding: '24px', marginBottom: '28px', backgroundColor: '#fffbeb' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '28px' }}>🔬</span>
                  <div>
                    <h4 style={{ margin: 0, color: '#92400e', fontSize: '17px' }}>Diagnostic Test Ordered</h4>
                    <span style={{ fontSize: '13px', color: '#78350f' }}>Please proceed to <strong>Pathology Lab 1 (Room 105)</strong></span>
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: '14px', color: '#451a03' }}>
                  Provide your Patient ID (<strong>{currentUser.data.patientId}</strong>) at the lab counter. No paper slips needed.
                </p>
              </div>
            )}

            {/* Timeline */}
            <h4 style={{ color: '#334155', marginBottom: '14px', fontSize: '15px' }}>Hospital Journey Timeline</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', borderRadius: '8px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                <span>✅</span>
                <div>
                  <strong style={{ fontSize: '14px', color: '#166534' }}>O/P Desk Registration</strong>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Account initialized & doctor assigned.</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', borderRadius: '8px', backgroundColor: currentUser.data.currentStatus === 'IN_LAB' || currentUser.data.currentStatus === 'DISCHARGED' ? '#f0fdf4' : '#eff6ff', border: '1px solid #bfdbfe' }}>
                <span>{currentUser.data.currentStatus === 'IN_LAB' || currentUser.data.currentStatus === 'DISCHARGED' ? '✅' : '⏳'}</span>
                <div>
                  <strong style={{ fontSize: '14px', color: '#0f172a' }}>Doctor Consultation</strong>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Waiting outside Room 102.</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', borderRadius: '8px', backgroundColor: currentUser.data.currentStatus === 'IN_LAB' ? '#fffbeb' : '#f8fafc', border: '1px solid #e2e8f0' }}>
                <span>{currentUser.data.currentStatus === 'IN_LAB' ? '🔬' : '⚪'}</span>
                <div>
                  <strong style={{ fontSize: '14px', color: '#0f172a' }}>Lab & Diagnostics</strong>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Sample collection and reports.</div>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* =========================================================================
            VIEW: DOCTOR DASHBOARD (AFTER DOCTOR LOGIN)
            ========================================================================= */}
        {activeView === 'doctor-dashboard' && currentUser?.role === 'doctor' && (
          <div style={{ width: '100%', maxWidth: '900px' }}>
            <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold' }}>Doctor Clinical Station</span>
                <h2 style={{ margin: '4px 0 0 0', color: '#0f172a' }}>{currentUser.data.name} ({currentUser.data.department})</h2>
              </div>
            </div>

            {doctorActionMessage && (
              <div style={{ marginBottom: '20px', padding: '14px', backgroundColor: '#f0fdf4', color: '#166534', borderRadius: '8px', border: '1px solid #bbf7d0', fontWeight: '600' }}>
                {doctorActionMessage}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: activePatientForExam ? '1fr 1.2fr' : '1fr', gap: '24px' }}>
              <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                <h3 style={{ margin: '0 0 16px 0', color: '#0f172a', fontSize: '18px' }}>Waiting Patients ({doctorQueue.length})</h3>

                {doctorQueue.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '36px 12px', color: '#94a3b8' }}>
                    <p style={{ margin: 0, fontSize: '14px' }}>No patients currently waiting.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {doctorQueue.map((patient, index) => (
                      <div key={patient.patientId} style={{ border: activePatientForExam?.patientId === patient.patientId ? '2px solid #2563eb' : '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong>#{index + 1} {patient.name}</strong>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>{patient.patientId} | {patient.gender}, {patient.age}y</div>
                        </div>
                        <button 
                          onClick={() => setActivePatientForExam(patient)}
                          style={{ padding: '6px 12px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                          Examine ➔
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {activePatientForExam && (
                <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                  <h3 style={{ margin: '0 0 14px 0', color: '#0f172a' }}>Examining {activePatientForExam.name}</h3>
                  <form onSubmit={handleOrderLabTest}>
                    <div style={{ marginBottom: '14px' }}>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '600' }}>Order Diagnostic Test</label>
                      <select 
                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                        value={selectedTest}
                        onChange={e => setSelectedTest(e.target.value)}
                      >
                        <option>Complete Blood Count (CBC)</option>
                        <option>Chest X-Ray (PA View)</option>
                        <option>Kidney Function Test (KFT)</option>
                      </select>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '600' }}>Designated Lab Room</label>
                      <select 
                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                        value={selectedLabRoom}
                        onChange={e => setSelectedLabRoom(e.target.value)}
                      >
                        <option>Pathology Lab 1 (Room 105)</option>
                        <option>Radiology Wing (Room 12)</option>
                      </select>
                    </div>

                    <button 
                      type="submit" 
                      style={{ width: '100%', padding: '12px', backgroundColor: '#d97706', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>
                      🔬 Dispatch to Lab Monitor
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        )}

        {/* =========================================================================
            VIEW: O/P COUNTER DESK (ACCESSIBLE VIA LOGIN FOR STAFF)
            ========================================================================= */}
        {activeView === 'op-desk' && currentUser?.role === 'op-desk' && (
          <div style={{ width: '100%', maxWidth: '620px', backgroundColor: 'white', padding: '36px', borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
            <h2 style={{ margin: '0 0 6px 0', color: '#0f172a' }}>O/P Reception Registration</h2>
            <p style={{ margin: '0 0 20px 0', color: '#64748b', fontSize: '14px' }}>Register new arrival & send credentials to their WhatsApp.</p>

            <form onSubmit={handleOpRegister}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '600' }}>Patient Name</label>
                <input 
                  required 
                  type="text" 
                  style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  value={opForm.name} 
                  onChange={e => setOpForm({...opForm, name: e.target.value})} 
                />
              </div>

              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '600' }}>Age</label>
                  <input 
                    required 
                    type="number" 
                    style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    value={opForm.age} 
                    onChange={e => setOpForm({...opForm, age: e.target.value})} 
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '600' }}>Gender</label>
                  <select 
                    style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: 'white' }}
                    value={opForm.gender} 
                    onChange={e => setOpForm({...opForm, gender: e.target.value})}
                  >
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '600' }}>WhatsApp Mobile Number</label>
                <input 
                  required 
                  type="tel" 
                  style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  value={opForm.phoneNumber} 
                  onChange={e => setOpForm({...opForm, phoneNumber: e.target.value})} 
                />
              </div>

              <button 
                type="submit" 
                style={{ width: '100%', padding: '14px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer' }}>
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

      </main>

      {/* ----------------- FOOTER (MATCHING USER SKETCH) ----------------- */}
      <footer style={{
        backgroundColor: '#ffffff',
        borderTop: '1px solid #e2e8f0',
        color: '#64748b',
        textAlign: 'center',
        padding: '20px',
        fontSize: '13px'
      }}>
        &copy; 2026 Chikitsya Setu - Gandhi Hospital Transparency Platform
      </footer>

      {/* =========================================================================
          UNIFIED ROLE LOGIN MODAL (TRIGGERED BY HEADER 'LOGIN' BUTTON)
          ========================================================================= */}
      {showLoginModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 10000
        }}>
          <div style={{
            backgroundColor: 'white',
            width: '100%',
            maxWidth: '460px',
            borderRadius: '16px',
            padding: '32px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            position: 'relative'
          }}>
            <button 
              onClick={() => setShowLoginModal(false)}
              style={{ position: 'absolute', top: '18px', right: '18px', background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>
              ✕
            </button>

            <h3 style={{ margin: '0 0 6px 0', fontSize: '20px', color: '#0f172a' }}>Login to Chikitsya Setu</h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#64748b' }}>Select your role to access your portal.</p>

            {/* Role Switcher */}
            <div style={{ display: 'flex', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '8px', marginBottom: '20px' }}>
              <button 
                onClick={() => setLoginRole('patient')}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: loginRole === 'patient' ? 'white' : 'transparent',
                  fontWeight: '600',
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: loginRole === 'patient' ? '0 2px 4px rgba(0,0,0,0.08)' : 'none'
                }}>
                👤 Patient
              </button>
              <button 
                onClick={() => setLoginRole('doctor')}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: loginRole === 'doctor' ? 'white' : 'transparent',
                  fontWeight: '600',
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: loginRole === 'doctor' ? '0 2px 4px rgba(0,0,0,0.08)' : 'none'
                }}>
                👨‍⚕️ Doctor
              </button>
              <button 
                onClick={() => {
                  setCurrentUser({ role: 'op-desk', data: { name: 'Counter Staff' } })
                  setActiveView('op-desk')
                  setShowLoginModal(false)
                }}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  fontWeight: '600',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}>
                🎫 O/P Staff
              </button>
            </div>

            {/* Patient Login Form */}
            {loginRole === 'patient' && (
              <div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                  <button 
                    onClick={() => setPatientLoginMode('password')}
                    style={{ flex: 1, padding: '6px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: patientLoginMode === 'password' ? '#e2e8f0' : 'white', cursor: 'pointer' }}>
                    Passcode
                  </button>
                  <button 
                    onClick={() => setPatientLoginMode('otp')}
                    style={{ flex: 1, padding: '6px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: patientLoginMode === 'otp' ? '#e2e8f0' : 'white', cursor: 'pointer' }}>
                    WhatsApp OTP
                  </button>
                </div>

                {patientLoginMode === 'password' ? (
                  <form onSubmit={handlePatientPasswordLogin}>
                    <div style={{ marginBottom: '14px' }}>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '600' }}>Patient ID</label>
                      <input 
                        required
                        type="text"
                        placeholder="e.g. PT-1001"
                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                        value={loginId}
                        onChange={e => setLoginId(e.target.value)}
                      />
                    </div>
                    <div style={{ marginBottom: '18px' }}>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '600' }}>Passcode</label>
                      <input 
                        required
                        type="password"
                        placeholder="e.g. pass1"
                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                        value={loginPassword}
                        onChange={e => setLoginPassword(e.target.value)}
                      />
                    </div>
                    <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>
                      Log In as Patient ➔
                    </button>
                  </form>
                ) : (
                  <div>
                    {!otpSent ? (
                      <form onSubmit={handleSendOtp}>
                        <div style={{ marginBottom: '14px' }}>
                          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '600' }}>Patient ID or Mobile</label>
                          <input 
                            required
                            type="text"
                            placeholder="PT-1001 or 9876500001"
                            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                            value={otpIdentifier}
                            onChange={e => setOtpIdentifier(e.target.value)}
                          />
                        </div>
                        <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#25D366', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>
                          💬 Send OTP to WhatsApp
                        </button>
                      </form>
                    ) : (
                      <form onSubmit={handleVerifyOtp}>
                        <div style={{ marginBottom: '14px' }}>
                          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '600' }}>Enter WhatsApp OTP</label>
                          <input 
                            required
                            type="text"
                            maxLength={6}
                            placeholder="123456"
                            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', textAlign: 'center', fontSize: '18px', letterSpacing: '4px' }}
                            value={enteredOtp}
                            onChange={e => setEnteredOtp(e.target.value)}
                          />
                        </div>
                        <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>
                          Verify OTP & Log In ➔
                        </button>
                      </form>
                    )}
                  </div>
                )}

                {loginError && <p style={{ color: '#dc2626', fontSize: '13px', marginTop: '10px' }}>⚠️ {loginError}</p>}
                {otpError && <p style={{ color: '#dc2626', fontSize: '13px', marginTop: '10px' }}>⚠️ {otpError}</p>}
              </div>
            )}

            {/* Doctor Login Select */}
            {loginRole === 'doctor' && (
              <div>
                <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '14px' }}>Select doctor account to enter clinical station:</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
                  {doctorsList.map(doc => (
                    <button 
                      key={doc.doctorId}
                      onClick={() => handleDoctorLogin(doc.doctorId)}
                      style={{
                        padding: '12px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        backgroundColor: 'white',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                      <div>
                        <strong>{doc.name}</strong>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>{doc.department}</div>
                      </div>
                      <span style={{ fontSize: '13px', color: '#2563eb', fontWeight: '600' }}>Enter ➔</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  )
}

export default App
