import { marked } from 'marked'
import { generateHTML } from '@tiptap/core'
import type { JSONContent } from '@tiptap/react'
import { join } from '@tauri-apps/api/path'
import { readBytes } from './commands'
import { editorExtensions } from './editorExtensions'

function mimeFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'png':
      return 'image/png'
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'gif':
      return 'image/gif'
    case 'webp':
      return 'image/webp'
    case 'svg':
      return 'image/svg+xml'
    case 'bmp':
      return 'image/bmp'
    default:
      return 'application/octet-stream'
  }
}

export function bytesToBase64(bytes: number[]): string {
  const uint8 = new Uint8Array(bytes)
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < uint8.length; i += chunkSize) {
    binary += String.fromCharCode(...uint8.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

export async function markdownToHtml(markdown: string, rootDir: string): Promise<string> {
  if (!markdown.trim()) return ''
  const rawHtml = marked.parse(markdown, { async: false }) as string
  const parsed = new DOMParser().parseFromString(rawHtml, 'text/html')
  const images = Array.from(parsed.querySelectorAll('img'))

  await Promise.all(
    images.map(async (img) => {
      const src = img.getAttribute('src') ?? ''
      if (!src || src.startsWith('data:') || /^https?:\/\//.test(src)) return
      try {
        const absolutePath = await join(rootDir, src)
        const bytes = await readBytes(absolutePath)
        img.setAttribute('data-path', src)
        img.setAttribute('src', `data:${mimeFromPath(src)};base64,${bytesToBase64(bytes)}`)
      } catch {
        // referenced image file is missing/unreadable - leave the relative src as-is
      }
    }),
  )

  return parsed.body.innerHTML
}

function rewriteImageSrcToPath(node: JSONContent): JSONContent {
  if (node.type === 'image' && node.attrs?.path) {
    return { ...node, attrs: { ...node.attrs, src: node.attrs.path } }
  }
  if (node.content) {
    return { ...node, content: node.content.map(rewriteImageSrcToPath) }
  }
  return node
}

export function docToMarkdown(doc: JSONContent): string {
  return blocksToMarkdown(doc.content ?? [], 0).trim() + '\n'
}

function blocksToMarkdown(nodes: JSONContent[], listDepth: number): string {
  return nodes.map((node) => blockToMarkdown(node, listDepth)).join('\n\n')
}

function blockToMarkdown(node: JSONContent, listDepth: number): string {
  switch (node.type) {
    case 'heading': {
      const level = (node.attrs?.level as number) ?? 1
      return `${'#'.repeat(level)} ${inlineToMarkdown(node.content ?? [])}`
    }
    case 'paragraph':
      return inlineToMarkdown(node.content ?? [])
    case 'image': {
      const path = (node.attrs?.path as string) ?? (node.attrs?.src as string) ?? ''
      const alt = (node.attrs?.alt as string) ?? ''
      const width = node.attrs?.width as number | null | undefined
      // Plain notes stay portable markdown; resized images fall back to an
      // inline <img> tag (standard GFM passthrough) so the width survives reloads.
      if (width) return `<img src="${path}" alt="${alt}" width="${width}" />`
      return `![${alt}](${path})`
    }
    case 'toggle': {
      // GFM has no native collapsible syntax, so a toggle is serialized as a
      // self-contained HTML island (marked passes raw HTML blocks through untouched).
      const exported = { ...node, content: (node.content ?? []).map(rewriteImageSrcToPath) }
      return generateHTML({ type: 'doc', content: [exported] }, editorExtensions)
    }
    case 'blockquote':
      return blocksToMarkdown(node.content ?? [], listDepth)
        .split('\n')
        .map((line) => (line ? `> ${line}` : '>'))
        .join('\n')
    case 'codeBlock': {
      const lang = (node.attrs?.language as string) ?? ''
      const code = (node.content ?? []).map((c) => c.text ?? '').join('')
      return `\`\`\`${lang}\n${code}\n\`\`\``
    }
    case 'bulletList':
      return (node.content ?? []).map((item) => listItemToMarkdown(item, listDepth, '-')).join('\n')
    case 'orderedList': {
      const start = (node.attrs?.start as number) ?? 1
      return (node.content ?? [])
        .map((item, i) => listItemToMarkdown(item, listDepth, `${start + i}.`))
        .join('\n')
    }
    case 'horizontalRule':
      return '---'
    default:
      return inlineToMarkdown(node.content ?? [])
  }
}

function listItemToMarkdown(item: JSONContent, listDepth: number, marker: string): string {
  const indent = '  '.repeat(listDepth)
  const inner = (item.content ?? [])
    .map((child) =>
      child.type === 'bulletList' || child.type === 'orderedList'
        ? blockToMarkdown(child, listDepth + 1)
        : inlineToMarkdown(child.content ?? []),
    )
    .join('\n')
  return inner
    .split('\n')
    .map((line, i) => (i === 0 ? `${indent}${marker} ${line}` : `${indent}  ${line}`))
    .join('\n')
}

function inlineToMarkdown(nodes: JSONContent[]): string {
  return nodes.map(inlineNodeToMarkdown).join('')
}

function inlineNodeToMarkdown(node: JSONContent): string {
  if (node.type === 'hardBreak') return '  \n'
  let text = node.text ?? ''
  for (const mark of node.marks ?? []) {
    switch (mark.type) {
      case 'bold':
        text = `**${text}**`
        break
      case 'italic':
        text = `*${text}*`
        break
      case 'strike':
        text = `~~${text}~~`
        break
      case 'code':
        text = `\`${text}\``
        break
    }
  }
  return text
}
