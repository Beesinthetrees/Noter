import { Editor } from './components/Editor'
import { Sidebar } from './components/Sidebar'
import { FontProvider } from './settings/FontContext'
import { KeybindsProvider } from './settings/KeybindsContext'
import { SidebarSizeProvider } from './settings/SidebarSizeContext'
import { VaultProvider } from './vault/VaultContext'
import './App.css'

function App() {
  return (
    <FontProvider>
      <KeybindsProvider>
        <SidebarSizeProvider>
          <VaultProvider>
            <div data-tauri-drag-region className="drag-region" />
            <Editor />
            <Sidebar />
          </VaultProvider>
        </SidebarSizeProvider>
      </KeybindsProvider>
    </FontProvider>
  )
}

export default App
