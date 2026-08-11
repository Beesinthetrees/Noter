import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { LogicalSize } from '@tauri-apps/api/dpi'
import { emitTo } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useGlobalShortcut, useKeybinds } from '../settings/KeybindsContext'
import { defaultRootDir, readNote, readTree } from '../vault/commands'
import { flattenNotes } from '../vault/tree'
import { ROOT_DIR_KEY } from '../vault/storageKeys'
import './SearchPopup.css'

interface IndexedNote {
  path: string
  name: string
  content: string
}

interface SearchResult {
  path: string
  name: string
  breadcrumb: string
  snippet: string | null
}

type ScoredResult = SearchResult & { score: number }

const MAX_RESULTS = 20
const SNIPPET_RADIUS = 50
const POPUP_WIDTH = 560

function buildSnippet(content: string, matchIndex: number): string {
  const start = Math.max(0, matchIndex - SNIPPET_RADIUS)
  const end = Math.min(content.length, matchIndex + SNIPPET_RADIUS)
  const clean = (value: string) => value.replace(/\s+/g, ' ').trim()
  const prefix = start > 0 ? '…' : ''
  const suffix = end < content.length ? '…' : ''
  return `${prefix}${clean(content.slice(start, end))}${suffix}`
}

function breadcrumbFor(path: string, rootDir: string | null): string {
  if (!rootDir) return ''
  const rel = path.slice(rootDir.length + 1).replace(/\\/g, '/')
  const parts = rel.split('/')
  parts.pop()
  return parts.join(' / ')
}

async function resolveRootDir(): Promise<string> {
  const stored = localStorage.getItem(ROOT_DIR_KEY)
  if (stored) return stored
  const root = await defaultRootDir()
  localStorage.setItem(ROOT_DIR_KEY, root)
  return root
}

export function SearchPopup() {
  const { keybinds } = useKeybinds()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [rootDir, setRootDir] = useState<string | null>(null)
  const [noteIndex, setNoteIndex] = useState<IndexedNote[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Re-reads every note fresh each time the popup is summoned - no
  // persistent index to keep in sync, consistent with the rest of the app
  // always trusting the filesystem over cached state.
  const refreshIndex = useCallback(async () => {
    setLoading(true)
    const root = await resolveRootDir()
    setRootDir(root)
    const tree = await readTree(root)
    const notes = flattenNotes(tree)
    const result = await Promise.all(
      notes.map(async (note) => ({
        path: note.path,
        name: note.name,
        content: await readNote(note.path).catch(() => ''),
      })),
    )
    setNoteIndex(result)
    setLoading(false)
  }, [])

  // Registered at the OS level so it fires no matter what has focus - even
  // another application, or this window backgrounded. Re-registers whenever
  // the binding changes (e.g. rebound in Settings, in the main window - see
  // the storage-event sync in KeybindsContext.tsx).
  const handleSearchShortcut = useCallback(() => {
    setQuery('')
    setSelectedIndex(0)
    void refreshIndex()
    void (async () => {
      const win = getCurrentWindow()
      await win.hide()
      await win.show()
      await win.setFocus()
      inputRef.current?.focus()
    })()
  }, [refreshIndex])
  useGlobalShortcut(keybinds.search, handleSearchShortcut)

  // Spotlight-style: losing focus (clicking elsewhere on the desktop) hides
  // the popup, since there's no in-window backdrop to click on anymore.
  useEffect(() => {
    const handleBlur = () => {
      void getCurrentWindow().hide()
    }
    window.addEventListener('blur', handleBlur)
    return () => window.removeEventListener('blur', handleBlur)
  }, [])

  // Grows/shrinks the actual OS window to match content height, so it's
  // genuinely just the search bar until results give it something to show -
  // a fixed-size transparent window would otherwise leave an invisible
  // region still capturing clicks meant for whatever's behind it.
  useEffect(() => {
    const el = panelRef.current
    if (!el) return
    const win = getCurrentWindow()
    const observer = new ResizeObserver((entries) => {
      const height = Math.ceil(entries[0].contentRect.height)
      void win.setSize(new LogicalSize(POPUP_WIDTH, height))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  const results = useMemo<SearchResult[]>(() => {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) return []

    const scored: ScoredResult[] = []
    for (const note of noteIndex) {
      const nameIndex = note.name.toLowerCase().indexOf(trimmed)
      const contentIndex = note.content.toLowerCase().indexOf(trimmed)
      if (nameIndex === -1 && contentIndex === -1) continue
      scored.push({
        path: note.path,
        name: note.name,
        breadcrumb: breadcrumbFor(note.path, rootDir),
        snippet: nameIndex === -1 && contentIndex !== -1 ? buildSnippet(note.content, contentIndex) : null,
        score: (nameIndex !== -1 ? 2 : 0) + (contentIndex !== -1 ? 1 : 0),
      })
    }
    scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    return scored.slice(0, MAX_RESULTS)
  }, [noteIndex, query, rootDir])

  const clampedIndex = results.length === 0 ? 0 : Math.min(selectedIndex, results.length - 1)

  const hidePopup = () => {
    void getCurrentWindow().hide()
  }

  const selectResult = (result: SearchResult | undefined) => {
    if (!result) return
    void (async () => {
      await emitTo('main', 'noter://open-note', { path: result.path })
      await getCurrentWindow().hide()
    })()
  }

  const handleInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, Math.max(results.length - 1, 0)))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      selectResult(results[clampedIndex])
    } else if (event.key === 'Escape') {
      event.preventDefault()
      hidePopup()
    }
  }

  return (
    <div className="search-overlay" ref={panelRef}>
      <input
        ref={inputRef}
        className="search-overlay__input"
        type="text"
        placeholder="Search notes…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={handleInputKeyDown}
      />
      {query.trim() !== '' && (
        <div className="search-overlay__results">
          {loading ? (
            <div className="search-overlay__hint">Indexing notes…</div>
          ) : results.length === 0 ? (
            <div className="search-overlay__hint">No matching notes.</div>
          ) : (
            results.map((result, i) => (
              <div
                key={result.path}
                className={`search-result${i === clampedIndex ? ' search-result--selected' : ''}`}
                onMouseEnter={() => setSelectedIndex(i)}
                onClick={() => selectResult(result)}
              >
                <div className="search-result__name">{result.name}</div>
                {result.breadcrumb && <div className="search-result__path">{result.breadcrumb}</div>}
                {result.snippet && <div className="search-result__snippet">{result.snippet}</div>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
