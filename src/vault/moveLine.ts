import { Extension } from '@tiptap/core'
import { Fragment, Slice } from '@tiptap/pm/model'
import { Selection, type Command } from '@tiptap/pm/state'

function moveLine(direction: 'up' | 'down'): Command {
  return (state, dispatch) => {
    const { doc, selection } = state
    const { $from } = selection
    if ($from.depth < 1) return false

    const index = $from.index(0)
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= doc.childCount) return false

    const a = Math.min(index, targetIndex)
    const nodeA = doc.child(a)
    const nodeB = doc.child(a + 1)

    // Headings anchor their position - a line can't swap past one, and a
    // heading itself can't be dragged out of place either.
    if (nodeA.type.name === 'heading' || nodeB.type.name === 'heading') return false

    let startA = 0
    for (let i = 0; i < a; i++) startA += doc.child(i).nodeSize

    const from = startA
    const to = startA + nodeA.nodeSize + nodeB.nodeSize

    if (dispatch) {
      const tr = state.tr
      tr.replaceRange(from, to, new Slice(Fragment.from([nodeB, nodeA]), 0, 0))

      const oldNodeStart = index === a ? startA : startA + nodeA.nodeSize
      const newNodeStart = direction === 'up' ? startA : startA + nodeB.nodeSize
      const offset = $from.pos - oldNodeStart
      const newPos = Math.min(newNodeStart + offset, tr.doc.content.size)

      tr.setSelection(Selection.near(tr.doc.resolve(newPos)))
      dispatch(tr)
    }

    return true
  }
}

export const MoveLine = Extension.create({
  name: 'moveLine',

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-ArrowUp': () =>
        this.editor.commands.command(({ state, dispatch }) => moveLine('up')(state, dispatch)),
      'Mod-Shift-ArrowDown': () =>
        this.editor.commands.command(({ state, dispatch }) => moveLine('down')(state, dispatch)),
    }
  },
})
