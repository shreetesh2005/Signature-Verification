import React, { useState, useEffect, useCallback } from 'react';
import DropZone from '../components/DropZone';
import VerdictCard from '../components/VerdictCard';
import { getCustomers, getCustomer, verifySignature } from '../api/client';

export default function VerifyPage() {
  const [customers, setCustomers]     = useState([]);
  const [customerId, setCustomerId]   = useState('');
  const [customerInfo, setCustomerInfo] = useState(null);
  const [file, setFile]               = useState(null);
  const [result, setResult]           = useState(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [loadingCustomers, setLoadingCustomers] = useState(true);

  // Fetch customer list on mount
  useEffect(() => {
    getCustomers()
      .then(d => setCustomers(d.customers || []))
      .catch(() => setError('Could not load customers. Is the API running?'))
      .finally(() => setLoadingCustomers(false));
  }, []);

  // Fetch customer details when selection changes
  useEffect(() => {
    if (!customerId) { setCustomerInfo(null); return; }
    getCustomer(customerId)
      .then(setCustomerInfo)
      .catch(() => setCustomerInfo(null));
  }, [customerId]);

  const canSubmit = customerId && file && !loading;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setError('');
    setLoading(true);
    try {
      const res = await verifySignature(customerId, file);
      setResult(res);
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Verification failed.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [canSubmit, customerId, file]);

  function reset() {
    setResult(null);
    setFile(null);
    setError('');
  }

  if (result) {
    return (
      <div className="main-content">
        <div className="page-header">
          <div className="page-eyebrow">Verification result</div>
          <h1 className="page-title">Signature Analysis</h1>
          <div style={{ marginTop: 8 }}>
            <span className="customer-badge">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              {result.customer_id}
            </span>
          </div>
        </div>
        <VerdictCard result={result} onReset={reset} />
      </div>
    );
  }

  return (
    <div className="main-content">
      <div className="page-header">
        <div className="page-eyebrow">Signature Verification</div>
        <h1 className="page-title">Verify against enrolled specimens</h1>
        <p className="page-subtitle">
          Select a customer and upload the signature to check against their stored specimens.
        </p>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        {/* Customer selector */}
        <div className="form-group">
          <label className="form-label" htmlFor="customer-select">Customer ID</label>
          {loadingCustomers ? (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '10px 0' }}>
              Loading customers…
            </div>
          ) : customers.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '10px 0' }}>
              No customers enrolled yet.
            </div>
          ) : (
            <select
              id="customer-select"
              className="form-select"
              value={customerId}
              onChange={e => { setCustomerId(e.target.value); setResult(null); }}
            >
              <option value="">— select a customer —</option>
              {customers.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
        </div>

        {/* Customer info badge */}
        {customerInfo && (
          <div style={{
            background: 'rgba(45,212,191,0.06)',
            border: '1px solid rgba(45,212,191,0.15)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 14px',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 13,
            color: 'var(--text-secondary)'
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="var(--teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            <span>
              <strong style={{ color: 'var(--teal)', fontWeight: 600 }}>{customerInfo.specimen_count}</strong>
              {' '}specimen{customerInfo.specimen_count !== 1 ? 's' : ''} on file for{' '}
              <strong style={{ color: 'var(--text-primary)' }}>{customerId}</strong>
            </span>
          </div>
        )}

        <div className="divider" style={{ margin: '0 0 1.25rem' }} />

        {/* Upload */}
        <DropZone
          id="sig-upload"
          label="Signature to verify"
          value={file}
          onChange={setFile}
        />

        <button
          className="btn btn-primary btn-full"
          style={{ marginTop: 8 }}
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          {loading ? (
            <>
              <span className="spinner" />
              Analysing…
            </>
          ) : (
            <>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              Run verification
            </>
          )}
        </button>
      </div>
    </div>
  );
}
