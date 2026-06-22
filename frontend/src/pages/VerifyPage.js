import React, { useState, useEffect, useCallback } from 'react';
import DropZone from '../components/DropZone';
import VerdictCard from '../components/VerdictCard';
import MagnifiedImage from '../components/MagnifiedImage'; 
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

  const uploadedPreviewUrl = file ? URL.createObjectURL(file) : null;

  // Fetch customer directory list on component mount
  useEffect(() => {
    getCustomers()
      .then(d => setCustomers(d.customers || []))
      .catch(() => setError('Could not load customers. Is the API running?'))
      .finally(() => setLoadingCustomers(false));
  }, []);

  // Dynamically pull folder metrics from disk when a valid Customer ID matches or is fully typed out
  useEffect(() => {
    if (!customerId || customerId.trim() === '') { 
      setCustomerInfo(null); 
      return; 
    }
    
    // Fetch details safely if the typed ID matches a real customer folder path on disk
    getCustomer(customerId.trim())
      .then(setCustomerInfo)
      .catch(() => setCustomerInfo(null)); // Silently fail if they are typing a non-existent ID
  }, [customerId]);

  const canSubmit = customerId.trim() && file && !loading;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setError('');
    setLoading(true);
    try {
      const res = await verifySignature(customerId.trim(), file);
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

  function handlePrint() {
    window.print();
  }

  function scoreColor(score) {
    if (score >= 0.7) return 'var(--green)';
    if (score >= 0.5) return 'var(--amber)';
    return 'var(--red)';
  }

  // --- POST-VERIFICATION DASHBOARD VIEW (PAGE 2) ---
  if (result) {
    const scoresArray = Object.entries(result.per_specimen_scores || {}).sort(
      ([nameA], [nameB]) => {
        const numA = parseInt(nameA.replace(/\D/g, ''), 10) || 0;
        const numB = parseInt(nameB.replace(/\D/g, ''), 10) || 0;
        return numA - numB;
      }
    );

    return (
      <div className="main-content printable-area" style={{ maxWidth: '1340px', padding: '1.5rem 2rem' }}>
        <div className="two-col" style={{ gridTemplateColumns: '1.05fr 0.95fr', alignItems: 'start', gap: '1.5rem' }}>
          
          {/* LEFT SIDE STACK */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* 1. Verified Customer ID Card with PDF Action Button */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div className="card-label" style={{ marginBottom: '0.5rem' }}>Verified Customer ID</div>
                  <span className="customer-badge">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                    {result.customer_id}
                  </span>
                </div>

                <button 
                  className="btn btn-ghost no-print" 
                  onClick={handlePrint}
                  style={{ padding: '6px 12px', fontSize: '12px', borderColor: 'var(--teal)', color: 'var(--teal)' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" 
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Export PDF
                </button>
              </div>
            </div>

            {/* 2. Review/Verdict Status Block */}
            <VerdictCard result={result} />

            {/* 3. Scanned Target Signature Preview Box */}
            <div className="card">
              <div className="card-label" style={{ marginBottom: '0.5rem' }}>Scanned Target Signature</div>
              <div style={{ 
                background: '#ffffff', 
                border: '1px solid var(--border)', 
                borderRadius: 'var(--radius-md)',
                padding: '1rem 1.5rem',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                boxShadow: 'inset 0 0 10px rgba(0,0,0,0.05)',
                position: 'relative'
              }}>
                {uploadedPreviewUrl && (
                  <MagnifiedImage 
                    src={uploadedPreviewUrl} 
                    alt="Scanned Target" 
                    width="100%"
                    height="110px"
                    zoomScale={2} 
                    lensSize={130} 
                  />
                )}
              </div>
            </div>

            {/* 4. Single Back Button */}
            <button className="btn btn-ghost btn-full no-print" onClick={reset} style={{ borderStyle: 'dashed', height: '44px' }}>
              ← Verify another signature
            </button>
          </div>

          {/* RIGHT SIDE: Enrolled Specimens */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="card-label" style={{ margin: 0 }}>Enrolled Specimens & Distance Comparisons</div>
            
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '1rem', 
              maxHeight: '820px', 
              overflowY: 'auto', 
              paddingRight: '4px' 
            }}>
              {scoresArray.map(([filename, score]) => {
                const imageSrc = `/specimens/${result.customer_id}/${filename}`;

                return (
                  <div key={filename} style={{
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '16px',
                  }}>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                      <div style={{ 
                        width: '170px',  
                        height: '100px', 
                        background: '#ffffff', 
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '8px',
                        flexShrink: 0,
                        boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                        position: 'relative',
                        overflow: 'visible' 
                      }}>
                        <MagnifiedImage 
                          src={imageSrc} 
                          alt={filename} 
                          width="100%"
                          height="100%"
                          zoomScale={2}
                          lensSize={110}
                        />
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                          <span className="specimen-name" style={{ fontSize: '13px', width: '100%', color: 'var(--text-primary)', fontWeight: '500' }} title={filename}>
                            {filename}
                          </span>
                          <span style={{ fontSize: '15px', fontWeight: '700', color: scoreColor(score) }}>
                            {(score * 100).toFixed(1)}% Match
                          </span>
                        </div>
                        
                        <div className="score-bar-track" style={{ height: '7px', background: 'rgba(255,255,255,0.05)' }}>
                          <div 
                            className="score-bar-fill" 
                            style={{ width: `${(score * 100).toFixed(1)}%`, background: scoreColor(score) }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    );
  }

  // --- STANDARD SELECTION FORM (PAGE 1) ---
  return (
    <div className="main-content">
      <div className="page-header">
        <div className="page-eyebrow">Signature Verification</div>
        <h1 className="page-title">Verify against enrolled specimens</h1>
        <p className="page-subtitle">
          Type or select a customer and upload the signature to check against their stored specimens.
        </p>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        {/* Customer Search / Text Entry Combobox */}
        <div className="form-group">
          <label className="form-label" htmlFor="customer-input">Customer ID</label>
          {loadingCustomers ? (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '10px 0' }}>Loading system assets…</div>
          ) : (
            <>
              {/* Swapped out select box for text field bound to datalist engine */}
              <input
                id="customer-input"
                type="text"
                className="form-input"
                list="customer-suggestions" // Connects to the datalist element below
                placeholder="Type or select a Customer ID (e.g., customer_058)"
                value={customerId}
                onChange={e => { setCustomerId(e.target.value); setResult(null); }}
                autoComplete="off"
              />
              
              {/* Hidden Suggestion Option Data Deck */}
              <datalist id="customer-suggestions">
                {customers.map(c => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </>
          )}
        </div>

        {/* Real-time file summary indicator badge */}
        {customerInfo ? (
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            <span>
              <strong style={{ color: 'var(--teal)' }}>{customerInfo.specimen_count}</strong> specimen{customerInfo.specimen_count !== 1 ? 's' : ''} found on file for <strong>{customerId.strip ? customerId.trim() : customerId}</strong>
            </span>
          </div>
        ) : customerId.trim() !== '' && !loadingCustomers ? (
          <div style={{
            background: 'rgba(239,68,68,0.04)',
            border: '1px solid rgba(239,68,68,0.15)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 14px',
            marginBottom: '1.25rem',
            fontSize: 13,
            color: 'var(--text-secondary)'
          }}>
            ❌ Customer ID <strong style={{ color: 'var(--red)' }}>"{customerId.trim()}"</strong> does not match any current folders on disk.
          </div>
        ) : null}

        <div className="divider" style={{ margin: '0 0 1.25rem' }} />

        <DropZone id="sig-upload" label="Signature to verify" value={file} onChange={setFile} />

        <button className="btn btn-primary btn-full" style={{ marginTop: 8 }} disabled={!canSubmit || !customerInfo} onClick={handleSubmit}>
          {loading ? <><span className="spinner" /> Analysing…</> : <>Run verification</>}
        </button>
      </div>
    </div>
  );
}