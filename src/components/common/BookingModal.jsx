import React, { useState, useEffect, useCallback } from "react";
import { useApp } from "../../context/AppContext";
import axios from 'axios';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const BookingModal = () => {
  const { currentTest, confirmBooking, setCurrentTest, currentUser, hospitals } = useApp();

  const [bookingData, setBookingData] = useState({
    patientName: "",
    patientPhone: "",
    patientEmail: "",
    insuranceNumber: "",
    appointment_date: "",
    time_slot: "",
  });

  // sensible defaults so the UI shows helpful messages if server isn't ready yet
  const [availability, setAvailability] = useState({ allowedDays: ['Monday', 'Thursday'], opens: '08:00', closes: '17:00' });
  const [dateError, setDateError] = useState('');
  const [bookingDateObj, setBookingDateObj] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);

  // Reset form when modal opens/closes or user changes
  useEffect(() => {
    if (currentTest && currentUser) {
      setBookingData({
        patientName: currentUser?.name || "",
        patientPhone: currentUser?.phone || "",
        patientEmail: currentUser?.email || "",
        insuranceNumber: currentUser?.insuranceNumber || "",
        appointment_date: "",
        time_slot: "",
      });
      setBookingDateObj(null);
      setAvailableSlots([]);
      setDateError('');
    }
  }, [currentTest, currentUser]);

  // Fetch availability config from server and merge with defaults
  useEffect(() => {
    let mounted = true;
    const fetchAvailability = async () => {
      try {
        const res = await axios.get('/api/config/availability');
        if (mounted && res.data && res.data.success) {
          setAvailability(prev => ({ ...prev, ...(res.data.availability || {}) }));
        }
      } catch (err) {
        console.warn('Could not fetch availability config', err);
      }
    };
    fetchAvailability();
    return () => { mounted = false; };
  }, []);

  // Helper: format Date object to local YYYY-MM-DD (avoids timezone shifts)
  const formatDateLocal = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // Fetch available slots for a given date (YYYY-MM-DD)
  const fetchSlotsForDate = useCallback(async (dateIso) => {
    try {
      if (!dateIso || !currentTest) {
        setAvailableSlots([]);
        return;
      }
      const testHospitalId = currentTest?.hospitalId ?? currentTest?.hospital_id;
      const res = await axios.get('/api/appointments/availability', {
        params: {
          hospital_id: testHospitalId,
          date: dateIso,
          duration: currentTest.duration || 45,
        },
      });
      if (res.data && res.data.success) {
        setAvailableSlots(res.data.slots || []);
      } else {
        setAvailableSlots([]);
      }
    } catch (err) {
      console.warn('Could not fetch available slots', err);
      setAvailableSlots([]);
    }
  }, [currentTest]);

  // Fetch available slots when date or test/hospital changes
  useEffect(() => {
    if (bookingData.appointment_date) {
      fetchSlotsForDate(bookingData.appointment_date);
    } else {
      setAvailableSlots([]);
    }
  }, [bookingData.appointment_date, fetchSlotsForDate]); // Added fetchSlotsForDate to dependencies

  // Close modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      const modal = document.getElementById("bookingModal");
      if (event.target === modal) {
        setCurrentTest(null);
      }
    };

    if (currentTest) {
      document.addEventListener("click", handleClickOutside);
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }

    return () => {
      document.removeEventListener("click", handleClickOutside);
      document.body.classList.remove("modal-open");
    };
  }, [currentTest, setCurrentTest]);

  // Close modal with escape key
  useEffect(() => {
    const handleEscapeKey = (event) => {
      if (event.key === "Escape" && currentTest) {
        setCurrentTest(null);
      }
    };

    document.addEventListener("keydown", handleEscapeKey);
    return () => {
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, [currentTest, setCurrentTest]);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!bookingData.appointment_date) {
      alert("Please select an appointment date");
      return;
    }

    if (dateError) {
      alert(dateError);
      return;
    }

    if (!bookingData.patientName || !bookingData.patientPhone) {
      alert("Please fill in all required fields");
      return;
    }

    const completeBookingData = {
      ...bookingData,
      test_id: currentTest.id,
      testName: currentTest.name,
      hospital_id: currentTest?.hospital_id ?? currentTest?.hospitalId,
      price: currentTest.price,
    };

    confirmBooking(completeBookingData);
    setCurrentTest(null); // Close modal after booking
  };

  const handleDateChange = (date) => {
    setDateError('');
    setBookingDateObj(date);
    if (!date) {
      handleChange('appointment_date', '');
      return;
    }
    // Use local date string to avoid UTC offset issues
    const iso = formatDateLocal(date);
    // Validate allowed days
    const dayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    const name = dayNames[date.getDay()];
    const allowed = (availability.allowedDays || []).map(s => s.toLowerCase());
    if (!allowed.includes(name)) {
      setDateError(`Selected date is not available. Allowed days: ${ (availability.allowedDays || ['Monday','Thursday']).join(', ')}`);
    }
    handleChange('appointment_date', iso);
    // Immediately fetch slots for the selected date (don't wait for state round-trip)
    fetchSlotsForDate(iso);
  };

  const handleChange = (field, value) => {
    if (field === 'appointment_date') {
      // validate allowed days
      setDateError('');
      if (value) {
        const dayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
        const d = new Date(value);
        const name = dayNames[d.getDay()];
        const allowed = (availability.allowedDays || []).map(s => s.toLowerCase());
        if (!allowed.includes(name)) {
          setDateError(`Selected date is not available. Allowed days: ${ (availability.allowedDays || ['Monday','Thursday']).join(', ')}`);
        }
      }
    }
    setBookingData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Don't render if no test is selected
  if (!currentTest) {
    return null;
  }

  const hospital = (hospitals || []).find((hospital) => {
    // Support both snake_case and camelCase keys on the test
    const testHospitalId = currentTest?.hospitalId ?? currentTest?.hospital_id;
    // Use strict comparison on normalized string values to satisfy lint rules
    return testHospitalId != null && hospital && String(hospital.id) === String(testHospitalId);
  });

  return (
    <div id="bookingModal" className="modal" style={{ display: "block" }}>
      <div className="modal-content show">
        <span
          className="close"
          onClick={() => setCurrentTest(null)}
          style={{ cursor: "pointer" }}
        >
          &times;
        </span>
        <h2>Book Your Test</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Test Type</label>
            <input type="text" value={currentTest.name} readOnly />
          </div>
          <div className="form-group">
            <label>Hospital</label>
            <input
              type="text"
              value={`${hospital?.name || ''}${hospital?.district ? ' — ' + hospital?.district : ''}`}
              readOnly
            />
          </div>
          <div className="form-group">
            <label>Price</label>
            <input
              type="text"
              value={`${currentTest.price?.toLocaleString() || 0} RWF`}
              readOnly
            />
          </div>
          <div className="form-group">
            <label>Full Name *</label>
            <input
              type="text"
              value={bookingData.patientName}
              onChange={(e) => handleChange("patientName", e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Phone Number *</label>
            <input
              type="tel"
              value={bookingData.patientPhone}
              onChange={(e) => handleChange("patientPhone", e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              value={bookingData.patientEmail}
              onChange={(e) => handleChange("patientEmail", e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Insurance Number (CBHI)</label>
            <input
              type="text"
              value={bookingData.insuranceNumber}
              onChange={(e) => handleChange("insuranceNumber", e.target.value)}
              placeholder="Enter if applicable"
            />
          </div>
          <div className="form-group">
            <label>Preferred Date *</label>
            <DatePicker
              selected={bookingDateObj}
              onChange={handleDateChange}
              minDate={new Date()}
              filterDate={(d) => {
                const allowed = (availability.allowedDays || []).map(s => s.toLowerCase());
                const dayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
                return allowed.includes(dayNames[d.getDay()]);
              }}
              dateFormat="yyyy-MM-dd"
              placeholderText="Select a date"
              required
            />
            {dateError && <small style={{ color: 'red' }}>{dateError}</small>}
          </div>

          <div className="form-group">
            <label>Preferred time*</label>
            {availableSlots.length > 0 ? (
              <select
                value={bookingData.time_slot}
                onChange={(e) => handleChange('time_slot', e.target.value)}
                required
              >
                <option value="">Select a time</option>
                {availableSlots.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            ) : (
              <input
                type="time"
                value={bookingData.time_slot}
                onChange={(e) => handleChange("time_slot", e.target.value)}
                required
              />
            )}
            {availableSlots.length === 0 && <small>No suggested slots available for this date.</small>}
          </div>

          <button type="submit" className="submit-btn">
            Confirm Booking
          </button>
        </form>
      </div>
    </div>
  );
};

export default BookingModal;