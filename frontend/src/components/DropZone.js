import React, { useState, useRef } from 'react';

export default function DropZone({ label, value, onChange, id }) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const preview = value ? URL.createObjectURL(value) : null;

  function handleFile(file) {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) return;
    onChange(file);
  }

  return (
    <div className="form-group">
      {label && <label className="form-label">{label}</label>}
      <div
        className={`dropzone ${dragOver ? 'drag-over' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => {
          e.preventDefault();
          setDragOver(false);
          handleFile(e.dataTransfer.files[0]);
        }}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept="image/png,image/jpeg"
          style={{ display: 'none' }}
          onChange={e => handleFile(e.target.files[0])}
        />

        {preview ? (
          <>
            <img src={preview} alt="signature preview" className="dropzone-preview" />
            <span className="dropzone-sub" style={{ marginTop: 6 }}>
              {value.name} — click to replace
            </span>
          </>
        ) : (
          <>
            <div className="dropzone-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="#2dd4bf" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>
            <span className="dropzone-title">Drop signature image here</span>
            <span className="dropzone-sub">PNG or JPG · click to browse</span>
          </>
        )}
      </div>
    </div>
  );
}
