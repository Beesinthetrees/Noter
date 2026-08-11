import { useEffect } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { matchesKeybind, useKeybinds } from '../settings/KeybindsContext'
import { openPath } from '../vault/commands'
import { editorExtensions } from '../vault/editorExtensions'
import { useVault } from '../vault/VaultContext'
import './Editor.css'

function readFileAsDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function isTauri(): boolean {
  return '__TAURI_INTERNALS__' in window
}

function extensionFromMime(mime: string): string {
  switch (mime) {
    case 'image/png':
      return 'png'
    case 'image/jpeg':
      return 'jpg'
    case 'image/gif':
      return 'gif'
    case 'image/webp':
      return 'webp'
    case 'image/bmp':
      return 'bmp'
    case 'image/svg+xml':
      return 'svg'
    default:
      return 'png'
  }
}

export function Editor() {
  const { registerEditor, scheduleSave, flush, newNote, saveAttachment } = useVault()
  const { keybinds } = useKeybinds()

  const editor = useEditor({
    extensions: editorExtensions,
    autofocus: 'end',
    onUpdate: () => scheduleSave(),
    editorProps: {
      attributes: {
        spellcheck: 'false',
      },
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items
        if (!items) return false
        const imageItem = Array.from(items).find((item) => item.type.startsWith('image/'))
        if (!imageItem) return false
        const file = imageItem.getAsFile()
        if (!file) return false

        event.preventDefault()

        void (async () => {
          const dataUri = await readFileAsDataUri(file)
          const bytes = Array.from(new Uint8Array(await file.arrayBuffer()))
          const extension = extensionFromMime(file.type)
          const relativePath = await saveAttachment(bytes, extension)

          const node = view.state.schema.nodes.image.create({ src: dataUri, path: relativePath })
          view.dispatch(view.state.tr.replaceSelectionWith(node))
        })()

        return true
      },
      handleClick: (_view, _pos, event) => {
        if (!(event.ctrlKey || event.metaKey)) return false
        const link = (event.target as HTMLElement).closest('a')
        if (!link) return false
        event.preventDefault()
        void openPath(link.href).catch(() => {})
        return true
      },
    },
  })

  useEffect(() => {
    registerEditor(editor)
    return () => registerEditor(null)
  }, [editor, registerEditor])

  useEffect(() => {
    if (!editor) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        newNote()
      } else if (matchesKeybind(event, keybinds.close)) {
        event.preventDefault()
        getCurrentWindow()
          .close()
          .catch(() => {})
      } else if (matchesKeybind(event, keybinds.minimize)) {
        event.preventDefault()
        getCurrentWindow()
          .minimize()
          .catch(() => {})
      }
    }

    const handleBeforeUnload = () => {
      void flush()
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [editor, newNote, flush, keybinds])

  useEffect(() => {
    if (!editor || !isTauri()) return

    const win = getCurrentWindow()
    let unlisten: (() => void) | undefined
    let cancelled = false

    win
      .onCloseRequested(async (event) => {
        // Intercept every close path (Ctrl+W, Alt+F4, taskbar close) so the
        // pending save always finishes writing to disk before the window dies.
        event.preventDefault()
        await flush()
        unlisten?.()
        await win.close()
      })
      .then((fn) => {
        if (cancelled) fn()
        else unlisten = fn
      })

    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [editor, flush])

  return (
    <div className="editor">
      <EditorContent editor={editor} />
    </div>
  )
}
