/**
 * NEXUS ESPORTS — evidence gallery
 *
 * The single renderer for report evidence everywhere it appears. Images are
 * shown as thumbnails and open in an in-page lightbox, because browsers refuse
 * to navigate to a `data:` URL from an anchor click — that is why "open
 * evidence" used to land on a blank page instead of the image. Non-image
 * attachments keep their file details and a download/open link.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import '../styles/components/evidence-gallery.css';

const IMAGE_MIME = /^image\/(png|jpe?g|webp|gif|bmp|avif)$/i;

function isImage(file) {
  const mimetype = String(file?.mimetype || '');
  const url = String(file?.url || '');
  if (IMAGE_MIME.test(mimetype)) return true;
  if (/^data:image\//i.test(url)) return true;
  return /\.(png|jpe?g|webp|gif|bmp|avif)(\?|#|$)/i.test(url);
}

function formatBytes(bytes) {
  const size = Number(bytes) || 0;
  if (!size) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function EvidenceGallery({ files, compact = false, emptyLabel = '' }) {
  const rows = useMemo(() => (Array.isArray(files) ? files : [])
    .map((file, index) => (typeof file === 'string' ? { url: file } : file))
    .filter((file) => file && file.url)
    .map((file, index) => ({ ...file, id: file.id || `evidence-${index}` })), [files]);

  const [openIndex, setOpenIndex] = useState(-1);
  const [zoom, setZoom] = useState(false);
  const [broken, setBroken] = useState({});

  const close = useCallback(() => { setOpenIndex(-1); setZoom(false); }, []);
  const step = useCallback((delta) => {
    setZoom(false);
    setOpenIndex((current) => (current < 0 ? current : (current + delta + rows.length) % rows.length));
  }, [rows.length]);

  useEffect(() => {
    if (openIndex < 0) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') close();
      else if (event.key === 'ArrowRight' && rows.length > 1) step(1);
      else if (event.key === 'ArrowLeft' && rows.length > 1) step(-1);
    };
    window.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [openIndex, rows.length, close, step]);

  if (!rows.length) return emptyLabel ? <p className="evidence-gallery-empty">{emptyLabel}</p> : null;

  const active = openIndex >= 0 ? rows[openIndex] : null;

  return (
    <div className={`evidence-gallery ${compact ? 'is-compact' : ''}`}>
      <div className="evidence-gallery-grid">
        {rows.map((file, index) => (
          isImage(file) && !broken[file.url] ? (
            <button
              type="button"
              className="evidence-thumb"
              key={file.id}
              onClick={() => { setOpenIndex(index); setZoom(false); }}
              title={`Open ${file.filename || 'evidence'}`}
              aria-label={`Open ${file.filename || `evidence ${index + 1}`}`}
            >
              <img
                src={file.url}
                alt={file.filename || `Report evidence ${index + 1}`}
                loading="lazy"
                onError={() => setBroken((previous) => ({ ...previous, [file.url]: true }))}
              />
              <span className="evidence-thumb-caption">{file.filename || `Evidence ${index + 1}`}</span>
            </button>
          ) : (
            <a
              className="evidence-file"
              key={file.id}
              href={file.url}
              download={file.filename || undefined}
              target="_blank"
              rel="noreferrer"
            >
              <span className="evidence-file-icon" aria-hidden="true">📄</span>
              <span className="evidence-file-meta">
                <strong>{file.filename || `Evidence ${index + 1}`}</strong>
                <small>{[formatBytes(file.size), file.mimetype].filter(Boolean).join(' · ') || 'Attachment'}</small>
              </span>
            </a>
          )
        ))}
      </div>

      {active && (
        <div
          className="evidence-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={active.filename || 'Evidence preview'}
          onClick={(event) => { if (event.target === event.currentTarget) close(); }}
        >
          <div className="evidence-lightbox-bar">
            <span className="evidence-lightbox-name">
              {active.filename || 'Evidence'}
              {rows.length > 1 ? ` · ${openIndex + 1} of ${rows.length}` : ''}
            </span>
            <div className="evidence-lightbox-tools">
              <button type="button" onClick={() => setZoom((value) => !value)} aria-pressed={zoom}>
                {zoom ? 'Fit to screen' : 'Zoom in'}
              </button>
              <a href={active.url} download={active.filename || undefined} target="_blank" rel="noreferrer">
                Download
              </a>
              <button type="button" className="evidence-lightbox-close" onClick={close} aria-label="Close preview">
                ×
              </button>
            </div>
          </div>
          <div className={`evidence-lightbox-stage ${zoom ? 'is-zoomed' : ''}`}>
            {rows.length > 1 && (
              <button type="button" className="evidence-lightbox-nav prev" onClick={() => step(-1)} aria-label="Previous evidence">
                ‹
              </button>
            )}
            <img src={active.url} alt={active.filename || 'Report evidence'} />
            {rows.length > 1 && (
              <button type="button" className="evidence-lightbox-nav next" onClick={() => step(1)} aria-label="Next evidence">
                ›
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
