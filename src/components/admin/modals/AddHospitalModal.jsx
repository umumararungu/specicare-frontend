import React, { useState, useEffect } from "react";
import { useApp } from "../../../context/AppContext";

export default function AddHospitalModal({ isOpen, onClose, onSubmit, edit }) {
  const [form, setForm] = useState({
    name: "",
    type: "",
    phone: "",
    email: "",
    emergency_phone: "",
    province: "",
    district: "",
    sector: "",
    cell: "",
    village: "",
    street: "",
    latitude: "",
    longitude: "",
    operating_hours: "",
    facilities: "",
    insurance_providers: ""
  });

  useEffect(() => {
    if (edit) {
      setForm({
        name: edit.name || "",
        type: edit.type || "",
        phone: edit.phone || "",
        email: edit.email || "",
        emergency_phone: edit.emergency_phone || "",
        province: edit.province || "",
        district: edit.district || "",
        sector: edit.sector || "",
        cell: edit.cell || "",
        village: edit.village || "",
        street: edit.street || "",
        latitude: edit.latitude ?? "",
        longitude: edit.longitude ?? "",
        operating_hours: edit.operating_hours ? JSON.stringify(edit.operating_hours, null, 2) : "",
        facilities: edit.facilities ? JSON.stringify(edit.facilities, null, 2) : "",
        insurance_providers: edit.insurance_providers ? JSON.stringify(edit.insurance_providers, null, 2) : "",
      });
    }
  }, [edit]);
  
  const { createHospital, updateHospital, showNotification, showErrors } = useApp();

  useEffect(() => {
    if (!isOpen) return;

    document.body.classList.add("modal-open");

    const handleKey = (e) => {
      if (e.key === "Escape") {
        onClose && onClose();
      }
    };

    const handleClick = (e) => {
      if (e.target && e.target.id === "hospitalModal") {
        onClose && onClose();
      }
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
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  // Helper function to safely parse JSON with forgiving fallbacks
  const safeJsonParse = (value, fieldName) => {
    if (!value || value.trim() === "") return null;

    const trimmed = value.trim();

    // If it looks like JSON, try parsing directly
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return JSON.parse(trimmed);
      } catch (error) {
        // fallthrough to forgiving parsing
        console.warn(`JSON.parse failed for ${fieldName}:`, error);
      }
    }

    // Fallbacks: allow simple comma/newline-separated lists for array-like fields
    const fname = (fieldName || "").toLowerCase();
    if (fname.includes("facility") || fname.includes("insurance")) {
      // split on newlines or commas and return array
      const parts = trimmed
        .split(/\r?\n|,/) // split by newline or comma
        .map((s) => s.trim())
        .filter(Boolean);
      if (parts.length === 0) return null;
      return parts;
    }

    // operating_hours expected to be an object; try parse simple key:value pairs
    if (fname.includes("operating")) {
      // try parsing pairs like "monday:8:00-17:00, tuesday:8:00-17:00" or newline separated
      const obj = {};
      const pairs = trimmed.split(/\r?\n|,/).map((p) => p.trim()).filter(Boolean);
      for (const p of pairs) {
        const sep = p.includes(":") ? ":" : p.includes("=") ? "=" : null;
        if (!sep) {
          // cannot parse this pair, skip
          continue;
        }
        const idx = p.indexOf(sep);
        const key = p.substring(0, idx).trim();
        const val = p.substring(idx + 1).trim();
        if (key) obj[key] = val;
      }
      // if we parsed at least one key, return it
      if (Object.keys(obj).length > 0) return obj;
    }

    // As a last resort, try to return the raw trimmed string (caller can accept it)
    return trimmed;
  };

  const handleSubmit = async () => {
    try {
      const cleaned = {
        ...form,
        operating_hours: safeJsonParse(form.operating_hours, "Operating Hours"),
        facilities: safeJsonParse(form.facilities, "Facilities"),
        insurance_providers: safeJsonParse(form.insurance_providers, "Insurance Providers"),
      };

      let created = null;
      if (edit && edit.id) {
        created = await updateHospital(edit.id, cleaned);
        showNotification("Hospital updated", "success");
      } else {
        created = await createHospital(cleaned);
        showNotification("Hospital created", "success");
      }
      if (onSubmit) onSubmit(created);
      onClose();
    } catch (err) {
      console.error("AddHospitalModal submit error", err);
      showErrors(err.response?.data?.message || err.message || "Failed to save hospital");
    }
  };

  return (
    <div id="hospitalModal" className="modal" style={{ display: "block" }}>
      <div className="modal-content show">
        <span className="close" onClick={onClose} style={{ cursor: 'pointer' }}>&times;</span>
        <h2>{edit ? 'Edit Hospital' : 'Add Hospital'}</h2>

        <input name="name" placeholder="Hospital Name" value={form.name} onChange={handleChange} />

        <select name="type" value={form.type} onChange={handleChange}>
          <option value="">Type</option>
          <option value="national_referral">National Referral</option>
          <option value="provincial">Provincial</option>
          <option value="district">District</option>
          <option value="private">Private</option>
          <option value="health_center">Health Center</option>
          <option value="clinic">Clinic</option>
        </select>

        <input name="phone" placeholder="Phone" value={form.phone} onChange={handleChange} />
        <input name="email" placeholder="Email" value={form.email} onChange={handleChange} />
        <input name="emergency_phone" placeholder="Emergency Phone" value={form.emergency_phone} onChange={handleChange} />

        <input name="province" placeholder="Province" value={form.province} onChange={handleChange} />
        <input name="district" placeholder="District" value={form.district} onChange={handleChange} />
        <input name="sector" placeholder="Sector" value={form.sector} onChange={handleChange} />
        <input name="cell" placeholder="Cell" value={form.cell} onChange={handleChange} />
        <input name="village" placeholder="Village" value={form.village} onChange={handleChange} />
        <input name="street" placeholder="Street" value={form.street} onChange={handleChange} />

        <input name="latitude" placeholder="Latitude" value={form.latitude} onChange={handleChange} />
        <input name="longitude" placeholder="Longitude" value={form.longitude} onChange={handleChange} />

        <textarea
          name="operating_hours"
          placeholder='Operating Hours (JSON) - e.g., {"monday": "8:00-17:00"}'
          value={form.operating_hours}
          onChange={handleChange}
          rows={3}
        />

        <textarea
          name="facilities"
          placeholder='Facilities (JSON) - e.g., ["Emergency Room", "ICU", "Pharmacy"]'
          value={form.facilities}
          onChange={handleChange}
          rows={3}
        />

        <textarea
          name="insurance_providers"
          placeholder='Insurance Providers (JSON) - e.g., ["RAMA", "MMI", "RSSB"]'
          value={form.insurance_providers}
          onChange={handleChange}
          rows={3}
        />

        <div className="modal-actions">
          <button onClick={handleSubmit}>{edit ? 'Save Changes' : 'Create Hospital'}</button>
          <button className="close-btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}