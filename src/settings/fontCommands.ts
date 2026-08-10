import { invoke } from '@tauri-apps/api/core'

export interface FontFile {
  name: string
  path: string
}

export function getFontsDir(): Promise<string> {
  return invoke('get_fonts_dir')
}

export function listFonts(): Promise<FontFile[]> {
  return invoke('list_fonts')
}

export function openFolder(path: string): Promise<void> {
  return invoke('open_folder', { path })
}
