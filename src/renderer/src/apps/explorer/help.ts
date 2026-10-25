interface HelpTopic {
  readonly id: string
  readonly title: string
  readonly body: string
  readonly keywords?: readonly string[]
}
interface HelpBook {
  readonly id: string
  readonly title: string
  readonly contents: readonly (
    | HelpTopic
    | { readonly title: string; readonly topics: readonly HelpTopic[] }
  )[]
}
export const help: HelpBook = {
  id: 'explorer',
  title: 'Windows Explorer Help',
  contents: [
    {
      id: 'welcome',
      title: 'Finding your way around',
      keywords: ['Explorer', 'folders', 'My Computer'],
      body: 'Use **My Computer** to open a drive or folder in its own window. Windows Explorer shows your folders in a tree beside their contents. Click a folder in the tree to see what is inside it. Click a plus or minus box to open or close a branch.\n\nPress Backspace or click **Up One Level** to see the parent folder. Use **Tools > Go to** to enter a folder path.\n\nSee [Selecting files](selection), [Moving and copying](clipboard), or [Choosing a view](views).',
    },
    {
      title: 'Working with files',
      topics: [
        {
          id: 'selection',
          title: 'Selecting files and folders',
          keywords: ['select', 'keyboard', 'range'],
          body: 'Click a file to select it. Hold Ctrl while clicking to add or remove a file from the selection. Hold Shift to select a range. Drag on empty space to select items inside a rectangle.\n\nUse the arrow keys to move through the icons. Home and End select the first and last items. Type the first letters of a name to find it. Choose **Edit > Select All** to select every item or **Invert Selection** to reverse your selection.',
        },
        {
          id: 'clipboard',
          title: 'Moving, copying, and making shortcuts',
          keywords: ['copy', 'cut', 'paste', 'shortcut', 'undo'],
          body: 'Select the items, choose **Edit > Cut** or **Copy**, open the destination folder, and choose **Paste**. Ctrl+X, Ctrl+C, and Ctrl+V do the same work. A copy in the same folder receives a name such as Copy of Readme.\n\nDrag files onto another folder or window to move them. Hold Ctrl while dragging to copy. **Paste Shortcut** makes a link to the original item. Deleting a shortcut leaves its target in place.\n\nChoose **Edit > Undo** or press Ctrl+Z to undo the last move, rename, or move to the Recycle Bin.',
        },
        {
          id: 'names',
          title: 'Creating and renaming items',
          keywords: ['new', 'rename', 'extensions'],
          body: 'Choose **File > New > Folder** to create a folder. Enter a name, then press Enter. **New > Text Document** creates a blank document.\n\nSelect an item and press F2 to rename it. Press Esc to keep the old name. When registered extensions are hidden, rename changes the name before the extension. Names cannot contain a backslash, slash, colon, asterisk, question mark, quotation mark, angle bracket, or vertical bar.',
        },
        {
          id: 'properties',
          title: 'Viewing item properties',
          keywords: ['size', 'attributes', 'properties'],
          body: 'Select an item and choose **File > Properties**, or press Alt+Enter. The General page shows its type, location, size, MS-DOS name, dates, and attributes. Click Apply to keep a change without closing the sheet.\n\nRight-click an item to open its menu. Right-click empty space for folder commands.',
        },
        {
          id: 'recycle',
          title: 'Restoring deleted files',
          keywords: ['delete', 'restore', 'Recycle Bin'],
          body: "Press Delete to send selected files to the Recycle Bin. Open the bin to see each item's original location and deletion date. Select an item and choose **File > Restore** to return it.\n\nDeleting from the Recycle Bin or choosing **Empty Recycle Bin** removes the files permanently. Check the names in the confirmation before choosing Yes.\n\nOpen the Recycle Bin's Properties to turn its delete confirmation on or off.",
        },
      ],
    },
    {
      id: 'views',
      title: 'Choosing a view',
      keywords: ['view', 'sort', 'toolbar', 'hidden'],
      body: 'The View menu offers **Large Icons**, **Small Icons**, **List**, and **Details**. Details shows file sizes, types, and dates. Click a column heading to sort by that column; click it again to reverse the order.\n\nUse **Arrange Icons** to sort by name, type, size, or date. **Toolbar** and **Status Bar** show or hide those controls. A folder remembers its view, size, and position.\n\nChoose **View > Options** to show hidden files, show registered file extensions, or browse folders in a single window. F5 refreshes the contents.',
    },
  ],
}
