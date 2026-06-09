import React, { useState, useEffect } from 'react';
import { getCustomers, getCustomer } from '../api/client';

function CustomerDetail({ customerId, onClose }) {
  const [info, setInfo]   = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getCustomer(customerId)
      .then(setInfo)
      .catch(() => setError('Failed to load customer details.'));
  }, [customerId]);

  return (
    <div className="card" style={{ marginTop: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span className="customer-badge">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          {customerId}
        </span>
        <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={onClose}>
          Close
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {!info && !error && (
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading…</div>
      )}

      {info && (
        <>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>
            <strong style={{ color: 'var(--teal)' }}>{info.specimen_count}</strong>{' '}
            specimen{info.specimen_count !== 1 ? 's' : ''} enrolled
          </div>
          {info.specimens.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📂</div>
              <div className="empty-state-text">No specimens found for this customer.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {info.specimens.map(s => (
                <div key={s} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 12px',
                  background: 'var(--bg-input)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  fontSize: 13,
                  color: 'var(--text-secondary)'
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="var(--teal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                  {s}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function CustomersPage() {
  const [customers, setCustomers]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [selected, setSelected]     = useState(null);

  useEffect(() => {
    getCustomers()
      .then(d => setCustomers(d.customers || []))
      .catch(() => setError('Could not load customers. Is the API running?'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="main-content">
      <div className="page-header">
        <div className="page-eyebrow">Enrolled customers</div>
        <h1 className="page-title">Specimen database</h1>
        <p className="page-subtitle">
          All customers with stored specimen signatures available for verification.
        </p>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading && (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '2rem 0' }}>
          Loading customers…
        </div>
      )}

      {!loading && customers.length === 0 && !error && (
        <div className="empty-state">
          <div className="empty-state-icon">👤</div>
          <div className="empty-state-text">
            No customers enrolled yet. Add specimen images to the <code>specimens/</code> directory.
          </div>
        </div>
      )}

      {!loading && customers.length > 0 && (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 10,
            marginBottom: selected ? '0.5rem' : 0
          }}>
            {customers.map(c => (
              <button
                key={c}
                className="btn btn-ghost"
                style={{
                  justifyContent: 'flex-start',
                  gap: 10,
                  padding: '10px 14px',
                  borderColor: selected === c ? 'var(--teal)' : undefined,
                  color: selected === c ? 'var(--teal)' : undefined,
                  background: selected === c ? 'var(--teal-dim)' : undefined,
                }}
                onClick={() => setSelected(prev => prev === c ? null : c)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                {c}
              </button>
            ))}
          </div>

          {selected && (
            <CustomerDetail customerId={selected} onClose={() => setSelected(null)} />
          )}
        </>
      )}
    </div>
  );
}
