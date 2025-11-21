import React, {
  useEffect,
  useMemo,
  useState,
  useCallback
} from "react";
import { useApp } from "../../context/AppContext";
import { getField, safeDate } from "../../utils/safe";

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
    currentUser,
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

const safeTests = useMemo(() => medicalTests || [], [medicalTests]);
const safeHospitals = useMemo(() => hospitals || [], [hospitals]);
const safeAppointments = useMemo(
  () => (allAppointments?.length ? allAppointments : appointments || []),
  [allAppointments, appointments]
);
const safeUsers = useMemo(() => allUsers || [], [allUsers]);

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

  /* ---------------------------------------------
      SAFE CALLBACKS
  ---------------------------------------------- */

  const safeFetchAdminData = useCallback(async () => {
    try {
      await fetchAdminData();
    } catch (e) {
      console.error("fetchAdminData failed", e);
      showNotification("Failed to load admin data", "error");
    }
  }, [fetchAdminData, showNotification]);

  const applySearchAndFilter = useCallback(
    (items, options = {}) => {
      const q = searchQuery.trim().toLowerCase();
      const f = filter.trim().toLowerCase();

      let out = [...(items || [])];

      if (q) {
        out = out.filter((it) =>
          JSON.stringify(it).toLowerCase().includes(q)
        );
      }

      if (f) {
        if (options.filterBy) {
          out = out.filter((it) =>
            String(it[options.filterBy] ?? "")
              .toLowerCase()
              .includes(f)
          );
        } else {
          out = out.filter((it) =>
            JSON.stringify(it).toLowerCase().includes(f)
          );
        }
      }

      return out;
    },
    [searchQuery, filter]
  );

  const paginate = useCallback(
    (items) => {
      const total = items.length;
      const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      const from = (page - 1) * PAGE_SIZE;
      return {
        slice: items.slice(from, from + PAGE_SIZE),
        total,
        pages,
      };
    },
    [page]
  );

  /* ---------------------------------------------
      EFFECTS
  ---------------------------------------------- */

  useEffect(() => {
    safeFetchAdminData();
  }, [safeFetchAdminData]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, filter, tab]);

  /* ---------------------------------------------
      MEMO LISTS
  ---------------------------------------------- */

  const testsList = useMemo(() => {
    return paginate(
      applySearchAndFilter(safeTests, { filterBy: "category" })
    );
  }, [safeTests, applySearchAndFilter, paginate]);

  const hospitalsList = useMemo(() => {
    return paginate(
      applySearchAndFilter(safeHospitals, { filterBy: "district" })
    );
  }, [safeHospitals, applySearchAndFilter, paginate]);

  const appointmentsList = useMemo(() => {
    return paginate(
      applySearchAndFilter(safeAppointments, { filterBy: "status" })
    );
  }, [safeAppointments, applySearchAndFilter, paginate]);

  const usersList = useMemo(() => {
    return paginate(
      applySearchAndFilter(safeUsers, { filterBy: "email" })
    );
  }, [safeUsers, applySearchAndFilter, paginate]);

  /* ---------------------------------------------
      ACTION HANDLERS
  ---------------------------------------------- */

  const handleSaveTest = async (payload) => {
    try {
      if (testEdit?.id) {
        await updateMedicalTest(testEdit.id, payload);
        showNotification("Test updated", "success");
      } else {
        await createMedicalTest(payload);
        showNotification("Test created", "success");
      }
      setTestModalOpen(false);
      await safeFetchAdminData();
    } catch (e) {
      console.error(e);
      showNotification("Failed to save test", "error");
    }
  };

  const handleDeleteTest = async (id) => {
    if (!window.confirm("Delete this test?")) return;
    try {
      await deleteMedicalTest(id);
      showNotification("Test deleted", "success");
      await safeFetchAdminData();
    } catch (e) {
      console.error(e);
      showNotification("Failed to delete test", "error");
    }
  };

  const handleSaveHospital = async (payload) => {
    try {
      if (hospitalEdit?.id) {
        await updateHospital(hospitalEdit.id, payload);
        showNotification("Hospital updated", "success");
      } else {
        await createHospital(payload);
        showNotification("Hospital created", "success");
      }
      setHospitalModalOpen(false);
      await safeFetchAdminData();
    } catch (e) {
      console.error(e);
      showNotification("Failed to save hospital", "error");
    }
  };

  const handleDeleteHospital = async (id) => {
    if (!window.confirm("Delete this hospital?")) return;
    try {
      await deleteHospital(id);
      showNotification("Hospital deleted", "success");
      await safeFetchAdminData();
    } catch (e) {
      console.error(e);
      showNotification("Failed to delete hospital", "error");
    }
  };

  const handleUpdateAppointmentStatus = async (id, status) => {
    try {
      await updateAppointmentStatus(id, status);
      showNotification("Appointment updated", "success");
      await safeFetchAdminData();
    } catch (e) {
      console.error(e);
      showNotification("Failed to update appointment", "error");
    }
  };

  const handleSaveResult = async (formData) => {
    try {
      let payload = formData;

      // If the modal sent FormData (file upload), append required ids to it
      if (typeof FormData !== "undefined" && formData instanceof FormData) {
        if (selectedAppointment?.id) payload.append("appointment_id", selectedAppointment.id);
        if (!formData.get("test_id") && (selectedAppointment?.test_id || selectedAppointment?.testId)) payload.append("test_id", selectedAppointment.test_id || selectedAppointment.testId);
        if (!formData.get("patient_id") && (selectedAppointment?.patient_id || selectedAppointment?.user_id)) payload.append("patient_id", selectedAppointment.patient_id || selectedAppointment.user_id);
        if (!formData.get("hospital_id") && (selectedAppointment?.hospital_id || currentUser?.hospital_id)) payload.append("hospital_id", selectedAppointment.hospital_id || currentUser?.hospital_id);
      } else {
        // plain object payload: ensure required snake_case ids are present
        payload = {
          ...(formData || {}),
          appointment_id: selectedAppointment?.id,
          test_id: formData?.test_id || selectedAppointment?.test_id || selectedAppointment?.testId,
          patient_id: selectedAppointment?.patient_id || selectedAppointment?.user_id,
          hospital_id: selectedAppointment?.hospital_id || currentUser?.hospital_id,
        };
      }

      console.log("Creating test result with payload:", payload); // Debug log

      await createTestResult(payload);
      showNotification("Test result created", "success");
      setResultModalOpen(false);
      setSelectedAppointment(null);
      await safeFetchAdminData();
    } catch (e) {
      console.error(e);
      showNotification("Failed to create result", "error");
    }
  };

  // normalize appointment shapes so result form always gets the expected ids
  const normalizeAppointment = useCallback((a) => {
    if (!a) return a;
    const id = a.id || a.appointment_id || null;

    const test_id =
      a.test_id ??
      a.test?.id ??
      a.medicalTest?.id ??
      a.medical_test?.id ??
      a.testId ??
      a.medicalTestId ??
      null;

    const patient_id =
      a.patient_id ??
      a.patient?.id ??
      a.user?.id ??
      a.patientId ??
      a.userId ??
      null;

    const hospital_id =
      a.hospital_id ??
      a.hospital?.id ??
      a.hospitalId ??
      (a.test && (a.test.hospital_id ?? a.test.hospitalId ?? a.test.hospital?.id)) ??
      null;

    return { ...a, id, test_id, patient_id, hospital_id };
  }, []);

  /* ---------------------------------------------
      PAGINATION UI
  ---------------------------------------------- */

  const renderPagination = (totalPages) => {
    if (totalPages <= 1) return null;

    return (
      <div className="admin-pager">
        <button
          disabled={page === 1}
          onClick={() => setPage((p) => p - 1)}
        >
          Prev
        </button>

        {Array.from({ length: totalPages }, (_, i) => i + 1).map(
          (p) => (
            <button
              key={p}
              className={p === page ? "active" : ""}
              onClick={() => setPage(p)}
            >
              {p}
            </button>
          )
        )}

        <button
          disabled={page === totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </div>
    );
  };

  /* ---------------------------------------------
      RENDER
  ---------------------------------------------- */

  return (
    <section className="section active">
      {/* ------------------- STATS ------------------- */}
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

      {/* ------------------- SEARCH & FILTER ------------------- */}
      <div className="tab-header">
        <h2>Admin Dashboard</h2>

        <div className="filter-controls">
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
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

      {/* ------------------- TABS ------------------- */}
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

      {/* ----------------------------------------------
            OVERVIEW TAB
      ----------------------------------------------- */}
      {tab === "overview" && (
        <div className="dashboard-tab active">
          <div className="recent-activities">
            <h3>Recent Activities</h3>

            <div className="activities-list">
              {safeAppointments.slice(0, 5).map((appointment, idx) => (
                <div key={`activity-${appointment.id ?? idx}`} className="activity-item">
                  <div className="activity-icon">
                    <i className="fas fa-calendar-plus"></i>
                  </div>

                  <div className="activity-content">
                    <p>New appointment {appointment.reference}</p>

                    <div className="activity-time">
                      {appointment.appointment_date}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------
            TESTS TAB
      ----------------------------------------------- */}
      {tab === "tests" && (
        <div className="dashboard-tab active">
          <div className="tab-header">
            <h3>Medical Tests</h3>

            <button
              className="cta-button"
              onClick={() => {
                setTestEdit(null);
                setTestModalOpen(true);
              }}
            >
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
              testsList.slice.map((test, idx) => (
                <div key={`test-${test.id ?? idx}`} className="test-item">
                  <div className="test-info">
                    <h4>{test.name}</h4>
                    <p className="hospital">{test.category}</p>
                    <p className="description">{test.description}</p>
                    <p className="price">
                      {test.price?.toLocaleString()} RWF
                    </p>
                  </div>

                  <div className="test-actions">
                    <button
                      className="secondary-btn"
                      onClick={() => {
                        setTestEdit(test);
                        setTestModalOpen(true);
                      }}
                    >
                      <i className="fas fa-edit"></i> Edit
                    </button>

                    <button
                      className="danger-btn"
                      onClick={() => handleDeleteTest(test.id)}
                    >
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

      {/* ----------------------------------------------
            APPOINTMENTS TAB
      ----------------------------------------------- */}
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
              appointmentsList.slice.map((appointment, idx) => {
                const dateDisplay = safeDate(getField(appointment, 'appointment_date', 'appointmentDate', 'date'));
                const timeSlot = getField(appointment, 'time_slot', 'timeSlot') || appointment.time || '';
                return (
                  <div key={`appointment-${appointment.id ?? idx}`} className="booking-item">
                    <div className="booking-info">
                      <div className="appointment-header">
                        <h4>Reference: {appointment.reference}</h4>

                        <span className={`status ${appointment.status}`}>
                          {appointment.status}
                        </span>
                      </div>

                      {(() => {
                        // Resolve patient name from several possible shapes
                        const patientName =
                          (appointment.patient && (appointment.patient.name || appointment.patient.fullName)) ||
                          appointment.patientName ||
                          appointment.patient_name ||
                          (appointment.user && (appointment.user.name || appointment.user.fullName)) ||
                          appointment.userName ||
                          getField(appointment, 'patient_name', 'patientName') ||
                          '—';

                        // Resolve test name from several possible shapes
                        const testName =
                          (appointment.medicalTest && (appointment.medicalTest.name || appointment.medicalTest.title)) ||
                          appointment.medicalTestName ||
                          appointment.medical_test_name ||
                          (appointment.test && (appointment.test.name || appointment.test.title)) ||
                          appointment.testName ||
                          getField(appointment, 'medical_test_name', 'testName', 'medicalTestName') ||
                          '—';

                        return (
                          <>
                            <p>
                              <strong>Patient:</strong> {patientName}
                            </p>

                            <p>
                              <strong>Test:</strong> {testName}
                            </p>
                          </>
                        );
                      })()}

                      <p>
                        <strong>When:</strong> {dateDisplay}{timeSlot ? ` • ${timeSlot}` : ''}
                      </p>
                    </div>

                    <div className="booking-actions">
                      <button
                        className="secondary-btn"
                        onClick={() =>
                          handleUpdateAppointmentStatus(
                            appointment.id,
                            "confirmed"
                          )
                        }
                      >
                        Confirm
                      </button>

                    <button
                      className="secondary-btn"
                      onClick={() => {
                        // instead of marking completed immediately, open result modal
                        // and prefill required ids for the result form
                        setSelectedAppointment(normalizeAppointment(appointment));
                        setResultModalOpen(true);
                      }}
                    >
                      Complete
                    </button>

                      <button
                        className="warning-btn"
                        onClick={() =>
                          handleUpdateAppointmentStatus(
                            appointment.id,
                            "cancelled"
                          )
                        }
                      >
                        Cancel
                      </button>

                      <button
                        className="cta-button"
                        onClick={() => {
                          setSelectedAppointment(normalizeAppointment(appointment));
                          setResultModalOpen(true);
                        }}
                      >
                        Create Result
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {renderPagination(appointmentsList.pages)}
        </div>
      )}

      {/* ----------------------------------------------
            HOSPITALS TAB
      ----------------------------------------------- */}
      {tab === "hospitals" && (
        <div className="dashboard-tab active">
          <div className="tab-header">
            <h3>Hospitals</h3>

            <button
              className="cta-button"
              onClick={() => {
                setHospitalEdit(null);
                setHospitalModalOpen(true);
              }}
            >
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
              hospitalsList.slice.map((hospital, idx) => (
                <div key={`hospital-${hospital.id ?? idx}`} className="hospital-item">
                  <div className="hospital-info">
                    <h4>{hospital.name}</h4>

                    <p className="location">
                      <i className="fas fa-map-marker-alt"></i>
                      {hospital.district}, {hospital.province}
                    </p>

                    <p className="description">
                      {hospital.type} • {hospital.phone}
                    </p>
                  </div>

                  <div className="hospital-actions">
                    <button
                      className="secondary-btn"
                      onClick={() => {
                        setHospitalEdit(hospital);
                        setHospitalModalOpen(true);
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

          {renderPagination(hospitalsList.pages)}
        </div>
      )}

      {/* ----------------------------------------------
            USERS TAB
      ----------------------------------------------- */}
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
              usersList.slice.map((user, idx) => (
                <div key={`user-${user.id ?? idx}`} className="user-item">
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

      {/* ------------------- MODALS ------------------- */}
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
          onClose={() => {
            setResultModalOpen(false);
            setSelectedAppointment(null);
          }}
          appointment={selectedAppointment}
          selectedAppointment={selectedAppointment}
          onSubmit={handleSaveResult}
        />
      )}
    </section>
  );
}
