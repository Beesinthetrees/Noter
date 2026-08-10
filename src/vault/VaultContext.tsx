import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { basename, dirname, join } from '@tauri-apps/api/path'
import type { Editor } from '@tiptap/react'
import {
  createFolder as createFolderCmd,
  createNote as createNoteCmd,
  defaultRootDir,
  deleteEntry as deleteEntryCmd,
  pathExists,
  readNote,
  readTree,
  renameEntry,
  writeBytes as writeBytesCmd,
  writeNote,
  type TreeEntry,
} from './commands'
import { docToMarkdown, markdownToHtml } from './markdown'
import { extractTitle, findEntry, findFirstNote, sanitizeFilename, TRASH_NAME } from './tree'

const ROOT_DIR_KEY = 'noter:root-dir'
const CURRENT_PATH_KEY = 'noter:current-note-path'
const ATTACHMENTS_DIR_NAME = '.attachments'
const SAVE_DEBOUNCE_MS = 400

async function uniquePath(dir: string, baseName: string, extension: string): Promise<string> {
  let candidate = await join(dir, `${baseName}${extension}`)
  let i = 2
  while (await pathExists(candidate)) {
    candidate = await join(dir, `${baseName} ${i}${extension}`)
    i++
  }
  return candidate
}

async function ensureTrash(root: string): Promise<void> {
  const trashDir = await join(root, TRASH_NAME)
  if (!(await pathExists(trashDir))) {
    await createFolderCmd(trashDir)
  }
}

function isWithin(path: string, dir: string): boolean {
  return path === dir || path.startsWith(`${dir}\\`) || path.startsWith(`${dir}/`)
}

interface VaultState {
  rootDir: string | null
  tree: TreeEntry[]
  currentPath: string | null
  activeFolder: string | null
  setActiveFolder: (path: string | null) => void
  registerEditor: (editor: Editor | null) => void
  openNote: (path: string) => Promise<void>
  newNote: (parentDir?: string) => Promise<void>
  newFolder: (parentDir?: string) => Promise<void>
  renamePath: (path: string, newName: string) => Promise<void>
  deletePath: (path: string, type: 'note' | 'folder') => Promise<void>
  scheduleSave: () => void
  flush: () => void
  changeRootDir: (newRoot: string) => Promise<void>
  saveAttachment: (bytes: number[], extension: string) => Promise<string>
}

const VaultContext = createContext<VaultState | null>(null)

export function useVault(): VaultState {
  const ctx = useContext(VaultContext)
  if (!ctx) throw new Error('useVault must be used within VaultProvider')
  return ctx
}

