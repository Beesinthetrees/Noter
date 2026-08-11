// Shared across the main window (VaultContext) and the standalone search
// window (SearchPopup) - both read/write these via the same-origin
// localStorage they share, so the literal keys must stay in sync.
export const ROOT_DIR_KEY = 'noter:root-dir'
export const CURRENT_PATH_KEY = 'noter:current-note-path'
