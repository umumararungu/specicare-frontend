import { useEffect, useRef, useMemo } from 'react';
import { io } from 'socket.io-client';

export function useSocket(url, opts = {}, handlers = {}, enabled = true) {
  const socketRef = useRef(null);

  // stable memo versions (React can track these better)
  const memoOpts = useMemo(() => opts, [opts]);
  const memoHandlers = useMemo(() => handlers, [handlers]);

  useEffect(() => {
    if (!enabled || !url) return;

    const socket = io(url, { ...memoOpts, autoConnect: false });
    socketRef.current = socket;

    // Attach handlers
    Object.entries(memoHandlers).forEach(([event, handler]) => {
      if (typeof handler === 'function') {
        socket.on(event, (data) => {
          try {
            handler(data);
          } catch (err) {
            console.error('Socket handler error', event, err);
          }
        });
      }
    });

    socket.connect();

    socket.on('connect_error', (err) => {
      console.warn('Socket connect_error:', err?.message || err);
    });

    return () => {
      try {
        socket.disconnect();
      } catch {}
      socketRef.current = null;
    };
  }, [url, enabled, memoOpts, memoHandlers]);

  return socketRef;
}
