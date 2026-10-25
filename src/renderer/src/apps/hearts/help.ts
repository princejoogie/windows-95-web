export const help = {
  id: 'hearts',
  title: 'Hearts Help',
  contents: [
    {
      id: 'welcome',
      title: 'Playing Hearts',
      keywords: ['rules', 'objective'],
      body: 'Try to finish with the lowest score. Each heart costs one point. The queen of spades costs thirteen points. Four players each receive thirteen cards.\n\nPlay one card in each trick. The highest card in the suit that started the trick takes all four cards. Aces are high. A card from another suit cannot win.\n\nSee [Passing cards](passing), [Playing a trick](tricks), and [Keeping score](scoring).',
    },
    {
      title: 'How to play',
      topics: [
        {
          id: 'start',
          title: 'Starting a game',
          keywords: ['name', 'dealer', 'network', 'Pauline', 'Michele', 'Ben'],
          body: 'Enter your name in The Microsoft Hearts Network dialog. Choose I want to be dealer, then choose OK. Pauline, Michele, and Ben fill the other seats.\n\nI want to connect to another game looks for a dealer. This computer has no network game available, so that choice reports that no dealer could be found. Return to the dialog and choose to be dealer for a local game.',
        },
        {
          id: 'passing',
          title: 'Passing cards',
          keywords: ['left', 'right', 'across', 'hold'],
          body: 'At the start of the first hand, select three cards and choose Pass to give them to the player on your left. A selected card rises above your hand. Click it again to keep it.\n\nThe second hand passes right. The third passes across the table. The fourth keeps every card. This four-hand cycle repeats. The status bar names the player receiving your cards.\n\nAfter the exchange, the three cards you received are raised. Click the table or press Enter to continue. Passing occurs before the two of clubs leads.',
        },
        {
          id: 'tricks',
          title: 'Playing a trick',
          keywords: ['two of clubs', 'follow suit', 'broken hearts', 'first trick'],
          body: 'The player holding the two of clubs leads it. Play follows the seats around the table. Click one of your cards when the status bar asks for a play.\n\nYou must follow the suit of the first card if you have that suit. If you are out of the suit, you may discard another suit. On the first trick you must avoid hearts and the queen of spades if you have a card without points.\n\nYou cannot lead a heart until someone discards a heart on another suit. This is called breaking hearts. A hand consisting only of hearts may lead one even before hearts break. Playing the queen of spades does not break hearts.\n\nAfter four cards appear, the status bar names the winner. Click to continue. That player leads the next trick. Computer turns pause when Hearts is inactive, minimized, or showing a dialog.',
        },
        {
          id: 'keyboard',
          title: 'Using the keyboard',
          keywords: ['keyboard', 'F2', 'F1', 'Enter'],
          body: 'Use Tab to reach your hand. Left and Right move between cards. Home and End move to the ends of the hand. Space or Enter selects a passing card or plays the focused card.\n\nWhen three cards are selected, Tab to Pass and press Enter. Enter also acknowledges received cards and completed tricks. In dialogs, Tab changes controls, Enter accepts, and Esc cancels when cancellation is available.\n\nF2 starts a new game. F1 opens Hearts Help.',
        },
      ],
    },
    {
      title: 'Scoring and strategy',
      topics: [
        {
          id: 'scoring',
          title: 'Keeping score',
          keywords: ['points', '100', 'score sheet', 'winner'],
          body: 'A captured heart adds one point to your hand score. The captured queen of spades adds thirteen. All other cards count zero. There are twenty-six points in each hand.\n\nThe Score sheet opens after each hand. It lists the points from each hand and the running totals. Choose OK to deal the next hand. Game > Score shows the completed hands at any time.\n\nWhen any total reaches 100 or more, the game ends. The player with the lowest total wins. Equal lowest totals share the win. Choose New Game on the final score sheet to play again.',
        },
        {
          id: 'moon',
          title: 'Shooting the moon',
          keywords: ['moon', '26'],
          body: 'Take all thirteen hearts and the queen of spades in the same hand to shoot the moon. Your score for that hand becomes zero. Each other player receives twenty-six points.\n\nThe Score sheet announces who shot the moon. Taking every trick is unnecessary; collecting all twenty-six points is what matters.',
        },
        {
          id: 'strategy',
          title: 'Planning your play',
          keywords: ['strategy', 'computer players', 'passing'],
          body: 'High spades can force you to take the queen. Passing a dangerous spade or shortening another suit can help you discard points later. Keep low cards that let you play beneath the current winner.\n\nWatch which players cannot follow each suit. A seemingly safe lead can collect many hearts if several players are out of that suit.\n\nIf one player takes most of the hearts, consider taking a point yourself to stop that player from shooting the moon. The computer players pass high-risk cards, discard points when they can, and try to stay beneath the winning card.',
        },
      ],
    },
    {
      title: 'Menu commands',
      topics: [
        {
          id: 'game',
          title: 'The Game menu',
          keywords: ['New Game', 'Score', 'Quit'],
          body: 'New Game or F2 ends the current game after confirmation and opens the player dialog. Score opens the score sheet without changing the hand. Quit closes Hearts.\n\nYour name, computer names, Sound, and Animation settings are retained for later launches. Scores belong to the current game.',
        },
        {
          id: 'options',
          title: 'The Options menu',
          keywords: ['Sound', 'Animation', 'Computer players'],
          body: 'Sound switches card sounds on or off. Animation switches the movement of played cards on or off. Clearing Animation also makes computer turns faster.\n\nComputer players lets you change the three computer player names. Blank names use Pauline, Michele, and Ben. These names do not change the rules or the computer strategy. Choose OK to save or Cancel to keep the old names.',
        },
        {
          id: 'help',
          title: 'The Help menu',
          keywords: ['Help Topics', 'About Hearts'],
          body: 'Help Topics or F1 opens this book in Windows Help when the viewer is installed. About Hearts displays the product name and version.',
        },
      ],
    },
  ],
} as const
