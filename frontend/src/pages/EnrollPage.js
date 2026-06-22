import React, { useState, useEffect } from 'react';
import { getCustomers, enrollCustomer } from '../api/client';

export default function EnrollPage() {
  const [existingCustomers, setExistingCustomers] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Fetch current customers on mount to build our validation checklist
  useEffect(() => {
    getCustomers()
      .then(d => setExistingCustomers(d.customers || []))
      .catch(() => console.error('Could not pre-fetch customer directory lists for validation.'));
  }, []);

  function handleFileChange(e) {
    const selectedFiles = Array.from(e.target.files).filter(file =>
      ['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)
    );
    setFiles(selectedFiles);
    setError('');
  }

  // Real-time validator flag
  const lowerIdInput = customerId.trim().toLowerCase();
  const idAlreadyExists = existingCustomers.some(c => c.toLowerCase() === lowerIdInput);

  async function handleSubmit(e) {
    e.preventDefault();
    
    if (!customerId || customerId.trim() === '' || files.length === 0) {
      setError('Please provide a Customer ID and select at least one specimen signature image.');
      return;
    }

    if (idAlreadyExists) {
      setError(`Customer ID "${customerId.trim()}" already exists in the system database path.`);
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await enrollCustomer(customerId.trim(), files);
      setSuccess(res.message);
      
      // Update our local cache with the newly created ID instantly
      setExistingCustomers(prev => [...prev, customerId.trim()]);
      
      // Reset layout forms cleanly
      setCustomerId('');
      setFiles([]);
      document.getElementById('specimen-input').value = '';
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Enrollment failed.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="main-content">
      <div className="page-header">
        <div className="page-eyebrow">Database Expansion Portal</div>
        <h1 className="page-title">Enroll New Customer Profile</h1>
        <p className="page-subtitle">
          Establish a new client record by uploading baseline reference specimen signatures directly to disk.
        </p>
      </div>

      {/* Warning/Error Banner */}
      {error && <div className="error-banner">{error}</div>}
      
      {/* Real-time duplicate path entry blocker */}
      {!error && idAlreadyExists && (
        <div className="error-banner" style={{ background: 'rgba(245,158,11,0.12)', borderColor: 'rgba(245,158,11,0.25)', color: '#fde68a' }}>
          ⚠ Warning: "{customerId.trim()}" already exists inside your local folder storage path.
        </div>
      )}

      {/* Success Notification */}
      {success && (
        <div className="error-banner" style={{ background: 'var(--green-dim)', borderColor: 'rgba(34,197,94,0.25)', color: '#bbf7d0' }}>
          ✓ {success}
        </div>
      )}

      <div className="card">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Customer ID Input Field */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" htmlFor="new-customer-id">Assign New Customer ID</label>
            <input
              id="new-customer-id"
              type="text"
              className="form-input"
              placeholder="e.g., customer_064"
              value={customerId}
              onChange={e => setCustomerId(e.target.value)}
              disabled={loading}
              style={{
                borderColor: idAlreadyExists ? 'var(--amber)' : undefined,
                boxShadow: idAlreadyExists ? '0 0 0 3px rgba(245,158,11,0.15)' : undefined
              }}
            />
          </div>

          {/* Multiple Specimen File Input Selector */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" htmlFor="specimen-input">Reference Specimen Signatures (PNG / JPG)</label>
            <input
              id="specimen-input"
              type="file"
              className="form-input"
              accept="image/png, image/jpeg"
              multiple 
              onChange={handleFileChange}
              disabled={loading || idAlreadyExists} // Locks choice picker frame if path matches duplication conditions
              style={{ paddingTop: '8px' }}
            />
          </div>

          {/* Selected Items Preview Queue */}
          {files.length > 0 && !idAlreadyExists && (
            <div style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', padding: '12px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--teal)', fontWeight: '600', marginBottom: '8px' }}>
                Selected Items Queue ({files.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '150px', overflowY: 'auto' }}>
                {files.map((file, i) => (
                  <div key={i} style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>📄</span> <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Form Action Submit Button */}
          <button
            type="submit"
            className="btn btn-primary btn-full"
            style={{ marginTop: '0.5rem' }}
            disabled={loading || !customerId || files.length === 0 || idAlreadyExists} // Hard lockout to prevent invalid executions
          >
            {loading ? (
              <>
                <span className="spinner" /> Enrolling Profile Asset...
              </>
            ) : idAlreadyExists ? (
              <>ID Path Blocked</>
            ) : (
              <>Create Customer Profile</>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}