import { db, type Document } from './db';

function newId(): string {
  return crypto.randomUUID();
}

/** Loads the document for a slug or creates an empty one, atomically (safe across tabs). */
export async function getOrCreateDocument(slug: string): Promise<Document> {
  return db.transaction('rw', db.documents, async () => {
    const existing = await db.documents.where('slug').equals(slug).first();
    if (existing) return existing;
    const now = Date.now();
    const doc: Document = { id: newId(), slug, content: '', createdAt: now, updatedAt: now };
    await db.documents.add(doc);
    return doc;
  });
}

/**
 * Saves the content. If the document was deleted in another tab while it was
 * open here, it is recreated so that what was typed is not lost.
 */
export async function saveDocumentContent(doc: Pick<Document, 'id' | 'slug' | 'createdAt'>, content: string): Promise<number> {
  const updatedAt = Date.now();
  await db.transaction('rw', db.documents, async () => {
    const changed = await db.documents.update(doc.id, { content, updatedAt });
    if (changed === 0) {
      const sameSlug = await db.documents.where('slug').equals(doc.slug).first();
      if (sameSlug) {
        await db.documents.update(sameSlug.id, { content, updatedAt });
      } else {
        await db.documents.add({ id: doc.id, slug: doc.slug, content, createdAt: doc.createdAt, updatedAt });
      }
    }
  });
  return updatedAt;
}

export async function deleteDocument(id: string): Promise<void> {
  await db.documents.delete(id);
}

export async function listDocuments(): Promise<Document[]> {
  return db.documents.orderBy('updatedAt').reverse().toArray();
}
