import { db, type Document } from './db';
import { normalizeSlug } from './slug';

export const BACKUP_FORMAT = 'localpad-backup';
export const BACKUP_VERSION = 1;

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: number;
  documents: Document[];
}

export interface ImportResult {
  added: number;
  updated: number;
  skipped: number;
}

export async function createBackup(): Promise<Backup> {
  const documents = await db.documents.orderBy('updatedAt').reverse().toArray();
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: Date.now(), documents };
}

/** Validates backup JSON and returns its documents. Throws an Error with a user-facing message. */
export function parseBackup(text: string): Document[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('The file is not valid JSON.');
  }
  if (!data || typeof data !== 'object' || (data as Backup).format !== BACKUP_FORMAT) {
    throw new Error('The file is not a LocalPad backup.');
  }
  const backup = data as Backup;
  if (typeof backup.version !== 'number' || backup.version > BACKUP_VERSION) {
    throw new Error('This backup was created by a newer version of LocalPad.');
  }
  if (!Array.isArray(backup.documents)) {
    throw new Error('The backup does not contain a list of documents.');
  }

  const now = Date.now();
  const docs: Document[] = [];
  for (const raw of backup.documents as unknown[]) {
    if (!raw || typeof raw !== 'object') continue;
    const d = raw as Partial<Document>;
    const slug = typeof d.slug === 'string' ? normalizeSlug(d.slug) : '';
    if (!slug || typeof d.content !== 'string') continue;
    const updatedAt = Number.isFinite(d.updatedAt) ? Number(d.updatedAt) : now;
    docs.push({
      id: typeof d.id === 'string' && d.id ? d.id : crypto.randomUUID(),
      slug,
      content: d.content,
      createdAt: Number.isFinite(d.createdAt) ? Number(d.createdAt) : updatedAt,
      updatedAt,
    });
  }
  return docs;
}

/**
 * Merges imported documents with existing ones, by slug:
 * - new slug: added;
 * - existing slug: replaced only if the imported version is newer;
 * - otherwise: skipped (nothing local is lost).
 */
export async function importDocuments(docs: Document[]): Promise<ImportResult> {
  const result: ImportResult = { added: 0, updated: 0, skipped: 0 };
  await db.transaction('rw', db.documents, async () => {
    for (const doc of docs) {
      const existing = await db.documents.where('slug').equals(doc.slug).first();
      if (!existing) {
        const idTaken = await db.documents.get(doc.id);
        await db.documents.add({ ...doc, id: idTaken ? crypto.randomUUID() : doc.id });
        result.added++;
      } else if (doc.updatedAt > existing.updatedAt) {
        await db.documents.update(existing.id, {
          content: doc.content,
          updatedAt: doc.updatedAt,
          createdAt: Math.min(existing.createdAt, doc.createdAt),
        });
        result.updated++;
      } else {
        result.skipped++;
      }
    }
  });
  return result;
}

export function backupFileName(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `localpad-backup-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`;
}
