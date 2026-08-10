import Link from '@tiptap/extension-link'
import StarterKit from '@tiptap/starter-kit'
import { MoveLine } from './moveLine'
import { NoteImage } from './noteImage'
import { NoteTaskItem, NoteTaskList } from './taskList'
import { Toggle, ToggleSummary } from './toggle'

export const editorExtensions = [
  StarterKit,
  NoteImage,
  Toggle,
  ToggleSummary,
  NoteTaskList,
  NoteTaskItem.configure({ nested: true }),
  MoveLine,
  Link.configure({
    openOnClick: false,
    autolink: true,
    linkOnPaste: true,
  }),
]
