import { useEffect, useState, type ChangeEvent } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import { FONT_PRESETS, useFont } from '../settings/FontContext'
import { formatKeyEvent, useKeybinds, type Keybinds } from '../settings/KeybindsContext'
import { openPath } from '../vault/commands'
import { useVault } from '../vault/VaultContext'
import './Settings.css'

export function Settings({ onClose }: { onClose: () => void }) {
  const { rootDir, changeRootDir } = useVault()
  const { keybinds, setKeybind } = useKeybinds()

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleChooseDirectory = async () => {
    const selected = await open({ directory: true, defaultPath: rootDir ?? undefined })
    if (typeof selected === 'string') {
      await changeRootDir(selected)
    }
  }

  return (
    <div className="settings-backdrop" onClick={onClose}>
      <div className="settings-panel" onClick={(event) => event.stopPropagation()}>
        <div className="settings-panel__header">
          <span>Settings</span>
          <button type="button" className="settings-panel__close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="settings-panel__row">
          <span className="settings-panel__label">Root directory</span>
          <div className="settings-panel__inline-row">
            <span className="settings-panel__value">{rootDir}</span>
            <button type="button" className="settings-panel__small-button" onClick={handleChooseDirectory}>
              Change…
            </button>
          </div>
        </div>
        <FontSection />
        <div className="settings-panel__section">
          <span className="settings-panel__label">Keybinds</span>
          <KeybindRow label="Minimize window" action="minimize" value={keybinds.minimize} onChange={setKeybind} />
          <KeybindRow label="Close window" action="close" value={keybinds.close} onChange={setKeybind} />
        </div>
      </div>
    </div>
  )
}

function FontSection() {
  const { font, setFont, customFonts, fontsDir, refreshFonts } = useFont()

  useEffect(() => {
    refreshFonts()
    const handleFocus = () => refreshFonts()
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [refreshFonts])

  const customOptions = customFonts.map((file) => ({ label: file.name, value: `"${file.name}"` }))
  const allOptions = [...FONT_PRESETS, ...customOptions]
  const matched = allOptions.find((option) => option.value === font)

  const handleSelect = (event: ChangeEvent<HTMLSelectElement>) => {
    const option = allOptions.find((o) => o.label === event.target.value)
    if (option) setFont(option.value)
  }

  const handleAddFonts = () => {
    if (fontsDir) void openPath(fontsDir).catch(() => {})
  }

  return (
    <div className="settings-panel__section">
      <span className="settings-panel__label">Font</span>
      <div className="settings-panel__inline-row">
        <select className="settings-panel__select" value={matched?.label ?? ''} onChange={handleSelect}>
          {allOptions.map((option) => (
            <option key={option.label} value={option.label}>
              {option.label}
            </option>
          ))}
        </select>
        <button type="button" className="settings-panel__small-button" onClick={handleAddFonts}>
          Add fonts…
        </button>
      </div>
    </div>
  )
}

function KeybindRow({
  label,
  action,
  value,
  onChange,
}: {
  label: string
  action: keyof Keybinds
  value: string
  onChange: (action: keyof Keybinds, value: string) => void
}) {
  const [recording, setRecording] = useState(false)

  useEffect(() => {
    if (!recording) return

    const handleKeyDown = (event: KeyboardEvent) => {
      event.preventDefault()
      event.stopPropagation()
      if (event.key === 'Escape') {
        setRecording(false)
        return
      }
      const formatted = formatKeyEvent(event)
      if (!formatted) return
      onChange(action, formatted)
      setRecording(false)
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [recording, action, onChange])

  return (
    <div className="settings-panel__keybind-row">
      <span className="settings-panel__keybind-label">{label}</span>
      <button
        type="button"
        className={`settings-panel__keybind-value${recording ? ' settings-panel__keybind-value--recording' : ''}`}
        onClick={() => setRecording(true)}
      >
        {recording ? 'Press keys…' : value}
      </button>
    </div>
  )
}
