import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db';
import { deleteDocument, getOrCreateDocument, listDocuments, saveDocumentContent } from '../documents';
import { createBackup, importDocuments, parseBackup } from '../backup';
import { normalizeSlug, slugToPath } from '../slug';

beforeEach(async () => {
  await db.documents.clear();
});

describe('slug', () => {
  it('normalizes URL paths', () => {
    expect(normalizeSlug('/meeting')).toBe('meeting');
    expect(normalizeSlug('/Project Ideas/')).toBe('project-ideas');
    expect(normalizeSlug('/work//Meeting%20Notes')).toBe('work/meeting-notes');
    expect(normalizeSlug('/')).toBe('');
    expect(normalizeSlug('/%E0%A4%A')).toBe('%e0%a4%a');
  });

  it('builds encoded paths', () => {
    expect(slugToPath('work/café')).toBe('/work/caf%C3%A9');
  });
});

describe('documents', () => {
  it('creates an empty document for an unknown slug', async () => {
    const doc = await getOrCreateDocument('todo');
    expect(doc.slug).toBe('todo');
    expect(doc.content).toBe('');
    expect(await db.documents.count()).toBe(1);
  });

  it('loads an existing document without duplicating it', async () => {
    const a = await getOrCreateDocument('todo');
    await saveDocumentContent(a, 'buy bread');
    const b = await getOrCreateDocument('todo');
    expect(b.id).toBe(a.id);
    expect(b.content).toBe('buy bread');
    expect(await db.documents.count()).toBe(1);
  });

  it('does not duplicate on concurrent access to the same slug', async () => {
    const docs = await Promise.all([getOrCreateDocument('x'), getOrCreateDocument('x'), getOrCreateDocument('x')]);
    expect(new Set(docs.map((d) => d.id)).size).toBe(1);
    expect(await db.documents.count()).toBe(1);
  });

  it('updates updatedAt on save', async () => {
    const doc = await getOrCreateDocument('a');
    const ts = await saveDocumentContent(doc, 'hi');
    const stored = await db.documents.get(doc.id);
    expect(stored?.updatedAt).toBe(ts);
    expect(ts).toBeGreaterThanOrEqual(doc.updatedAt);
  });

  it('recreates the document if it was deleted in another tab', async () => {
    const doc = await getOrCreateDocument('a');
    await deleteDocument(doc.id);
    await saveDocumentContent(doc, 'still here');
    const stored = await getOrCreateDocument('a');
    expect(stored.content).toBe('still here');
  });

  it('lists by most recently updated', async () => {
    const a = await getOrCreateDocument('a');
    await getOrCreateDocument('b');
    await new Promise((r) => setTimeout(r, 5));
    await saveDocumentContent(a, 'new');
    expect((await listDocuments()).map((d) => d.slug)).toEqual(['a', 'b']);
  });
});

describe('backup', () => {
  it('exports and restores all documents', async () => {
    const a = await getOrCreateDocument('a');
    await saveDocumentContent(a, 'content A');
    await getOrCreateDocument('b');
    const json = JSON.stringify(await createBackup());

    await db.documents.clear();
    const result = await importDocuments(parseBackup(json));
    expect(result).toEqual({ added: 2, updated: 0, skipped: 0 });
    expect((await getOrCreateDocument('a')).content).toBe('content A');
  });

  it('replaces only when the imported version is newer', async () => {
    const local = await getOrCreateDocument('a');
    await saveDocumentContent(local, 'local');
    const stored = (await db.documents.get(local.id))!;

    const older = { ...stored, id: 'x1', content: 'old', updatedAt: stored.updatedAt - 1000 };
    expect(await importDocuments([older])).toEqual({ added: 0, updated: 0, skipped: 1 });
    expect((await db.documents.get(local.id))?.content).toBe('local');

    const newer = { ...stored, id: 'x2', content: 'new', updatedAt: stored.updatedAt + 1000 };
    expect(await importDocuments([newer])).toEqual({ added: 0, updated: 1, skipped: 0 });
    expect((await db.documents.get(local.id))?.content).toBe('new');
  });

  it('rejects invalid files', () => {
    expect(() => parseBackup('not json')).toThrow('valid JSON');
    expect(() => parseBackup('{"foo":1}')).toThrow('not a LocalPad backup');
    expect(() => parseBackup('{"format":"localpad-backup","version":99,"documents":[]}')).toThrow('newer version');
  });

  it('skips malformed entries and normalizes slugs', () => {
    const docs = parseBackup(
      JSON.stringify({
        format: 'localpad-backup',
        version: 1,
        documents: [{ slug: '/Meeting Notes', content: 'x' }, { slug: '', content: 'y' }, { slug: 'z' }, null],
      }),
    );
    expect(docs).toHaveLength(1);
    expect(docs[0].slug).toBe('meeting-notes');
  });
});
