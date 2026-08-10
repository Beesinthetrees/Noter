import { Editor } from './components/Editor'
import { Sidebar } from './components/Sidebar'
import { FontProvider } from './settings/FontContext'
import { KeybindsProvider } from './settings/KeybindsContext'
import { VaultProvider } from './vault/VaultContext'
import './App.css'

function App() {
  return (
    <FontProvider>
      <KeybindsProvider>
        <VaultProvider>
          <div data-tauri-drag-region className="drag-region" />
          <Editor />
          <Sidebar />
        </VaultProvider>
      </KeybindsProvider>
    </FontProvider>
  )
}

export default App
