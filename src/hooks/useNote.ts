import { useCallback, useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { db } from '../db/db'
import { createNote, extractTitle, getMostRecentNote, saveNote } from '../db/notes'

const CURRENT_NOTE_KEY = 'noter:current-note-id'
const SAVE_DEBOUNCE_MS = 400

export function useNote() {
  const [noteId, setNoteId] = useState<number | null>(null)
  const [initialContent, setInitialContent] = useState<string | null>(null)
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>(undefined)
  const loadStarted = useRef(false)

  useEffect(() => {
    if (loadStarted.current) return
    loadStarted.current = true

    async function load() {
      const storedId = Number(localStorage.getItem(CURRENT_NOTE_KEY))
      let note = storedId ? await db.notes.get(storedId) : undefined
      if (!note) note = await getMostRecentNote()
      if (!note) note = await createNote()

      localStorage.setItem(CURRENT_NOTE_KEY, String(note.id))
      setNoteId(note.id)
      setInitialContent(note.content)
    }

    load()
  }, [])

  const flush = useCallback(
    (editor: Editor) => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current)
      if (noteId == null) return
      const title = extractTitle(editor.getJSON())
      saveNote(noteId, title, editor.getHTML())
    },
    [noteId],
  )

  const scheduleSave = useCallback(
    (editor: Editor) => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current)
      saveTimeout.current = setTimeout(() => flush(editor), SAVE_DEBOUNCE_MS)
    },
    [flush],
  )

  const newNote = useCallback(
    async (editor: Editor) => {
      flush(editor)
      const note = await createNote()
      localStorage.setItem(CURRENT_NOTE_KEY, String(note.id))
      setNoteId(note.id)
      editor.commands.setContent('')
      editor.commands.focus()
    },
    [flush],
  )

  return { initialContent, scheduleSave, flush, newNote }
}
