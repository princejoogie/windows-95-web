export const help = {
  id: 'charmap',
  title: 'Character Map Help',
  contents: [
    {
      id: 'overview',
      title: 'What Character Map does',
      body: 'Character Map shows every character a font can draw, so you can put accented letters, symbols, and typographic marks into a document that your keyboard has no key for.\n\nPick a font in the Font box. The table shows its characters in the order of their ANSI codes, from 33 to 255.',
      keywords: ['font', 'table', 'ansi'],
    },
    {
      id: 'select',
      title: 'Selecting and copying characters',
      body: 'Hold the mouse button down on a character to see it magnified. Double-click a character, or click it and then click Select, to add it to Characters to copy. You can also move the highlight with the arrow keys and press Enter.\n\nClick Copy to put the collected characters on the Clipboard, then paste them into WordPad or any other program with Edit > Paste.',
      keywords: ['select', 'copy', 'clipboard', 'magnify', 'paste'],
    },
    {
      id: 'keystroke',
      title: 'Typing a character from the keyboard',
      body: 'The status bar shows the keystroke for the highlighted character. For characters above 127 it reads Alt+0 followed by the code, such as Alt+0169 for the copyright sign. Hold Alt and type the four digits on the numeric keypad with Num Lock on.',
      keywords: ['keystroke', 'alt', 'numeric keypad'],
    },
  ],
}
