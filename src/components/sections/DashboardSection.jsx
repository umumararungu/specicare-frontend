import React, { useState } from "react";
import { useApp } from "../../context/AppContext";
import { getField, safeDate, safeNumber, safeDateTime } from "../../utils/safe";

const DashboardSection = () => {
  const { currentUser, appointments, testResults, setActiveSection, logout } =
    useApp();
  const [activeTab, setActiveTab] = useState("appointments");


  // Server returns only the current user's results at GET /test-results/my,
  // but be defensive and filter by patient_id when available.
  const userResults = (testResults || []).filter((result) => {
    const pid = getField(result, 'patientId', 'patient_id');
    return !pid || pid === currentUser?.id;
  });

  const renderAppointmentsTab = () => (
    <div
      id="appointmentsTab"
      className={`dashboard-tab ${
        activeTab === "appointments" ? "active" : ""
      }`}
    >
      <h3>Upcoming Appointments</h3>
      <div className="appointment-list">
        {(!appointments || appointments.length === 0) ? (
          <div className="no-appointments">
            <i className="fas fa-calendar-times"></i>
            <h4>No appointments yet</h4>
            <p>Book your first medical test to get started</p>
          </div>
        ) : (
          // Filter and show only upcoming appointments with a valid appointment date
          (() => {
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

            const normalizeDate = (appt) => {
              // Try multiple possible field names (snake_case and camelCase)
              const d = getField(
                appt,
                'appointmentDate',
                'appointment_date',
                'date',
                'appintment_date',
                'appintmentDate',
                'createdAt',
                'created_at'
              );
              if (!d) return null;
              const parsed = new Date(d);
              if (isNaN(parsed.getTime())) return null;
              // return date at local midnight for consistent comparisons
              return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
            };

            const upcoming = (appointments || [])
              .map((a) => ({ raw: a, apptDate: normalizeDate(a) }))
              .filter((x) => x.apptDate && x.apptDate.getTime() >= todayStart)
              .sort((a, b) => a.apptDate - b.apptDate)
              .map((x) => x.raw);

            if (upcoming.length === 0) {
              return (
                <div className="no-appointments">
                  <i className="fas fa-calendar-times"></i>
                  <h4>No upcoming appointments</h4>
                  <p>Book a medical test to schedule your next appointment</p>
                </div>
              );
            }

            return upcoming.map((appointment) => {
              const apptDateRaw = getField(
                appointment,
                'appointmentDate',
                'appointment_date',
                'date',
                'appintment_date',
                'appintmentDate',
                'createdAt',
                'created_at'
              );
              const dateDisplay = safeDate(apptDateRaw, 'N/A');
              const timeSlot = getField(appointment, 'time_slot', 'timeSlot') || '';
              const testName = appointment.medicalTest?.name || appointment.testName || 'Test';
              const hospitalName = appointment.hospital?.name || appointment.hospitalName || 'Hospital';
              const price = safeNumber(getField(appointment.medicalTest || {}, 'price') ?? getField(appointment, 'price'));

              return (
                <div key={appointment.id} className="appointment-item">
                  <div className="appointment-header">
                    <strong>{testName}</strong>
                    <span className={`status ${appointment.status}`}>{appointment.status}</span>
                  </div>
                  <p>
                    <i className="fas fa-hospital"></i> {hospitalName}
                  </p>
                  <p>
                    <i className="fas fa-calendar"></i> {dateDisplay} {timeSlot ? ` • ${timeSlot}` : ''}
                  </p>
                  {price ? (
                    <p>
                      <i className="fas fa-money-bill-wave"></i> {price.toLocaleString()} RWF
                    </p>
                  ) : null}
                  <p className="reference">Reference: {appointment.reference || appointment.id}</p>
                </div>
              );
            });
          })()
        )}
      </div>
      <button className="cta-button" onClick={() => setActiveSection("search")}>
        <i className="fas fa-plus"></i> Book New Test
      </button>
    </div>
  );

  const renderResultsTab = () => (
    <div
      id="resultsTab"
      className={`dashboard-tab ${activeTab === "results" ? "active" : ""}`}
    >
      <h3>Test Results</h3>
      <div className="results-list">
        {userResults.length === 0 ? (
          <div className="no-results">
            <i className="fas fa-file-medical"></i>
            <h4>No test results yet</h4>
            <p>Your test results will appear here after your appointments</p>
          </div>
        ) : (
          userResults.map((result) => {
            const testName = result.medicalTest?.name || result.testName || 'Test';
            const hospitalName = result.hospital?.name || result.hospitalName || 'Hospital';
            // Prefer the nested appointment date if present, otherwise try known top-level fields
            const apptDateRaw = result.appointment?.appointment_date ?? getField(result, 'testDate', 'test_date', 'appointment_date', 'created_at', 'createdAt');
            const apptDateDisplay = safeDate(apptDateRaw, 'N/A');
            const files = result.files || [];
            return (
              <div key={result.id} className="result-item">
                <div className="result-header">
                  <strong>{testName}</strong>
                  <span className={`status ${result.status}`}>
                    {result.status}
                  </span>
                </div>
                <p>
                  <i className="fas fa-hospital"></i> {hospitalName}
                </p>
                <p>
                  <i className="fas fa-calendar"></i>{" "}
                  {apptDateDisplay}
                </p>
                {files.length > 0 && (
                  <p>
                    <i className="fas fa-paperclip"></i> {files.length} file{files.length>1? 's':''}
                  </p>
                )}
                <div className="result-actions">
                  <button
                    className="book-btn"
                    onClick={() => viewResult(result)}
                  >
                    <i className="fas fa-eye"></i> View Results
                  </button>
                  <button
                    className="secondary-btn"
                    onClick={() => downloadResult(result)}
                  >
                    <i className="fas fa-download"></i> Download
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  const renderProfileTab = () => (
    <div
      id="profileTab"
      className={`dashboard-tab ${activeTab === "profile" ? "active" : ""}`}
    >
      <h3>My Profile</h3>
      <div className="profile-info">
        <div className="profile-item">
          <label>Full Name:</label>
          <span id="profileName">{currentUser?.name || "-"}</span>
        </div>
        <div className="profile-item">
          <label>Phone Number:</label>
          <span id="profilePhone">{currentUser?.phone || "-"}</span>
        </div>
        <div className="profile-item">
          <label>Email:</label>
          <span id="profileEmail">{currentUser?.email || "-"}</span>
        </div>
        <div className="profile-item">
          <label>Insurance Number:</label>
          <span id="profileInsurance">
            {currentUser?.insuranceNumber || "Not provided"}
          </span>
        </div>
      </div>
      <button className="logout-btn" onClick={logout}>
        <i className="fas fa-sign-out-alt"></i> Logout
      </button>
    </div>
  );

  const viewResult = (result) => {
    // If there are files, open the first file in a new tab. Otherwise show details.
    const files = result.files || [];
    if (files.length > 0 && files[0].url) {
      window.open(files[0].url, '_blank');
      return;
    }
    // Otherwise show a compact details dialog
    const testName = result.medicalTest?.name || result.testName || 'Test';
    const hospitalName = result.hospital?.name || result.hospitalName || 'Hospital';
    const apptDateRaw = result.appointment?.appointment_date ?? getField(result, 'testDate', 'test_date', 'appointment_date', 'created_at', 'createdAt');
    const apptDate = safeDateTime(apptDateRaw, 'N/A');
    const numeric = result.numeric_results ? JSON.stringify(result.numeric_results) : 'N/A';
    const text = result.text_results ? JSON.stringify(result.text_results) : result.text_findings || 'N/A';
    alert(`Result: ${testName}\nHospital: ${hospitalName}\nDate: ${apptDate}\n\nNumeric: ${numeric}\nText: ${text}`);
  };

  const downloadResult = (result) => {
    const files = result.files || [];
    if (files.length === 0) {
      alert('No attached files to download for this result.');
      return;
    }
    // Open each file url in a new tab (browser will handle download or display)
    files.forEach((f) => {
      if (f.url) {
        window.open(f.url, '_blank');
      }
    });
  };

  return (
    <section id="dashboard" className="section active">
      <div className="dashboard-header">
        <h2>My Dashboard</h2>
        <p>Manage your appointments and view test results</p>
      </div>

      <div className="dashboard-actions">
        <button
          className={`dashboard-btn ${
            activeTab === "appointments" ? "active" : ""
          }`}
          onClick={() => setActiveTab("appointments")}
        >
          <i className="fas fa-calendar-alt"></i> Appointments
        </button>
        <button
          className={`dashboard-btn ${activeTab === "results" ? "active" : ""}`}
          onClick={() => setActiveTab("results")}
        >
          <i className="fas fa-file-medical-alt"></i> Test Results
        </button>
        <button
          className={`dashboard-btn ${activeTab === "profile" ? "active" : ""}`}
          onClick={() => setActiveTab("profile")}
        >
          <i className="fas fa-user"></i> Profile
        </button>
      </div>

      <div className="dashboard-content">
        {activeTab === "appointments" && renderAppointmentsTab()}
        {activeTab === "results" && renderResultsTab()}
        {activeTab === "profile" && renderProfileTab()}
      </div>
    </section>
  );
};

export default DashboardSection;
