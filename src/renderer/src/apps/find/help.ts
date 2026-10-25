import type { HelpBook } from '../help/books'

export const help: HelpBook = {
  id: 'find',
  title: 'Find Help',
  contents: [
    {
      id: 'name',
      title: 'Finding files and folders',
      keywords: ['Named', 'wildcards', 'Look in'],
      body: 'Type a name or part of a name in **Named**. Use * for any number of characters, or ? for one character. Separate several patterns with a semicolon, such as *.txt;*.bmp.\n\nChoose the starting folder in **Look in**, or click **Browse**. Select Include subfolders to search its folders too. Click **Find Now**.\n\nDouble-click a result to open it. **Stop** ends the current search and keeps the results. **New Search** clears your criteria and results.\n\nSee [Date filters](dates) or [Advanced filters](advanced).',
    },
    {
      id: 'dates',
      title: 'Date filters',
      keywords: ['Date Modified', 'days', 'months'],
      body: 'Choose **Date Modified** to limit the search to files changed on particular dates. **All files** ignores the date.\n\n**Between** includes both the starting date and the whole ending date. **During the previous** searches back the number of days or months you specify.\n\nThe dates refer to changes in the virtual drive, not to dates of files on the host computer.',
    },
    {
      id: 'advanced',
      title: 'Advanced filters',
      keywords: ['size', 'text', 'type', 'case sensitive'],
      body: '**Of type** limits the search to a file extension, applications, shortcuts, or folders. **Containing text** searches inside file contents. A folder cannot contain matching text.\n\n**Size is** compares the stored file contents in kilobytes. One kilobyte is 1,024 bytes. Folders do not match a size limit.\n\nChoose **Options**, then **Case Sensitive** if uppercase and lowercase must match. All filters apply together.',
    },
  ],
}
