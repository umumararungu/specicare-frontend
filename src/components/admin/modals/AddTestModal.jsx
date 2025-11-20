import React, { useState, useEffect } from "react";
import { useApp } from "../../../context/AppContext";

export default function AddTestModal({ isOpen, onClose, hospitals = [], onSubmit, edit }) {
  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "",
    hospital_id: "",
    price: "",
    duration: "",
    preparation_instructions: "",
    is_insurance_covered: true,
    insurance_co_pay: 0
  });

  useEffect(() => {
    if (edit) {
      setForm({
        name: edit.name || "",
        description: edit.description || "",
        category: edit.category || "",
        hospital_id: edit.hospital_id || "",
        price: edit.price ?? "",
        duration: edit.duration || "",
        preparation_instructions: edit.preparation_instructions || "",
        is_insurance_covered: edit.is_insurance_covered ?? true,
        insurance_co_pay: edit.insurance_co_pay ?? 0,
      });
    } else {
      setForm(prev => ({ ...prev }));
    }
  }, [edit]);

  const { createMedicalTest, updateMedicalTest, showNotification, showErrors } = useApp();


  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setForm((p) => ({ ...p, [name]: type === "number" ? Number(value) : value }));
  };

  const handleCheckbox = (e) => {
    setForm((p) => ({ ...p, is_insurance_covered: e.target.checked }));
  };

  const handleSubmit = async () => {
    const payload = {
      ...form,
      price: Number(form.price || 0),
      insurance_co_pay: Number(form.insurance_co_pay || 0),
    };
    try {
      let created = null;
      if (edit && edit.id) {
        created = await updateMedicalTest(edit.id, payload);
        showNotification("Test updated", "success");
      } else {
        created = await createMedicalTest(payload);
        showNotification("Test created", "success");
      }
      if (onSubmit) onSubmit(created);
      onClose();
    } catch (err) {
      console.error("AddTestModal submit error", err);
      showErrors(err.response?.data?.message || "Failed to save test");
    }
  };


  return (
    <div className="modal-backdrop">
      <div className="modal-box">
        <h2>{edit ? "Edit Medical Test" : "Add Medical Test"}</h2>

        <input name="name" placeholder="Test Name" value={form.name} onChange={handleChange} />

        <textarea
          name="description"
          placeholder="Description"
          value={form.description}
          onChange={handleChange}
        />

        <select name="category" value={form.category} onChange={handleChange}>
          <option value="">Select Category</option>
          <option value="radiology">Radiology</option>
          <option value="laboratory">Laboratory</option>
          <option value="cardiology">Cardiology</option>
          <option value="neurology">Neurology</option>
          <option value="pathology">Pathology</option>
          <option value="other">Other</option>
        </select>

        <select name="hospital_id" value={form.hospital_id} onChange={handleChange}>
          <option value="">Select Hospital</option>
          {hospitals.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>

        <input
          name="price"
          type="number"
          placeholder="Price"
          value={form.price}
          onChange={handleChange}
        />

        <input
          name="duration"
          placeholder="Duration (e.g., 45 minutes)"
          value={form.duration}
          onChange={handleChange}
        />

        <textarea
          name="preparation_instructions"
          placeholder="Preparation Instructions"
          value={form.preparation_instructions}
          onChange={handleChange}
        />

        <label>
          <input type="checkbox" checked={!!form.is_insurance_covered} onChange={handleCheckbox} />
          Insurance Covered
        </label>

        <input
          name="insurance_co_pay"
          type="number"
          placeholder="Insurance Co-Pay"
          value={form.insurance_co_pay}
          onChange={handleChange}
        />

        <div className="modal-actions">
          <button onClick={handleSubmit}>{edit ? "Update Test" : "Create Test"}</button>
          <button className="close-btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
