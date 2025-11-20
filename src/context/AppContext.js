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

/* ---------------------------
   Helpers (outside component)
   --------------------------- */
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

/* ---------------------------
   Axios default config
   --------------------------- */
axios.defaults.withCredentials = false;
axios.defaults.headers.common["Content-Type"] = "application/json";

/* ---------------------------
   Context
   --------------------------- */
const AppContext = createContext();
export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
};

/* ---------------------------
   Provider
   --------------------------- */
export const AppProvider = ({ children }) => {
  // State
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

  // Config
  const rawUrl = (process.env.REACT_APP_API_URL || "http://localhost:5000").replace(/\/+$/, "");
  const API_BASE = `${rawUrl}/api`;
  const SOCKET_URL = rawUrl;

  const isAdmin = currentUser?.role === "admin";

  // Refs & cooldowns
  const isInitializing = useRef(false);
  const lastSocketRefresh = useRef(0);
  const SOCKET_COOLDOWN_MS = 3000;

  /* ---------------------------
     Stable small utilities wrapped with useCallback so they can be safely used in deps
     --------------------------- */
  const clearErrors = useCallback(() => setErrors([]), []);

  const showNotification = useCallback((message, type = "info", duration = 5000) => {
    setNotification({ message, type });
    if (duration > 0) {
      setTimeout(() => setNotification(null), duration);
    }
  }, []);

  const showErrors = useCallback(
    (errorMessages, type = "error") => {
      if (Array.isArray(errorMessages)) {
        setErrors(errorMessages);
        if (errorMessages.length > 0) showNotification(errorMessages[0], type);
      } else {
        setErrors([errorMessages]);
        showNotification(errorMessages, type);
      }
    },
    [showNotification]
  );

  /* ---------------------------
     Persist token and set axios header when currentUser changes
     (token stored on login as res.data.token; currentUser includes token field)
     --------------------------- */
  useEffect(() => {
    if (currentUser?.token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${currentUser.token}`;
      try {
        localStorage.setItem("currentUser", JSON.stringify(currentUser));
        localStorage.setItem("token", currentUser.token);
      } catch {}
    } else {
      delete axios.defaults.headers.common["Authorization"];
      try {
        localStorage.removeItem("currentUser");
        localStorage.removeItem("token");
      } catch {}
    }
  }, [currentUser]);

  /* ---------------------------
     Helper fetchers (stable)
     --------------------------- */
  const fetchAdminData = useCallback(async () => {
    try {
      const [statsRes, usersRes, appointmentsRes] = await Promise.all([
        axios.get(`${API_BASE}/admin/dashboard/stats`),
        axios.get(`${API_BASE}/admin/users`),
        axios.get(`${API_BASE}/admin/appointments`),
      ]);
      setAdminStats(statsRes.data?.stats ?? null);
      setAllUsers(camelizeObject(usersRes.data?.users || []));
      setAllAppointments(camelizeObject(appointmentsRes.data?.appointments || []));
    } catch (err) {
      console.error("fetchAdminData error", err);
      showNotification("Error loading admin data", "error");
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

  /* ---------------------------
     initializeData: guarded, only runs when token available
     --------------------------- */
  const initializeData = useCallback(async () => {
    const token = currentUser?.token || localStorage.getItem("token");
    if (!token) return;
    if (isInitializing.current) return;

    isInitializing.current = true;
    setIsLoading(true);

    try {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      // get user and base data
      const userRes = await axios.get(`${API_BASE}/users/me`);
      const camelUser = camelizeObject(userRes.data?.user);
      setCurrentUser((prev) => ({ ...(prev || {}), ...camelUser, token }));

      const [testsRes, hospitalsRes, apptsRes] = await Promise.all([
        axios.get(`${API_BASE}/medical-test`),
        axios.get(`${API_BASE}/hospitals`),
        axios.get(`${API_BASE}/appointments/my`),
      ]);

      setMedicalTests(camelizeObject(testsRes.data || []));
      setHospitals(camelizeObject(hospitalsRes.data?.hospitals || []));
      setAppointments(camelizeObject(apptsRes.data || []));

      if (camelUser?.role === "admin") {
        await fetchAdminData();
      }
      await fetchNotifications();

      setActiveSection(camelUser?.role === "admin" ? "admin" : "dashboard");
    } catch (err) {
      console.error("initializeData error", err);
      setCurrentUser(null);
      localStorage.removeItem("currentUser");
      localStorage.removeItem("token");
      setAppointments([]);
      setTestResults([]);
      setActiveSection("login");
    } finally {
      setIsLoading(false);
      isInitializing.current = false;
    }
  }, [API_BASE, currentUser?.token, fetchAdminData, fetchNotifications]);

  // Run initialize once when provider mounts (if token exists)
  useEffect(() => {
    initializeData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // empty on purpose – initializeData checks token itself

  /* ---------------------------
     Socket integration - HYBRID:
       - Admin: real-time appointments and admin data refresh (debounced)
       - All users: receive notifications via socket (no forced refresh)
     --------------------------- */
  useSocket(
    SOCKET_URL,
    { transports: ["websocket"], withCredentials: true },
    {
      notification: (payload) => {
        try {
          const p = camelizeObject(payload);
          setNotifications((prev) => [p, ...(prev || [])]);
        } catch (e) {
          console.error("socket notification handler error", e);
        }
      },
      "appointment:update": async () => {
        try {
          const now = Date.now();
          if (now - lastSocketRefresh.current < SOCKET_COOLDOWN_MS) return;
          lastSocketRefresh.current = now;

          // admin gets live admin refresh, users only refresh appointments
          if (currentUser?.role === "admin") {
            await fetchAdminData();
          } else if (currentUser) {
            const res = await axios.get(`${API_BASE}/appointments/my`);
            setAppointments(camelizeObject(res.data || []));
          }
        } catch (e) {
          console.error("socket appointment:update handler error", e);
        }
      },
    },
    !!currentUser // enabled only when a user object exists
  );

  /* ---------------------------
     Auth functions: login, logout, register, forgot/reset
     --------------------------- */
  const login = useCallback(
    async (email, password) => {
      try {
        setIsLoading(true);
        clearErrors();
        const res = await axios.post(`${API_BASE}/users/login`, { email, password });
        if (res.data?.success && res.data.token) {
          // backend returns token + user (you confirmed)
          const token = res.data.token;
          const user = camelizeObject(res.data.user || {});
          // persist token and user
          const newUser = { ...user, token };
          setCurrentUser(newUser);
          localStorage.setItem("token", token);
          localStorage.setItem("currentUser", JSON.stringify(newUser));
          showNotification(res.data.message || "Login successful", "success");
          // initializeData will run (either immediately via effect or we call it)
          await initializeData();
          return { ok: true, user: newUser };
        } else {
          showErrors(res.data?.errors || [res.data?.message || "Login failed"]);
          return { ok: false };
        }
      } catch (err) {
        console.error("login error", err);
        showErrors([err.response?.data?.message || "Login failed"]);
        return { ok: false };
      } finally {
        setIsLoading(false);
      }
    },
    [API_BASE, clearErrors, initializeData, showErrors, showNotification]
  );

  const logout = useCallback(async () => {
    try {
      await axios.post(`${API_BASE}/users/logout`).catch(() => {});
    } catch {}
    setCurrentUser(null);
    localStorage.removeItem("currentUser");
    localStorage.removeItem("token");
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
          const token = res.data.token;
          const user = camelizeObject(res.data.user || {});
          const newUser = { ...user, token };
          setCurrentUser(newUser);
          localStorage.setItem("token", token);
          localStorage.setItem("currentUser", JSON.stringify(newUser));
          showNotification(res.data.message || "Registration successful", "success");
          await initializeData();
          return { ok: true, user: newUser };
        } else {
          showErrors(res.data?.errors || [res.data?.message || "Registration failed"]);
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
    [API_BASE, clearErrors, initializeData, showErrors, showNotification]
  );

  const forgotPassword = useCallback(
    async (email) => {
      try {
        setIsLoading(true);
        const res = await axios.post(`${API_BASE}/users/forgot-password`, { email });
        showNotification(res.data?.message || "Reset email sent", "info");
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
        const res = await axios.post(`${API_BASE}/users/reset-password`, {
          token,
          password: newPassword,
        });
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

  /* ---------------------------
     Booking functions
     --------------------------- */
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
        // refresh appointments (best effort)
        try {
          const apptsRes = await axios.get(`${API_BASE}/appointments/my`);
          setAppointments(camelizeObject(apptsRes.data || []));
        } catch {
          setAppointments((prev) => [created, ...(prev || [])]);
        }
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

  /* ---------------------------
     Medical test / Hospital / Admin functions
     (admin endpoints use /admin prefix; adjust if your backend differs)
     --------------------------- */
  const createMedicalTest = useCallback(
    async (payload) => {
      try {
        const res = await axios.post(`${API_BASE}/admin/medical-test`, payload);
        // Normalize response shapes: some backends return { test }, others return the created object directly
        const raw = res.data?.test ?? res.data?.data ?? res.data ?? null;
        const created = camelizeObject(raw);
        setMedicalTests((prev) => [created, ...(prev || [])]);
        showNotification(res.data?.message || "Medical test created", "success");
        return created;
      } catch (err) {
        console.error("createMedicalTest error", err);
        // Log backend response for debugging
        // eslint-disable-next-line no-console
        console.debug('createMedicalTest response error:', err?.response?.data || err?.message || err);
        showErrors(err.response?.data?.message || "Error creating test");
        throw err;
      }
    },
    [API_BASE, showErrors, showNotification]
  );

  const updateMedicalTest = useCallback(
    async (id, updates) => {
      try {
        const res = await axios.put(`${API_BASE}/admin/medical-test/${id}`, updates);
        const updated = camelizeObject(res.data);
        setMedicalTests((prev) => prev.map((t) => (t.id === id ? updated : t)));
        showNotification(res.data?.message || "Medical test updated", "success");
        return updated;
      } catch (err) {
        console.error("updateMedicalTest error", err);
        showErrors(err.response?.data?.message || "Error updating test");
        throw err;
      }
    },
    [API_BASE, showErrors, showNotification]
  );

  const deleteMedicalTest = useCallback(
    async (id) => {
      try {
        await axios.delete(`${API_BASE}/admin/medical-test/${id}`);
        setMedicalTests((prev) => prev.filter((t) => t.id !== id));
        showNotification("Medical test deleted", "success");
        return true;
      } catch (err) {
        console.error("deleteMedicalTest error", err);
        showErrors(err.response?.data?.message || "Error deleting test");
        throw err;
      }
    },
    [API_BASE, showErrors, showNotification]
  );

  const createHospital = useCallback(
    async (payload) => {
      try {
        const res = await axios.post(`${API_BASE}/admin/hospitals`, payload);
        const raw = res.data?.hospital ?? res.data?.data ?? res.data ?? null;
        const created = camelizeObject(raw);
        setHospitals((prev) => [created, ...(prev || [])]);
        showNotification(res.data?.message || "Hospital added successfully", "success");
        return created;
      } catch (err) {
        console.error("createHospital error", err);
        // eslint-disable-next-line no-console
        console.debug('createHospital response error:', err?.response?.data || err?.message || err);
        showErrors(err.response?.data?.message || "Error creating hospital");
        throw err;
      }
    },
    [API_BASE, showErrors, showNotification]
  );

  const updateHospital = useCallback(
    async (id, updates) => {
      try {
        const res = await axios.put(`${API_BASE}/admin/hospitals/${id}`, updates);
        const updated = camelizeObject(res.data);
        setHospitals((prev) => prev.map((h) => (h.id === id ? updated : h)));
        showNotification("Hospital updated", "success");
        return updated;
      } catch (err) {
        console.error("updateHospital error", err);
        showErrors(err.response?.data?.message || "Error updating hospital");
        throw err;
      }
    },
    [API_BASE, showErrors, showNotification]
  );

  const deleteHospital = useCallback(
    async (id) => {
      try {
        await axios.delete(`${API_BASE}/admin/hospitals/${id}`);
        setHospitals((prev) => prev.filter((h) => h.id !== id));
        showNotification("Hospital deleted", "success");
        return true;
      } catch (err) {
        console.error("deleteHospital error", err);
        showErrors(err.response?.data?.message || "Error deleting hospital");
        throw err;
      }
    },
    [API_BASE, showErrors, showNotification]
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
    [API_BASE, showErrors, showNotification]
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
    [API_BASE, showErrors, showNotification]
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
    [API_BASE, showErrors, showNotification]
  );

  /* ---------------------------
     Exposed context value
     --------------------------- */
  const value = {
    // state
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

    // setters
    setActiveSection,
    setMedicalTests,
    setCurrentResultDraft,
    setCurrentTest,

    // auth
    login,
    logout,
    register,
    forgotPassword,
    resetPassword,

    // booking
    bookTest,
    confirmBooking,

    // admin / tests / hospitals
    createMedicalTest,
    updateMedicalTest,
    deleteMedicalTest,
    createHospital,
    updateHospital,
    deleteHospital,
    updateAppointmentStatus,
    createTestResult,
    deleteUser,

    // misc
    fetchHospitals,
    fetchAdminData,
    fetchNotifications,
    showNotification,
    showErrors,
    clearErrors,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export default AppProvider;
