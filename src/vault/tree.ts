import type { JSONContent } from '@tiptap/react'
import type { TreeEntry } from './commands'

export const TRASH_NAME = 'Trash'

// eslint-disable-next-line no-control-regex -- stripping control chars is intentional here
const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\x00-\x1f]/g

export function sanitizeFilename(name: string): string {
  const cleaned = name.replace(INVALID_FILENAME_CHARS, '').trim().replace(/\.+$/, '')
  return cleaned || 'Untitled'
}

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

export function findFirstNote(entries: TreeEntry[]): (TreeEntry & { type: 'note' }) | undefined {
  for (const entry of entries) {
    if (entry.type === 'folder' && entry.name === TRASH_NAME) continue
    if (entry.type === 'note') return entry
    const found = findFirstNote(entry.children)
    if (found) return found
  }
  return undefined
}

export function findEntry(entries: TreeEntry[], path: string): TreeEntry | undefined {
  for (const entry of entries) {
    if (entry.path === path) return entry
    if (entry.type === 'folder') {
      const found = findEntry(entry.children, path)
      if (found) return found
    }
  }
  return undefined
}
