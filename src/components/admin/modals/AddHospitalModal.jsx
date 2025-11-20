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
        operating_hours: edit.operating_hours ? JSON.stringify(edit.operating_hours) : "",
        facilities: edit.facilities ? JSON.stringify(edit.facilities) : "",
        insurance_providers: edit.insurance_providers ? JSON.stringify(edit.insurance_providers) : "",
      });
    }
  }, [edit]);
  const { createHospital, updateHospital, showNotification, showErrors } = useApp();

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const handleSubmit = async () => {
    const cleaned = {
      ...form,
      operating_hours: form.operating_hours ? JSON.parse(form.operating_hours) : null,
      facilities: form.facilities ? JSON.parse(form.facilities) : null,
      insurance_providers: form.insurance_providers ? JSON.parse(form.insurance_providers) : null,
    };
    try {
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
      showErrors(err.response?.data?.message || "Failed to save hospital");
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-box">
        <h2>Add Hospital</h2>

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
          placeholder="Operating Hours (JSON)"
          value={form.operating_hours}
          onChange={handleChange}
        />

        <textarea
          name="facilities"
          placeholder="Facilities (JSON)"
          value={form.facilities}
          onChange={handleChange}
        />

        <textarea
          name="insurance_providers"
          placeholder="Insurance Providers (JSON)"
          value={form.insurance_providers}
          onChange={handleChange}
        />

        <div className="modal-actions">
          <button onClick={handleSubmit}>Create Hospital</button>
          <button className="close-btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
