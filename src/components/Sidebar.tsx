import { useState, type MouseEvent } from 'react'
import type { TreeEntry } from '../vault/commands'
import { TRASH_NAME } from '../vault/tree'
import { useVault } from '../vault/VaultContext'
import { Settings } from './Settings'
import './Sidebar.css'

export function Sidebar() {
  const [hovering, setHovering] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { tree, setActiveFolder, newNote, newFolder } = useVault()

  const visible = hovering || settingsOpen

  const notes = tree.filter((entry) => !(entry.type === 'folder' && entry.name === TRASH_NAME))
  const trash = tree.find((entry) => entry.type === 'folder' && entry.name === TRASH_NAME) as
    | (TreeEntry & { type: 'folder' })
    | undefined

  return (
    <>
      <div className="sidebar-trigger" onMouseEnter={() => setHovering(true)} />
      <div
        className={`sidebar${visible ? ' sidebar--visible' : ''}`}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <div className="sidebar__header">
          <span className="tree-row tree-row--root" onClick={() => setActiveFolder(null)}>
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
              <div className="sidebar__divider" />
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
  const { currentPath, activeFolder, setActiveFolder, openNote, renamePath, deletePath, newNote, newFolder } =
    useVault()
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(entry.name)

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
    deletePath(entry.path, entry.type)
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
    return (
      <div className={`tree-row${isActive ? ' tree-row--active' : ''}`} onClick={() => openNote(entry.path)}>
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

  return (
    <div>
      <div
        className={`tree-row tree-row--folder${isActiveFolder ? ' tree-row--active' : ''}`}
        onClick={() => {
          setExpanded((value) => !value)
          if (!isSystem) setActiveFolder(entry.path)
        }}
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
                  setExpanded(true)
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
                  setExpanded(true)
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
