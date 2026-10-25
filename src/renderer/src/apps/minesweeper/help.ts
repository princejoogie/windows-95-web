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

export const help = {
  id: 'minesweeper',
  title: 'Minesweeper Help',
  contents: [
    {
      id: 'welcome',
      title: 'How to play Minesweeper',
      body: 'Find the safe squares in a field of hidden mines. To win, uncover every square that has no mine. You do not have to put a flag on each mine. Opening a mine ends the game.\n\nStart with [Uncovering squares](uncovering), then learn about [Flags and question marks](marks). For a faster game, try [Opening neighboring squares](chording).',
      keywords: ['rules', 'instructions', 'winning', 'losing'],
    },
    {
      title: 'Playing the game',
      topics: [
        {
          id: 'uncovering',
          title: 'Uncovering squares',
          body: 'Click a covered square with the left mouse button to uncover it. Your first square is safe, but it may have mines beside it.\n\nA number tells you how many mines touch that square, including the diagonals. A blank square has no neighboring mines. Opening a blank also uncovers the connected blanks and the numbers around them.\n\nIf you uncover a mine, the field shows the other mines and crosses out any flags you placed on safe squares. Click the face button or press F2 to [start again](new-game).',
          keywords: ['left button', 'numbers', 'blank', 'first click', 'mine'],
        },
        {
          id: 'marks',
          title: 'Flags and question marks',
          body: 'Right-click a covered square to flag a suspected mine. A flag protects that square from a left click. Right-click it again to change the flag to a question mark, then once more to leave it unmarked.\n\nA question mark is a reminder, not protection. You can uncover a questioned square with the left mouse button.\n\nChoose Marks (?) on the Game menu to turn question marks off. Right-clicking then switches between a flag and an unmarked square. The mine counter subtracts each flag from the total number of mines. It can go below zero if you place too many flags.',
          keywords: ['right button', 'flag', 'question mark', 'Marks', 'counter'],
        },
        {
          id: 'chording',
          title: 'Opening neighboring squares',
          body: 'After you flag all the mines beside an uncovered number, point to that number and press the left and right mouse buttons together. Release them to uncover its unflagged neighbors. You can also use the middle mouse button.\n\nThe number of neighboring flags must match the number in the square. The game checks the count, not whether your flags are correct. A misplaced flag can cause this move to uncover a mine.',
          keywords: ['both buttons', 'middle button', 'chord', 'neighbors'],
        },
        {
          id: 'times',
          title: 'Time and best times',
          body: 'The clock starts when you uncover your first square and stops when you win or uncover a mine. It displays seconds, up to 999. Minesweeper has no points score. A shorter winning time is better.\n\nWin a Beginner, Intermediate, or Expert game faster than the stored record to enter your name. Custom games do not enter the best-times table.\n\nChoose Best Times on the Game menu to see the three records. Reset Scores clears all three names and times. Your records remain available when you next open Minesweeper.',
          keywords: ['scoring', 'clock', 'timer', 'record', 'name', 'Best Times', 'Reset Scores'],
        },
        {
          id: 'strategy',
          title: 'Hints for finding mines',
          body: 'Compare neighboring numbers before making a move. If a number has exactly that many covered neighbors, all those neighbors contain mines. If it already has that many correctly flagged neighbors, the remaining neighbors are safe.\n\nWork along the edge of an open area and compare overlapping groups of squares. Count diagonal neighbors too. Do not treat a flag as proof unless you deduced its position.\n\nSome positions leave more than one possible arrangement of mines. When the numbers cannot distinguish them, you may have to guess.',
          keywords: ['strategy', 'hints', 'deduction', 'guess'],
        },
      ],
    },
    {
      title: 'Game menu commands',
      topics: [
        {
          id: 'new-game',
          title: 'New',
          body: 'Choose New on the Game menu, press F2, or click the face above the field to start a fresh game at the current level. This clears the field and resets the counters. Your previous game cannot be restored.',
          keywords: ['New', 'F2', 'face', 'restart'],
        },
        {
          id: 'levels',
          title: 'Beginner, Intermediate, and Expert',
          body: 'Choose a level on the Game menu to start a field of that size.\n\n**Beginner** has 8 rows, 8 columns, and 10 mines.\n\n**Intermediate** has 16 rows, 16 columns, and 40 mines.\n\n**Expert** has 16 rows, 30 columns, and 99 mines.\n\nTo choose your own dimensions, use [Custom](custom).',
          keywords: ['difficulty', 'Beginner', 'Intermediate', 'Expert', 'size'],
        },
        {
          id: 'custom',
          title: 'Custom',
          body: 'Choose Custom on the Game menu. Enter the height in rows, the width in columns, and the number of mines. Choose OK to start the field or Cancel to keep your current game.\n\nHeight can be 8 through 24. Width can be 8 through 30. There must be at least 10 mines. Entries outside the allowed range are adjusted to fit the field. Custom games do not qualify for [best times](times).',
          keywords: ['Custom', 'height', 'width', 'mines'],
        },
        {
          id: 'display',
          title: 'Marks (?) and Color',
          body: 'Marks (?) controls whether right-clicking cycles through a question mark. See [Flags and question marks](marks).\n\nColor switches the field, face, and counters between color and monochrome artwork. Changing either setting keeps the current field.',
          keywords: ['Color', 'monochrome', 'Marks', 'options'],
        },
        {
          id: 'exit',
          title: 'Best Times and Exit',
          body: 'Best Times opens the [record table](times).\n\nExit closes Minesweeper. Your chosen level, custom dimensions, display settings, and best times are saved. An unfinished field is not saved.',
          keywords: ['Exit', 'close', 'save', 'Best Times'],
        },
      ],
    },
    {
      id: 'help-menu',
      title: 'Help menu commands',
      body: 'Choose Help Topics on the Help menu, or press F1, to open this book. Select a topic in the contents or follow a link to another topic.\n\nAbout Minesweeper displays the product name, version, and copyright information.',
      keywords: ['Help Topics', 'F1', 'About', 'version'],
    },
  ],
} satisfies HelpBook
