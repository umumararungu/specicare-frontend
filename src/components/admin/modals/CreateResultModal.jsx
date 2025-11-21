import React, { useState, useEffect } from "react";

export default function CreateResultModal({ isOpen, onClose, onSubmit, appointment, selectedAppointment }) {
  const [form, setForm] = useState({
    numeric_value: "",
    text_results: "",
    priority: "normal",
    status: "completed"
  });

  const [files, setFiles] = useState([]);
  useEffect(() => {
    if (appointment) {
      setForm({ numeric_value: "", text_results: "", priority: "normal", status: "completed" });
      setFiles([]);
    }
  }, [appointment]);

  // modal lifecycle: body class, escape key, outside-click
  useEffect(() => {
    if (!isOpen) return;

    document.body.classList.add("modal-open");

    const handleKey = (e) => {
      if (e.key === "Escape") onClose && onClose();
    };

    const handleClick = (e) => {
      if (e.target && e.target.id === "resultModal") onClose && onClose();
    };

    document.addEventListener("keydown", handleKey);
    document.addEventListener("click", handleClick);

    return () => {
      document.body.classList.remove("modal-open");
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("click", handleClick);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  };

  // derive readable names from appointment shapes, falling back to selectedAppointment
  const resolve = (keys, src = {}) => {
    for (const k of keys) {
      const v = src[k];
      if (v !== undefined && v !== null) return v;
    }
    return undefined;
  };

  const source = appointment || selectedAppointment || {};
  const toDisplay = (v) => {
    if (v === undefined || v === null) return undefined;
    if (typeof v === "string") return v;
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    if (typeof v === "object") {
      if (v.name) return v.name;
      if (v.fullName) return v.fullName;
      if (v.email) return v.email;
      try {
        return JSON.stringify(v);
      } catch (e) {
        return String(v);
      }
    }
    return String(v);
  };

  const rawPatient = resolve(['patientName','patient_name','userName','patient','user'], source) || (source.patient || source.user);
  const patientName = toDisplay(rawPatient) || '—';

  const rawTest = resolve(['medicalTestName','medical_test_name','testName','test'], source) || (source.medicalTest || source.test);
  const testName = toDisplay(rawTest) || '—';

  const rawHospital = resolve(['hospitalName','hospital_name','hospital'], source) || source.hospital;
  const hospitalName = toDisplay(rawHospital) || '—';

  const handleFile = (e) => {
    setFiles(Array.from(e.target.files));
  };

  const handleSubmit = () => {
    const data = new FormData();

    // resolve ids from appointment or selectedAppointment (allow multiple shapes)
    const appointmentId = appointment?.id ?? selectedAppointment?.id ?? appointment?.appointment_id ?? selectedAppointment?.appointment_id ?? null;
    const testId = appointment?.test_id ?? appointment?.testId ?? appointment?.test?.id ?? selectedAppointment?.test_id ?? selectedAppointment?.testId ?? selectedAppointment?.test?.id ?? null;
    const patientId = appointment?.patient_id ?? appointment?.user_id ?? appointment?.patient?.id ?? selectedAppointment?.patient_id ?? selectedAppointment?.user_id ?? selectedAppointment?.patient?.id ?? null;
    const hospitalId = appointment?.hospital_id ?? appointment?.hospital?.id ?? appointment?.hospitalId ?? selectedAppointment?.hospital_id ?? selectedAppointment?.hospital?.id ?? selectedAppointment?.hospitalId ?? null;

  // Debug: Check if any are null
  console.log('Resolved IDs:', { appointmentId, testId, patientId, hospitalId });
  
  if (!appointmentId || !testId || !patientId || !hospitalId) {
    alert('Missing required appointment data. Please check the appointment details.');
    console.error('Missing IDs - cannot submit');
    return;
  }

  // CHANGE TO CAMELCASE - backend expects these names
  data.append("appointmentId", appointmentId);  // Changed from appointment_id
  data.append("testId", testId);                // Changed from test_id
  data.append("patientId", patientId);          // Changed from patient_id
  data.append("hospitalId", hospitalId);        // Changed from hospital_id

    data.append("numeric_value", form.numeric_value);
    data.append("text_results", form.text_results);
    data.append("priority", form.priority);
    data.append("status", form.status);

    files.forEach((f) => data.append("files", f));

    // Debug: enumerate FormData so we can inspect what is actually being sent
    try {
      // create a simple object representation for console readability
      const entries = {};
      for (const [k, v] of data.entries()) {
        // for files, just note filename
        if (v instanceof File) entries[k] = v.name;
        else entries[k] = v;
      }
      // eslint-disable-next-line no-console
      console.debug("CreateResultModal FormData entries:", entries);
    } catch (e) {
      // ignore debug failures
    }

    onSubmit(data);
  };

  return (
    <div id="resultModal" className="modal" style={{ display: "block" }}>
      <div className="modal-content show">
        <span className="close" onClick={onClose} style={{ cursor: 'pointer' }}>&times;</span>
        <h2>Create Test Result</h2>

        <p><strong>Patient:</strong> {patientName}</p>
        <p><strong>Test:</strong> {testName}</p>
        <p><strong>Hospital:</strong> {hospitalName}</p>

        <input
          name="numeric_value"
          placeholder="Numeric Value"
          value={form.numeric_value}
          onChange={handleChange}
        />

        <textarea
          name="text_results"
          placeholder="Text Result"
          value={form.text_results}
          onChange={handleChange}
        />

        <select name="priority" value={form.priority} onChange={handleChange}>
          <option value="normal">Normal</option>
          <option value="urgent">Urgent</option>
        </select>

        <select name="status" value={form.status} onChange={handleChange}>
          <option value="completed">Completed</option>
          <option value="verified">Verified</option>
        </select>

        <input type="file" multiple onChange={handleFile} />

        <div className="modal-actions">
          <button onClick={handleSubmit}>Save Result</button>
          <button className="close-btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
