import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { backupFileName, createBackup, importDocuments, parseBackup } from '../lib/backup';
import { deleteDocument, listDocuments } from '../lib/documents';
import { preview, relativeTime } from '../lib/format';
import { Link, navigate, toUrl } from '../lib/router';
import { normalizeSlug, slugToPath } from '../lib/slug';
import { useOnline } from '../lib/useOnline';
import { useConfirm } from '../components/ConfirmDialog';
import { ThemeToggle } from '../lib/theme';
import type { Document } from '../lib/db';
import { TrashIcon } from './EditorPage';

type Notice = { kind: 'ok' | 'error'; text: string } | null;

export function HomePage() {
  const docs = useLiveQuery(listDocuments, []);
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState<Notice>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const online = useOnline();
  const [confirm, confirmDialog] = useConfirm();

  useEffect(() => {
    document.title = 'LocalPad';
    navigator.storage?.persisted?.().then(setPersisted).catch(() => {});
  }, []);

  const target = normalizeSlug(query);
  const needle = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!docs) return [];
    if (!needle) return docs;
    return docs.filter((d) => d.slug.includes(needle) || d.slug.includes(target) || d.content.toLowerCase().includes(needle));
  }, [docs, needle, target]);
  const exists = !!docs?.some((d) => d.slug === target);

  const open = (e: FormEvent) => {
    e.preventDefault();
    if (target) navigate(slugToPath(target));
  };

  const onDelete = async (doc: Document) => {
    const ok = await confirm({
      title: 'Delete document?',
      message: (
        <>
          <code>/{doc.slug}</code> and everything in it will be permanently deleted. This can’t be undone.
        </>
      ),
    });
    if (!ok) return;
    await deleteDocument(doc.id);
  };

  const onExport = async () => {
    try {
      const backup = await createBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = backupFileName();
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      const n = backup.documents.length;
      setNotice({ kind: 'ok', text: `Exported a backup with ${n} document${n === 1 ? '' : 's'}.` });
    } catch (err) {
      console.error(err);
      setNotice({ kind: 'error', text: 'Could not export the backup.' });
    }
  };

  const onImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const imported = parseBackup(await file.text());
      const r = await importDocuments(imported);
      const parts = [`${r.added} added`, `${r.updated} updated`];
      if (r.skipped) parts.push(`${r.skipped} kept (local version is the same or newer)`);
      setNotice({ kind: 'ok', text: `Import complete: ${parts.join(', ')}.` });
    } catch (err) {
      setNotice({ kind: 'error', text: err instanceof Error ? err.message : 'Could not import the file.' });
    }
  };

  return (
    <div className="home">
      <header className="home-header">
        <div className="brand">
          <img src={toUrl('/icons/icon.svg')} alt="" width="28" height="28" />
          <h1>LocalPad</h1>
        </div>
        <div className="topbar-right">
          {!online && <span className="pill">Offline</span>}
          <ThemeToggle />
        </div>
      </header>
      <p className="tagline">Notes by URL, stored only in this browser.</p>

      <form className="open-form" onSubmit={open} role="search">
        <span className="slash" aria-hidden="true">/</span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="search or create"
          aria-label="Search or create a document"
          autoFocus
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <button type="submit" className="btn btn-primary" disabled={!target}>
          {target && !exists ? 'Create' : 'Open'}
        </button>
      </form>
      {target && !exists && (
        <p className="hint">
          Press Enter to create <code>/{target}</code>
        </p>
      )}

      {notice && (
        <p className={`notice notice-${notice.kind}`} role="status">
          {notice.text}
          <button className="link" onClick={() => setNotice(null)} aria-label="Dismiss notice">
            ×
          </button>
        </p>
      )}

      <section aria-labelledby="docs-title">
        <div className="section-head">
          <h2 id="docs-title">Documents</h2>
          {docs && <span className="count">{needle ? `${filtered.length} of ${docs.length}` : docs.length}</span>}
        </div>

        {docs === undefined ? null : docs.length === 0 ? (
          <div className="empty">
            <p>No documents yet.</p>
            <p>
              Type a name above or open any address, such as <Link to="/todo"><code>/todo</code></Link>.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="empty">Nothing found for “{query.trim()}”.</p>
        ) : (
          <ul className="doc-list">
            {filtered.map((doc) => {
              const path = slugToPath(doc.slug);
              const snippet = preview(doc.content);
              return (
                <li key={doc.id}>
                  <Link to={path} className="doc-link">
                    <span className="doc-slug">/{doc.slug}</span>
                    <span className={`doc-preview${snippet ? '' : ' muted'}`}>{snippet || 'Empty'}</span>
                  </Link>
                  <time className="doc-time" dateTime={new Date(doc.updatedAt).toISOString()} title={new Date(doc.updatedAt).toLocaleString('en')}>
                    {relativeTime(doc.updatedAt)}
                  </time>
                  <button className="btn btn-icon" onClick={() => onDelete(doc)} title={`Delete /${doc.slug}`} aria-label={`Delete /${doc.slug}`}>
                    <TrashIcon />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="backup" aria-labelledby="backup-title">
        <h2 id="backup-title">Backup</h2>
        <p className="muted">
          Documents exist only in this browser and profile. Clearing site data erases everything, so export a backup to keep a copy or move it to another device.
          {persisted === true && ' Persistent storage is enabled.'}
        </p>
        <div className="backup-actions">
          <button className="btn" onClick={onExport} disabled={!docs?.length}>
            Export JSON
          </button>
          <button className="btn" onClick={() => fileInput.current?.click()}>
            Import JSON
          </button>
          <input ref={fileInput} type="file" accept="application/json,.json" onChange={onImport} hidden />
        </div>
      </section>
      {confirmDialog}
    </div>
  );
}
