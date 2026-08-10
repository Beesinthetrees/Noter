import Image from '@tiptap/extension-image'

const MIN_WIDTH = 60

export const NoteImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      path: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-path'),
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.path) return {}
          return { 'data-path': attributes.path }
        },
      },
      width: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const value = element.getAttribute('width')
          return value ? parseInt(value, 10) : null
        },
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.width) return {}
          return { width: attributes.width }
        },
      },
    }
  },

  addNodeView() {
    return ({ node, view, getPos }) => {
      const wrapper = document.createElement('div')
      wrapper.className = 'note-image'

      const img = document.createElement('img')
      img.src = node.attrs.src
      if (node.attrs.alt) img.alt = node.attrs.alt
      if (node.attrs.width) img.style.width = `${node.attrs.width}px`

      const handle = document.createElement('div')
      handle.className = 'note-image__handle'

      wrapper.append(img, handle)

      let startX = 0
      let startWidth = 0

      const onPointerMove = (event: PointerEvent) => {
        const newWidth = Math.max(MIN_WIDTH, Math.round(startWidth + (event.clientX - startX)))
        img.style.width = `${newWidth}px`
      }

      const onPointerUp = () => {
        window.removeEventListener('pointermove', onPointerMove)
        window.removeEventListener('pointerup', onPointerUp)

        const pos = getPos()
        if (typeof pos !== 'number') return
        const currentNode = view.state.doc.nodeAt(pos)
        if (!currentNode) return

        const finalWidth = Math.round(img.getBoundingClientRect().width)
        view.dispatch(
          view.state.tr.setNodeMarkup(pos, undefined, { ...currentNode.attrs, width: finalWidth }),
        )
      }

      handle.addEventListener('pointerdown', (event) => {
        event.preventDefault()
        startX = event.clientX
        startWidth = img.getBoundingClientRect().width
        window.addEventListener('pointermove', onPointerMove)
        window.addEventListener('pointerup', onPointerUp)
      })

      return {
        dom: wrapper,
        update: (updatedNode) => {
          if (updatedNode.type.name !== 'image') return false
          img.src = updatedNode.attrs.src
          img.style.width = updatedNode.attrs.width ? `${updatedNode.attrs.width}px` : ''
          return true
        },
      }
    }
  },
})
