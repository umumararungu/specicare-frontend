import React, { useEffect, useMemo, useState } from "react";
import { useApp } from "../../context/AppContext";
import AddTestModal from "../admin/modals/AddTestModal";
import AddHospitalModal from "../admin/modals/AddHospitalModal";
import CreateResultModal from "../admin/modals/CreateResultModal";

const PAGE_SIZE = 8;

export default function AdminSection() {
  const {
    medicalTests = [],
    hospitals = [],
    appointments = [],
    allAppointments = [],
    allUsers = [],
    adminStats,
    fetchAdminData,
    createMedicalTest,
    updateMedicalTest,
    deleteMedicalTest,
    createHospital,
    updateHospital,
    deleteHospital,
    updateAppointmentStatus,
    createTestResult,
    showNotification,
  } = useApp();

  const safeTests = medicalTests || [];
  const safeHospitals = hospitals || [];
  const safeAppointments = allAppointments?.length ? allAppointments : appointments || [];
  const safeUsers = allUsers || [];

  const [tab, setTab] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);

  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testEdit, setTestEdit] = useState(null);

  const [hospitalModalOpen, setHospitalModalOpen] = useState(false);
  const [hospitalEdit, setHospitalEdit] = useState(null);

  const [resultModalOpen, setResultModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);

  useEffect(() => {
    fetchAdminData().catch((e) => {
      console.error("fetchAdminData failed", e);
      showNotification("Failed to load admin data", "error");
    });
  }, []);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, filter, tab]);

  function applySearchAndFilter(items, options = {}) {
    const q = (searchQuery || "").trim().toLowerCase();
    const f = (filter || "").trim().toLowerCase();

    let out = (items || []).slice();

    if (q) {
      out = out.filter((it) => {
        const s = JSON.stringify(it).toLowerCase();
        return s.includes(q);
      });
    }

    if (f) {
      if (options.filterBy) {
        out = out.filter((it) => {
          const val = String(it[options.filterBy] ?? "").toLowerCase();
          return val.includes(f);
        });
      } else {
        out = out.filter((it) => JSON.stringify(it).toLowerCase().includes(f));
      }
    }

    return out;
  }

  function paginate(items) {
    const total = items.length;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const from = (page - 1) * PAGE_SIZE;
    const slice = items.slice(from, from + PAGE_SIZE);
    return { slice, total, pages };
  }

  const testsList = useMemo(() => {
    const filtered = applySearchAndFilter(safeTests, { filterBy: "category" });
    return paginate(filtered);
  }, [safeTests, searchQuery, filter, page]);

  const hospitalsList = useMemo(() => {
    const filtered = applySearchAndFilter(safeHospitals, { filterBy: "district" });
    return paginate(filtered);
  }, [safeHospitals, searchQuery, filter, page]);

  const appointmentsList = useMemo(() => {
    const filtered = applySearchAndFilter(safeAppointments, { filterBy: "status" });
    return paginate(filtered);
  }, [safeAppointments, searchQuery, filter, page]);

  const usersList = useMemo(() => {
    const filtered = applySearchAndFilter(safeUsers, { filterBy: "email" });
    return paginate(filtered);
  }, [safeUsers, searchQuery, filter, page]);

  const handleOpenCreateTest = () => {
    setTestEdit(null);
    setTestModalOpen(true);
  };

  const handleOpenEditTest = (t) => {
    setTestEdit(t);
    setTestModalOpen(true);
  };

  const handleSaveTest = async (payload) => {
    try {
      if (testEdit && testEdit.id) {
        await updateMedicalTest(testEdit.id, payload);
        showNotification("Test updated", "success");
      } else {
        await createMedicalTest(payload);
        showNotification("Test created", "success");
      }
      setTestModalOpen(false);
      await fetchAdminData();
    } catch (err) {
      console.error("save test", err);
      showNotification("Failed to save test", "error");
    }
  };

  const handleDeleteTest = async (id) => {
    if (!window.confirm("Delete this test?")) return;
    try {
      await deleteMedicalTest(id);
      showNotification("Test deleted", "success");
      await fetchAdminData();
    } catch (err) {
      console.error("delete test", err);
      showNotification("Failed to delete test", "error");
    }
  };

  const handleOpenCreateHospital = () => {
    setHospitalEdit(null);
    setHospitalModalOpen(true);
  };

  const handleOpenEditHospital = (h) => {
    setHospitalEdit(h);
    setHospitalModalOpen(true);
  };

  const handleSaveHospital = async (payload) => {
    try {
      if (hospitalEdit && hospitalEdit.id) {
        await updateHospital(hospitalEdit.id, payload);
        showNotification("Hospital updated", "success");
      } else {
        await createHospital(payload);
        showNotification("Hospital created", "success");
      }
      setHospitalModalOpen(false);
      await fetchAdminData();
    } catch (err) {
      console.error("save hospital", err);
      showNotification("Failed to save hospital", "error");
    }
  };

  const handleDeleteHospital = async (id) => {
    if (!window.confirm("Delete this hospital?")) return;
    try {
      await deleteHospital(id);
      showNotification("Hospital deleted", "success");
      await fetchAdminData();
    } catch (err) {
      console.error("delete hospital", err);
      showNotification("Failed to delete hospital", "error");
    }
  };

  const handleUpdateAppointmentStatus = async (id, status) => {
    try {
      await updateAppointmentStatus(id, status);
      showNotification("Appointment updated", "success");
      await fetchAdminData();
    } catch (err) {
      console.error("update appointment", err);
      showNotification("Failed to update appointment", "error");
    }
  };

  const handleOpenCreateResult = (appt) => {
    setSelectedAppointment(appt);
    setResultModalOpen(true);
  };

  const handleSaveResult = async (formData) => {
    try {
      await createTestResult(formData);
      showNotification("Test result created", "success");
      setResultModalOpen(false);
      setSelectedAppointment(null);
      await fetchAdminData();
    } catch (err) {
      console.error("create result", err);
      showNotification("Failed to create result", "error");
    }
  };

  const renderPagination = (totalPages) => {
    if (!totalPages || totalPages === 1) return null;
    const pages = [];
    for (let p = 1; p <= totalPages; p++) pages.push(p);
    return (
      <div className="admin-pager">
        <button disabled={page === 1} onClick={() => setPage((s) => Math.max(1, s - 1))}>
          Prev
        </button>
        {pages.map((p) => (
          <button key={p} className={p === page ? "active" : ""} onClick={() => setPage(p)}>
            {p}
          </button>
        ))}
        <button disabled={page === totalPages} onClick={() => setPage((s) => Math.min(totalPages, s + 1))}>
          Next
        </button>
      </div>
    );
  };

  return (
    <section className="section active">
      <div className="admin-stats">
        <div className="admin-stat-card">
          <div className="stat-icon">
            <i className="fas fa-users"></i>
          </div>
          <div className="stat-info">
            <h3>{safeUsers.length}</h3>
            <p>Total Users</p>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-icon">
            <i className="fas fa-calendar-check"></i>
          </div>
          <div className="stat-info">
            <h3>{safeAppointments.length}</h3>
            <p>Total Bookings</p>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-icon">
            <i className="fas fa-flask"></i>
          </div>
          <div className="stat-info">
            <h3>{safeTests.length}</h3>
            <p>Medical Tests</p>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-icon">
            <i className="fas fa-hospital"></i>
          </div>
          <div className="stat-info">
            <h3>{safeHospitals.length}</h3>
            <p>Hospitals</p>
          </div>
        </div>
      </div>

      <div className="tab-header">
        <h2>Admin Dashboard</h2>
        <div className="filter-controls">
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="form-group"
          />
          <select 
            value={filter} 
            onChange={(e) => setFilter(e.target.value)}
            className="small"
          >
            <option value="">All Categories</option>
            <option value="laboratory">Laboratory</option>
            <option value="radiology">Radiology</option>
            <option value="cardiology">Cardiology</option>
          </select>
        </div>
      </div>

      <div className="dashboard-actions">
        <button 
          className={`dashboard-btn ${tab === "overview" ? "active" : ""}`}
          onClick={() => setTab("overview")}
        >
          <i className="fas fa-chart-bar"></i> Overview
        </button>
        <button 
          className={`dashboard-btn ${tab === "tests" ? "active" : ""}`}
          onClick={() => setTab("tests")}
        >
          <i className="fas fa-flask"></i> Tests
        </button>
        <button 
          className={`dashboard-btn ${tab === "appointments" ? "active" : ""}`}
          onClick={() => setTab("appointments")}
        >
          <i className="fas fa-calendar-alt"></i> Appointments
        </button>
        <button 
          className={`dashboard-btn ${tab === "hospitals" ? "active" : ""}`}
          onClick={() => setTab("hospitals")}
        >
          <i className="fas fa-hospital"></i> Hospitals
        </button>
        <button 
          className={`dashboard-btn ${tab === "users" ? "active" : ""}`}
          onClick={() => setTab("users")}
        >
          <i className="fas fa-users"></i> Users
        </button>
      </div>

      <div className="dashboard-tabs">
        {tab === "overview" && (
          <div className="dashboard-tab active">
            <div className="recent-activities">
              <h3>Recent Activities</h3>
              <div className="activities-list">
                {safeAppointments.slice(0, 5).map((appointment) => (
                  <div key={appointment.id} className="activity-item">
                    <div className="activity-icon">
                      <i className="fas fa-calendar-plus"></i>
                    </div>
                    <div className="activity-content">
                      <p>New appointment {appointment.reference}</p>
                      <div className="activity-time">{appointment.appointment_date}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "tests" && (
          <div className="dashboard-tab active">
            <div className="tab-header">
              <h3>Medical Tests</h3>
              <button className="cta-button" onClick={handleOpenCreateTest}>
                <i className="fas fa-plus"></i> Create Test
              </button>
            </div>
            <div className="tests-list">
              {testsList.slice.length === 0 ? (
                <div className="no-tests">
                  <i className="fas fa-flask"></i>
                  <p>No tests found</p>
                </div>
              ) : (
                testsList.slice.map((test) => (
                  <div key={test.id} className="test-item">
                    <div className="test-info">
                      <h4>{test.name}</h4>
                      <p className="hospital">{test.category}</p>
                      <p className="description">{test.description}</p>
                      <p className="price">{test.price?.toLocaleString()} RWF</p>
                    </div>
                    <div className="test-actions">
                      <button className="secondary-btn" onClick={() => handleOpenEditTest(test)}>
                        <i className="fas fa-edit"></i> Edit
                      </button>
                      <button className="danger-btn" onClick={() => handleDeleteTest(test.id)}>
                        <i className="fas fa-trash"></i> Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            {renderPagination(testsList.pages)}
          </div>
        )}

        {tab === "appointments" && (
          <div className="dashboard-tab active">
            <div className="tab-header">
              <h3>Appointments</h3>
            </div>
            <div className="bookings-list">
              {appointmentsList.slice.length === 0 ? (
                <div className="no-appointments">
                  <i className="fas fa-calendar-times"></i>
                  <p>No appointments found</p>
                </div>
              ) : (
                appointmentsList.slice.map((appointment) => (
                  <div key={appointment.id} className="booking-item">
                    <div className="booking-info">
                      <div className="appointment-header">
                        <h4>Reference: {appointment.reference}</h4>
                        <span className={`status ${appointment.status}`}>
                          {appointment.status}
                        </span>
                      </div>
                      <p><strong>Patient:</strong> {appointment.patient_name}</p>
                      <p><strong>Test:</strong> {appointment.medical_test_name}</p>
                      <p><strong>Date:</strong> {appointment.appointment_date}</p>
                    </div>
                    <div className="booking-actions">
                      <button className="secondary-btn" onClick={() => handleUpdateAppointmentStatus(appointment.id, "confirmed")}>
                        Confirm
                      </button>
                      <button className="secondary-btn" onClick={() => handleUpdateAppointmentStatus(appointment.id, "completed")}>
                        Complete
                      </button>
                      <button className="warning-btn" onClick={() => handleUpdateAppointmentStatus(appointment.id, "cancelled")}>
                        Cancel
                      </button>
                      <button className="cta-button" onClick={() => handleOpenCreateResult(appointment)}>
                        Create Result
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            {renderPagination(appointmentsList.pages)}
          </div>
        )}

        {tab === "hospitals" && (
          <div className="dashboard-tab active">
            <div className="tab-header">
              <h3>Hospitals</h3>
              <button className="cta-button" onClick={handleOpenCreateHospital}>
                <i className="fas fa-plus"></i> Create Hospital
              </button>
            </div>
            <div className="hospitals-list">
              {hospitalsList.slice.length === 0 ? (
                <div className="no-hospitals">
                  <i className="fas fa-hospital"></i>
                  <p>No hospitals found</p>
                </div>
              ) : (
                hospitalsList.slice.map((hospital) => (
                  <div key={hospital.id} className="hospital-item">
                    <div className="hospital-info">
                      <h4>{hospital.name}</h4>
                      <p className="location">
                        <i className="fas fa-map-marker-alt"></i>
                        {hospital.district}, {hospital.province}
                      </p>
                      <p className="description">{hospital.type} • {hospital.phone}</p>
                    </div>
                    <div className="hospital-actions">
                      <button className="secondary-btn" onClick={() => handleOpenEditHospital(hospital)}>
                        <i className="fas fa-edit"></i> Edit
                      </button>
                      <button className="danger-btn" onClick={() => handleDeleteHospital(hospital.id)}>
                        <i className="fas fa-trash"></i> Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            {renderPagination(hospitalsList.pages)}
          </div>
        )}

        {tab === "users" && (
          <div className="dashboard-tab active">
            <div className="tab-header">
              <h3>Users</h3>
            </div>
            <div className="users-list">
              {usersList.slice.length === 0 ? (
                <div className="no-users">
                  <i className="fas fa-users"></i>
                  <p>No users found</p>
                </div>
              ) : (
                usersList.slice.map((user) => (
                  <div key={user.id} className="user-item">
                    <div className="user-info">
                      <h4>{user.name}</h4>
                      <p>{user.email}</p>
                      <p>{user.phone}</p>
                    </div>
                    <div className="user-actions">
                      <button className="view-btn">
                        <i className="fas fa-eye"></i> View
                      </button>
                      <button className="suspend-btn">
                        <i className="fas fa-pause"></i> Suspend
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            {renderPagination(usersList.pages)}
          </div>
        )}
      </div>

      {/* Modals (external modal components) */}
      {testModalOpen && (
        <AddTestModal
          isOpen={testModalOpen}
          onClose={() => setTestModalOpen(false)}
          onSubmit={handleSaveTest}
          hospitals={safeHospitals}
          edit={testEdit}
        />
      )}

      {hospitalModalOpen && (
        <AddHospitalModal
          isOpen={hospitalModalOpen}
          onClose={() => setHospitalModalOpen(false)}
          onSubmit={handleSaveHospital}
          edit={hospitalEdit}
        />
      )}

      {resultModalOpen && selectedAppointment && (
        <CreateResultModal
          isOpen={resultModalOpen}
          onClose={() => { setResultModalOpen(false); setSelectedAppointment(null); }}
          appointment={selectedAppointment}
          onSubmit={handleSaveResult}
        />
      )}
    </section>
  );
}