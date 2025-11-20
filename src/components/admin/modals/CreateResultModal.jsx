import React, { useState, useEffect } from "react";

export default function CreateResultModal({ isOpen, onClose, onSubmit, appointment }) {
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

  const handleFile = (e) => {
    setFiles(Array.from(e.target.files));
  };

  const handleSubmit = () => {
    const data = new FormData();

    data.append("appointment_id", appointment.id);
    data.append("test_id", appointment.test_id);
    data.append("patient_id", appointment.patient_id);
    data.append("hospital_id", appointment.hospital_id);

    data.append("numeric_value", form.numeric_value);
    data.append("text_results", form.text_results);
    data.append("priority", form.priority);
    data.append("status", form.status);

    files.forEach((f) => data.append("files", f));

    onSubmit(data);
  };

  return (
    <div id="resultModal" className="modal" style={{ display: "block" }}>
      <div className="modal-content show">
        <span className="close" onClick={onClose} style={{ cursor: 'pointer' }}>&times;</span>
        <h2>Create Test Result</h2>

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
