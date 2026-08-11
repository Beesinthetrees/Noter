import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent,
  type ReactNode,
} from 'react'
import type { TreeEntry } from '../vault/commands'
import { flattenVisible, TRASH_NAME } from '../vault/tree'
import { useVault } from '../vault/VaultContext'
import { Settings } from './Settings'
import './Sidebar.css'

const DRAG_MIME = 'application/x-noter-paths'

type FolderEntry = TreeEntry & { type: 'folder' }

interface SelectionState {
  selectedPaths: Set<string>
  isExpanded: (path: string) => boolean
  toggleExpand: (path: string) => void
  expand: (path: string) => void
  selectOnly: (path: string) => void
  toggleOne: (path: string) => void
  selectRange: (path: string) => void
  clearSelection: () => void
  draggingPaths: string[] | null
  setDraggingPaths: (paths: string[] | null) => void
  dropTargetPath: string | null
  setDropTargetPath: (path: string | null) => void
}

const SelectionContext = createContext<SelectionState | null>(null)

function useSelection(): SelectionState {
  const ctx = useContext(SelectionContext)
  if (!ctx) throw new Error('useSelection must be used within SelectionProvider')
  return ctx
}

function SelectionProvider({
  notes,
  trash,
  children,
}: {
  notes: TreeEntry[]
  trash: FolderEntry | undefined
  children: ReactNode
}) {
  const { rootDir } = useVault()
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set())
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  const [draggingPaths, setDraggingPaths] = useState<string[] | null>(null)
  const [dropTargetPath, setDropTargetPath] = useState<string | null>(null)
  const anchorRef = useRef<string | null>(null)

  // Old folder paths are meaningless after switching vault root.
  useEffect(() => {
    anchorRef.current = null
    setSelectedPaths(new Set())
    setExpandedPaths(new Set())
  }, [rootDir])

  const isExpanded = useCallback((path: string) => expandedPaths.has(path), [expandedPaths])

  const toggleExpand = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  const expand = useCallback((path: string) => {
    setExpandedPaths((prev) => (prev.has(path) ? prev : new Set(prev).add(path)))
  }, [])

  const selectOnly = useCallback((path: string) => {
    anchorRef.current = path
    setSelectedPaths(new Set([path]))
  }, [])

  const toggleOne = useCallback((path: string) => {
    anchorRef.current = path
    setSelectedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  const selectRange = useCallback(
    (path: string) => {
      const anchor = anchorRef.current
      if (!anchor) {
        selectOnly(path)
        return
      }
      const visible = [
        ...flattenVisible(notes, expandedPaths),
        ...(trash ? flattenVisible([trash], expandedPaths) : []),
      ]
      const from = visible.indexOf(anchor)
      const to = visible.indexOf(path)
      if (from === -1 || to === -1) {
        selectOnly(path)
        return
      }
      const [start, end] = from <= to ? [from, to] : [to, from]
      const range = new Set(visible.slice(start, end + 1))
      // The Trash container itself is never selectable/draggable, even if a
      // range happens to span across it.
      if (trash) range.delete(trash.path)
      setSelectedPaths(range)
    },
    [notes, trash, expandedPaths, selectOnly],
  )

  const clearSelection = useCallback(() => {
    anchorRef.current = null
    setSelectedPaths(new Set())
  }, [])

  return (
    <SelectionContext.Provider
      value={{
        selectedPaths,
        isExpanded,
        toggleExpand,
        expand,
        selectOnly,
        toggleOne,
        selectRange,
        clearSelection,
        draggingPaths,
        setDraggingPaths,
        dropTargetPath,
        setDropTargetPath,
      }}
    >
      {children}
    </SelectionContext.Provider>
  )
}

export function Sidebar() {
  const [hovering, setHovering] = useState(false)
  const { tree } = useVault()

  const notes = tree.filter((entry) => !(entry.type === 'folder' && entry.name === TRASH_NAME))
  const trash = tree.find((entry) => entry.type === 'folder' && entry.name === TRASH_NAME) as
    | FolderEntry
    | undefined

  return (
    <>
      <div className="sidebar-trigger" onMouseEnter={() => setHovering(true)} />
      <SelectionProvider notes={notes} trash={trash}>
        <SidebarPanel hovering={hovering} setHovering={setHovering} notes={notes} trash={trash} />
      </SelectionProvider>
    </>
  )
}

function SidebarPanel({
  hovering,
  setHovering,
  notes,
  trash,
}: {
  hovering: boolean
  setHovering: (value: boolean) => void
  notes: TreeEntry[]
  trash: FolderEntry | undefined
}) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { rootDir, setActiveFolder, newNote, newFolder, movePaths } = useVault()
  const { clearSelection, dropTargetPath, setDropTargetPath, setDraggingPaths } = useSelection()

  const visible = hovering || settingsOpen

  const handleRootDragOver = (event: DragEvent) => {
    event.preventDefault()
    if (rootDir) setDropTargetPath(rootDir)
  }

  const handleRootDragLeave = (event: DragEvent) => {
    const related = event.relatedTarget as Node | null
    if (related && event.currentTarget.contains(related)) return
    setDropTargetPath(null)
  }

  const handleRootDrop = async (event: DragEvent) => {
    event.preventDefault()
    setDropTargetPath(null)
    setDraggingPaths(null)
    const raw = event.dataTransfer.getData(DRAG_MIME)
    if (!raw || !rootDir) return
    const paths: string[] = JSON.parse(raw)
    await movePaths(paths, rootDir)
    clearSelection()
  }

  return (
    <>
      <div
        className={`sidebar${visible ? ' sidebar--visible' : ''}`}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        // Catch-all: accept the drag anywhere in the sidebar so the browser's
        // "not-allowed" cursor doesn't show over non-target rows/empty space.
        // Rows with their own onDragOver/onDrop (folders, Trash, root label)
        // still handle the actual move; dropping anywhere else just no-ops.
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => event.preventDefault()}
      >
        <div className="sidebar__header">
          <span
            className={`tree-row tree-row--root${dropTargetPath === rootDir ? ' tree-row--drop-target' : ''}`}
            onClick={() => {
              setActiveFolder(null)
              clearSelection()
            }}
            onDragOver={handleRootDragOver}
            onDragLeave={handleRootDragLeave}
            onDrop={handleRootDrop}
          >
            Notes
          </span>
          <button type="button" className="sidebar__action" title="New note" onClick={() => newNote()}>
            +
          </button>
          <button type="button" className="sidebar__action" title="New folder" onClick={() => newFolder()}>
            ⊞
          </button>
        </div>
        <div className="sidebar__tree">
          {notes.map((entry, i) => (
            <TreeNode
              key={entry.path}
              entry={entry}
              ancestorLines={[]}
              isLast={i === notes.length - 1}
              isRoot
            />
          ))}
          {trash && (
            <>
              <div
                className="sidebar__divider"
                onDragOver={handleRootDragOver}
                onDragLeave={handleRootDragLeave}
                onDrop={handleRootDrop}
              />
              <TreeNode entry={trash} ancestorLines={[]} isLast isRoot isSystem />
            </>
          )}
        </div>
        <button
          type="button"
          className="sidebar__settings-btn"
          title="Settings"
          onClick={() => setSettingsOpen(true)}
        >
          ⚙
        </button>
      </div>
      {settingsOpen && <Settings onClose={() => setSettingsOpen(false)} />}
    </>
  )
}

