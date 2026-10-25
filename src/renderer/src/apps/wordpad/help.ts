export const help = {
  id: 'wordpad',
  title: 'WordPad Help',
  contents: [
    {
      title: 'Working with documents',
      topics: [
        {
          id: 'new',
          title: 'Creating a new document',
          body: 'Choose File > New, or click the New button on the toolbar. Pick Word 6 Document, Rich Text Document, or Text Document. Word 6 and Rich Text documents keep fonts, colors, and paragraph formatting. Text documents hold only the words.\n\nThe title bar shows the document name followed by WordPad. A document you have not saved yet is called Document.',
          keywords: ['new', 'document type', 'word 6', 'rich text', 'text'],
        },
        {
          id: 'open-save',
          title: 'Opening and saving a document',
          body: 'Choose File > Open to read a .doc, .rtf, .wri, or .txt file from the virtual C: drive. Choose File > Save to write it back, or File > Save As to pick another folder, name, or type.\n\nWhen you save a Text Document, WordPad warns that formatting will be lost. Choose Yes to continue or No to keep the current type. The four most recent files appear at the bottom of the File menu.',
          keywords: ['open', 'save', 'save as', 'recent'],
        },
        {
          id: 'print',
          title: 'Printing and previewing',
          body: 'Choose File > Print Preview to see the pages as they would print. Use Next Page, Prev Page, Two Page, Zoom In, and Zoom Out to look around, and Close to return to editing.\n\nFile > Print sends the document to the Generic / Text Only printer on the FILE: port, which asks where to put the printed output. File > Page Setup sets the paper size, orientation, and margins, which also set the width of the ruler.',
          keywords: ['print', 'preview', 'page setup', 'margins', 'paper'],
        },
      ],
    },
    {
      title: 'Formatting',
      topics: [
        {
          id: 'characters',
          title: 'Changing the font and style',
          body: 'Select the text, then use the format bar to pick a font, a size, bold, italic, underline, or a color. Format > Font opens the Font dialog with every setting at once, including strikeout and a sample.\n\nCtrl+B, Ctrl+I, and Ctrl+U toggle bold, italic, and underline.',
          keywords: ['font', 'bold', 'italic', 'underline', 'color', 'size'],
        },
        {
          id: 'paragraphs',
          title: 'Aligning and indenting paragraphs',
          body: 'The alignment buttons set the current paragraphs to the left, center, or right. Format > Paragraph sets the left, right, and first-line indents in the measurement unit chosen in View > Options.\n\nOn the ruler, drag the lower triangle to move the left indent, the upper triangle to move the first-line indent, the small box to move both, and the right triangle to move the right indent.',
          keywords: ['alignment', 'indent', 'ruler', 'paragraph'],
        },
        {
          id: 'tabs',
          title: 'Setting tab stops',
          body: 'Click the ruler where you want a tab stop. Drag a tab stop to move it, or drag it off the ruler to remove it. Format > Tabs lists the stops for the selected paragraphs and lets you type a position, Set it, Clear one, or Clear All.\n\nWithout custom stops, the Tab key moves to the next half inch.',
          keywords: ['tab', 'tab stop', 'ruler'],
        },
        {
          id: 'bullets',
          title: 'Making a bulleted list',
          body: 'Choose Format > Bullet Style or click the Bullets button. Each selected paragraph gets a bullet and a hanging indent. Choose the command again to remove the bullets.',
          keywords: ['bullet', 'list'],
        },
      ],
    },
    {
      title: 'Editing',
      topics: [
        {
          id: 'find',
          title: 'Finding and replacing text',
          body: 'Choose Edit > Find or press Ctrl+F, type the text, and click Find Next. Match whole word only skips matches inside longer words, and Match case requires the same capitals. F3 repeats the last search.\n\nEdit > Replace (Ctrl+H) adds a Replace with box. Replace changes the selected match and finds the next one. Replace All changes every match in the document.',
          keywords: ['find', 'replace', 'search', 'match case', 'whole word'],
        },
        {
          id: 'clipboard',
          title: 'Cutting, copying, and pasting',
          body: 'Cut, Copy, and Paste are on the Edit menu, the toolbar, and Ctrl+X, Ctrl+C, and Ctrl+V. Pasting keeps the formatting of rich text. Edit > Paste Special lets you paste as Unformatted Text instead.\n\nEdit > Undo (Ctrl+Z) reverses the last edit.',
          keywords: ['cut', 'copy', 'paste', 'undo', 'clipboard'],
        },
        {
          id: 'datetime',
          title: 'Inserting the date and time',
          body: 'Choose Insert > Date and Time or click the Date/Time button. Pick a format from the list and click OK. The current date or time is inserted at the caret.',
          keywords: ['date', 'time', 'insert'],
        },
        {
          id: 'options',
          title: 'Changing how WordPad looks',
          body: 'The View menu shows or hides the Toolbar, Format Bar, Ruler, and Status Bar. View > Options remembers these per document type, together with the word wrap setting: No wrap, Wrap to window, or Wrap to ruler. The Options tab chooses the measurement unit for dialogs and the ruler.',
          keywords: ['options', 'toolbar', 'word wrap', 'units', 'view'],
        },
      ],
    },
  ],
}
