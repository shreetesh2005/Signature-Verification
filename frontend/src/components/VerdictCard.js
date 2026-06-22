import React from 'react';

function scoreColor(score) {
  if (score >= 0.7) return 'var(--green)';
  if (score >= 0.5) return 'var(--amber)';
  return 'var(--red)';
}

export default function VerdictCard({ result }) {
  let rawDecision = String(result.decision || '').trim().toUpperCase();

  // Force Pass Correction logic
  if (result.average_score >= 0.70) {
    rawDecision = 'MATCH';
  }

  let labelPrefix = rawDecision;
  let cls = 'review';
  let displayLabel = 'Manual Review Required';
  let emoji = '⚠';

  if (rawDecision === 'MATCH' || rawDecision === 'PASS') {
    labelPrefix = 'PASS';
    cls = 'match';                 
    displayLabel = 'Signature Verified';
    emoji = '✓';                   
  } else if (rawDecision === 'NO MATCH' || rawDecision === 'FAIL') {
    labelPrefix = 'FAIL';
    cls = 'no-match';             
    displayLabel = 'Signature Rejected';
    emoji = '✗';                   
  } else {
    labelPrefix = 'REVIEW';
    cls = 'review';                
    displayLabel = 'Manual Review Required';
    emoji = '⚠';
  }

  // STRICT CORRECTION GUARD: Only display the green success badges if the final layout 
  // decision is a definitive PASS. Hide them completely for FAIL and REVIEW cases.
  const shouldShowBadges = labelPrefix === 'PASS';

  // --- DYNAMIC STATE BADGE RENDERER ---
  // Formulates natural English explanations based on scores and flags
  function renderConditionBadges() {
    // 1. PASS STATE BADGES (Green theme)
    if (labelPrefix === 'PASS') {
      return (
        <>
          {result.case1_individual && (
            <span style={{
              background: 'rgba(34,197,94,0.12)', color: 'var(--green)',
              border: '1px solid rgba(34,197,94,0.25)',
              borderRadius: 6, padding: '5px 12px', fontSize: '12.5px', fontWeight: 600
            }}>
              ✓ Individual specimen match
            </span>
          )}
          {result.case2_average && (
            <span style={{
              background: 'rgba(34,197,94,0.12)', color: 'var(--green)',
              border: '1px solid rgba(34,197,94,0.25)',
              borderRadius: 6, padding: '5px 12px', fontSize: '12.5px', fontWeight: 600
            }}>
              ✓ Average threshold met
            </span>
          )}
        </>
      );
    }

    // 2. FAIL STATE BADGES (Red theme)
    if (labelPrefix === 'FAIL') {
      return (
        <>
          <span style={{
            background: 'rgba(239,68,68,0.12)', color: 'var(--red)',
            border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: 6, padding: '5px 12px', fontSize: '12.5px', fontWeight: 600
          }}>
            ✗ Below average baseline
          </span>
          {result.max_score < result.threshold && (
            <span style={{
              background: 'rgba(239,68,68,0.12)', color: 'var(--red)',
              border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 6, padding: '5px 12px', fontSize: '12.5px', fontWeight: 600
            }}>
              ✗ Individual specimen mismatch
            </span>
          )}
        </>
      );
    }

    // 3. REVIEW STATE BADGES (Amber theme)
    if (labelPrefix === 'REVIEW') {
      const scoreVariance = result.max_score - result.min_score;
      return (
        <>
          <span style={{
            background: 'rgba(245,158,11,0.12)', color: 'var(--amber)',
            border: '1px solid rgba(245,158,11,0.25)',
            borderRadius: 6, padding: '5px 12px', fontSize: '12.5px', fontWeight: 600
          }}>
            ⚠ Near threshold boundary
          </span>
          {scoreVariance > 0.25 && (
            <span style={{
              background: 'rgba(245,158,11,0.12)', color: 'var(--amber)',
              border: '1px solid rgba(245,158,11,0.25)',
              borderRadius: 6, padding: '5px 12px', fontSize: '12.5px', fontWeight: 600
            }}>
              ⚠ High variant gap detected
            </span>
          )}
        </>
      );
    }

    return null;
  }

  return (
    <div className={`verdict ${cls}`} style={{ margin: 0, padding: '1.75rem' }}>
      <div className="verdict-header" style={{ gap: '16px' }}>
        <div className="verdict-icon" style={{ width: '46px', height: '46px', fontSize: '22px' }}>
          <span>{emoji}</span>
        </div>
        <div>
          <div className="verdict-label" style={{ 
            fontSize: '18px',     
            fontWeight: '900',    
            letterSpacing: '0.08em', 
            marginBottom: '4px' 
          }}>
            {labelPrefix}
          </div>
          <div className="verdict-decision" style={{ fontSize: '22px' }}>{displayLabel}</div>
        </div>
      </div>

      {/* Narrative Summary Code Block - REMOVED */}

      {/* Dynamic Condition Badges Section */}
      <div style={{ marginTop: '1.25rem', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {renderConditionBadges()}
      </div>

      {/* Symmetric 3-Column Score Grid Layout */}
      <div className="score-grid" style={{ marginTop: '1.5rem', gap: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
        <div className="score-tile" style={{ padding: '14px' }}>
          <div className="score-tile-label" style={{ fontSize: '11.5px' }}>Average score</div>
          <div className="score-tile-value" style={{ color: scoreColor(result.average_score), fontSize: '22px' }}>
            {(result.average_score * 100).toFixed(1)}%
          </div>
        </div>
        <div className="score-tile" style={{ padding: '14px' }}>
          <div className="score-tile-label" style={{ fontSize: '11.5px' }}>Highest match</div>
          <div className="score-tile-value" style={{ color: scoreColor(result.max_score), fontSize: '22px' }}>
            {(result.max_score * 100).toFixed(1)}%
          </div>
        </div>
        <div className="score-tile" style={{ padding: '14px' }}>
          <div className="score-tile-label" style={{ fontSize: '11.5px' }}>Lowest match</div>
          <div className="score-tile-value" style={{ color: scoreColor(result.min_score), fontSize: '22px' }}>
            {(result.min_score * 100).toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
  );
}