function Rails({ ancestorLines, isRoot, isLast }: { ancestorLines: boolean[]; isRoot: boolean; isLast: boolean }) {
  return (
    <>
      {ancestorLines.map((hasLine, i) => (
        <span key={i} className={`rail${hasLine ? ' rail--line' : ''}`} />
      ))}
      {!isRoot && <span className={`rail rail--branch${isLast ? ' rail--branch-last' : ''}`} />}
    </>
  )
}

function TreeNode({
  entry,
  ancestorLines,
  isLast,
  isRoot = false,
  isSystem = false,
}: {
  entry: TreeEntry
  ancestorLines: boolean[]
  isLast: boolean
  isRoot?: boolean
  isSystem?: boolean
}) {
  const {
    currentPath,
    activeFolder,
    setActiveFolder,
    openNote,
    renamePath,
    deletePath,
    deletePaths,
    newNote,
    newFolder,
    movePaths,
  } = useVault()
  const {
    selectedPaths,
    isExpanded,
    toggleExpand,
    expand,
    selectOnly,
    toggleOne,
    selectRange,
    clearSelection,
    setDraggingPaths,
    dropTargetPath,
    setDropTargetPath,
  } = useSelection()
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(entry.name)

  const expanded = isExpanded(entry.path)
  const isSelected = selectedPaths.has(entry.path)
  const childAncestorLines = isRoot ? [] : [...ancestorLines, !isLast]

  const commitRename = () => {
    setEditing(false)
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== entry.name) {
      renamePath(entry.path, trimmed)
    } else {
      setEditValue(entry.name)
    }
  }

  const handleDelete = (event: MouseEvent) => {
    event.stopPropagation()
    if (isSelected && selectedPaths.size > 1) {
      deletePaths([...selectedPaths])
    } else {
      deletePath(entry.path, entry.type)
    }
  }

  const handleRowClick = (event: MouseEvent) => {
    // The Trash container itself is never selectable/draggable - only its
    // contents are (see the equivalent guard in selectRange).
    if (isSystem) {
      toggleExpand(entry.path)
      return
    }
    if (event.shiftKey) {
      selectRange(entry.path)
      return
    }
    if (event.ctrlKey || event.metaKey) {
      toggleOne(entry.path)
      return
    }
    selectOnly(entry.path)
    if (entry.type === 'note') {
      openNote(entry.path)
    } else {
      toggleExpand(entry.path)
      setActiveFolder(entry.path)
    }
  }

  const handleDragStart = (event: DragEvent) => {
    const dragWholeSelection = isSelected && selectedPaths.size > 1
    const paths = dragWholeSelection ? [...selectedPaths] : [entry.path]
    if (!dragWholeSelection) selectOnly(entry.path)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData(DRAG_MIME, JSON.stringify(paths))
    setDraggingPaths(paths)
  }

  const handleDragEnd = () => {
    setDraggingPaths(null)
    setDropTargetPath(null)
  }

  const handleDragOver = (event: DragEvent) => {
    event.preventDefault()
    setDropTargetPath(entry.path)
  }

  const handleDragLeave = (event: DragEvent) => {
    const related = event.relatedTarget as Node | null
    if (related && event.currentTarget.contains(related)) return
    setDropTargetPath(null)
  }

  const handleDrop = async (event: DragEvent) => {
    event.preventDefault()
    setDropTargetPath(null)
    setDraggingPaths(null)
    const raw = event.dataTransfer.getData(DRAG_MIME)
    if (!raw) return
    const paths: string[] = JSON.parse(raw)
    await movePaths(paths, entry.path)
    clearSelection()
  }

  const nameField = editing ? (
    <input
      className="tree-row__input"
      value={editValue}
      autoFocus
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => setEditValue(event.target.value)}
      onBlur={commitRename}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commitRename()
        if (event.key === 'Escape') {
          setEditValue(entry.name)
          setEditing(false)
        }
      }}
    />
  ) : (
    <span
      className="tree-row__label"
      onDoubleClick={(event) => {
        if (isSystem) return
        event.stopPropagation()
        setEditing(true)
      }}
    >
      {entry.name}
    </span>
  )

  if (entry.type === 'note') {
    const isActive = currentPath === entry.path
    const classes = ['tree-row', isActive && 'tree-row--active', isSelected && 'tree-row--selected']
      .filter(Boolean)
      .join(' ')
    return (
      <div className={classes} draggable onDragStart={handleDragStart} onDragEnd={handleDragEnd} onClick={handleRowClick}>
        <Rails ancestorLines={ancestorLines} isRoot={isRoot} isLast={isLast} />
        <div className="tree-row__content">
          {nameField}
          <span className="tree-row__actions">
            <button type="button" className="tree-row__action" title="Delete" onClick={handleDelete}>
              ×
            </button>
          </span>
        </div>
      </div>
    )
  }

  const isActiveFolder = activeFolder === entry.path
  const classes = [
    'tree-row',
    'tree-row--folder',
    isActiveFolder && 'tree-row--active',
    isSelected && 'tree-row--selected',
    dropTargetPath === entry.path && 'tree-row--drop-target',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div>
      <div
        className={classes}
        draggable={!isSystem}
        onDragStart={isSystem ? undefined : handleDragStart}
        onDragEnd={isSystem ? undefined : handleDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleRowClick}
      >
        <Rails ancestorLines={ancestorLines} isRoot={isRoot} isLast={isLast} />
        <div className="tree-row__content">
          <span className="tree-row__chevron">{expanded ? '▾' : '▸'}</span>
          {nameField}
          {!isSystem && (
            <span className="tree-row__actions">
              <button
                type="button"
                className="tree-row__action"
                title="New note here"
                onClick={(event) => {
                  event.stopPropagation()
                  newNote(entry.path)
                  expand(entry.path)
                }}
              >
                +
              </button>
              <button
                type="button"
                className="tree-row__action"
                title="New folder here"
                onClick={(event) => {
                  event.stopPropagation()
                  newFolder(entry.path)
                  expand(entry.path)
                }}
              >
                ⊞
              </button>
              <button type="button" className="tree-row__action" title="Delete" onClick={handleDelete}>
                ×
              </button>
            </span>
          )}
        </div>
      </div>
      {expanded && (
        <div>
          {entry.children.length === 0 ? (
            <div className="tree-row tree-row__empty">
              <Rails ancestorLines={childAncestorLines} isRoot={false} isLast />
              <div className="tree-row__content">empty</div>
            </div>
          ) : (
            entry.children.map((child, i) => (
              <TreeNode
                key={child.path}
                entry={child}
                ancestorLines={childAncestorLines}
                isLast={i === entry.children.length - 1}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}
