import Dexie, { type EntityTable } from 'dexie'

export interface Note {
  id: number
  title: string
  content: string
  createdAt: Date
  updatedAt: Date
}

export const db = new Dexie('NoterDatabase') as Dexie & {
  notes: EntityTable<Note, 'id'>
}

db.version(1).stores({
  notes: '++id, title, createdAt, updatedAt',
})
