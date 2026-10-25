export const help = {
  id: 'solitaire',
  title: 'Solitaire Help',
  contents: [
    {
      id: 'welcome',
      title: 'Playing Solitaire',
      keywords: ['Klondike', 'rules'],
      body: 'Move all 52 cards to the four foundation piles at the upper right. Each pile begins with an Ace and grows in one suit up to the King. You choose where each suit starts.\n\nThe seven columns below form the tableau. Build these columns downward, alternating red and black cards. Move a King into an empty column.\n\nSee [Moving cards](moves), [Drawing cards](draw), and [Scoring](scoring).',
    },
    {
      title: 'How to play',
      topics: [
        {
          id: 'moves',
          title: 'Moving cards',
          keywords: ['drag', 'foundation', 'tableau'],
          body: 'Drag a face-up card onto a card of the next higher rank and the opposite color. You can also drag a complete descending, alternating-color run by its first card. Only a King or a run starting with a King can fill an empty column.\n\nDrag an Ace to any empty foundation. Add the Two of its suit, then the Three, continuing to the King. Double-click a single exposed card to send it to a foundation that can accept it. Enter does the same when a face-up card has keyboard focus.\n\nClick an exposed face-down tableau card to turn it over. The top waste card and the top card of a foundation can move back to a legal tableau position.',
        },
        {
          id: 'draw',
          title: 'Drawing and recycling cards',
          keywords: ['stock', 'waste', 'draw one', 'draw three'],
          body: 'Click the face-down stock at the upper left to turn over one or three cards, according to Options. Only the top face-up waste card is available. Moving it exposes the next card.\n\nWhen the stock is empty, click its green circular arrow to turn the waste over without shuffling. A red cross means that another pass is unavailable.\n\nStandard and None allow repeated passes. Vegas allows one pass in Draw one and three passes in Draw three.',
        },
        {
          id: 'controls',
          title: 'Mouse and keyboard',
          keywords: ['F2', 'Ctrl+Z', 'keyboard'],
          body: 'Press F2 for a new deal. Press Ctrl+Z to undo the last action. Double-click an eligible card to move it to a foundation. Drag a card or run with the left mouse button.\n\nIn Options, use Tab to move between controls, arrows to choose a radio button, and Space to toggle a checkbox. Enter accepts and Esc cancels. Underlined letters work with Alt.\n\nIn Deck, the arrow keys move through the gallery. Space selects the focused back. Enter accepts the selection and Esc keeps the previous back.',
        },
        {
          id: 'strategy',
          title: 'Planning your moves',
          keywords: ['strategy', 'tips'],
          body: 'Try to expose face-down cards in the tableau. An empty column helps only when a King can use it. Compare both possible moves before covering a card that you still need.\n\nA card in a foundation may still be useful on the tableau. Returning it can free a move, although it costs points. In Draw three, removing a waste card changes which cards become accessible on the next pass.',
        },
      ],
    },
    {
      title: 'Scoring',
      topics: [
        {
          id: 'scoring',
          title: 'Choosing a scoring system',
          keywords: ['score', 'None'],
          body: 'Choose Standard, Vegas, or None in Game > Options. Changing the scoring system starts a new deal. None hides the score and lets you play without points.\n\nSee [Standard scoring](standard) and [Vegas scoring](vegas).',
        },
        {
          id: 'standard',
          title: 'Standard scoring',
          keywords: ['points', 'time bonus'],
          body: 'A waste card moved to the tableau earns 5 points. A card added to a foundation earns 10 points. Turning over a tableau card earns 5 points. Returning a foundation card to the tableau costs 15 points. Scores do not fall below zero.\n\nUndo costs 2 points. A timed game costs 2 points for each ten seconds of active play. Recycling in Draw one costs 100 points. In Draw three, the first two recycles are free; later recycles cost 20 points.\n\nWinning a timed game after more than 30 seconds adds a bonus of 700,000 divided by the elapsed seconds, rounded down.',
        },
        {
          id: 'vegas',
          title: 'Vegas scoring and Keep score',
          keywords: ['Vegas', 'Keep score', 'balance'],
          body: 'Each Vegas deal costs $52. Each card added to a foundation returns $5. Taking a foundation card back costs $5. There is no time penalty or winning time bonus.\n\nSelect Keep score to carry the balance into the next deal and later launches. Each new deal subtracts another $52. Without Keep score, each Vegas deal starts at -$52. Keep score is available only while Vegas is selected.\n\nDraw one allows one trip through the stock. Draw three allows three trips.',
        },
      ],
    },
    {
      title: 'Game commands',
      topics: [
        {
          id: 'deal',
          title: 'Deal and Undo',
          keywords: ['new game', 'undo'],
          body: 'Game > Deal or F2 starts a fresh shuffled game using the current options and card back. The current game ends immediately. A new Vegas deal applies the [Keep score](vegas) rule.\n\nGame > Undo or Ctrl+Z reverses the last move, turn, stock draw, or recycle. Only one action can be undone. Undo does not return elapsed time and is unavailable after winning.',
        },
        {
          id: 'options',
          title: 'Options',
          keywords: ['Timed game', 'Status bar', 'Outline dragging'],
          body: 'Draw one turns one stock card at a time. Draw three turns up to three. Scoring chooses Standard, Vegas, or None. Changing the draw mode, scoring system, or timed setting starts a new deal.\n\nTimed game shows the clock and enables the Standard time rules. Status bar shows or hides the panes below the table. Outline dragging moves card outlines instead of the card pictures. Keep score retains the Vegas balance.\n\nOK or Enter saves accepted options for later launches. Cancel or Esc discards changes.',
        },
        {
          id: 'deck',
          title: 'Choosing a card back',
          keywords: ['Deck', 'card back', 'animation'],
          body: 'Choose Game > Deck to see twelve card backs. Click a back or use the arrow keys. Choose OK or press Enter to use it. Cancel or Esc keeps the old back. The accepted back is saved for later games.\n\nRobot, Castle, Sun, and Poker hand have animated frames during timed play. Animations pause while a dialog is open or the game window is inactive or minimized.',
        },
        {
          id: 'help',
          title: 'Help and About',
          keywords: ['Help Topics', 'About', 'Exit'],
          body: 'Help > Help Topics opens this book in Windows Help when the Help viewer is installed. Help > About Solitaire displays product and version information.\n\nGame > Exit closes Solitaire. Accepted options, the card back, and the saved Vegas balance remain available the next time you start the game.',
        },
      ],
    },
  ],
} as const
