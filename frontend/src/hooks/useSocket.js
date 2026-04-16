import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export function useSocket() {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [simData, setSimData] = useState(null);
  const [mode, setMode] = useState('normal');
  const [connectionError, setConnectionError] = useState(null);
  // Proactive nudges from the server — crowd spike alerts with auto-route suggestions
  const [activeNudge, setActiveNudge] = useState(null);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      setConnectionError(null);
    });

    socket.on('disconnect', (reason) => {
      setConnected(false);
      if (reason === 'io server disconnect') socket.connect();
    });

    socket.on('connect_error', (err) => {
      setConnectionError(`Cannot connect to backend: ${err.message}`);
    });

    socket.on('simulation_update', (data) => {
      setSimData(data);
      setMode(data.mode);
    });

    socket.on('mode_change', ({ mode }) => setMode(mode));

    // Proactive nudge from server — show for 12 seconds then auto-dismiss
    socket.on('proactive_nudge', (nudge) => {
      setActiveNudge(nudge);
      setTimeout(() => setActiveNudge(null), 12000);
    });

    return () => { socket.disconnect(); };
  }, []);

  const dismissNudge = () => setActiveNudge(null);

  return { socket: socketRef.current, connected, simData, mode, connectionError, activeNudge, dismissNudge };
}
