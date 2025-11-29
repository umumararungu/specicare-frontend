import React, { useState, useEffect } from "react";
import { useApp } from "../../../context/AppContext";
import { DISTRICTS, getSectors } from '../../../utils/locations';

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
    insurance_providers: []
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
        insurance_providers: edit.insurance_providers
          ? (Array.isArray(edit.insurance_providers)
              ? edit.insurance_providers
              : (typeof edit.insurance_providers === 'string'
                  ? (() => {
                      try {
                        return JSON.parse(edit.insurance_providers);
                      } catch (e) {
                        return edit.insurance_providers
                          .split(/\r?\n|,/) // split by newlines or commas
                          .map(s => s.trim())
                          .filter(Boolean);
                      }
                    })()
                  : []))
          : [],
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
    // Reset sector and cell when district changes
    if (name === 'district') {
      setForm((p) => ({ ...p, district: value, sector: '', cell: '' }));
      return;
    }
    // Reset cell when sector changes
    if (name === 'sector') {
      setForm((p) => ({ ...p, sector: value, cell: '' }));
      return;
    }
    // multi-select insurance_providers (selectedOptions -> array)
    if (name === 'insurance_providers') {
      const selected = Array.from(e.target.selectedOptions || []).map((o) => o.value);
      setForm((p) => ({ ...p, insurance_providers: selected }));
      return;
    }
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
        insurance_providers: Array.isArray(form.insurance_providers)
          ? form.insurance_providers
          : safeJsonParse(form.insurance_providers, "Insurance Providers"),
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

        <select name="district" value={form.district} onChange={handleChange}>
          <option value="">District</option>
          {DISTRICTS.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        {(() => {
          const sectors = getSectors(form.district || '');
          if (sectors && sectors.length > 0) {
            return (
              <select name="sector" value={form.sector} onChange={handleChange}>
                <option value="">Sector</option>
                {sectors.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            );
          }

          return (
            <input name="sector" placeholder="Sector" value={form.sector} onChange={handleChange} />
          );
        })()}

        <input name="street" placeholder="Street" value={form.street} onChange={handleChange} />


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

        <div className="form-group">
          <label htmlFor="insurance_providers">Insurance Providers</label>
          <select
            id="insurance_providers"
            name="insurance_providers"
            multiple
            value={form.insurance_providers}
            onChange={handleChange}
          >
            <option value="RAMA">RAMA</option>
            <option value="MMI">MMI</option>
            <option value="RSSB">RSSB</option>
            <option value="EDEN">EDEN</option>
            <option value="BRITAM">BRITAM</option>
            <option value="RADIANT">RADIANT</option>
            <option value="PRIME">PRIME</option>
          </select>
          <small className="form-help">Hold Ctrl (Cmd on macOS) to select multiple</small>
        </div>

        <div className="modal-actions">
          <button onClick={handleSubmit}>{edit ? 'Save Changes' : 'Create Hospital'}</button>
          <button className="close-btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}