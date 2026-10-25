export const help = {
  id: 'notepad',
  title: 'Notepad Help',
  contents: [
    {
      id: 'editing',
      title: 'Writing and editing text',
      body: 'Type in the document area to write plain text. Select text before choosing Cut, Copy, or Delete from Edit. Paste inserts text at the caret or replaces the selection. Undo reverses an edit. Select All selects the whole document.\n\nWord Wrap displays long lines within the window without inserting line breaks in the file. Time/Date inserts the current time and date. F5 performs the same command.',
      keywords: ['editing', 'clipboard', 'word wrap', 'time', 'date'],
    },
    {
      id: 'files',
      title: 'Opening and saving files',
      body: 'Choose File > New for an empty document or File > Open to read an existing text file on the virtual drive. Save writes changes to the current file. Save As lets you choose a folder and name.\n\nWhen you close a changed document or replace it with another file, choose Yes to save, No to discard the changes, or Cancel to keep editing.',
      keywords: ['open', 'save', 'new'],
    },
    {
      id: 'find',
      title: 'Finding text',
      body: 'Choose Search > Find or press Ctrl+F. Enter the words to find. Match case requires the same capitalization. Choose Up to search toward the beginning or Down to search toward the end.\n\nFind Next selects the next match. You can leave Find open while editing the document. F3 repeats the search. A message appears when there are no more matches in that direction.',
      keywords: ['search', 'direction', 'match case'],
    },
    {
      id: 'printing',
      title: 'Page setup and printing',
      body: 'Choose File > Page Setup to select paper, orientation, margins, a header, and a footer. The default header is &f for the file name. The default footer is Page &p for the page number. OK keeps the settings and Cancel leaves them unchanged.\n\nPrint requires a printer. This desktop has no installed printer, so the Print command reports that a printer must be installed.',
      keywords: ['print', 'paper', 'margins', 'header', 'footer'],
    },
  ],
}
