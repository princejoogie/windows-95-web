import type { HelpBook } from './books'

export const help: HelpBook = {
  id: 'windows',
  title: 'Windows Help',
  contents: [
    {
      title: 'Introducing Windows',
      topics: [
        {
          id: 'welcome',
          title: 'Welcome to Windows',
          keywords: ['desktop', 'getting started'],
          body: '**Welcome to Windows 95**\n\nYour desktop is the place to start programs and work with files. Double-click My Computer to explore your computer, or click Start to choose a program.\n\nThe [taskbar](popup:taskbar) shows the programs you have open. Click a program button to return to its window.\n\nSee [Starting a program](programs) and [Working with windows](windows).',
        },
        {
          id: 'programs',
          title: 'Starting a program',
          keywords: ['Start menu', 'Run', 'applications'],
          body: 'Click **Start**, point to **Programs**, and choose a program. Accessories contains tools for writing, drawing, and calculations. The Games folder contains Solitaire and Minesweeper.\n\nTo start a program by name, choose **Run** on the Start menu, type its executable name, and press Enter. Try NOTEPAD, CALC, WINMINE, SOL, MSPAINT, WINHLP32, or FIND.\n\nYou can also double-click a document to open the program associated with its file type. See [Working with files](files).',
        },
        {
          id: 'windows',
          title: 'Working with windows',
          keywords: ['minimize', 'maximize', 'close', 'taskbar'],
          body: 'Drag the title bar to move a window. Drag an edge or corner to change its size. Some tools and games have a fixed size.\n\nClick **Minimize** to put a window on the taskbar. Click its taskbar button to bring it back. Click **Maximize** to fill the desktop, then click **Restore** to return to the previous size.\n\nClick the X in the title bar to close a program. Save your work first. [Saving a document](save) explains how.',
        },
        {
          id: 'taskbar',
          title: 'Taskbar',
          keywords: ['switching programs'],
          body: 'The taskbar is the strip at the bottom of the screen. It contains Start, a button for each open window, and the clock. Click a program button to switch to that window. Clicking the active button minimizes it.',
        },
      ],
    },
    {
      title: 'How To...',
      topics: [
        {
          id: 'files',
          title: 'Working with files',
          keywords: ['folders', 'My Computer', 'Explorer'],
          body: 'Double-click **My Computer**, then open the C: drive. Double-click a folder to see its contents. My Documents is a convenient place to save your work.\n\nIn Explorer, select a file before choosing a command. You can rename files, create folders, and move items between folders.\n\nUse [Find](find) when you do not remember where you saved a file. Use the [Recycle Bin](recycle) to recover a deleted item.',
        },
        {
          id: 'save',
          title: 'Saving a document',
          keywords: ['Save As', 'Notepad', 'Paint'],
          body: 'In Notepad or Paint, choose **File**, then **Save**. The first time you save, choose a folder, type a file name, and click **Save**.\n\nChoose **Save As** to keep another copy under a different name. To open an existing document, choose **File**, then **Open**, and select it.\n\nDocuments are stored on this computer in a virtual C: drive. They remain after restarting the desktop. They are separate from files on the host computer.',
        },
        {
          id: 'find',
          title: 'Finding a file or folder',
          keywords: ['search', 'wildcards', 'dates', 'size'],
          body: 'On the Start menu, point to **Find**, then click **Files or Folders**. In **Named**, type all or part of a name. Use * for any number of characters and ? for one character. For example, *.txt finds text files.\n\nChoose a drive or folder in **Look in**. Select **Include subfolders** to search inside its folders. Click **Find Now**. Double-click a result to open it.\n\nUse **Date Modified** to restrict the dates. Use **Advanced** to find text inside a file, choose a type, or set a size limit. **Stop** ends a search and keeps the results already found. **New Search** clears the criteria and results.',
        },
        {
          id: 'recycle',
          title: 'Restoring deleted files',
          keywords: ['Recycle Bin', 'delete', 'restore'],
          body: 'Open **Recycle Bin** on the desktop. Select an item and choose **Restore** to put it back in its original folder.\n\nEmptying the Recycle Bin permanently removes its contents from the virtual drive. Check the items before emptying it.\n\nFind does not search inside the Recycle Bin. Restore a file before searching for it.',
        },
        {
          id: 'using-help',
          title: 'Using Help',
          keywords: ['Contents', 'Index', 'Find', 'Back', 'help'],
          body: 'Choose a book on **Contents**, then double-click a page. **Index** lists keywords. Type the first letters of a keyword, select it, and click **Display**. **Find** searches the words in this Help book.\n\nGreen underlined text opens another topic. Green text with a dotted underline opens a small explanation. Click outside an explanation or press Esc to close it.\n\n**Back** returns to the previous topic. **Help Topics** returns to the list. **Options** lets you change the text size, copy or print the topic, and see your history.\n\nTry opening the [taskbar](popup:taskbar) explanation or reading about [finding files](find).',
        },
      ],
    },
    {
      title: 'Tips and Tricks',
      topics: [
        {
          id: 'keyboard',
          title: 'Using the keyboard',
          keywords: ['shortcuts', 'Tab', 'Enter'],
          body: 'Press **Tab** to move to the next control in a dialog. Press **Shift+Tab** to move back. Press **Enter** to use the selected button and **Esc** to cancel a dialog.\n\nIn a list, use the arrow keys to select an item. In Help Contents, the right arrow opens a book and the left arrow closes it.\n\nIn Notepad, **Ctrl+S** saves your work and **Ctrl+O** opens a file. In Find, **Alt+N** moves to Named and **Alt+F** starts the search.',
        },
        {
          id: 'games',
          title: 'Playing games',
          keywords: ['Minesweeper', 'Solitaire'],
          body: 'Choose **Start**, **Programs**, **Accessories**, then **Games**.\n\nIn Minesweeper, uncover all squares that do not contain mines. Right-click a square to mark a suspected mine. Press **F2** for a new game.\n\nIn Solitaire, build the four suit piles from ace to king. Move cards between columns in alternating colors and descending order.\n\nEach game may include its own Help book with rules and scoring details.',
        },
      ],
    },
    {
      title: 'Troubleshooting',
      topics: [
        {
          id: 'missing-file',
          title: 'I cannot find my document',
          keywords: ['lost files', 'search', 'troubleshooting'],
          body: 'Look in **My Documents** and on the desktop. If you remember part of the name, use [Find](find). Search C: with Include subfolders selected.\n\nCheck the [Recycle Bin](recycle) if you deleted the document. If the document is still open in a program, use Save As to save a copy in My Documents.\n\nThe virtual drive belongs to this desktop profile. A different profile has a different drive.',
        },
        {
          id: 'file-type',
          title: 'A file does not open',
          keywords: ['file types', 'extensions', 'troubleshooting'],
          body: 'A document opens only when a program is associated with its type. Text documents use .txt, and Paint pictures use a supported image extension.\n\nTry starting the program first and choosing **File**, then **Open**. Do not rename a file extension to convert its contents.\n\nFiles in the virtual drive are separate from host files. Network drives and downloads are not available in this build.',
        },
      ],
    },
  ],
}
