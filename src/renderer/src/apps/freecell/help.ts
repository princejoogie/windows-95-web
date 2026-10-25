export const help = {
  id: 'freecell',
  title: 'FreeCell Help',
  contents: [
    {
      id: 'welcome',
      title: 'Playing FreeCell',
      keywords: ['rules', 'object', 'home cells'],
      body: 'Move all 52 cards to the four home cells at the upper right. Start each home cell with an Ace, then add cards of the same suit in order through the King. You can choose which home cell holds each suit. Cards cannot return from home cells.\n\nAll cards are face up in eight columns. The four free cells at the upper left each hold one card temporarily. A card in a free cell remains available to play.\n\nSee [Moving cards](moves), [Moving a column](columns), and [Planning ahead](strategy).',
    },
    {
      title: 'How to play',
      topics: [
        {
          id: 'moves',
          title: 'Moving cards',
          keywords: ['select', 'free cells', 'tableau', 'double-click'],
          body: 'Click an exposed card, then click its destination. Place it on a card one rank higher and of the opposite color. For example, place a black Six on a red Seven. Any card can start an empty column.\n\nClick a free cell to put one exposed card there. Click that card and a destination to return it to play. Double-click an exposed card to send it home when legal, or to an available free cell.\n\nClick a selected card again or press Esc to cancel the selection. Use the arrow keys to move keyboard focus between cards. Enter or Space selects the focused card or destination.',
        },
        {
          id: 'columns',
          title: 'Moving a column',
          keywords: ['sequence', 'supermove', 'empty column'],
          body: 'A sequence descends by one rank at a time and alternates red and black. Click its first card and then the destination. You may also select the exposed card and click another column to move the longest sequence that fits.\n\nA sequence can move only when the same move can be made one card at a time with the available free cells and empty columns. With no spare column, you can move one more card than the number of empty free cells. Each spare empty column doubles that limit. The destination column does not count as a spare.\n\nWhen a sequence can move to an empty column, choose **Move column** to move the sequence or **Move single card** to move only the exposed card. Cancel leaves the cards where they are. Quick play skips this question and moves the sequence.',
        },
        {
          id: 'automatic',
          title: 'Automatic home moves',
          keywords: ['automatic', 'safe', 'foundation'],
          body: 'After each move, FreeCell sends exposed Aces and Twos home when their home cell is ready. Higher cards go home automatically only when the lower cards that might need them are already home.\n\nYou can send a legal card home yourself even when the automatic rule would keep it in play. Take care because cards cannot move back from home cells.\n\n[Undo](undo) restores your last move together with every automatic move that followed it.',
        },
        {
          id: 'strategy',
          title: 'Planning ahead',
          keywords: ['strategy', 'tips'],
          body: 'Look for Aces and low cards before you move. Expose them without filling all four free cells. Each free cell you keep empty gives you more room to move a sequence.\n\nAn empty column can hold a sequence and can help you move longer sequences elsewhere. Try to empty a short column. Before covering a card, check whether you need it to uncover a lower card.\n\nA game number repeats the same deal. Use Restart Game to try another plan, or note the number and return to it with Select Game.',
        },
      ],
    },
    {
      title: 'Game commands',
      topics: [
        {
          id: 'deals',
          title: 'New, Select, and Restart Game',
          keywords: ['F2', 'F3', 'numbered deal', 'restart'],
          body: 'Choose Game > New Game or press F2 for a random numbered deal. Choose Game > Select Game or press F3 and enter a whole number from 1 through 32000. The same number always gives the same arrangement. The title bar shows the current game number.\n\nRestart Game deals the current game again. If you have already made a move, leaving or restarting an unfinished game asks for confirmation and counts as a loss. Cancel keeps the current game. An untouched deal does not count as a loss.',
        },
        {
          id: 'undo',
          title: 'Undo',
          keywords: ['F10', 'reverse'],
          body: 'Choose Game > Undo or press F10 to return to the position before your last move. Automatic home moves made as part of that turn are also reversed. Only the most recent turn can be undone.\n\nUndo is unavailable before the first move, after an undo, or after a win. If no legal moves remain, the message offers Undo or New Game.',
        },
        {
          id: 'statistics',
          title: 'Statistics and scoring',
          keywords: ['F4', 'wins', 'losses', 'streak', 'score'],
          body: 'FreeCell keeps wins and losses instead of a point score or a timer. Choose Game > Statistics or press F4 to see the results for this session, lifetime totals, the percentage won, and winning and losing streaks.\n\nA win counts once when every card reaches a home cell. Leaving a game after making a move counts as a loss when you confirm. Statistics remain available after you close FreeCell.\n\nClear asks for confirmation before resetting both session and saved statistics. No keeps them.',
        },
        {
          id: 'options',
          title: 'Options',
          keywords: ['F5', 'quick play', 'illegal moves'],
          body: 'Choose Game > Options or press F5. **Display messages on illegal moves** shows a message when a move cannot be made. Turning it off dismisses the selection silently. The rules stay the same.\n\n**Quick play** moves an eligible sequence to an empty column without asking whether to move the column or a single card. To move one card with Quick play enabled, move it through a free cell.\n\nChoose OK to save the settings for later games. Cancel or Esc keeps the old settings. In the dialog, Tab moves focus, Space changes a checkbox, and Enter accepts.',
        },
        {
          id: 'keyboard',
          title: 'Keyboard and Help',
          keywords: ['Alt', 'menus', 'F1', 'About', 'Exit'],
          body: 'Press Alt to open the Game menu. Use Left and Right to change menus, Up and Down to choose a command, and Enter to run it. An underlined letter chooses its command. Esc closes the menu. F10 is reserved for Undo.\n\nHelp > Help Topics or F1 opens this book in Windows Help when that viewer is installed. Help > About FreeCell shows the product and version information.\n\nGame > Exit closes FreeCell. If the current game has started, you can keep playing or confirm a loss. Saved options and statistics remain available on the next launch.',
        },
      ],
    },
  ],
} as const
