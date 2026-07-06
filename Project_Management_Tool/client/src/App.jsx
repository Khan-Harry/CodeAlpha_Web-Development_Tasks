import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Info } from 'lucide-react';
import Login from './views/Login.jsx';
import Register from './views/Register.jsx';
import Dashboard from './views/Dashboard.jsx';
import Board from './views/Board.jsx';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [notifications, setNotifications] = useState([]);
  const [toasts, setToasts] = useState([]);
  
  const wsRef = useRef(null);
  const wsListenersRef = useRef([]);

  useEffect(() => {
    if (token) {
      fetchNotifications();
      connectWebSocket();
    } else {
      if (wsRef.current) {
        wsRef.current.close();
      }
    }
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [token]);

  const fetchNotifications = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/notifications', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  const connectWebSocket = () => {
    if (!token) return;

    if (wsRef.current) {
      wsRef.current.close();
    }

    const wsUrl = `ws://localhost:5000/?token=${token}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connection established.');
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('WebSocket message received:', message);

        // Process global notifications
        if (message.type === 'NOTIFICATION_RECEIVED') {
          setNotifications(prev => [message.data, ...prev]);
          showToast(message.data.content);
        }

        // Dispatch to page-specific listeners
        wsListenersRef.current.forEach(listener => listener(message));
      } catch (err) {
        console.error('WebSocket message parsing error:', err);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket connection closed.');
      // Reconnect after 3 seconds if user is still logged in
      if (localStorage.getItem('token')) {
        setTimeout(connectWebSocket, 3000);
      }
    };

    ws.onerror = (err) => {
      console.error('WebSocket connection error:', err);
    };
  };

  const showToast = (content) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, content }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const registerWSListener = (callback) => {
    wsListenersRef.current.push(callback);
  };

  const unregisterWSListener = (callback) => {
    wsListenersRef.current = wsListenersRef.current.filter(cb => cb !== callback);
  };

  const setAuth = (newToken, newUser) => {
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken('');
    setUser(null);
    setNotifications([]);
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  const PrivateRoute = ({ children }) => {
    return token ? children : <Navigate to="/login" replace />;
  };

  return (
    <Router>
      <Routes>
        <Route path="/login" element={
          token ? <Navigate to="/" replace /> : <Login setAuth={setAuth} />
        } />
        <Route path="/register" element={
          token ? <Navigate to="/" replace /> : <Register setAuth={setAuth} />
        } />
        
        <Route path="/" element={
          <PrivateRoute>
            <Dashboard
              user={user}
              token={token}
              logout={logout}
              notifications={notifications}
              setNotifications={setNotifications}
            />
          </PrivateRoute>
        } />

        <Route path="/project/:projectId" element={
          <PrivateRoute>
            <Board
              token={token}
              user={user}
              registerWSListener={registerWSListener}
              unregisterWSListener={unregisterWSListener}
            />
          </PrivateRoute>
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Floating toast notification panel */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className="toast glass">
            <Info size={18} style={{ color: '#a855f7', flexShrink: 0 }} />
            <span style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.4' }}>{toast.content}</span>
          </div>
        ))}
      </div>
    </Router>
  );
}
