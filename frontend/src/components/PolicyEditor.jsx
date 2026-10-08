/**
 * NEXUS ESPORTS — PolicyEditor
 *
 * Shared clause + tag editor used by the create-policy and edit-policy pages.
 */
import { useState } from 'react';

export default function PolicyEditor({ clauses, tags, onClausesChange, onTagsChange }) {
  const [tagDraft, setTagDraft] = useState('');

  const addClause = () => onClausesChange([...clauses, '']);
  const removeClause = (i) => onClausesChange(clauses.filter((_, j) => j !== i));
  const setClause = (i, value) => onClausesChange(clauses.map((c, j) => (j === i ? value : c)));

  const addTag = (val) => {
    const clean = String(val || '').toLowerCase().replace(/[^a-z0-9-]/g, '').trim();
    if (!clean || tags.includes(clean)) return;
    onTagsChange([...tags, clean]);
  };
  const onTagKey = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(tagDraft);
      setTagDraft('');
    }
    if (e.key === 'Backspace' && !tagDraft && tags.length) {
      onTagsChange(tags.slice(0, -1));
    }
  };

  return (
    <>
      <div className="clause-list" id="clause-list">
        {clauses.map((text, i) => (
          <div className="clause-item" key={i}>
            <div className="clause-num">{i + 1}</div>
            <textarea className="clause-text" rows="2" placeholder="Enter rule clause…" value={text} onChange={(e) => setClause(i, e.target.value)} />
            <button type="button" className="clause-del" title="Remove clause" onClick={() => removeClause(i)}>×</button>
          </div>
        ))}
      </div>

      <button type="button" className="add-clause-btn" onClick={addClause}>
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="6.5" y1="1" x2="6.5" y2="12" /><line x1="1" y1="6.5" x2="12" y2="6.5" /></svg>
        Add Clause
      </button>

      <div className="form-section-label" style={{ marginTop: 28 }}>Tags</div>
      <p className="pf-hint" style={{ marginBottom: 12 }}>Press <kbd style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: 3, fontSize: 11 }}>Enter</kbd> or <kbd style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: 3, fontSize: 11 }}>,</kbd> to add a tag.</p>

      <div className="pf-tags" id="tag-input-wrap">
        {tags.map((tag) => (
          <span className="pf-tag" key={tag}>{tag}<button type="button" onClick={() => onTagsChange(tags.filter((t) => t !== tag))}>×</button></span>
        ))}
        <input className="pf-tag-input" type="text" placeholder="e.g. anti-cheat, conduct, fair-play…" value={tagDraft} onChange={(e) => setTagDraft(e.target.value)} onKeyDown={onTagKey} />
      </div>
    </>
  );
}


