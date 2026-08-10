import { mergeAttributes, Node } from '@tiptap/core'

export const ToggleSummary = Node.create({
  name: 'toggleSummary',
  content: 'inline*',
  defining: true,

  parseHTML() {
    return [{ tag: 'summary' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['summary', HTMLAttributes, 0]
  },

  addNodeView() {
    return () => {
      const dom = document.createElement('summary')

      const arrow = document.createElement('span')
      arrow.className = 'note-toggle__arrow'
      arrow.contentEditable = 'false'
      arrow.textContent = '▸'
      arrow.addEventListener('mousedown', (event) => {
        event.preventDefault()
        const details = dom.closest('details')
        if (details) details.open = !details.open
      })

      const contentDOM = document.createElement('span')
      contentDOM.className = 'note-toggle__summary-text'

      dom.append(arrow, contentDOM)

      return { dom, contentDOM }
    }
  },
})

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    toggle: {
      setToggle: () => ReturnType
    }
  }
}

export const Toggle = Node.create({
  name: 'toggle',
  group: 'block',
  content: 'toggleSummary block+',
  defining: true,
  isolating: true,

  parseHTML() {
    return [{ tag: 'details' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['details', mergeAttributes(HTMLAttributes, { open: '' }), 0]
  },

  addCommands() {
    return {
      setToggle:
        () =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            content: [{ type: 'toggleSummary', content: [] }, { type: 'paragraph' }],
          }),
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-t': () => this.editor.commands.setToggle(),
    }
  },
})
