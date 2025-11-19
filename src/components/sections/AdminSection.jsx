import React, { useState, useEffect } from "react";
import { useApp } from "../../context/AppContext";

const AdminSection = () => {
  const {
    medicalTests,
    createMedicalTest,
    appointments,
    showNotification,
    allUsers,
    hospitals,
    createHospital,
    deleteHospital,
    deleteMedicalTest,
    deleteUser,
    updateAppointmentStatus,
    setCurrentResultDraft,
    createTestResult,
  currentResultDraft,
    adminStats,
    allAppointments,
    currentUser,
    updateMedicalTest,
    updateHospital,
    notifications,
    fetchHospitals,
    fetchAdminData,
  } = useApp();
  const [activeTab, setActiveTab] = useState("overview");
  const [adminActivities, setAdminActivities] = useState([]);
  const [bookingStatusFilter, setBookingStatusFilter] = useState("all");

  // Helper to support both snake_case (from backend) and camelCase (normalized) keys
  const getField = (obj, ...keys) => {
    if (!obj) return undefined;
    for (const k of keys) {
      if (obj[k] !== undefined && obj[k] !== null) return obj[k];
    }
    return undefined;
  };

  // const [deptInput, setDeptInput] = useState("");
  const [facilitiesInput, setFacilitiesInput] = useState("");

  // Initialize admin data
  useEffect(() => {
    const storedActivities =
      JSON.parse(localStorage.getItem("adminActivities")) || [];

    setAdminActivities(storedActivities);
  }, []);

  // If hospitals weren't loaded during app init (e.g. CORS or network error),
  // fetch them when admin opens the hospitals tab or when component mounts.
  useEffect(() => {
    let mounted = true;
    const ensureHospitals = async () => {
      try {
        if (mounted && (!hospitals || hospitals.length === 0)) {
          await fetchHospitals();
        }
      } catch (e) {
        console.error('Could not load hospitals for admin view', e);
        showNotification('Failed to load hospitals', 'error');
      }
    };

    // Fetch immediately if the hospitals tab is active, otherwise still ensure
    // we have hospitals once on mount so the select lists work.
    if (activeTab === 'hospitals') ensureHospitals();
    else ensureHospitals();

    return () => { mounted = false; };
  }, [activeTab, hospitals, fetchHospitals, showNotification]);

  // Ensure admin-specific data (users, appointments, tests) is loaded when
  // the admin views the relevant tabs. This helps when initial app
  // initialization failed or ran before auth headers were set.
  useEffect(() => {
    let mounted = true;
    const ensureAdminData = async () => {
      try {
        if (!mounted) return;
        if (currentUser && currentUser.role === 'admin') {
          // If any of the primary admin arrays are empty, refresh admin data
          if ((allUsers || []).length === 0 || (allAppointments || []).length === 0 || (medicalTests || []).length === 0) {
            await fetchAdminData();
          }
        }
      } catch (e) {
        console.error('Could not load admin data', e);
        showNotification('Failed to load admin data', 'error');
      }
    };

    // Trigger when admin opens admin dashboard or switches tabs
    if (activeTab === 'overview' || activeTab === 'users' || activeTab === 'bookings' || activeTab === 'tests') {
      ensureAdminData();
    }

    return () => { mounted = false; };
  }, [activeTab, currentUser, allUsers, allAppointments, medicalTests, fetchAdminData, showNotification]);

  // Admin stats
  const totalUsers = allUsers.length;
  const totalBookings = (currentUser && currentUser.role === 'admin') ? allAppointments.length : appointments.length;
  const totalTests = medicalTests.length;
  // Prefer adminStats.totalRevenue when available (server-calculated). Fallback to summing
  // appointment-level amounts or the included medicalTest price.
  const totalRevenue =
    (typeof adminStats !== "undefined" && adminStats && adminStats.totalRevenue) ||
    appointments.reduce((sum, apt) => {
      const priceFromTest = apt?.medicalTest?.price;
      const totalAmount = apt?.total_amount;
      const price = Number(totalAmount ?? priceFromTest ?? 0);
      return sum + (Number.isFinite(price) ? price : 0);
    }, 0);

  const bookingsSource = (currentUser && currentUser.role === 'admin') ? allAppointments : appointments;

  const filteredBookings =
    bookingStatusFilter === "all"
      ? bookingsSource
      : bookingsSource.filter((apt) => apt.status === bookingStatusFilter);

  // Merge client-side admin activities (localStorage) with server-side notifications
  const serverActivities = (notifications || []).map((n) => ({
    id: n.id,
    type: n.type || 'system',
    message: n.message || n.title || '',
    timestamp: n.createdAt || n.created_at || n.createdAt,
    source: 'server',
  }));

  const clientActivities = (adminActivities || []).map((a, idx) => ({
    id: `client-${idx}`,
    type: a.type || 'system',
    message: a.message || '',
    timestamp: a.timestamp || new Date().toISOString(),
    admin: a.admin,
    source: 'client',
  }));

  const merged = [...serverActivities, ...clientActivities]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 5);

  const recentActivities = merged;

  // Add new test function
  const [showAddTestModal, setShowAddTestModal] = useState(false);
  const [newTestData, setNewTestData] = useState({
    name: "",
    category: "",
    hospital_id: "",
    price: "",
    duration: "",
    description: "",
    available: true,
    insuranceCovered: true,
  });
  const [editingTest, setEditingTest] = useState(null);

  const handleAddTest = (e) => {
    e.preventDefault();

    const newTest = {
      ...newTestData,
      id: Date.now(),
      price: parseInt(newTestData.price),
      hospital_id: newTestData.hospital_id,
    };
    if (editingTest) {
      // update existing test
      updateMedicalTest(editingTest.id, {
        name: newTestData.name,
        description: newTestData.description,
        category: newTestData.category,
        hospital_id: newTestData.hospital_id,
        price: parseFloat(newTestData.price) || 0,
        duration: newTestData.duration,
        is_available: newTestData.available,
      });
      setEditingTest(null);
    } else {
      createMedicalTest(newTest);
    }

    // Log activity
    const activity = {
      type: "test",
      message: `Added new test: ${newTest.name}`,
      timestamp: new Date().toISOString(),
      admin: "System Administrator",
    };

    const updatedActivities = [...adminActivities, activity];
    setAdminActivities(updatedActivities);
    localStorage.setItem("adminActivities", JSON.stringify(updatedActivities));

    showNotification(`Test "${newTest.name}" added successfully!`, "success");
    setShowAddTestModal(false);
    setNewTestData({
      name: "",
      category: "",
      hospital: "",
      location: "",
      price: "",
      duration: "",
      description: "",
      available: true,
      insuranceCovered: true,
    });
  };
  
  
  // Add new hospital

  const [showAddHospitalModal, setShowAddHospitalModal] = useState(false);
  const [newHospitalData, setNewHospitalData] = useState({
    name: "",
    email: "",
    phone: "",
    province:"",
    district: "",
    sector: "",
    cell:"",
    village:"",
    street:"",
    latitude:"",
    longitude:"",
    // departments: [],
    facilities: [],
    registration_number: "",
    accreditation: { body: "", status: "" },
    is_active: true,
  });
  const [editingHospital, setEditingHospital] = useState(null);

  useEffect(() => {
    // Guard against undefined by defaulting to an empty array
    // setDeptInput((newHospitalData.departments || []).join(", "));
    setFacilitiesInput((newHospitalData.facilities || []).join(", "));
  }, [newHospitalData]);

  const handleAddHospital = (e) => {
    e.preventDefault();

    const newHospital = {
      ...newHospitalData,
    };

    if (editingHospital) {
      updateHospital(editingHospital.id, newHospitalData);
      setEditingHospital(null);
    } else {
      createHospital(newHospital);
    }

    showNotification(
      `Hospital "${newHospital.name}" added successfully!`,
      "success"
    );

    setShowAddHospitalModal(false);
    setNewHospitalData({
      name: "",
      email: "",
      phone: "",
      province:"",
      district: "",
      sector: "",
      cell:"",
      village:"",
      street:"",
      latitude:"",
      longitude:"",
      // departments: [],
      facilities: [],
      registration_number: "",
      accreditation: { body: "", status: "" },
      is_active: true,
    });
  };

  const handleDeleteHospital = (hospital_id) => {
    if (window.confirm("Are you sure you want to delete this hospital?")) {
      deleteHospital(hospital_id);
      showNotification("Hospital deleted successfully!", "success");
    }
  };

  const deleteTest = (testId) => {
    if (window.confirm("Are you sure you want to delete this test?")) {
      deleteMedicalTest(testId);
      showNotification("Test deleted successfully!", "success");
    }
  };

  

  const handleDeleteUser = (userId) => {
    if (window.confirm("Are you sure you want to delete this user?")) {
      deleteUser(userId);
      showNotification("User deleted successfully!", "success");
    }
  };

  const [showCreateResultModal, setShowCreateResultModal] = useState(false);
  const [resultInputs, setResultInputs] = useState({ numeric: "", text: "", priority: "normal" });
  const [resultFiles, setResultFiles] = useState([]);

  const handleSubmitTestResult = async (e) => {
    e.preventDefault();
    const draft = currentResultDraft || {};
    // Build FormData to allow file uploads
    const form = new FormData();
    form.append('appointmentId', draft.appointmentId);
    form.append('testId', draft.testId);
    form.append('patientId', draft.patientId);
    form.append('hospitalId', draft.hospitalId);
    form.append('priority', resultInputs.priority || 'normal');
    if (resultInputs.numeric) {
      // store numeric_results as JSON string
      form.append('numeric_results', JSON.stringify({ value: resultInputs.numeric }));
    }
    if (resultInputs.text) {
      form.append('text_results', JSON.stringify({ notes: resultInputs.text }));
    }

    // Append files if any
    if (resultFiles && resultFiles.length > 0) {
      for (let i = 0; i < resultFiles.length; i++) {
        form.append('files', resultFiles[i]);
      }
    }

    const created = await createTestResult(form);
    if (created) {
      setShowCreateResultModal(false);
      setCurrentResultDraft(null);
      setResultInputs({ numeric: "", text: "", priority: "normal" });
      setResultFiles([]);
      showNotification('Test result saved', 'success');
    }
  };

  const onFilesChange = (e) => {
    const files = Array.from(e.target.files || []);
    setResultFiles(files);
  };

  const updateBookingStatus = async (bookingId, status) => {
    const res = await updateAppointmentStatus(bookingId, status);

    // Try to get the appointment from the API response; if not available, find it in local state
    let appointment = null;
    if (res && typeof res === 'object' && res.id) {
      appointment = res;
    } else {
      // bookingsSource is defined above and already selects admin vs regular source
      appointment = (bookingsSource || []).find((b) => b.id === bookingId) || null;
    }

    // If appointment was marked completed, open the create-result modal prefilled
    if (status === "completed" && appointment) {
      const draft = {
        appointmentId: appointment.id,
        testId: appointment.test_id || appointment.testId || (appointment.medicalTest && appointment.medicalTest.id),
        patientId: appointment.patient_id || appointment.patientId || (appointment.user && appointment.user.id),
        hospitalId: appointment.hospital_id || appointment.hospitalId || (appointment.hospital && appointment.hospital.id),
      };
      setCurrentResultDraft(draft);
      setShowCreateResultModal(true);
    }
    // No full page reload — rely on context updates for UI refresh.
  };

  const renderOverviewTab = () => (
    <div id="overviewTab" className="dashboard-tab active">
      <div className="admin-stats">
        <div className="admin-stat-card">
          <div className="stat-icon">
            <i className="fas fa-users"></i>
          </div>
          <div className="stat-info">
            <h3>{totalUsers}</h3>
            <p>Total Users</p>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-icon">
            <i className="fas fa-calendar-check"></i>
          </div>
          <div className="stat-info">
            <h3>{totalBookings}</h3>
            <p>Total Bookings</p>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-icon">
            <i className="fas fa-hospital"></i>
          </div>
          <div className="stat-info">
            <h3>{totalTests}</h3>
            <p>Available Tests</p>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-icon">
            <i className="fas fa-money-bill-wave"></i>
          </div>
          <div className="stat-info">
            <h3>{totalRevenue.toLocaleString()} RWF</h3>
            <p>Total Revenue</p>
          </div>
        </div>
       {/* eslint-disable-next-line */}
      </div>

      <div className="recent-activities">
        <h3>Recent Activities</h3>
        <div className="activities-list">
          {recentActivities.length === 0 ? (
            <p className="no-activities">No recent activities</p>
          ) : (
            recentActivities.map((activity, index) => (
              <div key={index} className="activity-item">
                <div className="activity-icon">
                  <i className={`fas fa-${getActivityIcon(activity.type)}`}></i>
                </div>
                <div className="activity-content">
                  <p>{activity.message}</p>
                  <span className="activity-time">
                    {new Date(activity.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  const renderUsersTab = () => (
    <div
      id="usersTab"
      className={`dashboard-tab ${activeTab === "users" ? "active" : ""}`}
    >
      <div className="tab-header">
        <h3>User Management</h3>
      </div>
      <div className="users-list">
        {allUsers.filter((user) => user.email !== "admin@specicare.com")
          .length === 0 ? (
          <p className="no-users">No users registered</p>
        ) : (
          allUsers
            .filter((user) => user.email !== "admin@specicare.com")
            .map((user) => (
              <div key={user.id} className="user-item">
                <div className="user-info">
                  <h4>{user.name}</h4>
                  <p>
                    {user.email} • {user.phone}
                  </p>
                  <small>
                    Joined: {(() => {
                      const created = getField(user, 'createdAt', 'created_at');
                      if (!created) return 'N/A';
                      const d = new Date(created);
                      return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString();
                    })()}
                  </small>
                </div>
                <div className="user-actions">
                  <button
                    className="danger-btn"
                    onClick={() => handleDeleteUser(user.id)}
                  >
                    <i className="fas fa-trash"></i> Delete
                  </button>
                </div>
              </div>
            ))
        )}
      </div>
    </div>
  );

  const renderBookingsTab = () => (
    <div
      id="bookingsTab"
      className={`dashboard-tab ${activeTab === "bookings" ? "active" : ""}`}
    >
      <div className="tab-header">
        <h3>Booking Management</h3>
        <div className="filter-controls">
          <select
            value={bookingStatusFilter}
            onChange={(e) => setBookingStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>
      <div className="bookings-list">
        {filteredBookings.length === 0 ? (
          <p className="no-bookings">No bookings found</p>
        ) : (
          filteredBookings.map((booking) => (
            <div key={booking.id} className="booking-item">
              <div className="booking-info">
                <h4>{booking.medicalTest?.name || booking.testName || "Test"}</h4>
                <p>
                  <strong>Patient:</strong> {(booking.user && booking.user.name) || booking.patient_name || booking.patientName || "Unknown"} • { (booking.user && booking.user.phone) || booking.patient_phone || booking.patientPhone || "N/A" }
                </p>
                <p>
                  <strong>Hospital:</strong> {booking.hospital?.name || booking.hospitalName || "N/A"}
                </p>
                <p>
                  <strong>Reference:</strong> {booking.reference || booking.id}
                </p>
                <p>
                  <strong>Date:</strong>{" "}
                  {(() => {
                    const apptDate = getField(booking, 'appointmentDate', 'appointment_date');
                    if (!apptDate) return 'N/A';
                    const d = new Date(apptDate);
                    return isNaN(d.getTime()) ? String(apptDate) : d.toLocaleDateString();
                  })()}
                </p>
                <p>
                  <strong>Price:</strong>{" "}
                  {(booking.medicalTest?.price ?? booking.price ?? 0).toLocaleString()} RWF
                </p>
                <span className={`status ${booking.status}`}>
                  {booking.status}
                </span>
              </div>
              <div className="booking-actions">
                <button
                  className="secondary-btn"
                  onClick={() => updateBookingStatus(booking.id, "confirmed")}
                >
                  Confirm
                </button>
                <button
                  className="warning-btn"
                  onClick={() => updateBookingStatus(booking.id, "completed")}
                >
                  Complete
                </button>
                <button
                  className="danger-btn"
                  onClick={() => updateBookingStatus(booking.id, "cancelled")}
                >
                  Cancel
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderTestsTab = () => (
    <div
      id="testsTab"
      className={`dashboard-tab ${activeTab === "tests" ? "active" : ""}`}
    >
      <div className="tab-header">
        <h3>Test Management</h3>
        <button
          className="cta-button"
          onClick={() => setShowAddTestModal(true)}
        >
          <i className="fas fa-plus"></i> Add New Test
        </button>
      </div>
      <div className="tests-list">
        {medicalTests.length === 0 ? (
          <p className="no-tests">No tests available</p>
        ) : (
          medicalTests.map((test) => (
            <div key={test.id} className="test-item">
              <div className="test-info">
                <h4>{test.name}</h4>
                <p>
                  <strong>Hospital:</strong>{" "}
                  {
                    // Compare as strings to avoid type mismatch between id types
                    ((hospitals || []).find((hospital) => {
                      const testHospitalId = (test.hospitalId ?? test.hospital_id);
                      if (testHospitalId == null) return false;
                      return String(hospital?.id) === String(testHospitalId);
                    }) || {}).name || 'N/A'
                  }
                </p>
                <p>
                  <strong>Category:</strong> {test.category} • {test.duration}
                </p>
                <p>
                  <strong>Price:</strong> {(Number(test.price ?? test.price) || 0).toLocaleString()} RWF
                </p>
                <span
                  className={`status ${
                    (test.isAvailable ?? test.is_available) ? "confirmed" : "cancelled"
                  }`}
                >
                  {(test.isAvailable ?? test.is_available) ? "Available" : "Unavailable"}
                </span>
              </div>
              <div className="test-actions">
                <button
                  className="secondary-btn"
                  onClick={() => {
                    // open edit modal prefilled
                    setEditingTest(test);
                    setNewTestData({
                      name: test.name || "",
                      category: test.category || "",
                      hospital_id: test.hospital_id || "",
                      price: test.price || "",
                      duration: test.duration || "",
                      description: test.description || "",
                      available: test.is_available ?? true,
                    });
                    setShowAddTestModal(true);
                  }}
                >
                  <i className="fas fa-edit"></i> Edit
                </button>
                <button
                  className="danger-btn"
                  onClick={() => deleteTest(test.id)}
                >
                  <i className="fas fa-trash"></i> Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderHospitalsTab = () => (
    <div
      id="hospitalsTab"
      className={`dashboard-tab ${activeTab === "hospitals" ? "active" : ""}`}
    >
      <div className="tab-header">
        <h3>Hospital Management</h3>
        <button
          className="cta-button"
          onClick={() => setShowAddHospitalModal(true)}
        >
          <i className="fas fa-plus"></i> Add New Hospital
        </button>
      </div>
      <div className="hospitals-list">
        {hospitals.length === 0 ? (
          <p className="no-hospitals">No hospitals available</p>
        ) : (
          hospitals.map((hospital) => (
            <div key={hospital.id} className="test-item">
              <div className="test-info">
                <h4>{hospital.name}</h4>
                <p>
                  <strong>Location:</strong> {hospital?.district || 'N/A'}
                </p>
                <p>
                  <strong>Contact:</strong> {hospital.phone || 'N/A'}
                </p>
                <p>
                  <strong>Email:</strong> {hospital.email || 'N/A'}
                </p>
                {/* <p>
                  <strong>Departments:</strong> {(hospital.departments || []).join(', ') || 'N/A'}
                </p> */}
                <span className={`status ${hospital.is_active ?? hospital.isActive ? 'confirmed' : 'cancelled'}`}>
                  {hospital.is_active ?? hospital.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="test-actions">
                <button
                  className="secondary-btn"
                  onClick={() => {
                    setEditingHospital(hospital);
                    setNewHospitalData({
                      name: hospital.name || "",
                      email: hospital.email || "",
                      phone: hospital.phone || "",
                      province: hospital.province || "",
                      district: hospital?.district || "",
                      sector: hospital.sector || "",
                      cell: hospital.cell || "",
                      village: hospital.village || "",
                      street: hospital.street || "",
                      latitude: hospital.latitude || "",
                      longitude: hospital.longitude || "",
                      // departments: hospital.departments || [],
                      facilities: hospital.facilities || [],
                      registration_number: hospital.registration_number || "",
                      accreditation: hospital.accreditation || { body: "", status: "" },
                      is_active: hospital.is_active ?? true,
                    });
                    setShowAddHospitalModal(true);
                  }}
                >
                  <i className="fas fa-edit"></i> Edit
                </button>
                <button
                  className="danger-btn"
                  onClick={() => handleDeleteHospital(hospital.id)}
                >
                  <i className="fas fa-trash"></i> Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const getActivityIcon = (type) => {
    const icons = {
      user: "user-plus",
      booking: "calendar-check",
      test: "flask",
      system: "cog",
    };
    return icons[type] || "info-circle";
  };

  return (
    <section id="admin" className="section active">
      <div className="dashboard-header">
        <h2>Admin Dashboard</h2>
        <p>Manage platform operations and view analytics</p>
      </div>

      <div className="dashboard-actions">
        <button
          className={`dashboard-btn ${
            activeTab === "overview" ? "active" : ""
          }`}
          onClick={() => setActiveTab("overview")}
        >
          <i className="fas fa-chart-bar"></i> Overview
        </button>
        <button
          className={`dashboard-btn ${activeTab === "users" ? "active" : ""}`}
          onClick={() => setActiveTab("users")}
        >
          <i className="fas fa-users"></i> Users
        </button>
        <button
          className={`dashboard-btn ${
            activeTab === "bookings" ? "active" : ""
          }`}
          onClick={() => setActiveTab("bookings")}
        >
          <i className="fas fa-calendar-alt"></i> Bookings
        </button>
        <button
          className={`dashboard-btn ${activeTab === "tests" ? "active" : ""}`}
          onClick={() => setActiveTab("tests")}
        >
          <i className="fas fa-flask"></i> Tests
        </button>
        <button
          className={`dashboard-btn ${
            activeTab === "hospitals" ? "active" : ""
          }`}
          onClick={() => setActiveTab("hospitals")}
        >
          <i className="fas fa-hospital"></i> Hospitals
        </button>
      </div>

      <div className="dashboard-content">
        {activeTab === "overview" && renderOverviewTab()}
        {activeTab === "users" && renderUsersTab()}
        {activeTab === "bookings" && renderBookingsTab()}
        {activeTab === "tests" && renderTestsTab()}
        {activeTab === "hospitals" && renderHospitalsTab()}
      </div>

      {/* Add Test Modal */}
      {showAddTestModal && (
        <div id="addTestModal" className="modal" style={{ display: "block" }}>
          <div className={`modal-content ${showAddTestModal ? "show" : ""}`}>
            <span className="close" onClick={() => setShowAddTestModal(false)}>
              &times;
            </span>
            <h2>Add New Medical Test</h2>
            <form onSubmit={handleAddTest}>
              <div className="form-group">
                <label htmlFor="testName">Test Name *</label>
                <input
                  type="text"
                  id="testName"
                  required
                  value={newTestData.name}
                  onChange={(e) =>
                    setNewTestData({ ...newTestData, name: e.target.value })
                  }
                />
              </div>
              <div className="form-group">
                <label htmlFor="testCategory">Category *</label>
                <select
                  id="testCategory"
                  required
                  value={newTestData.category}
                  onChange={(e) =>
                    setNewTestData({ ...newTestData, category: e.target.value })
                  }
                >
                  <option value="">Select Category</option>
                  <option value="radiology">Radiology</option>
                  <option value="laboratory">Laboratory</option>
                  <option value="cardiology">Cardiology</option>
                  <option value="neurology">Neurology</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="testHospital">Hospital *</label>
                <select
                  id="testHospital"
                  required
                  value={newTestData.hospital_id || ""}
                  onChange={(e) =>
                    setNewTestData({
                      ...newTestData,
                      hospital_id: e.target.value,
                    })
                  }
                >
                  <option value="">Select Hospital</option>
                  {hospitals && hospitals.length > 0 ? (
                    hospitals.map((hospital) => (
                      <option key={hospital.id} value={hospital.id}>
                        {hospital.name} — {hospital?.district || ""}
                      </option>
                    ))
                  ) : (
                    <option disabled>No hospitals available</option>
                  )}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="testPrice">Price (RWF) *</label>
                <input
                  type="number"
                  id="testPrice"
                  required
                  value={newTestData.price}
                  onChange={(e) =>
                    setNewTestData({ ...newTestData, price: e.target.value })
                  }
                />
              </div>
              <div className="form-group">
                <label htmlFor="testDuration">Duration *</label>
                <input
                  type="text"
                  id="testDuration"
                  required
                  placeholder="e.g., 30 minutes"
                  value={newTestData.duration}
                  onChange={(e) =>
                    setNewTestData({ ...newTestData, duration: e.target.value })
                  }
                />
              </div>
              <div className="form-group">
                <label htmlFor="testDescription">Description *</label>
                <textarea
                  id="testDescription"
                  required
                  value={newTestData.description}
                  onChange={(e) =>
                    setNewTestData({
                      ...newTestData,
                      description: e.target.value,
                    })
                  }
                ></textarea>
              </div>
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={newTestData.available}
                    onChange={(e) =>
                      setNewTestData({
                        ...newTestData,
                        available: e.target.checked,
                      })
                    }
                  />{" "}
                  Available
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={newTestData.insuranceCovered}
                    onChange={(e) =>
                      setNewTestData({
                        ...newTestData,
                        insuranceCovered: e.target.checked,
                      })
                    }
                  />{" "}
                  Insurance Covered
                </label>
              </div>
              <button type="submit" className="submit-btn">
                {editingTest ? 'Save Changes' : 'Add Test'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add hospital Modal */}

      {showAddHospitalModal && (
        <div
          id="addHospitalModal"
          className="modal"
          style={{ display: "block" }}
        >
          <div
            className={`modal-content ${showAddHospitalModal ? "show" : ""}`}
          >
            <span
              className="close"
              onClick={() => setShowAddHospitalModal(false)}
            >
              &times;
            </span>
            <h2>Add New Hospital</h2>
            <form onSubmit={handleAddHospital}>
              {/* Basic Info */}
              <div className="form-group">
                <label htmlFor="hospitalName">Hospital Name *</label>
                <input
                  type="text"
                  id="hospitalName"
                  required
                  value={newHospitalData.name}
                  onChange={(e) =>
                    setNewHospitalData({
                      ...newHospitalData,
                      name: e.target.value,
                    })
                  }
                />
              </div>

              <div className="form-group">
                <label htmlFor="hospitalEmail">Email *</label>
                <input
                  type="email"
                  id="hospitalEmail"
                  required
                  value={newHospitalData.email}
                  onChange={(e) =>
                    setNewHospitalData({
                      ...newHospitalData,
                      email: e.target.value,
                    })
                  }
                />
              </div>

              <div className="form-group">
                <label htmlFor="hospitalPhone">Phone *</label>
                <input
                  type="text"
                  id="hospitalPhone"
                  required
                  value={newHospitalData.phone}
                  onChange={(e) =>
                    setNewHospitalData({
                      ...newHospitalData,
                      phone: e.target.value,
                    })
                  }
                />
              </div>

              {/* Address JSON */}
              <h4>Address</h4>
              <div className="form-group">
                <input
                  type="text"
                  placeholder="District"
                  value={newHospitalData.district || ""}
                  onChange={(e) =>
                    setNewHospitalData({
                      ...newHospitalData,
                        district: e.target.value,
                    })
                  }
                />
                <input
                  type="text"
                  placeholder="Sector"
                  className="gap"
                  value={newHospitalData.sector || ""}
                  onChange={(e) =>
                    setNewHospitalData({
                      ...newHospitalData,
                        sector: e.target.value,
                    })
                  }
                />
              </div>

              {/* Departments
              <div className="form-group">
                <label>Departments (comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g., Radiology, Laboratory"
                  value={deptInput}
                  onChange={(e) => setDeptInput(e.target.value)}
                  onBlur={(e) =>
                    setNewHospitalData({
                      ...newHospitalData,
                      departments: e.target.value
                        .split(",")
                        .map((d) => d.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </div> */}

              {/* Facilities */}
              <div className="form-group">
                <label>Facilities (comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g., X-ray, CT Scan, Emergency"
                  value={facilitiesInput}
                  onChange={(e) => setFacilitiesInput(e.target.value)}
                  onBlur={(e) =>
                    setNewHospitalData({
                      ...newHospitalData,
                      facilities: e.target.value
                        .split(",")
                        .map((f) => f.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </div>

              {/* License */}
              <div className="form-group">
                <label htmlFor="license">License Number</label>
                <input
                  type="text"
                  id="license"
                  value={newHospitalData.license_number}
                  onChange={(e) =>
                    setNewHospitalData({
                      ...newHospitalData,
                      license_number: e.target.value,
                    })
                  }
                />
              </div>

              {/* Accreditation */}
              <h4>Accreditation</h4>
              <div className="form-group">
                <input
                  type="text"
                  placeholder="Accrediting Body"
                  value={newHospitalData.accreditation.body || ""}
                  onChange={(e) =>
                    setNewHospitalData({
                      ...newHospitalData,
                      accreditation: {
                        ...newHospitalData.accreditation,
                        body: e.target.value,
                      },
                    })
                  }
                />
                <input
                  type="text"
                  placeholder="Status (approved, pending)"
                  className="gap"
                  value={newHospitalData.accreditation.status || ""}
                  onChange={(e) =>
                    setNewHospitalData({
                      ...newHospitalData,
                      accreditation: {
                        ...newHospitalData.accreditation,
                        status: e.target.value,
                      },
                    })
                  }
                />
              </div>

              <div className="form-group items-center">
                <label>Active</label>
                <label className="mleft">
                  <input
                    type="checkbox"
                    checked={newHospitalData.is_active}
                    onChange={(e) =>
                      setNewHospitalData({
                        ...newHospitalData,
                        is_active: e.target.checked,
                      })
                    }
                  />{" "}
                </label>
              </div>

              <button type="submit" className="submit-btn">
                {editingHospital ? 'Save Changes' : 'Add Hospital'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Create Test Result Modal */}
      {showCreateResultModal && (
        <div id="createResultModal" className="modal" style={{ display: "block" }}>
          <div className={`modal-content ${showCreateResultModal ? "show" : ""}`}>
            <span className="close" onClick={() => { setShowCreateResultModal(false); setCurrentResultDraft(null); }}>&times;</span>
            <h2>Create Test Result</h2>
            <div className="form-group">
              {(() => {
                const draft = currentResultDraft || {};
                // Try to find appointment details in available sources
                const appointmentObj = (bookingsSource || []).find(a => a.id === draft.appointmentId) || (allAppointments || []).find(a => a.id === draft.appointmentId) || null;
                const patientName = appointmentObj?.user?.name || appointmentObj?.patient_name || draft.patientId || 'N/A';
                const testName = appointmentObj?.medicalTest?.name || appointmentObj?.testName || draft.testId || 'N/A';
                const hospitalName = appointmentObj?.hospital?.name || appointmentObj?.hospitalName || draft.hospitalId || 'N/A';
                const apptRef = appointmentObj?.reference || appointmentObj?.id || draft.appointmentId || 'N/A';
                return (
                  <>
                    <p><strong>Appointment:</strong> {apptRef}</p>
                    <p><strong>Patient:</strong> {patientName}</p>
                    <p><strong>Test:</strong> {testName}</p>
                    <p><strong>Hospital:</strong> {hospitalName}</p>
                  </>
                );
              })()}
            </div>
            <form onSubmit={handleSubmitTestResult}>
              <div className="form-group">
                <label>Numeric Results (single value)</label>
                <input type="text" value={resultInputs.numeric} onChange={(e) => setResultInputs(prev => ({ ...prev, numeric: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Text Results / Notes</label>
                <textarea value={resultInputs.text} onChange={(e) => setResultInputs(prev => ({ ...prev, text: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Priority</label>
                <select value={resultInputs.priority} onChange={(e) => setResultInputs(prev => ({ ...prev, priority: e.target.value }))}>
                  <option value="normal">Normal</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div className="form-group">
                <label>Attach Files (optional)</label>
                <input type="file" multiple onChange={onFilesChange} />
                {resultFiles && resultFiles.length > 0 && (
                  <div className="attached-files-list">
                    <strong>Files to upload:</strong>
                    <ul>
                      {resultFiles.map((f, idx) => (
                        <li key={idx}>{f.name} ({(f.size/1024).toFixed(1)} KB)</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <div className="form-group items-center">
                <button type="submit" className="submit-btn">Save Result</button>
                <button type="button" className="secondary-btn" onClick={() => { setShowCreateResultModal(false); setCurrentResultDraft(null); }}>Close</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

export default AdminSection;
