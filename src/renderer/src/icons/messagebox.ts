import { messageBox } from './art'
import { pixelArtSet } from './pixel'

export const messageBoxIcons = pixelArtSet(messageBox)

export type MessageBoxIcon = keyof typeof messageBoxIcons
