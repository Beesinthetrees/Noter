import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { SearchPopup } from './components/SearchPopup'
import { FontProvider } from './settings/FontContext'
import { KeybindsProvider } from './settings/KeybindsContext'
import './search-main.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FontProvider>
      <KeybindsProvider>
        <SearchPopup />
      </KeybindsProvider>
    </FontProvider>
  </StrictMode>,
)
