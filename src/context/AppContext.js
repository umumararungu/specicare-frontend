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

/*
  AppContext.js - Stable, lint-clean, token-safe App context.
  Key points:
  - token comes from login response (res.data.token) and/or localStorage
  - /users/me is used only to refresh profile, NOT to obtain token
  - all callbacks are wrapped with useCallback (stable references for deps)
  - socket integration uses useSocket and a short cooldown to avoid repeated refreshes
*/

/* -----------------------
   Utilities (pure)
   ----------------------- */
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

/* -----------------------
   Axios defaults
   ----------------------- */
axios.defaults.withCredentials = false;
axios.defaults.headers.common["Content-Type"] = "application/json";

/* -----------------------
   Context creation
   ----------------------- */
const AppContext = createContext();
export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
};

/* -----------------------
   Provider
   ----------------------- */
export const AppProvider = ({ children }) => {
  // --- State ---
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
  const [activeSection, setActiveSection] = useState("home"); // home | login | dashboard | admin
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [errors, setErrors] = useState([]);
  const [adminStats, setAdminStats] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [allAppointments, setAllAppointments] = useState([]);

  // --- Config ---
  const rawUrl = (process.env.REACT_APP_API_URL || "http://localhost:5000").replace(/\/+$/, "");
  const API_BASE = `${rawUrl}/api`;
  const SOCKET_URL = rawUrl;

  const isAdmin = currentUser?.role === "admin";

  // --- Refs / cooldowns ---
  const isInitializing = useRef(false);
  const lastSocketRefresh = useRef(0);
  const SOCKET_COOLDOWN_MS = 3000;

  /* -----------------------
     Small stable helpers
     ----------------------- */
  const clearErrors = useCallback(() => setErrors([]), []);
  const showNotification = useCallback((message, type = "info", duration = 5000) => {
    setNotification({ message, type });
    if (duration > 0) setTimeout(() => setNotification(null), duration);
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

  /* -----------------------
     Persist token & currentUser -> axios header
     (token MUST come from login or localStorage)
     ----------------------- */
  useEffect(() => {
    try {
      if (currentUser?.token) {
        axios.defaults.headers.common["Authorization"] = `Bearer ${currentUser.token}`;
        localStorage.setItem("currentUser", JSON.stringify(currentUser));
        localStorage.setItem("token", currentUser.token);
      } else {
        delete axios.defaults.headers.common["Authorization"];
        localStorage.removeItem("currentUser");
        localStorage.removeItem("token");
      }
    } catch {
      // ignore localStorage errors
    }
  }, [currentUser]);

  /* -----------------------
     Fetch helpers (stable callbacks)
     ----------------------- */
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

  const fetchTestResults = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/test-results/my`);
      const data = res.data?.results ?? res.data ?? [];
      setTestResults(camelizeObject(data || []));
      return data;
    } catch (err) {
      console.error("fetchTestResults error", err);
      return [];
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

  // Public data fetcher - used to populate lists for anonymous users
  const fetchPublicData = useCallback(async () => {
    try {
      const [testsRes, hospitalsRes] = await Promise.all([
        axios.get(`${API_BASE}/medical-test`),
        axios.get(`${API_BASE}/hospitals`),
      ]);
      setMedicalTests(camelizeObject(testsRes.data || []));
      setHospitals(camelizeObject(hospitalsRes.data?.hospitals || []));
    } catch (err) {
      console.error("fetchPublicData error", err);
    }
  }, [API_BASE]);

  /* -----------------------
     initializeData (guarded)
     - token is read from currentUser.token OR localStorage token
     - does not assume /users/me returns token
     ----------------------- */
  const initializeData = useCallback(async () => {
    const token = currentUser?.token || localStorage.getItem("token");
    if (!token) return;
    if (isInitializing.current) return;

    isInitializing.current = true;
    setIsLoading(true);
    try {
      // ensure axios has header
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      // refresh profile (server returns user WITHOUT token)
      const userRes = await axios.get(`${API_BASE}/users/me`);
      const camelUser = camelizeObject(userRes.data?.user || {});
      // preserve token from storage
      const mergedUser = { ...(camelUser || {}), token };
      setCurrentUser(mergedUser);

      // fetch base lists
      const [testsRes, hospitalsRes, apptsRes] = await Promise.all([
        axios.get(`${API_BASE}/medical-test`),
        axios.get(`${API_BASE}/hospitals`),
        axios.get(`${API_BASE}/appointments/my`),
      ]);

      setMedicalTests(camelizeObject(testsRes.data || []));
      setHospitals(camelizeObject(hospitalsRes.data?.hospitals || []));
      setAppointments(camelizeObject(apptsRes.data || []));

      // fetch user's test results as well
      await fetchTestResults();

      if (mergedUser?.role === "admin") {
        await fetchAdminData();
      }
      await fetchNotifications();
      setActiveSection(mergedUser?.role === "admin" ? "admin" : "dashboard");
    } catch (err) {
      console.error("initializeData error", err);
      // invalid token or other error -> clear auth
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
  }, [API_BASE, currentUser?.token, fetchAdminData, fetchNotifications, fetchTestResults]);

  // run once on mount to pick up any token in localStorage
  useEffect(() => {
    // Always fetch public lists (medical tests + hospitals) so unauthenticated
    // users can browse available tests before logging in.
    fetchPublicData();
    // initializeData will return early if no token is present.
    initializeData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // initializeData guards token itself

  /* -----------------------
     Socket integration (useSocket)
     - anonymized handlers but use cooldown to avoid thrashing
     ----------------------- */
useSocket(
  SOCKET_URL,
  {
    transports: ["websocket"],
    auth: {
      token: currentUser?.token || localStorage.getItem("token") || null,
    },
    reconnection: true,
  },
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

        if (currentUser?.role === "admin") {
          await fetchAdminData();
        } else if (currentUser) {
          const res = await axios.get(`${API_BASE}/appointments/my`);
          setAppointments(camelizeObject(res.data || []));
        }
      } catch (e) {
        console.error("socket appointment:update handler", e);
      }
    },
  },
  !!currentUser // enable only when logged in
);

  /* -----------------------
     Auth functions
     - login MUST get token from response and store it
     - /users/me won't provide token, so use login token
     ----------------------- */
  const login = useCallback(
    async (email, password) => {
      try {
        setIsLoading(true);
        clearErrors();
        const res = await axios.post(`${API_BASE}/users/login`, { email, password });
        if (res.data?.success && res.data.token) {
          const token = res.data.token;
          const user = camelizeObject(res.data.user || {});
          const newUser = { ...user, token };
          setCurrentUser(newUser);
          try {
            localStorage.setItem("token", token);
            localStorage.setItem("currentUser", JSON.stringify(newUser));
          } catch {}
          showNotification(res.data.message || "Login successful", "success");
          // initialize other data
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
          try {
            localStorage.setItem("token", token);
            localStorage.setItem("currentUser", JSON.stringify(newUser));
          } catch {}
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

  /* -----------------------
     Booking
     ----------------------- */
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
        // backend expects snake_case keys; ensure patient_id is provided
        const res = await axios.post(`${API_BASE}/appointments`, {
          ...bookingData,
          patient_id: currentUser.id,
        });
        const created = camelizeObject(res.data || {});
        // refresh appointments best-effort
        try {
          const apptsRes = await axios.get(`${API_BASE}/appointments/my`);
          setAppointments(camelizeObject(apptsRes.data || []));
        } catch {
          setAppointments((prev) => [created, ...(prev || [])]);
        }
        setCurrentTest(null);
        showNotification(created?.reference ? `Booking confirmed — reference: ${created.reference}` : "Booking confirmed!", "success");
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

  /* -----------------------
     Admin / Tests / Hospitals
     ----------------------- */
  const createMedicalTest = useCallback(
    async (payload) => {
      try {
        const res = await axios.post(`${API_BASE}/admin/medical-test`, payload);
        const raw = res.data?.test ?? res.data?.data ?? res.data ?? null;
        const created = camelizeObject(raw);
        setMedicalTests((prev) => [created, ...(prev || [])]);
        showNotification(res.data?.message || "Medical test created", "success");
        return created;
      } catch (err) {
        console.error("createMedicalTest error", err, err.response?.data);
        showErrors(err.response?.data?.message || err.response?.data || "Error creating test");
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
        console.error("updateMedicalTest error", err, err.response?.data);
        showErrors(err.response?.data?.message || err.response?.data || "Error updating test");
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
        let res;

        // If payload is FormData (file upload), send as multipart/form-data
        if (typeof FormData !== "undefined" && payload instanceof FormData) {
          // When sending FormData, explicitly set multipart/form-data so axios/browser include boundary
          res = await axios.post(`${API_BASE}/test-results`, payload, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        } else {
          res = await axios.post(`${API_BASE}/test-results`, payload);
        }

        // server may return result under different keys; try common shapes
        const raw = res.data?.testResult ?? res.data?.result ?? res.data?.data ?? res.data;
        const created = camelizeObject(raw || {});

        // Normalize attached files so each has a `url` field usable by the UI
        const normalizeFile = (f) => {
          if (!f) return null;
          // already has url
          if (f.url) return f;
          if (f.fileUrl) return { ...f, url: f.fileUrl };
          if (f.path) {
            const u = String(f.path);
            return { ...f, url: u.startsWith("/") ? `${rawUrl}${u}` : u };
          }
          if (f.filePath) {
            const u = String(f.filePath);
            return { ...f, url: u.startsWith("/") ? `${rawUrl}${u}` : u };
          }
          if (f.filename) {
            const u = String(f.filename);
            return { ...f, url: u.startsWith("/") ? `${rawUrl}${u}` : u };
          }
          // s3 style
          if (f.location) return { ...f, url: f.location };
          return f;
        };

        if (Array.isArray(created.files)) {
          created.files = created.files.map(normalizeFile).filter(Boolean);
        }

        setTestResults((prev) => [created, ...(prev || [])]);
        showNotification("Test result created successfully", "success");
        return created;
      } catch (err) {
        console.error("createTestResult error", err);
        showErrors(err.response?.data?.message || "Error creating test result");
        throw err;
      }
    },
    [API_BASE, showErrors, showNotification, rawUrl]
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

  /* -----------------------
     Expose context value
     ----------------------- */
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

    // Auth
    login,
    logout,
    register,
    forgotPassword,
    resetPassword,

    // Booking
    bookTest,
    confirmBooking,

    // Admin / tests / hospitals
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
    fetchTestResults,
    fetchNotifications,
    showNotification,
    showErrors,
    clearErrors,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export default AppProvider;
