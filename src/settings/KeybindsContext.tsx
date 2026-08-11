import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { register, unregister } from '@tauri-apps/plugin-global-shortcut'

export interface Keybinds {
  minimize: string
  close: string
  search: string
  newNote: string
}

const DEFAULT_KEYBINDS: Keybinds = {
  minimize: 'Ctrl+M',
  close: 'Ctrl+W',
  search: 'Ctrl+Shift+F',
  newNote: 'Ctrl+Shift+N',
}

const STORAGE_KEY = 'noter:keybinds'

function loadKeybinds(): Keybinds {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_KEYBINDS
    return { ...DEFAULT_KEYBINDS, ...(JSON.parse(raw) as Partial<Keybinds>) }
  } catch {
    return DEFAULT_KEYBINDS
  }
}

export function formatKeyEvent(event: KeyboardEvent): string | null {
  const key = event.key
  if (key === 'Control' || key === 'Shift' || key === 'Alt' || key === 'Meta') return null

  const parts: string[] = []
  if (event.ctrlKey) parts.push('Ctrl')
  if (event.shiftKey) parts.push('Shift')
  if (event.altKey) parts.push('Alt')
  if (event.metaKey) parts.push('Meta')
  parts.push(key.length === 1 ? key.toUpperCase() : key)
  return parts.join('+')
}

export function matchesKeybind(event: KeyboardEvent, binding: string): boolean {
  return formatKeyEvent(event) === binding
}

// Our internal keybind format (formatKeyEvent above) writes "Ctrl", but the
// global-shortcut plugin expects "Control" - everything else (Shift/Alt/Meta/
// single letters) already matches its syntax as-is.
export function toGlobalShortcutSyntax(binding: string): string {
  return binding
    .split('+')
    .map((part) => (part === 'Ctrl' ? 'Control' : part))
    .join('+')
}

// register()/unregister() are async, and React Strict Mode's dev-mode
// mount->unmount->mount runs an effect's cleanup synchronously right after
// its setup - so without serialization, a register() from the first
// (throwaway) mount, an unregister() from its cleanup, and a register() from
// the second (real) mount can all end up in flight for the *same* shortcut
// string at once, racing each other at the OS level in whatever order the
// IPC round-trips happen to resolve. Queuing operations per shortcut string
// guarantees they run one at a time, in the order they were requested, so
// there's never more than one in-flight operation for a given string to
// race against.
const shortcutQueues = new Map<string, Promise<void>>()

function enqueueShortcutOp(shortcut: string, op: () => Promise<void>): void {
  const previous = shortcutQueues.get(shortcut) ?? Promise.resolve()
  const next = previous.then(op, op)
  shortcutQueues.set(shortcut, next)
}

// Registers `binding` as an OS-level global shortcut for the lifetime of the
// calling component, calling `handler` on every press. `handler` should be
// stable (wrap it in useCallback at the call site) - it's an effect
// dependency, so an identity change re-registers.
export function useGlobalShortcut(binding: string, handler: () => void): void {
  useEffect(() => {
    const shortcut = toGlobalShortcutSyntax(binding)
    let isCurrent = true

    enqueueShortcutOp(shortcut, async () => {
      // Already cleaned up (e.g. Strict Mode's throwaway first mount) before
      // this op reached the front of the queue - skip registering something
      // we're just going to immediately unregister anyway.
      if (!isCurrent) return
      await register(shortcut, (event) => {
        if (event.state === 'Pressed') handler()
      }).catch(() => {})
    })

    return () => {
      isCurrent = false
      enqueueShortcutOp(shortcut, async () => {
        await unregister(shortcut).catch(() => {})
      })
    }
  }, [binding, handler])
}

interface KeybindsState {
  keybinds: Keybinds
  setKeybind: (action: keyof Keybinds, value: string) => void
}

const KeybindsContext = createContext<KeybindsState | null>(null)

export function useKeybinds(): KeybindsState {
  const ctx = useContext(KeybindsContext)
  if (!ctx) throw new Error('useKeybinds must be used within KeybindsProvider')
  return ctx
}

export function KeybindsProvider({ children }: { children: ReactNode }) {
  const [keybinds, setKeybinds] = useState<Keybinds>(loadKeybinds)

  // The main window and the standalone search popup window (SearchPopup.tsx)
  // each mount their own independent KeybindsProvider - this is how a rebind
  // made in Settings (main window only) reaches the search window's copy.
  // The native `storage` event only fires in *other* windows/documents than
  // the one that made the change, which is exactly what's needed here.
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== STORAGE_KEY) return
      setKeybinds(loadKeybinds())
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const setKeybind = useCallback((action: keyof Keybinds, value: string) => {
    setKeybinds((prev) => {
      const next = { ...prev, [action]: value }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return <KeybindsContext.Provider value={{ keybinds, setKeybind }}>{children}</KeybindsContext.Provider>
}
