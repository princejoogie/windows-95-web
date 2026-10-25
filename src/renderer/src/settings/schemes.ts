export const standardColors = {
  face: '#c0c0c0',
  shadow: '#808080',
  dark: '#000000',
  light: '#dfdfdf',
  hilight: '#ffffff',
  title: '#000080',
  'title-inactive': '#808080',
  select: '#000080',
  tooltip: '#ffffe1',
  text: '#000000',
  'title-text': '#ffffff',
  'inactive-text': '#c0c0c0',
  'select-text': '#ffffff',
  window: '#ffffff',
  'window-text': '#000000',
} satisfies Record<string, string>

export type ThemeColor = keyof typeof standardColors
export type ThemeColors = Record<ThemeColor, string>

function scheme(face: string, title: string, desktop: string, shadow: string, light: string) {
  return {
    desktop,
    colors: {
      ...standardColors,
      face,
      title,
      select: title,
      shadow,
      light,
      'title-inactive': shadow,
      'inactive-text': face,
    },
  }
}

export const schemes = {
  'Windows Standard': scheme('#c0c0c0', '#000080', '#008080', '#808080', '#dfdfdf'),
  Brick: scheme('#c8b8b0', '#800000', '#804040', '#887870', '#e4dcd8'),
  Desert: scheme('#d8d0b8', '#008080', '#a89068', '#908870', '#ece8dc'),
  Eggplant: scheme('#c0b0c8', '#400040', '#400040', '#807088', '#dfd7e3'),
  Lilac: scheme('#c8c0d8', '#604080', '#807098', '#888098', '#e4dfec'),
  Maple: scheme('#d8c8b8', '#804000', '#806040', '#988878', '#ece4dc'),
  Marine: scheme('#b8c8d0', '#000080', '#001048', '#788890', '#dce4e8'),
  Plum: scheme('#d0b8c8', '#600040', '#604058', '#907888', '#e8dce4'),
  Pumpkin: scheme('#d8c0a8', '#804000', '#c07020', '#988068', '#ece0d4'),
  'Rainy Day': scheme('#b8c8c8', '#405868', '#687878', '#788888', '#dce4e4'),
  'Red White and Blue': scheme('#c0c0c0', '#800000', '#000080', '#808080', '#dfdfdf'),
  Rose: scheme('#d8b8b8', '#800040', '#a06070', '#987878', '#ecdcdc'),
  Slate: scheme('#b8c0c8', '#304858', '#607080', '#788088', '#dcdfe4'),
  Spruce: scheme('#b8c8b8', '#004040', '#204838', '#788878', '#dce4dc'),
  Storm: scheme('#b8b8c8', '#000080', '#484868', '#787888', '#dcdce4'),
  Teal: scheme('#b8d0d0', '#004040', '#008080', '#789090', '#dce8e8'),
  Wheat: scheme('#d8d0b8', '#806000', '#a09060', '#989078', '#ece8dc'),
  'High Contrast Black and White': {
    desktop: '#000000',
    colors: {
      ...standardColors,
      face: '#000000',
      shadow: '#ffffff',
      dark: '#ffffff',
      light: '#ffffff',
      hilight: '#ffffff',
      title: '#ffffff',
      'title-inactive': '#000000',
      select: '#ffffff',
      text: '#ffffff',
      'title-text': '#000000',
      'inactive-text': '#ffffff',
      'select-text': '#000000',
      window: '#000000',
      'window-text': '#ffffff',
      tooltip: '#000000',
    },
  },
}

export type SchemeName = keyof typeof schemes
export const schemeNames = Object.keys(schemes).filter((name): name is SchemeName => name in schemes)
export const themeColorNames = Object.keys(standardColors).filter(
  (name): name is ThemeColor => name in standardColors,
)

export interface AppearanceSettings {
  scheme: SchemeName
  colors: Partial<ThemeColors>
}

export function appearanceColors(appearance: AppearanceSettings): ThemeColors {
  return { ...schemes[appearance.scheme].colors, ...appearance.colors }
}

export function schemeProperties(
  appearance: AppearanceSettings,
  desktopColor: string,
): Record<string, string> {
  return Object.fromEntries([
    ...Object.entries(appearanceColors(appearance)).map(([name, value]) => [`--color-${name}`, value]),
    ['--color-desktop', desktopColor],
  ])
}
