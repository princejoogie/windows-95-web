import { PALETTE, pixelArt } from '../../icons/pixel'

const COLORS = { ...PALETTE, n: '#8a5a34', d: '#5a3a22', e: '#ffb020', f: '#e05010', t: '#e8e0c8' }

/** A horned demon head over a ring of fire. */
export const icon = pixelArt(
  [
    '................................',
    '.....t......................t...',
    '.....tt....................tt...',
    '......tt..................tt....',
    '......ttt................ttt....',
    '.......ttt..............ttt.....',
    '........ttdddddddddddddtt.......',
    '........ddnnnnnnnnnnnnndd.......',
    '.......dnnnnnnnnnnnnnnnnnd......',
    '......dnnnnnnnnnnnnnnnnnnnd.....',
    '......dnnddddnnnnnnnddddnnd.....',
    '......dnneeeednnnnndeeeennd.....',
    '......dnndeeednnnnndeeednnd.....',
    '......dnnnddddnnnnnddddnnnd.....',
    '......dnnnnnnnnnddnnnnnnnnd.....',
    '.......dnnnnnnnddddnnnnnnd......',
    '.......dnnnnnnnnnnnnnnnnnd......',
    '.......dnnkkkkkkkkkkkkknnd......',
    '........dnktktktktktktknd.......',
    '........dnkkkkkkkkkkkkknd.......',
    '.........dnktktktktktknd........',
    '..........dnnnnnnnnnnnd.........',
    '...........ddnnnnnnndd..........',
    '....f........ddddddd........f...',
    '...ff.f....................f.ff.',
    '..ffeff..f..f.....f...f...ffeff.',
    '..feyeff.ff.ff...ff..ff..ffeyef.',
    '.ffeyyefffeffeff.ffeffefffeyyeff',
    '.feyyyyeffeyeeffffeyeeffeyyyyeff',
    'ffeyyyyyeeyyyeeffeyyyeeeyyyyyyef',
    'feyyyyyyyyyyyyyeeyyyyyyyyyyyyyye',
    'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  ],
  COLORS,
)

export const smallIcon = pixelArt(
  [
    '..t..........t..',
    '..tt........tt..',
    '...tddddddddt...',
    '..dnnnnnnnnnnd..',
    '..dnddnnnnddnd..',
    '..dneednndeend..',
    '..dnnnnddnnnnd..',
    '...dnnnnnnnnd...',
    '...dnkkkkkknd...',
    '...dnktktktnd...',
    '....dnkkkknd....',
    '.....dddddd.....',
    '.f..........f.f.',
    'ffef.f.ff.f.fef.',
    'feyefefeefefeyef',
    'kkkkkkkkkkkkkkkk',
  ],
  COLORS,
)
