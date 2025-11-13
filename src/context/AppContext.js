// context/AppContext.js
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import axios from "axios";

const AppContext = createContext();

// Helper: convert snake_case keys to camelCase recursively for objects returned by backend
const toCamel = (s) => String(s).replace(/_([a-z])/g, (m, p1) => p1.toUpperCase());
const camelizeObject = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(camelizeObject);
  const out = {};
  Object.keys(obj).forEach((k) => {
    const v = obj[k];
    const key = toCamel(k);
    out[key] = camelizeObject(v);
  });
  return out;
};

// Custom hook to use the app context
export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
};

export const AppProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [testResults, setTestResults] = useState([]);
  const [currentTest, setCurrentTest] = useState(null);
  const [medicalTests, setMedicalTests] = useState([]);
  const [activeSection, setActiveSection] = useState("home");
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [errors, setErrors] = useState([]);
  const [adminStats, setAdminStats] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [allAppointments, setAllAppointments] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [currentResultDraft, setCurrentResultDraft] = useState(null);

  const API_BASE = "http://localhost:5000/api";

  // Check if user is admin
  const isAdmin = currentUser?.role === "admin";

  // Clear errors
  const clearErrors = () => setErrors([]);

  // Enhanced notification system
  const showNotification = (message, type = "info", duration = 5000) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), duration);
  };

  // Show multiple errors
  const showErrors = (errorMessages, type = "error") => {
    if (Array.isArray(errorMessages)) {
      setErrors(errorMessages);
      // Also show the first error as a notification
      if (errorMessages.length > 0) {
        showNotification(errorMessages[0], type);
      }
    } else {
      setErrors([errorMessages]);
      showNotification(errorMessages, type);
    }
  };

  // Fetch admin-specific data - defined with useCallback to avoid infinite re-renders
  const fetchAdminData = useCallback(async () => {
    try {
      const [statsRes, usersRes, appointmentsRes] = await Promise.all([
        axios.get(`${API_BASE}/admin/dashboard/stats`, {
          withCredentials: true,
        }),
        axios.get(`${API_BASE}/admin/users`, { withCredentials: true }),
        axios.get(`${API_BASE}/admin/appointments`, { withCredentials: true }),
      ]);
  setAdminStats(statsRes.data.stats);
  setAllUsers(camelizeObject(usersRes.data.users || []));
  setAllAppointments(camelizeObject(appointmentsRes.data.appointments || []));
    } catch (error) {
      console.error("Error fetching admin data:", error);
      showNotification("Error loading admin data", "error");
    }
  }, [API_BASE]); // Only depend on API_BASE since it's a constant

  // Enhanced initializeData for admin
  const initializeData = useCallback(async () => {
    try {
      setIsLoading(true);

      // Fetch logged-in user
      const userRes = await axios.get(`${API_BASE}/users/me`, {
        withCredentials: true,
      });
      const camelUser = camelizeObject(userRes.data.user);
      setCurrentUser(camelUser);
      // If already logged in, land admins on admin dashboard, regular users on dashboard
      if (camelUser?.role === 'admin') {
        setActiveSection('admin');
      } else {
        setActiveSection('dashboard');
      }

      // Fetch medical tests
      const testsRes = await axios.get(`${API_BASE}/medical-test`);
      console.log("medical test: ", testsRes);
  setMedicalTests(camelizeObject(testsRes.data || []));

      const hospitalsRes = await axios.get(`${API_BASE}/hospitals`, {
        withCredentials: true,
      });
  setHospitals(camelizeObject(hospitalsRes.data.hospitals || []));

      const apptsRes = await axios.get(`${API_BASE}/appointments/my`, {
        withCredentials: true,
      });
  setAppointments(camelizeObject(apptsRes.data || []));
      console.log("appointments: ", apptsRes.data);

      // If user is admin, fetch admin data and notifications
        if (userRes.data.user.role === "admin") {
        await fetchAdminData();
        // Fetch notifications for admin as well so admin sees server-side events immediately
        try {
          const notifRes = await axios.get(`${API_BASE}/notifications/my`, { withCredentials: true });
          if (notifRes.data && notifRes.data.success) {
            setNotifications(camelizeObject(notifRes.data.notifications || []));
          }
        } catch (err) {
          console.error('Error fetching notifications (admin):', err);
        }
      } else {
        // Regular user data
        const apptsRes = await axios.get(`${API_BASE}/appointments/my`, {
          withCredentials: true,
        });
        setAppointments(camelizeObject(apptsRes.data || []));

        const resultsRes = await axios.get(`${API_BASE}/test-results/my`, {
          withCredentials: true,
        });
        setTestResults(camelizeObject(resultsRes.data || []));
        // Fetch recent notifications for user
        await fetchNotifications();
      }

      setIsLoading(false);
    } catch (error) {
      console.error("Error initializing data:", error);
      setIsLoading(false);
      // If initialize fails (no session / server error), clear user and redirect to login
      setCurrentUser(null);
      setAppointments([]);
      setTestResults([]);
      setActiveSection("login");
    }
  }, [API_BASE, fetchAdminData]); // Include fetchAdminData in dependencies

  useEffect(() => {
    initializeData();
  }, [initializeData]);

  // If the user navigated to a password reset URL like /reset-password?token=..., switch to reset section
  useEffect(() => {
    try {
      const path = window.location.pathname || '';
      const qs = new URLSearchParams(window.location.search || '');
      if (path.includes('/reset-password') && qs.get('token')) {
        setActiveSection('reset');
      }
    } catch (e) {
      // ignore in SSR or non-browser contexts
    }
  }, []);

  // Listen for simple global events (used by some components) to change active section
  useEffect(() => {
    const handler = (e) => {
      try {
        const s = e.detail;
        if (s) setActiveSection(s);
      } catch (err) {
        // ignore
      }
    };
    window.addEventListener('app-set-section', handler);
    return () => window.removeEventListener('app-set-section', handler);
  }, []);

  // -------------------------------
  // Authentication
  // -------------------------------
  const login = async (email, password) => {
    try {
      setIsLoading(true);
      clearErrors();

      const res = await axios.post(
        `${API_BASE}/users/login`,
        { email, password },
        { withCredentials: true }
      );

      if (res.data.success) {
      const camelUser = camelizeObject(res.data.user);
      setCurrentUser(camelUser);
      // Redirect admin users to admin dashboard, others to user dashboard
      setActiveSection(camelUser?.role === 'admin' ? 'admin' : 'dashboard');
        showNotification(res.data.message, "success");
        clearErrors();

        // Reinitialize data after login
        await initializeData();

        setIsLoading(false);
        return true;
      } else {
        if (res.data.errors && res.data.errors.length > 0) {
          showErrors(res.data.errors, "error");
        } else {
          showErrors([res.data.message || "Login failed"], "error");
        }
        setIsLoading(false);
        return false;
      }
    } catch (error) {
      console.error("Login error:", error);

      if (error.response && error.response.data) {
        const backendError = error.response.data;
        if (backendError.errors && backendError.errors.length > 0) {
          showErrors(backendError.errors, "error");
        } else {
          showErrors([backendError.message || "Login failed"], "error");
        }
      } else if (error.request) {
        showErrors(
          [
            "Unable to connect to server. Please check your internet connection.",
          ],
          "error"
        );
      } else {
        showErrors(
          ["An unexpected error occurred. Please try again."],
          "error"
        );
      }

      setIsLoading(false);
      return false;
    }
  };

  const logout = async () => {
    try {
      await axios.post(
        `${API_BASE}/users/logout`,
        {},
        { withCredentials: true }
      );
      setCurrentUser(null);
      setCurrentTest(null);
      setActiveSection("home");
      setAppointments([]);
      setTestResults([]);
      setAdminStats(null);
      setAllUsers([]);
      setAllAppointments([]);
      showNotification("Logged out successfully", "success");
    } catch (error) {
      console.error("Logout error:", error);
      showNotification("Logout failed", "error");
    }
  };

  const register = async (userData) => {
    try {
      setIsLoading(true);
      clearErrors();

  const res = await axios.post(`${API_BASE}/users/register`, userData, { withCredentials: true });

      if (res.data.success) {
        const camelUser = camelizeObject(res.data.user);
        setCurrentUser(camelUser);
        setActiveSection(camelUser?.role === 'admin' ? 'admin' : 'dashboard');
        showNotification(res.data.message, "success");
        clearErrors();

        // Reinitialize data after registration
        await initializeData();

        setIsLoading(false);
        return true;
      } else {
        // Handle backend validation errors
        if (res.data.errors && res.data.errors.length > 0) {
          showErrors(res.data.errors, "error");
        } else {
          showErrors([res.data.message || "Registration failed"], "error");
        }
        setIsLoading(false);
        return false;
      }
    } catch (error) {
      console.error("Registration error:", error);

      // Handle axios errors
      if (error.response && error.response.data) {
        const backendError = error.response.data;
        if (backendError.errors && backendError.errors.length > 0) {
          showErrors(backendError.errors, "error");
        } else {
          showErrors([backendError.message || "Registration failed"], "error");
        }
      } else if (error.request) {
        showErrors(
          [
            "Unable to connect to server. Please check your internet connection.",
          ],
          "error"
        );
      } else {
        showErrors(
          ["An unexpected error occurred. Please try again."],
          "error"
        );
      }

      setIsLoading(false);
      return false;
    }
  };

  // -------------------------------
  // Password reset helpers
  // -------------------------------
  const forgotPassword = async (email) => {
    try {
      setIsLoading(true);
      const res = await axios.post(`${API_BASE}/users/forgot-password`, { email });
      showNotification(res.data?.message || 'If an account exists, a reset email has been sent', 'info');
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error('Forgot password error:', error);
      showNotification('Failed to request password reset', 'error');
      setIsLoading(false);
      return false;
    }
  };

  const resetPassword = async (token, newPassword) => {
    try {
      setIsLoading(true);
      const res = await axios.post(`${API_BASE}/users/reset-password`, { token, password: newPassword });
      showNotification(res.data?.message || 'Password reset successfully', 'success');
      // After reset, navigate to login
      setActiveSection('login');
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error('Reset password error:', error);
      showNotification(error.response?.data?.message || 'Failed to reset password', 'error');
      setIsLoading(false);
      return false;
    }
  };


  // -------------------------------
  // Booking / Appointments
  // -------------------------------
  const bookTest = (test) => {
    setCurrentTest(test);
  };

  const confirmBooking = async (bookingData) => {
    if (!currentUser) {
      showNotification("You must be logged in to book a test", "error");
      return;
    }
    try {
      setIsLoading(true);
      const res = await axios.post(
        `${API_BASE}/appointments`,
        {
          ...bookingData,
          patientId: currentUser.id,
        },
        { withCredentials: true }
      );
      // Capture created appointment (backend returns created appointment)
      const createdAppointment = res?.data ? camelizeObject(res.data) : null;
      // Refresh the user's appointments from the server to ensure consistent state
      try {
        const apptsRes = await axios.get(`${API_BASE}/appointments/my`, { withCredentials: true });
        setAppointments(camelizeObject(apptsRes.data || []));
      } catch (err) {
        // Fallback: append the returned appointment if fetching fresh list fails
        console.debug('Could not refresh appointments after booking, appending locally', err && err.message);
        setAppointments((prev) => [...prev, createdAppointment || camelizeObject(res.data)]);
      }
      setCurrentTest(null);
      // Show reference when available to help users track bookings
      const ref = createdAppointment?.reference || createdAppointment?.id;
      showNotification(
        ref ? `Booking confirmed — reference: ${ref}` : "Booking confirmed successfully!",
        "success"
      );
  // Return created appointment for callers that need it
  setIsLoading(false);
  return createdAppointment || null;
    } catch (error) {
      console.error("Booking error:", error);
      showNotification(
        error.response?.data?.message || "Booking failed",
        "error"
      );
      setIsLoading(false);
    }
  };

  // -------------------------------
  // Admin Functions
  // -------------------------------
  const updateAppointmentStatus = async (appointmentId, status) => {
    try {
      const res = await axios.put(
        `${API_BASE}/admin/appointments/${appointmentId}/status`,
        { status },
        { withCredentials: true }
      );

      if (res.data.success) {
        // Update local state
        setAllAppointments((prev) =>
          prev.map((apt) =>
            apt.id === appointmentId ? { ...apt, status } : apt
          )
        );

        showNotification(res.data.message, "success");
        // return the updated appointment so callers can act on it
        return res.data.appointment || null;
      }
    } catch (error) {
      console.error("Update appointment error:", error);
      showNotification(
        error.response?.data?.message || "Error updating appointment",
        "error"
      );
      return null;
    }
  };

  // Create a test result (admin)
  const createTestResult = async (payload) => {
    try {
      let res;
      // If payload is FormData (multipart), let the browser set headers
      if (typeof FormData !== 'undefined' && payload instanceof FormData) {
        res = await axios.post(`${API_BASE}/test-results`, payload, { withCredentials: true });
      } else {
        res = await axios.post(`${API_BASE}/test-results`, payload, { withCredentials: true });
      }

      if (res.data && res.data.success) {
        // Optionally refresh testResults or admin data
        await refreshAdminData();
        showNotification('Test result created successfully', 'success');
        return res.data.testResult;
      }
    } catch (error) {
      console.error('Create test result error:', error);
      showNotification(error.response?.data?.message || 'Error creating test result', 'error');
    }
    return null;
  };

  const createMedicalTest = async (testData) => {
    try {
      const res = await axios.post(`${API_BASE}/admin/medical-test`, testData, {
        withCredentials: true,
      });

      if (res.data.success) {
        // Update local state
        setMedicalTests((prev) => [...prev, res.data.test]);
        showNotification(res.data.message, "success");
        return true;
      }
    } catch (error) {
      console.error("Create test error:", error);
      showNotification(
        error.response?.data?.message || "Error creating test",
        "error"
      );
      return false;
    }
  };

  const updateMedicalTest = async (testId, updates) => {
    try {
      const res = await axios.put(`${API_BASE}/admin/medical-test/${testId}`, updates, {
        withCredentials: true,
      });

      if (res.data && res.data.success) {
        setMedicalTests((prev) => prev.map((t) => (t.id === testId ? { ...t, ...updates } : t)));
        showNotification(res.data.message || 'Medical test updated', 'success');
        return true;
      }
    } catch (error) {
      console.error('Update test error:', error);
      showNotification(error.response?.data?.message || 'Error updating test', 'error');
      return false;
    }
  };

  const deleteMedicalTest = async (testId) => {
    try {
      const res = await axios.delete(
        `${API_BASE}/admin/medical-test/${testId}`,
        { withCredentials: true }
      );

      if (res.data.success) {
        // Update local state
        setMedicalTests((prev) => prev.filter((test) => test.id !== testId));
        showNotification(res.data.message, "success");
        return true;
      }
    } catch (error) {
      console.error("Delete test error:", error);
      showNotification(
        error.response?.data?.message || "Error deleting test",
        "error"
      );
      return false;
    }
  };

  const deleteUser = async (userId) => {
    try {
      const res = await axios.delete(`${API_BASE}/admin/users/${userId}`, {
        withCredentials: true,
      });

      if (res.data.success) {
        // Update local state
        setAllUsers((prev) => prev.filter((user) => user.id !== userId));
        showNotification(res.data.message, "success");
        return true;
      }
    } catch (error) {
      console.error("Delete user error:", error);
      showNotification(
        error.response?.data?.message || "Error deleting user",
        "error"
      );
      return false;
    }
  };

  // -------------------------------
  // Hospital Management
  // -------------------------------
  const fetchHospitals = async () => {
    try {
      const res = await axios.get(`${API_BASE}/hospitals`, {
        withCredentials: true,
      });
      setHospitals(camelizeObject(res.data.hospitals || []));
    } catch (error) {
      console.error("Error fetching hospitals:", error);
      showNotification("Error loading hospitals", "error");
    }
  };

  // Fetch user's recent notifications
  const fetchNotifications = async () => {
    try {
      const res = await axios.get(`${API_BASE}/notifications/my`, { withCredentials: true });
      if (res.data && res.data.success) {
        setNotifications(camelizeObject(res.data.notifications || []));
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  const createHospital = async (hospitalData) => {
    try {
      const res = await axios.post(
        `${API_BASE}/admin/hospitals`,
        hospitalData,
        { withCredentials: true }
      );

      if (res.data.success) {
        setHospitals((prev) => [...prev, camelizeObject(res.data.hospital)]);
        showNotification(
          res.data.message || "Hospital added successfully",
          "success"
        );
        return true;
      }
    } catch (error) {
      console.error("Create hospital error:", error);
      showNotification(
        error.response?.data?.message || "Error creating hospital",
        "error"
      );
      return false;
    }
  };

  const updateHospital = async (hospitalId, updates) => {
    try {
      const res = await axios.put(
        `${API_BASE}/admin/hospitals/${hospitalId}`,
        updates,
        { withCredentials: true }
      );

      if (res.data.success) {
        setHospitals((prev) =>
          prev.map((h) => (h.id === hospitalId ? { ...h, ...updates } : h))
        );
        showNotification(
          res.data.message || "Hospital updated successfully",
          "success"
        );
        return true;
      }
    } catch (error) {
      console.error("Update hospital error:", error);
      showNotification(
        error.response?.data?.message || "Error updating hospital",
        "error"
      );
      return false;
    }
  };

  const deleteHospital = async (hospitalId) => {
    try {
      const res = await axios.delete(
        `${API_BASE}/admin/hospitals/${hospitalId}`,
        { withCredentials: true }
      );

      if (res.data.success) {
        setHospitals((prev) => prev.filter((h) => h.id !== hospitalId));
        showNotification(
          res.data.message || "Hospital deleted successfully",
          "success"
        );
        return true;
      }
    } catch (error) {
      console.error("Delete hospital error:", error);
      showNotification(
        error.response?.data?.message || "Error deleting hospital",
        "error"
      );
      return false;
    }
  };

  // Refresh admin data
  const refreshAdminData = async () => {
    if (isAdmin) {
      await fetchAdminData();
    }
  };

  // -------------------------------
  // Values exposed to components
  // -------------------------------
  const value = {
    // State
    currentUser,
    appointments: isAdmin ? allAppointments : appointments,
    testResults,
    currentTest,
    currentResultDraft,
    medicalTests,
    hospitals,
    activeSection,
    isLoading,
    notification,
  notifications,
    errors,
    adminStats,
  allUsers,
  allAppointments,
    isAdmin,

    // Setters
    setActiveSection,
    setMedicalTests,
  setCurrentResultDraft,

    // Auth functions
    login,
    logout,
    register,
  forgotPassword,
  resetPassword,

    // Booking functions
    bookTest,
    confirmBooking,
    setCurrentTest,

    // Notification functions
    showNotification,
    showErrors,
    clearErrors,

    // Hospital functions
    fetchHospitals,
    createHospital,
    updateHospital,
    deleteHospital,

    // Admin functions
    updateAppointmentStatus,
    createTestResult,
    createMedicalTest,
  updateMedicalTest,
    deleteMedicalTest,
    deleteUser,
    refreshAdminData,
    fetchNotifications,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export default AppProvider;
