export function shortcutKey(value: string): string | null {
  return /^[a-z]$/i.test(value) ? value.toUpperCase() : null
}
