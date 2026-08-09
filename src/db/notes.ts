import type { JSONContent } from '@tiptap/react'
import { db, type Note } from './db'

export function extractTitle(doc: JSONContent): string {
  const heading = findFirstHeading(doc)
  const text = heading ? nodeText(heading).trim() : ''
  return text || 'Untitled'
}

function findFirstHeading(node: JSONContent): JSONContent | undefined {
  if (node.type === 'heading') return node
  for (const child of node.content ?? []) {
    const found = findFirstHeading(child)
    if (found) return found
  }
  return undefined
}

function nodeText(node: JSONContent): string {
  if (node.type === 'text') return node.text ?? ''
  return (node.content ?? []).map(nodeText).join('')
}

export function getMostRecentNote(): Promise<Note | undefined> {
  return db.notes.orderBy('updatedAt').last()
}

export async function createNote(): Promise<Note> {
  const now = new Date()
  const id = await db.notes.add({
    title: 'Untitled',
    content: '',
    createdAt: now,
    updatedAt: now,
  })
  return (await db.notes.get(id))!
}

export function saveNote(id: number, title: string, content: string): Promise<number> {
  return db.notes.update(id, { title, content, updatedAt: new Date() })
}
