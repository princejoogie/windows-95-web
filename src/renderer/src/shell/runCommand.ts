export interface RunCommand {
  readonly target: string
  readonly arguments: readonly string[]
}

export function parseCommand(command: string): RunCommand | null {
  const words: string[] = []
  let word = ''
  let quoted = false
  let started = false
  for (const char of command.trim()) {
    if (char === '"') {
      quoted = !quoted
      started = true
    } else if (/\s/.test(char) && !quoted) {
      if (started) words.push(word)
      word = ''
      started = false
    } else {
      word += char
      started = true
    }
  }
  if (quoted) return null
  if (started) words.push(word)
  const [target, ...args] = words
  return target ? { target, arguments: args } : null
}
