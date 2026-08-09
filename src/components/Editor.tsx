import { useEffect } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useNote } from '../hooks/useNote'
import './Editor.css'

export function Editor() {
  const { initialContent, scheduleSave, flush, newNote } = useNote()

  const editor = useEditor(
    {
      extensions: [StarterKit],
      content: initialContent ?? '',
      autofocus: 'end',
      onUpdate: ({ editor }) => scheduleSave(editor),
    },
    [initialContent],
  )

  useEffect(() => {
    if (!editor) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        newNote(editor)
      } else if (event.ctrlKey && event.key.toLowerCase() === 'w') {
        event.preventDefault()
        flush(editor)
        getCurrentWindow()
          .close()
          .catch(() => {})
      }
    }

    const handleBeforeUnload = () => flush(editor)

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [editor, newNote, flush])

  if (initialContent === null) {
    return <div className="editor" />
  }

  return (
    <div className="editor">
      <EditorContent editor={editor} />
    </div>
  )
}
