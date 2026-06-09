import React, { useState } from 'react';

const ICONS = {
  MATCH:     { emoji: '✓', label: 'Signature Verified',      cls: 'match'    },
  'NO MATCH':{ emoji: '✗', label: 'Signature Rejected',      cls: 'no-match' },
  REVIEW:    { emoji: '⚠', label: 'Manual Review Required',  cls: 'review'   },
};

function scoreColor(score) {
  if (score >= 0.7) return 'var(--green)';
  if (score >= 0.5) return 'var(--amber)';
  return 'var(--red)';
}

export default function VerdictCard({ result, onReset }) {
  const [expanded, setExpanded] = useState(false);
  const meta = ICONS[result.decision] || ICONS['REVIEW'];

  const scores = Object.entries(result.per_specimen_scores || {}).sort(
    ([, a], [, b]) => b - a
  );

  return (
    <>
      <div className={`verdict ${meta.cls}`}>
        {/* Header */}
        <div className="verdict-header">
          <div className="verdict-icon">
            <span style={{ fontSize: 18 }}>{meta.emoji}</span>
          </div>
          <div>
            <div className="verdict-label">{result.decision}</div>
            <div className="verdict-decision">{meta.label}</div>
          </div>
        </div>

        {/* Summary scores */}
        <div className="score-grid">
          <div className="score-tile">
            <div className="score-tile-label">Average score</div>
            <div className="score-tile-value" style={{ color: scoreColor(result.average_score) }}>
              {(result.average_score * 100).toFixed(1)}%
            </div>
          </div>
          <div className="score-tile">
            <div className="score-tile-label">Highest match</div>
            <div className="score-tile-value" style={{ color: scoreColor(result.max_score) }}>
              {(result.max_score * 100).toFixed(1)}%
            </div>
          </div>
          <div className="score-tile">
            <div className="score-tile-label">Lowest match</div>
            <div className="score-tile-value" style={{ color: scoreColor(result.min_score) }}>
              {(result.min_score * 100).toFixed(1)}%
            </div>
          </div>
          <div className="score-tile">
            <div className="score-tile-label">Threshold</div>
            <div className="score-tile-value" style={{ color: 'var(--text-secondary)' }}>
              {(result.threshold * 100).toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Case flags */}
        {(result.case1_individual || result.case2_average) && (
          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {result.case1_individual && (
              <span style={{
                background: 'rgba(34,197,94,0.15)', color: 'var(--green)',
                border: '1px solid rgba(34,197,94,0.25)',
                borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 500
              }}>
                ✓ Individual specimen match
              </span>
            )}
            {result.case2_average && (
              <span style={{
                background: 'rgba(34,197,94,0.15)', color: 'var(--green)',
                border: '1px solid rgba(34,197,94,0.25)',
                borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 500
              }}>
                ✓ Average threshold met
              </span>
            )}
          </div>
        )}
      </div>

      {/* Per-specimen breakdown (collapsible) */}
      {scores.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <button
            className="btn btn-ghost"
            style={{ width: '100%', justifyContent: 'space-between', marginBottom: expanded ? 12 : 0 }}
            onClick={() => setExpanded(v => !v)}
          >
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Per-specimen scores ({scores.length})
            </span>
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: '0.2s' }}
            >
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {expanded && (
            <div className="specimen-list">
              {scores.map(([name, score]) => (
                <div className="specimen-row" key={name}>
                  <span className="specimen-name" title={name}>{name}</span>
                  <div className="score-bar-track">
                    <div
                      className="score-bar-fill"
                      style={{ width: `${(score * 100).toFixed(1)}%`, background: scoreColor(score) }}
                    />
                  </div>
                  <span className="score-num" style={{ color: scoreColor(score) }}>
                    {(score * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <button className="btn btn-ghost btn-full" onClick={onReset}>
        ← Verify another signature
      </button>
    </>
  );
}
