// src/context/AppContext.js
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import axios from "axios";
import { useSocket } from "../hooks/useSocket";

axios.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axios.defaults.withCredentials = true;
axios.defaults.headers.common["Content-Type"] = "application/json";

/* Helpers */
const toCamel = (s) => String(s).replace(/_([a-z])/g, (_, p1) => p1.toUpperCase());
const camelizeObject = (obj) => {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(camelizeObject);
  const out = {};
  Object.keys(obj).forEach((k) => {
    out[toCamel(k)] = camelizeObject(obj[k]);
  });
  return out;
};

const AppContext = createContext();

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
};

export const AppProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const raw = localStorage.getItem("currentUser");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [appointments, setAppointments] = useState([]);
  const [testResults, setTestResults] = useState([]);
  const [currentTest, setCurrentTest] = useState(null);
  const [currentResultDraft, setCurrentResultDraft] = useState(null);
  const [medicalTests, setMedicalTests] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [activeSection, setActiveSection] = useState("home");
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [errors, setErrors] = useState([]);
  const [adminStats, setAdminStats] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [allAppointments, setAllAppointments] = useState([]);

  const rawUrl = (process.env.REACT_APP_API_URL || "http://localhost:5000").replace(/\/+$/, "");
  const API_BASE = `${rawUrl}/api`;
  const SOCKET_URL = rawUrl;

  const isAdmin = currentUser?.role === "admin";

  const clearErrors = useCallback(() => setErrors([]), []);

  const showNotification = useCallback((message, type = "info", duration = 5000) => {
    setNotification({ message, type });
    if (duration > 0) {
      setTimeout(() => setNotification(null), duration);
    }
  }, []);

  const showErrors = useCallback((errorMessages, type = "error") => {
    if (Array.isArray(errorMessages)) {
      setErrors(errorMessages);
      if (errorMessages.length > 0) showNotification(errorMessages[0], type);
    } else {
      setErrors([errorMessages]);
      showNotification(errorMessages, type);
    }
  }, [showNotification]);

  const fetchAdminData = useCallback(async () => {
    try {
      // Only fetch admin dashboard stats. Fetching users and appointments
      // has caused stability issues in some environments, so avoid those
      // requests here. If you need users/appointments later, call the
      // specific endpoints from an admin-only page where errors can be
      // handled more gracefully.
      const statsRes = await axios.get(`${API_BASE}/admin/dashboard/stats`);
      setAdminStats(camelizeObject(statsRes.data?.stats ?? statsRes.data ?? {}));
    } catch (err) {
      console.error("fetchAdminData error", err);
      showNotification(err.response?.data?.message || "Error loading admin data", "error");
    }
  }, [API_BASE, showNotification]);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/notifications/my`);
      if (res.data?.success) setNotifications(camelizeObject(res.data.notifications || []));
    } catch (err) {
      console.error("fetchNotifications error", err);
    }
  }, [API_BASE]);

  const fetchHospitals = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/hospitals`);
      setHospitals(camelizeObject(res.data?.hospitals || []));
      return res.data;
    } catch (err) {
      console.error("fetchHospitals error", err);
      showErrors(err.response?.data?.message || "Failed to fetch hospitals");
      throw err;
    }
  }, [API_BASE, showErrors]);

  const isInitializing = useRef(false);

  // Guard to avoid re-running auth-based initialization multiple times
  const _authInitialized = useRef(false);

  // Helper to extract common token fields from a user object returned by backend
  const extractTokenFromUser = (user) => {
    if (!user || typeof user !== 'object') return null;
    return user.token || user.accessToken || user.authToken || user.jwt || user.access_token || null;
  };

  const initializeData = useCallback(async () => {
    const token = currentUser?.token;
    // Debug: current token before initialization
    // eslint-disable-next-line no-console
    console.debug('initializeData token:', token);
    if (!token) return;

    if (isInitializing.current) return;
    isInitializing.current = true;
    setIsLoading(true);

    try {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      const userRes = await axios.get(`${API_BASE}/users/me`);
      const camelUser = camelizeObject(userRes.data?.user);
      setCurrentUser(camelUser);

      // Avoid fetching medical tests and appointments here (these endpoints
      // have caused issues). Only fetch hospitals which are required by the UI.
      const hospitalsRes = await axios.get(`${API_BASE}/hospitals`);
      setHospitals(camelizeObject(hospitalsRes.data?.hospitals || []));

      if (camelUser?.role === "admin") {
        // Only fetch admin stats (fetchAdminData no longer fetches users/bookings/tests)
        await fetchAdminData();
      }
      await fetchNotifications();

      setActiveSection(camelUser?.role === "admin" ? "admin" : "dashboard");
    } catch (err) {
      console.error("initializeData error", err);
      setCurrentUser(null);
      localStorage.removeItem("currentUser");
      setAppointments([]);
      setTestResults([]);
      setActiveSection("login");
    } finally {
      setIsLoading(false);
      isInitializing.current = false;
    }
  }, [API_BASE, currentUser?.token, fetchAdminData, fetchNotifications]);

  useEffect(() => {
    initializeData();
  }, [initializeData]);

  useEffect(() => {
    if (currentUser?.token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${currentUser.token}`;
      try {
        localStorage.setItem("currentUser", JSON.stringify(currentUser));
      } catch (e) {
        // ignore storage errors
      }
    } else {
      delete axios.defaults.headers.common["Authorization"];
      try {
        localStorage.removeItem("currentUser");
      } catch (e) {}
    }
  }, [currentUser]);

  // Global axios interceptor to handle 401 responses centrally. This prevents
  // repeated failing requests from flooding the console and allows us to
  // clear local auth state when the token is invalid/expired.
  const _seen401 = useRef(false);
  useEffect(() => {
    const id = axios.interceptors.response.use(
      (resp) => resp,
      (error) => {
        // Debug: log interceptor error payload
        // eslint-disable-next-line no-console
        console.debug('axios interceptor error:', error?.response?.data || error?.message || error);
        const status = error?.response?.status;
        if (status === 401) {
          // notify once per short window to avoid spam
          if (!_seen401.current) {
            _seen401.current = true;
            showNotification('Authentication required — please login', 'error');
            // Clear local auth so UI can show login and stop further authed requests
            setCurrentUser(null);
            delete axios.defaults.headers.common['Authorization'];
            // reset seen flag after 5s so user can be notified again if needed
            setTimeout(() => { _seen401.current = false; }, 5000);
          }
        }
        return Promise.reject(error);
      }
    );

    return () => axios.interceptors.response.eject(id);
  }, [showNotification]);

  const lastRefreshRef = useRef(0);
  const SOCKET_COOLDOWN_MS = 3000;

  useSocket(
    SOCKET_URL,
    // Pass the auth token (if available) to the socket server via `auth`.
    // Do not force `transports: ['websocket']` so the client may fall back
    // to polling when a pure websocket connection is not possible.
    { auth: { token: extractTokenFromUser(currentUser) || currentUser?.token } },
    {
      notification: (payload) => {
        try {
          const p = camelizeObject(payload);
          setNotifications((prev) => [p, ...(prev || [])]);
        } catch (e) {
          console.error("socket notification handler error", e);
        }
      },
      "appointment:update": async (payload) => {
        try {
          const now = Date.now();
          if (now - lastRefreshRef.current < SOCKET_COOLDOWN_MS) return;
          lastRefreshRef.current = now;

          if (currentUser?.role === "admin") {
            await fetchAdminData();
          } else if (currentUser) {
            // Avoid fetching bookings here; instead refresh notifications
            // which are safe and lightweight and inform users of updates.
            await fetchNotifications();
          }
        } catch (e) {
          console.error("socket appointment:update handler error", e);
        }
      },
    },
    !!currentUser
  );

  const login = useCallback(async (email, password) => {
    try {
      setIsLoading(true);
      clearErrors();
      const res = await axios.post(`${API_BASE}/users/login`, { email, password });
      // Debug: raw login response
      // eslint-disable-next-line no-console
      console.debug('login response:', res.data);

      if (res.data?.success) {
        const camelUser = camelizeObject(res.data.user || res.data);
        setCurrentUser(camelUser);

        // Extract token from either the returned user object or top-level response
        let token = extractTokenFromUser(camelUser) || res.data.token || res.data.access_token || res.data.accessToken || null;
        if (token) {
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          // mark auth initialization so initializeData doesn't clear the user
          try { _authInitialized.current = true; } catch (e) {}
          // Debug: token and header set
          // eslint-disable-next-line no-console
          console.debug('login token set:', token);
          // eslint-disable-next-line no-console
          console.debug('axios Authorization header after login:', axios.defaults.headers.common['Authorization']);
        }

        showNotification(res.data.message || 'Login successful', 'success');
        return { ok: true, user: camelUser };
      }

      showErrors(res.data?.errors || [res.data?.message || 'Login failed']);
      return { ok: false };
    } catch (err) {
      console.error('Login error', err);
      showErrors(err.response?.data?.message || 'Login failed');
      return { ok: false };
    } finally {
      setIsLoading(false);
    }
  }, [API_BASE, clearErrors, showNotification, showErrors]);

  const logout = useCallback(async () => {
    try {
      await axios.post(`${API_BASE}/users/logout`).catch(() => {});
    } catch (e) {
      /* ignore */
    }
    setCurrentUser(null);
    localStorage.removeItem("currentUser");
    setCurrentTest(null);
    setActiveSection("home");
    setAppointments([]);
    setTestResults([]);
    setAdminStats(null);
    setAllUsers([]);
    setAllAppointments([]);
    showNotification("Logged out successfully", "success");
  }, [API_BASE, showNotification]);

  const register = useCallback(
    async (userData) => {
      try {
        setIsLoading(true);
        clearErrors();
        const res = await axios.post(`${API_BASE}/users/register`, userData);
        if (res.data?.success) {
          const user = camelizeObject(res.data.user);
          setCurrentUser(user);
          // extract token if returned at top-level or inside user
          let token = extractTokenFromUser(user) || res.data.token || res.data.access_token || res.data.accessToken || null;
          if (token) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            try { _authInitialized.current = true; } catch (e) {}
          }
          showNotification(res.data.message || "Registration successful", "success");
          return { ok: true, user };
        } else {
          showErrors(res.data.errors || [res.data.message || "Registration failed"]);
          return { ok: false };
        }
      } catch (err) {
        console.error("register error", err);
        showErrors([err.response?.data?.message || "Registration failed"]);
        return { ok: false };
      } finally {
        setIsLoading(false);
      }
    },
    [API_BASE, clearErrors, showNotification, showErrors]
  );

  const forgotPassword = useCallback(
    async (email) => {
      try {
        setIsLoading(true);
        const res = await axios.post(`${API_BASE}/users/forgot-password`, { email });
        showNotification(res.data?.message || "If an account exists, a reset email was sent", "info");
        return true;
      } catch (err) {
        console.error("forgotPassword error", err);
        showErrors(err.response?.data?.message || "Failed to request password reset");
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [API_BASE, showErrors, showNotification]
  );

  const resetPassword = useCallback(
    async (token, newPassword) => {
      try {
        setIsLoading(true);
        const res = await axios.post(`${API_BASE}/users/reset-password`, { token, password: newPassword });
        showNotification(res.data?.message || "Password reset successful", "success");
        setActiveSection("login");
        return true;
      } catch (err) {
        console.error("resetPassword error", err);
        showErrors(err.response?.data?.message || "Failed to reset password");
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [API_BASE, showErrors, showNotification]
  );

  const bookTest = useCallback((test) => {
    setCurrentTest(test);
  }, []);

  const confirmBooking = useCallback(
    async (bookingData) => {
      if (!currentUser) {
        showNotification("You must be logged in to book a test", "error");
        return null;
      }
      try {
        setIsLoading(true);
        const res = await axios.post(`${API_BASE}/appointments`, {
          ...bookingData,
          patientId: currentUser.id,
        });
        const created = camelizeObject(res.data || {});
        // Avoid fetching the full bookings list here to reduce problematic requests.
        // Append the created appointment locally so the UI reflects the new booking.
        setAppointments((prev) => [created, ...(prev || [])]);
        setCurrentTest(null);
        showNotification(created?.reference ? `Booking confirmed — reference: ${created.reference}` : "Booking confirmed successfully!", "success");
        return created;
      } catch (err) {
        console.error("confirmBooking error", err);
        showNotification(err.response?.data?.message || "Booking failed", "error");
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [API_BASE, currentUser, showNotification]
  );

  const createMedicalTest = useCallback(
    async (testData) => {
      try {
        const res = await axios.post(`${API_BASE}/admin/medical-test`, testData);
        const created = camelizeObject(res.data);
        setMedicalTests((prev) => [created, ...(prev || [])]);
        showNotification(res.data?.message || "Medical test created", "success");
        return created;
      } catch (err) {
        console.error("createMedicalTest error", err);
        showErrors(err.response?.data?.message || "Error creating test");
        throw err;
      }
    },
    [API_BASE, showNotification, showErrors]
  );

  const updateMedicalTest = useCallback(
    async (testId, updates) => {
      try {
        const res = await axios.put(`${API_BASE}/admin/medical-test/${testId}`, updates);
        const updated = camelizeObject(res.data);
        setMedicalTests((prev) => prev.map((t) => (t.id === testId ? updated : t)));
        showNotification(res.data?.message || "Medical test updated", "success");
        return updated;
      } catch (err) {
        console.error("updateMedicalTest error", err);
        showErrors(err.response?.data?.message || "Error updating test");
        throw err;
      }
    },
    [API_BASE, showNotification, showErrors]
  );

  const deleteMedicalTest = useCallback(
    async (testId) => {
      try {
        await axios.delete(`${API_BASE}/admin/medical-test/${testId}`);
        setMedicalTests((prev) => prev.filter((t) => t.id !== testId));
        showNotification("Medical test deleted", "success");
        return true;
      } catch (err) {
        console.error("deleteMedicalTest error", err);
        showErrors(err.response?.data?.message || "Error deleting test");
        throw err;
      }
    },
    [API_BASE, showErrors]
  );

  const createHospital = useCallback(
    async (payload) => {
      try {
        const res = await axios.post(`${API_BASE}/admin/hospitals`, payload);
        const h = camelizeObject(res.data);
        setHospitals((prev) => [h, ...(prev || [])]);
        showNotification("Hospital added successfully", "success");
        return h;
      } catch (err) {
        console.error("createHospital error", err);
        showErrors(err.response?.data?.message || "Error creating hospital");
        throw err;
      }
    },
    [API_BASE, showErrors]
  );

  const updateHospital = useCallback(
    async (hospitalId, updates) => {
      try {
        const res = await axios.put(`${API_BASE}/admin/hospitals/${hospitalId}`, updates);
        const updated = camelizeObject(res.data);
        setHospitals((prev) => prev.map((h) => (h.id === hospitalId ? updated : h)));
        showNotification("Hospital updated successfully", "success");
        return updated;
      } catch (err) {
        console.error("updateHospital error", err);
        showErrors(err.response?.data?.message || "Error updating hospital");
        throw err;
      }
    },
    [API_BASE, showErrors]
  );

  const deleteHospital = useCallback(
    async (hospitalId) => {
      try {
        await axios.delete(`${API_BASE}/admin/hospitals/${hospitalId}`);
        setHospitals((prev) => prev.filter((h) => h.id !== hospitalId));
        showNotification("Hospital deleted", "success");
        return true;
      } catch (err) {
        console.error("deleteHospital error", err);
        showErrors(err.response?.data?.message || "Error deleting hospital");
        throw err;
      }
    },
    [API_BASE, showErrors]
  );

  const updateAppointmentStatus = useCallback(
    async (appointmentId, status) => {
      try {
        const res = await axios.put(`${API_BASE}/admin/appointments/${appointmentId}/status`, { status });
        const updated = camelizeObject(res.data);
        setAllAppointments((prev) => prev.map((a) => (a.id === appointmentId ? updated : a)));
        setAppointments((prev) => prev.map((a) => (a.id === appointmentId ? updated : a)));
        showNotification(res.data?.message || "Appointment status updated", "success");
        return updated;
      } catch (err) {
        console.error("updateAppointmentStatus error", err);
        showErrors(err.response?.data?.message || "Error updating appointment status");
        throw err;
      }
    },
    [API_BASE, showErrors]
  );

  const createTestResult = useCallback(
    async (payload) => {
      try {
        const res = await axios.post(`${API_BASE}/admin/test-results`, payload);
        const created = camelizeObject(res.data);
        setTestResults((prev) => [created, ...(prev || [])]);
        showNotification("Test result created successfully", "success");
        return created;
      } catch (err) {
        console.error("createTestResult error", err);
        showErrors(err.response?.data?.message || "Error creating test result");
        throw err;
      }
    },
    [API_BASE, showErrors]
  );

  const deleteUser = useCallback(
    async (userId) => {
      try {
        await axios.delete(`${API_BASE}/admin/users/${userId}`);
        setAllUsers((prev) => prev.filter((u) => u.id !== userId));
        showNotification("User deleted", "success");
        return true;
      } catch (err) {
        console.error("deleteUser error", err);
        showErrors(err.response?.data?.message || "Error deleting user");
        throw err;
      }
    },
    [API_BASE, showErrors]
  );

  const refreshAdminData = useCallback(async () => {
    if (!isAdmin) return;
    await fetchAdminData();
    await fetchNotifications();
  }, [fetchAdminData, fetchNotifications, isAdmin]);

  const value = {
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

    setActiveSection,
    setMedicalTests,
    setCurrentResultDraft,
    setCurrentTest,

    login,
    logout,
    register,
    forgotPassword,
    resetPassword,

    bookTest,
    confirmBooking,

    createMedicalTest,
    updateMedicalTest,
    deleteMedicalTest,
    createHospital,
    updateHospital,
    deleteHospital,
    updateAppointmentStatus,
    createTestResult,
    deleteUser,

    fetchHospitals,
    fetchAdminData,
    fetchNotifications,
    refreshAdminData,
    showNotification,
    showErrors,
    clearErrors,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export default AppProvider;
