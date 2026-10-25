export type DocumentTemplate = 'text' | 'bitmap' | 'wordpad'
export const documentNames: Record<DocumentTemplate, string> = {
  text: 'New Text Document.txt',
  bitmap: 'New Bitmap Image.bmp',
  wordpad: 'New WordPad Document.doc',
}

export function documentContent(template: DocumentTemplate): string {
  if (template === 'wordpad') return '{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0\\fswiss Arial;}}\\f0\\fs20\\par}'
  if (template === 'text') return ''
  const canvas = document.createElement('canvas')
  canvas.width = 300
  canvas.height = 200
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Cannot create a bitmap document.')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/png')
}
