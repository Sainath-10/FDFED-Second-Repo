/**
 * NEXUS ESPORTS — organiser reputation badge
 *
 * Blue does not mean untrustworthy; it means there is not enough history to
 * establish reliability yet. The tooltip carries the level meaning.
 */
import { LEVEL_META, formatINR } from '../lib/reporting.js';

export default function ReputationBadge({ level = 'blue', limit, showLimit = true, className = '' }) {
  const meta = LEVEL_META[level] || LEVEL_META.blue;
  return (
    <span
      className={`reputation-badge ${className}`.trim()}
      title={`${meta.label}: ${meta.description}`}
      style={{ color: meta.color, background: meta.bg, borderColor: meta.color }}
    >
      <span className="dot" style={{ background: meta.color }} />
      {meta.label} reputation
      {showLimit && <span className="limit">· max {formatINR(limit ?? meta.limit)}</span>}
    </span>
  );
}