export function VaultProvider({ children }: { children: ReactNode }) {
  const [rootDir, setRootDir] = useState<string | null>(null)
  const [tree, setTree] = useState<TreeEntry[]>([])
  const [currentPath, setCurrentPath] = useState<string | null>(null)
  const [activeFolder, setActiveFolder] = useState<string | null>(null)

  const editorRef = useRef<Editor | null>(null)
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>(undefined)
  const initStarted = useRef(false)
  const currentPathRef = useRef<string | null>(null)
  const rootDirRef = useRef<string | null>(null)

  const registerEditor = useCallback((editor: Editor | null) => {
    editorRef.current = editor
  }, [])

  const setRoot = useCallback((root: string) => {
    rootDirRef.current = root
    setRootDir(root)
  }, [])

  const refreshTree = useCallback(async (root: string) => {
    const t = await readTree(root)
    setTree(t)
    return t
  }, [])

  const setCurrent = useCallback((path: string) => {
    currentPathRef.current = path
    setCurrentPath(path)
    localStorage.setItem(CURRENT_PATH_KEY, path)
  }, [])

  const flush = useCallback(() => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    const editor = editorRef.current
    const path = currentPathRef.current
    if (!editor || !path) return

    const json = editor.getJSON()
    const markdown = docToMarkdown(json)
    const title = extractTitle(json)
    void writeNote(path, markdown)

    void (async () => {
      const desiredName = sanitizeFilename(title)
      const currentName = (await basename(path)).replace(/\.md$/, '')
      if (desiredName === currentName) return
      const dir = await dirname(path)
      const newPath = await join(dir, `${desiredName}.md`)
      try {
        await renameEntry(path, newPath)
        setCurrent(newPath)
      } catch {
        // name collision - keep the existing filename until it's unique
      }
      if (rootDir) await refreshTree(rootDir)
    })()
  }, [rootDir, refreshTree, setCurrent])

  const scheduleSave = useCallback(() => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(flush, SAVE_DEBOUNCE_MS)
  }, [flush])

  const openNote = useCallback(
    async (path: string) => {
      flush()
      const content = await readNote(path)
      setCurrent(path)
      const root = rootDirRef.current
      if (!root) return
      const html = await markdownToHtml(content, root)
      editorRef.current?.commands.setContent(html)
    },
    [flush, setCurrent],
  )

  useEffect(() => {
    if (initStarted.current) return
    initStarted.current = true

    async function init() {
      let root = localStorage.getItem(ROOT_DIR_KEY)
      if (!root) {
        root = await defaultRootDir()
        localStorage.setItem(ROOT_DIR_KEY, root)
      }
      setRoot(root)
      await ensureTrash(root)
      let t = await refreshTree(root)

      const storedPath = localStorage.getItem(CURRENT_PATH_KEY)
      const existing = storedPath ? findEntry(t, storedPath) : undefined
      let target = existing && existing.type === 'note' ? existing : findFirstNote(t)

      if (!target) {
        const path = await uniquePath(root, 'Untitled', '.md')
        await createNoteCmd(path)
        t = await refreshTree(root)
        target = findEntry(t, path) as (TreeEntry & { type: 'note' }) | undefined
      }

      if (target) await openNote(target.path)
    }

    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const newNote = useCallback(
    async (parentDir?: string) => {
      if (!rootDir) return
      flush()
      const parent = parentDir ?? activeFolder ?? rootDir
      const path = await uniquePath(parent, 'Untitled', '.md')
      await createNoteCmd(path)
      await refreshTree(rootDir)
      setCurrent(path)
      editorRef.current?.commands.setContent('')
      editorRef.current?.commands.focus()
    },
    [rootDir, activeFolder, flush, refreshTree, setCurrent],
  )

  const newFolder = useCallback(
    async (parentDir?: string) => {
      if (!rootDir) return
      const parent = parentDir ?? activeFolder ?? rootDir
      const path = await uniquePath(parent, 'New Folder', '')
      await createFolderCmd(path)
      await refreshTree(rootDir)
    },
    [rootDir, activeFolder, refreshTree],
  )

  const renamePath = useCallback(
    async (path: string, newName: string) => {
      if (!rootDir) return
      const dir = await dirname(path)
      const isNote = path.endsWith('.md')
      const newPath = await join(dir, isNote ? `${sanitizeFilename(newName)}.md` : sanitizeFilename(newName))
      await renameEntry(path, newPath)
      if (path === currentPathRef.current) setCurrent(newPath)
      await refreshTree(rootDir)
    },
    [rootDir, refreshTree, setCurrent],
  )

  const deletePath = useCallback(
    async (path: string, type: 'note' | 'folder') => {
      if (!rootDir) return
      const trashDir = await join(rootDir, TRASH_NAME)
      const alreadyTrashed = isWithin(path, trashDir)

      if (alreadyTrashed) {
        const name = await basename(path)
        if (!window.confirm(`Permanently delete "${name}"? This cannot be undone.`)) return
        await deleteEntryCmd(path)
      } else {
        if (type === 'folder' && !window.confirm(`Delete folder "${await basename(path)}" and everything inside it?`)) {
          return
        }
        const name = await basename(path)
        const dest =
          type === 'note'
            ? await uniquePath(trashDir, name.replace(/\.md$/, ''), '.md')
            : await uniquePath(trashDir, name, '')
        await renameEntry(path, dest)
      }

      const current = currentPathRef.current
      const affectsCurrent = !!current && isWithin(current, path)

      let t = await refreshTree(rootDir)

      if (affectsCurrent) {
        const next = findFirstNote(t)
        if (next) {
          await openNote(next.path)
        } else {
          const newPath = await uniquePath(rootDir, 'Untitled', '.md')
          await createNoteCmd(newPath)
          t = await refreshTree(rootDir)
          setCurrent(newPath)
          editorRef.current?.commands.setContent('')
        }
      }
    },
    [rootDir, refreshTree, openNote, setCurrent],
  )

  const changeRootDir = useCallback(
    async (newRoot: string) => {
      flush()
      localStorage.setItem(ROOT_DIR_KEY, newRoot)
      setRoot(newRoot)
      setActiveFolder(null)
      await ensureTrash(newRoot)
      let t = await refreshTree(newRoot)
      let first = findFirstNote(t)
      if (!first) {
        const path = await uniquePath(newRoot, 'Untitled', '.md')
        await createNoteCmd(path)
        t = await refreshTree(newRoot)
        first = findEntry(t, path) as (TreeEntry & { type: 'note' }) | undefined
      }
      if (first) await openNote(first.path)
    },
    [flush, refreshTree, openNote, setRoot],
  )

  const saveAttachment = useCallback(async (bytes: number[], extension: string): Promise<string> => {
    const root = rootDirRef.current
    if (!root) throw new Error('No root directory set')
    const dir = await join(root, ATTACHMENTS_DIR_NAME)
    await createFolderCmd(dir)
    const path = await uniquePath(dir, `pasted-${Date.now()}`, `.${extension}`)
    await writeBytesCmd(path, bytes)
    return path.slice(root.length + 1).replace(/\\/g, '/')
  }, [])

  return (
    <VaultContext.Provider
      value={{
        rootDir,
        tree,
        currentPath,
        activeFolder,
        setActiveFolder,
        registerEditor,
        openNote,
        newNote,
        newFolder,
        renamePath,
        deletePath,
        scheduleSave,
        flush,
        changeRootDir,
        saveAttachment,
      }}
    >
      {children}
    </VaultContext.Provider>
  )
}
