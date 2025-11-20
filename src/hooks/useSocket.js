import { useEffect, useRef, useMemo } from 'react';
import { io } from 'socket.io-client';

export function useSocket(url, opts = {}, handlers = {}, enabled = true) {
  const socketRef = useRef(null);
  const handlersRef = useRef(handlers);

  // Keep handlers always updated
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  // Serialize opts for stable dependency
  const optsKey = useMemo(() => {
    try {
      return JSON.stringify(opts || {});
    } catch {
      return String(opts || '');
    }
  }, [opts]);

  // ⭐ Extract token OUTSIDE the effect (this fixes the ESLint warning)
  const token = useMemo(() => {
    return (
      opts?.auth?.token ||
      localStorage.getItem("token") ||
      null
    );
  }, [opts?.auth?.token]);

  useEffect(() => {
    if (!enabled || !url) return;

    // Parse options from optsKey
    let optsObj = {};
    try {
      optsObj = JSON.parse(optsKey || '{}');
    } catch {
      optsObj = {};
    }

    if (!optsObj.auth) optsObj.auth = {};
    optsObj.auth.token = token;

    const socket = io(url, { ...optsObj, autoConnect: false });
    socketRef.current = socket;

    // Attach handlers
    Object.keys(handlersRef.current || {}).forEach((event) => {
      socket.on(event, (data) => {
        const h = handlersRef.current?.[event];
        if (typeof h === 'function') {
          try {
            h(data);
          } catch (err) {
            console.error('Socket handler error', event, err);
          }
        }
      });
    });

    socket.connect();

    socket.on("connect_error", (err) => {
      console.warn("Socket connect_error:", err?.message || err);
    });

    socket.on("connect", () => {
      console.info("Socket connected", socket.id);
    });

    socket.on("disconnect", (reason) => {
      console.info("Socket disconnected", reason);
    });

    return () => {
      try {
        socket.disconnect();
      } catch {}
      socketRef.current = null;
    };

  }, [url, enabled, optsKey, token]); 

  return socketRef;
}
