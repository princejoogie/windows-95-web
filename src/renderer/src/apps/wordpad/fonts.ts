/** The fonts a retail Windows 95 shipped with, as the Font box lists them. Character Map shares this list. */
export const FONTS: readonly string[] = [
  'Arial',
  'Arial Black',
  'Comic Sans MS',
  'Courier New',
  'Fixedsys',
  'Impact',
  'Marlett',
  'MS Sans Serif',
  'MS Serif',
  'Small Fonts',
  'Symbol',
  'System',
  'Tahoma',
  'Times New Roman',
  'Verdana',
  'Webdings',
  'Wingdings',
]

/** Fonts whose glyphs live in the private-use area rather than at their ANSI codes. */
export const SYMBOL_FONTS: ReadonlySet<string> = new Set(['Symbol', 'Wingdings', 'Webdings', 'Marlett'])

export const isSymbolFont = (font: string): boolean => SYMBOL_FONTS.has(font)

export const FONT_SIZES: readonly number[] = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72]

/** What the format bar's Script box offers for each font. */
export const scriptsFor = (font: string): readonly string[] => (isSymbolFont(font) ? ['Symbol'] : ['Western'])
