import React, { useState, useEffect } from 'react';
import { getCustomers, getCustomer } from '../api/client';
import axios from 'axios'; // Import standard axios directly to pass the raw array stream cleanly
import MagnifiedImage from '../components/MagnifiedImage';

export default function ManageCustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [customerInfo, setCustomerInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // States for bulk uploader operation field elements
  const [bulkFiles, setBulkFiles] = useState([]);

  useEffect(() => {
    getCustomers()
      .then(d => setCustomers(d.customers || []))
      .catch(() => setError('Could not load system customer records.'));
  }, []);

  useEffect(() => {
    if (!selectedId || typeof selectedId !== 'string' || selectedId.trim() === '') {
      setCustomerInfo(null);
      return;
    }
    fetchCustomerDetails(selectedId.trim());
  }, [selectedId]);

  function fetchCustomerDetails(id) {
    getCustomer(id)
      .then(setCustomerInfo)
      .catch(() => setCustomerInfo(null));
  }

  function handleBulkFileChange(e) {
    const selectedFiles = Array.from(e.target.files).filter(file =>
      ['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)
    );
    setBulkFiles(selectedFiles);
    setError('');
    setSuccess('');
  }

  async function handleBulkSubmit(e) {
    e.preventDefault();
    if (bulkFiles.length < 2) {
      setError('Please choose at least 2 or more new specimen signature files to process.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    // Prepare multi-file payload form stream block matching backend typing layout
    const form = new FormData();
    for (let i = 0; i < bulkFiles.length; i++) {
      form.append('specimens', bulkFiles[i]);
    }

    try {
      const { data } = await axios.post(`/customers/${selectedId.trim()}/replace`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSuccess(data.message);
      setBulkFiles([]);
      document.getElementById('bulk-specimen-field').value = '';
      
      // Instantly refresh workspace preview frames
      fetchCustomerDetails(selectedId.trim());
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Failed to perform bulk updates.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="main-content">
      <div className="page-header">
        <div className="page-eyebrow">Records Maintenance Workspace</div>
        <h1 className="page-title">Manage Enrolled Customers</h1>
        <p className="page-subtitle">
          Select a customer to view active baselines or submit a completely new batch of baseline signatures to archive old ones.
        </p>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {success && (
        <div className="error-banner" style={{ background: 'var(--green-dim)', borderColor: 'rgba(34,197,94,0.25)', color: '#bbf7d0' }}>
          ✓ {success}
        </div>
      )}

      {/* 1. Main Search Entry Card */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.5rem' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Customer ID</label>
          <input
            type="text"
            className="form-input"
            list="manage-suggestions"
            placeholder="Type or select a Customer ID (e.g., customer_058)"
            value={selectedId}
            onChange={e => { setSelectedId(e.target.value || ''); setSuccess(''); setError(''); setBulkFiles([]); }}
            autoComplete="off"
          />
          <datalist id="manage-suggestions">
            {customers.map(c => <option key={c} value={c} />)}
          </datalist>
        </div>

        {customerInfo && (
          <div style={{
            background: 'rgba(45,212,191,0.06)',
            border: '1px solid rgba(45,212,191,0.15)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 13,
            color: 'var(--text-secondary)',
            margin: 0
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            <span>
              Currently has <strong style={{ color: 'var(--teal)' }}>{customerInfo.specimen_count}</strong> active verification specimens on file.
            </span>
          </div>
        )}
      </div>

      {/* 2. Interactive Bulk Archive & Upload Tool (Appears above signature lists once customer is verified) */}
      {customerInfo && (
        <div className="card" style={{ marginBottom: '1.5rem', borderColor: 'rgba(45,212,191,0.25)', borderStyle: 'dashed' }}>
          <div style={{ fontSize: '12px', color: 'var(--teal)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.05em' }}>
             Complete Baseline Update Panel
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
            Uploading a new file list here automatically moves all current active specimens to the <code>archived/</code> directory folder on your disk.
          </div>

          <form onSubmit={handleBulkSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <input 
                id="bulk-specimen-field"
                type="file"
                className="form-input"
                accept="image/png, image/jpeg"
                multiple
                onChange={handleBulkFileChange}
                disabled={loading}
                style={{ paddingTop: '8px' }}
              />
            </div>

            {bulkFiles.length > 0 && (
              <div style={{ background: 'var(--bg-input)', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '13px', color: 'var(--text-muted)' }}>
                🚀 Ready to upload: <strong>{bulkFiles.length} item{bulkFiles.length !== 1 ? 's' : ''}</strong> (Minimum 2 required)
              </div>
            )}

            <button 
              type="submit" 
              className="btn btn-primary btn-full"
              disabled={loading || bulkFiles.length < 2}
              style={{ background: bulkFiles.length >= 2 ? 'var(--teal)' : undefined }}
            >
              {loading ? <><span className="spinner" /> Archiving & Updating Files...</> : <>Archive Old & Upload New Baseline</>}
            </button>
          </form>
        </div>
      )}

      {/* 3. Static Preview Monitor Deck */}
      {customerInfo && customerInfo.specimens.length > 0 && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card-label" style={{ margin: 0 }}>Active Verification Baselines</div>
          <div className="divider" style={{ margin: 0 }} />
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {customerInfo.specimens.map(filename => {
              const imageSrc = `/specimens/${customerInfo.customer_id}/${filename}?t=${new Date().getTime()}`;

              return (
                <div key={filename} style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                }}>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    
                    {/* White Backing Canvas Frame */}
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

                    <div>
                      <span className="specimen-name" style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: '600' }}>
                        {filename}
                      </span>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Active Baseline Reference
                      </div>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}