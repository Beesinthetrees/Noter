import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

const STORAGE_KEY = 'noter:sidebar-font-size'

export const SIDEBAR_SIZE_DEFAULT = 0.85
export const SIDEBAR_SIZE_MIN = 0.7
export const SIDEBAR_SIZE_MAX = 1.2
export const SIDEBAR_SIZE_STEP = 0.05

function clamp(value: number): number {
  return Math.min(SIDEBAR_SIZE_MAX, Math.max(SIDEBAR_SIZE_MIN, value))
}

function loadSize(): number {
  const stored = Number(localStorage.getItem(STORAGE_KEY))
  return Number.isFinite(stored) && stored > 0 ? clamp(stored) : SIDEBAR_SIZE_DEFAULT
}

interface SidebarSizeState {
  size: number
  setSize: (size: number) => void
}

const SidebarSizeContext = createContext<SidebarSizeState | null>(null)

export function useSidebarSize(): SidebarSizeState {
  const ctx = useContext(SidebarSizeContext)
  if (!ctx) throw new Error('useSidebarSize must be used within SidebarSizeProvider')
  return ctx
}

export function SidebarSizeProvider({ children }: { children: ReactNode }) {
  const [size, setSizeState] = useState<number>(loadSize)

  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-font-size', `${size}rem`)
  }, [size])

  const setSize = useCallback((value: number) => {
    const clamped = clamp(value)
    localStorage.setItem(STORAGE_KEY, String(clamped))
    setSizeState(clamped)
  }, [])

  return <SidebarSizeContext.Provider value={{ size, setSize }}>{children}</SidebarSizeContext.Provider>
}
