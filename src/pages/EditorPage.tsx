import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Document } from '../lib/db';
import { deleteDocument, getOrCreateDocument, saveDocumentContent } from '../lib/documents';
import { Link, navigate, toUrl } from '../lib/router';
import { useOnline } from '../lib/useOnline';
import { ThemeToggle } from '../lib/theme';

type SaveStatus = 'loading' | 'saved' | 'pending' | 'saving' | 'error';

const SAVE_DELAY_MS = 400;
const RETRY_DELAY_MS = 3000;

const STATUS_LABEL: Record<SaveStatus, string> = {
  loading: 'Loading…',
  saved: 'Saved',
  pending: 'Editing…',
  saving: 'Saving…',
  error: 'Save failed. Retrying…',
};

export function EditorPage({ slug }: { slug: string }) {
  const [doc, setDoc] = useState<Document | null>(null);
  const [text, setText] = useState('');
  const [status, setStatus] = useState<SaveStatus>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const online = useOnline();

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const docRef = useRef<Document | null>(null);
  /** Current editor text (without waiting for a re-render). */
  const textRef = useRef('');
  /** Last content known to be stored in IndexedDB. */
  const savedRef = useRef('');
  const timerRef = useRef<number | undefined>(undefined);
  /** Save queue: ensures writes never overlap. */
  const chainRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    document.title = `/${slug} · LocalPad`;
    let cancelled = false;
    getOrCreateDocument(slug)
      .then((d) => {
        if (cancelled) return;
        docRef.current = d;
        textRef.current = d.content;
        savedRef.current = d.content;
        setDoc(d);
        setText(d.content);
        setStatus('saved');
        requestAnimationFrame(() => textareaRef.current?.focus());
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setLoadError('Could not open this browser\'s local storage.');
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const flush = useCallback(() => {
    window.clearTimeout(timerRef.current);
    const run = async () => {
      const d = docRef.current;
      const content = textRef.current;
      if (!d || content === savedRef.current) return;
      setStatus('saving');
      try {
        await saveDocumentContent(d, content);
        savedRef.current = content;
        setStatus(textRef.current === content ? 'saved' : 'pending');
      } catch (err) {
        console.error(err);
        setStatus('error');
        window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(flush, RETRY_DELAY_MS);
      }
    };
    chainRef.current = chainRef.current.then(run);
    return chainRef.current;
  }, []);

  // Save when leaving the page, switching tabs/apps, or navigating to another document.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onHide);
      void flush();
    };
  }, [flush]);

  // Sync with other tabs: apply external changes when there are no pending local edits.
  const live = useLiveQuery(() => (doc ? db.documents.get(doc.id) : undefined), [doc?.id]);
  useEffect(() => {
    if (!live || live.content === savedRef.current) return;
    if (textRef.current !== savedRef.current) return; // unsaved local edits take priority
    const el = textareaRef.current;
    const selection = el && document.activeElement === el ? [el.selectionStart, el.selectionEnd] : null;
    savedRef.current = live.content;
    textRef.current = live.content;
    setText(live.content);
    if (selection && el) {
      requestAnimationFrame(() => el.setSelectionRange(selection[0], selection[1]));
    }
  }, [live]);

  const onChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    textRef.current = e.target.value;
    setText(e.target.value);
    setStatus('pending');
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(flush, SAVE_DELAY_MS);
  };

  const onDelete = async () => {
    const d = docRef.current;
    if (!d) return;
    if (!window.confirm(`Delete "/${slug}"? This cannot be undone.`)) return;
    window.clearTimeout(timerRef.current);
    docRef.current = null; // prevents a pending save from recreating the document
    await chainRef.current;
    await deleteDocument(d.id);
    navigate('/');
  };

  return (
    <div className="editor-page">
      <header className="topbar">
        <Link to="/" className="brand" title="All documents">
          <img src={toUrl('/icons/icon.svg')} alt="" width="22" height="22" />
          <span className="brand-name">LocalPad</span>
        </Link>
        <span className="crumb" title={`/${slug}`}>/{slug}</span>
        <div className="topbar-right">
          {!online && <span className="pill">Offline</span>}
          <span className={`save-status save-${status}`} role="status" aria-live="polite">
            <span className="dot" aria-hidden="true" />
            <span className="save-label">{STATUS_LABEL[status]}</span>
          </span>
          <ThemeToggle />
          <button className="btn btn-icon" onClick={onDelete} disabled={!doc} title="Delete document" aria-label="Delete document">
            <TrashIcon />
          </button>
        </div>
      </header>

      {loadError ? (
        <p className="error-box">{loadError}</p>
      ) : (
        <textarea
          ref={textareaRef}
          className="editor"
          value={text}
          onChange={onChange}
          disabled={!doc}
          placeholder={doc ? 'Start writing. Everything is saved automatically in this browser.' : ''}
          spellCheck={false}
          aria-label={`Contents of /${slug}`}
        />
      )}
    </div>
  );
}

export function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
    </svg>
  );
}
