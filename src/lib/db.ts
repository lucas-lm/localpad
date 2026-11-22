import Dexie, { type Table } from 'dexie';

export interface Document {
  id: string;
  slug: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

class LocalPadDB extends Dexie {
  documents!: Table<Document, string>;

  constructor() {
    super('localpad');
    this.version(1).stores({
      // &slug = unique index: two documents never share the same URL.
      documents: 'id, &slug, updatedAt',
    });
  }
}

export const db = new LocalPadDB();
