import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

export interface Keybinds {
  minimize: string
  close: string
}

const DEFAULT_KEYBINDS: Keybinds = {
  minimize: 'Ctrl+M',
  close: 'Ctrl+W',
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

  const setKeybind = useCallback((action: keyof Keybinds, value: string) => {
    setKeybinds((prev) => {
      const next = { ...prev, [action]: value }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return <KeybindsContext.Provider value={{ keybinds, setKeybind }}>{children}</KeybindsContext.Provider>
}
