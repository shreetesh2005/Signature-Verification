import React, { useState, useRef } from 'react';

export default function MagnifiedImage({ src, alt, width, height, zoomScale = 2.5, lensSize = 120 }) {
  const [showLens, setShowLens] = useState(false);
  const [lensStyle, setLensStyle] = useState({});
  const imgRef = useRef(null);

  function handleMouseMove(e) {
    if (!imgRef.current) return;

    const img = imgRef.current;
    const { left, top, width: imgWidth, height: imgHeight } = img.getBoundingClientRect();

    // Calculate cursor positions relative to the image framework bounds
    let x = e.pageX - left - window.scrollX;
    let y = e.pageY - top - window.scrollY;

    // Constrain the tracking system strictly within image margins
    if (x < 0 || x > imgWidth || y < 0 || y > imgHeight) {
      setShowLens(false);
      return;
    }

    // Math calculation for locating background magnification view dimensions
    const bgX = (x / imgWidth) * 100;
    const bgY = (y / imgHeight) * 100;

    setLensStyle({
      position: 'absolute',
      left: `${x - lensSize / 2}px`,
      top: `${y - lensSize / 2}px`,
      width: `${lensSize}px`,
      height: `${lensSize}px`,
      borderRadius: '50%',
      border: '2px solid var(--teal)',
      boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
      backgroundColor: '#fff',
      backgroundImage: `url(${src})`,
      backgroundRepeat: 'no-repeat',
      backgroundSize: `${imgWidth * zoomScale}px ${imgHeight * zoomScale}px`,
      backgroundPosition: `${bgX}% ${bgY}%`,
      pointerEvents: 'none', // Crucial rule: lets cursor pass directly back to parent tracking box
      zIndex: 99
    });

    setShowLens(true);
  }

  return (
    <div 
      style={{ position: 'relative', width: width || '100%', height: height || '100%', cursor: 'crosshair', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setShowLens(false)}
    >
      <img 
        ref={imgRef}
        src={src} 
        alt={alt} 
        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} 
      />
      {showLens && <div style={lensStyle} />}
    </div>
  );
}