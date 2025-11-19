import { useEffect, useRef, useMemo } from 'react';
import { io } from 'socket.io-client';

// useSocket: manages a single socket.io connection while allowing handler
// functions to change without forcing a reconnect. Handlers are stored in a
// ref and invoked from wrapper listeners attached once when the socket
// connects. This avoids reconnect loops caused by recreating handler objects.
export function useSocket(url, opts = {}, handlers = {}, enabled = true) {
  const socketRef = useRef(null);
  const handlersRef = useRef(handlers);

  // keep handlersRef in sync with latest handlers without recreating the socket
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  // Serialize simple options for dependency purposes (safe for plain objects)
  const optsKey = useMemo(() => {
    try {
      return JSON.stringify(opts || {});
    } catch (e) {
      return String(opts || '');
    }
  }, [opts]);

  useEffect(() => {
    if (!enabled || !url) return;

    // Reconstruct options from the serialized key. If parsing fails, fall back to an empty object.
    let optsObj = {};
    try {
      optsObj = JSON.parse(optsKey || '{}');
    } catch (e) {
      optsObj = {};
    }

    const socket = io(url, { ...(optsObj || {}), autoConnect: false });
    socketRef.current = socket;

    // Attach wrapper handlers that delegate to the latest handlers from ref
    Object.keys(handlersRef.current || {}).forEach((event) => {
      socket.on(event, (data) => {
        const h = handlersRef.current && handlersRef.current[event];
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

    socket.on('connect_error', (err) => {
      console.warn('Socket connect_error:', err?.message || err);
    });

    socket.on('connect', () => {
      try {
        // eslint-disable-next-line no-console
        console.info('Socket connected', socket.id);
      } catch (e) {}
    });

    socket.on('disconnect', (reason) => {
      try {
        // eslint-disable-next-line no-console
        console.info('Socket disconnected', reason);
      } catch (e) {}
    });

    return () => {
      try {
        socket.disconnect();
      } catch (e) {
        // ignore
      }
      socketRef.current = null;
    };
    // We only recreate the connection when the url, enabled flag, or opts change.
  }, [url, enabled, optsKey]);

  return socketRef;
}
