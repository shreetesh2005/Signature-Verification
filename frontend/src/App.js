import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { healthCheck } from './api/client';
import VerifyPage    from './pages/VerifyPage';
import EnrollPage    from './pages/EnrollPage';
import ManageCustomersPage from './pages/ManageCustomersPage'; // <-- Imported Management Portal

function Nav({ apiOnline }) {
  return (
    <nav className="nav">
      <NavLink to="/verify" className="nav-brand">
        <div className="nav-brand-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="#2dd4bf" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        </div>
        SigVerify
      </NavLink>

      {/* Expanded Multi-Tab View Layout Menu */}
      <div className="nav-tabs">
        <NavLink to="/verify" className={({ isActive }) => `nav-tab${isActive ? ' active' : ''}`}>
          Verify
        </NavLink>
        <NavLink to="/enroll" className={({ isActive }) => `nav-tab${isActive ? ' active' : ''}`}>
          New Customer
        </NavLink>
        <NavLink to="/manage" className={({ isActive }) => `nav-tab${isActive ? ' active' : ''}`}>
          Manage Directory
        </NavLink>
      </div>

      <div className="nav-status">
        <span className={`status-dot ${apiOnline === true ? 'online' : apiOnline === false ? 'offline' : ''}`} />
        {apiOnline === null ? 'Checking API…' : apiOnline ? 'API online' : 'API offline'}
      </div>
    </nav>
  );
}

export default function App() {
  const [apiOnline, setApiOnline] = useState(null);

  useEffect(() => {
    healthCheck().then(() => setApiOnline(true)).catch(() => setApiOnline(false));
    const id = setInterval(() => {
      healthCheck().then(() => setApiOnline(true)).catch(() => setApiOnline(false));
    }, 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <BrowserRouter>
      <div className="app-shell">
        <Nav apiOnline={apiOnline} />
        <Routes>
          <Route path="/verify" element={<VerifyPage />} />
          <Route path="/enroll" element={<EnrollPage />} />
          <Route path="/manage" element={<ManageCustomersPage />} /> {/* <-- Connected path route wrapper */}
          <Route path="*"      element={<Navigate to="/verify" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}