import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { readBytes } from '../vault/commands'
import { getFontsDir, listFonts, type FontFile } from './fontCommands'

export interface FontPreset {
  label: string
  value: string
}

export const FONT_PRESETS: FontPreset[] = [
  { label: 'Cascadia Mono', value: "'Cascadia Mono', 'Cascadia Code', Consolas, monospace" },
  { label: 'Consolas', value: "Consolas, 'Cascadia Mono', monospace" },
  { label: 'Courier New', value: "'Courier New', monospace" },
  { label: 'JetBrains Mono', value: "'JetBrains Mono', Consolas, monospace" },
  { label: 'System UI (sans-serif)', value: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif" },
]

const DEFAULT_FONT = FONT_PRESETS[0].value
const STORAGE_KEY = 'noter:font'

function loadFont(): string {
  return localStorage.getItem(STORAGE_KEY) || DEFAULT_FONT
}

interface FontState {
  font: string
  setFont: (font: string) => void
  customFonts: FontFile[]
  fontsDir: string | null
  refreshFonts: () => Promise<void>
}

const FontContext = createContext<FontState | null>(null)

export function useFont(): FontState {
  const ctx = useContext(FontContext)
  if (!ctx) throw new Error('useFont must be used within FontProvider')
  return ctx
}

const loadedFontNames = new Set<string>()

export function FontProvider({ children }: { children: ReactNode }) {
  const [font, setFontState] = useState<string>(loadFont)
  const [customFonts, setCustomFonts] = useState<FontFile[]>([])
  const [fontsDir, setFontsDir] = useState<string | null>(null)

  useEffect(() => {
    document.documentElement.style.setProperty('--app-font', font)
  }, [font])

  const refreshFonts = useCallback(async () => {
    const dir = await getFontsDir()
    setFontsDir(dir)
    const files = await listFonts()
    setCustomFonts(files)

    await Promise.all(
      files
        .filter((file) => !loadedFontNames.has(file.name))
        .map(async (file) => {
          try {
            const bytes = await readBytes(file.path)
            const fontFace = new FontFace(file.name, new Uint8Array(bytes).buffer)
            await fontFace.load()
            document.fonts.add(fontFace)
            loadedFontNames.add(file.name)
          } catch {
            // skip files that fail to parse as a font
          }
        }),
    )
  }, [])

  useEffect(() => {
    refreshFonts()
  }, [refreshFonts])

  const setFont = useCallback((value: string) => {
    localStorage.setItem(STORAGE_KEY, value)
    setFontState(value)
  }, [])

  return (
    <FontContext.Provider value={{ font, setFont, customFonts, fontsDir, refreshFonts }}>
      {children}
    </FontContext.Provider>
  )
}
