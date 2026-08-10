import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'

// `marked` renders GFM task list markdown as a plain <ul><li><input type="checkbox"></li></ul> -
// it doesn't know about TipTap's data-type="taskList"/"taskItem" markers. These extensions add a
// fallback parse rule that recognizes that plain shape too, so loaded notes round-trip correctly.

export const NoteTaskList = TaskList.extend({
  parseHTML() {
    return [
      { tag: `ul[data-type="${this.name}"]`, priority: 51 },
      {
        tag: 'ul',
        priority: 60,
        getAttrs: (element) => {
          if (typeof element === 'string') return false
          return element.querySelector(':scope > li > input[type="checkbox"]') ? {} : false
        },
      },
    ]
  },
})

export const NoteTaskItem = TaskItem.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      checked: {
        default: false,
        parseHTML: (element) => {
          const dataChecked = element.getAttribute('data-checked')
          if (dataChecked === '' || dataChecked === 'true') return true
          if (dataChecked === 'false') return false
          const checkbox = element.querySelector(':scope > input[type="checkbox"]')
          return checkbox?.hasAttribute('checked') ?? false
        },
        renderHTML: (attributes) => ({ 'data-checked': attributes.checked }),
      },
    }
  },

  parseHTML() {
    return [
      { tag: `li[data-type="${this.name}"]`, priority: 51 },
      {
        tag: 'li',
        priority: 60,
        getAttrs: (element) => {
          if (typeof element === 'string') return false
          return element.querySelector(':scope > input[type="checkbox"]') ? {} : false
        },
      },
    ]
  },
})
