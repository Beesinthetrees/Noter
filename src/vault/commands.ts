import { invoke } from '@tauri-apps/api/core'

export type TreeEntry =
  | { type: 'folder'; name: string; path: string; children: TreeEntry[] }
  | { type: 'note'; name: string; path: string }

export function readTree(root: string): Promise<TreeEntry[]> {
  return invoke('read_tree', { root })
}

export function readNote(path: string): Promise<string> {
  return invoke('read_note', { path })
}

export function writeNote(path: string, content: string): Promise<void> {
  return invoke('write_note', { path, content })
}

export function createNote(path: string): Promise<void> {
  return invoke('create_note', { path })
}

export function createFolder(path: string): Promise<void> {
  return invoke('create_folder', { path })
}

export function renameEntry(from: string, to: string): Promise<void> {
  return invoke('rename_entry', { from, to })
}

export function deleteEntry(path: string): Promise<void> {
  return invoke('delete_entry', { path })
}

export function pathExists(path: string): Promise<boolean> {
  return invoke('path_exists', { path })
}

export function defaultRootDir(): Promise<string> {
  return invoke('default_root_dir')
}

export function readBytes(path: string): Promise<number[]> {
  return invoke('read_bytes', { path })
}

export function writeBytes(path: string, bytes: number[]): Promise<void> {
  return invoke('write_bytes', { path, bytes })
}
