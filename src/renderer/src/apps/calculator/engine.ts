export type Operator = '+' | '-' | '*' | '/'
export type Key =
  | Operator
  | 'equals'
  | 'decimal'
  | 'sign'
  | 'sqrt'
  | 'percent'
  | 'reciprocal'
  | 'clear'
  | 'clearEntry'
  | 'back'
  | 'MC'
  | 'MR'
  | 'MS'
  | 'M+'
export type Action =
  | { kind: 'digit'; digit: string }
  | { kind: 'key'; key: Key }
  | { kind: 'paste'; text: string }
type Calculation =
  | { kind: 'idle' }
  | { kind: 'pending'; left: number; operator: Operator }
  | { kind: 'repeat'; right: number; operator: Operator }
export interface Calculator {
  display: string
  entry: 'typing' | 'replace' | 'waiting' | 'error'
  calculation: Calculation
  memory: number
}

export const initialCalculator: Calculator = {
  display: '0',
  entry: 'replace',
  calculation: { kind: 'idle' },
  memory: 0,
}

function formatted(value: number): string {
  return Number(value.toPrecision(15)).toString()
}

function result(state: Calculator, value: number): Calculator {
  return Number.isFinite(value)
    ? { ...state, display: formatted(value), entry: 'replace' }
    : { ...state, display: 'Result of function is undefined', entry: 'error' }
}

function calculate(state: Calculator, left: number, operator: Operator, right: number): Calculator {
  if (operator === '/' && right === 0) {
    return {
      ...state,
      display: left === 0 ? 'Result of function is undefined' : 'Cannot divide by zero',
      entry: 'error',
    }
  }
  switch (operator) {
    case '+':
      return result(state, left + right)
    case '-':
      return result(state, left - right)
    case '*':
      return result(state, left * right)
    case '/':
      return result(state, left / right)
  }
}

export function reduceCalculator(state: Calculator, action: Action): Calculator {
  if (action.kind === 'paste') {
    const text = action.text.trim().replaceAll(',', '')
    if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(text) || !Number.isFinite(Number(text)))
      return state
    return {
      ...state,
      display: formatted(Number(text)),
      entry: 'replace',
      calculation: state.calculation.kind === 'repeat' ? { kind: 'idle' } : state.calculation,
    }
  }
  if (action.kind === 'digit') {
    if (!/^\d$/.test(action.digit) || state.entry === 'error') return state
    const display =
      state.entry !== 'typing' || state.display === '0' ? action.digit : state.display + action.digit
    if (display.replace(/[-.]/g, '').length > 15) return state
    return {
      ...state,
      display,
      entry: 'typing',
      calculation: state.calculation.kind === 'repeat' ? { kind: 'idle' } : state.calculation,
    }
  }
  const key = action.key
  if (key === 'clear') return { ...initialCalculator, memory: state.memory }
  if (key === 'MC') return { ...state, memory: 0 }
  if (key === 'clearEntry') return { ...state, display: '0', entry: 'replace' }
  if (key === 'MR') return { ...state, display: formatted(state.memory), entry: 'replace' }
  if (state.entry === 'error') return state
  const value = Number(state.display)
  switch (key) {
    case 'MS':
      return { ...state, memory: value, entry: 'replace' }
    case 'M+':
      return Number.isFinite(state.memory + value)
        ? { ...state, memory: state.memory + value, entry: 'replace' }
        : state
    case 'back':
      return state.entry === 'typing'
        ? { ...state, display: state.display.slice(0, -1).replace(/^-$|^$/, '0') }
        : state
    case 'decimal': {
      const display = state.entry !== 'typing' ? '0' : state.display
      return {
        ...state,
        display: display.includes('.') ? display : `${display}.`,
        entry: 'typing',
        calculation: state.calculation.kind === 'repeat' ? { kind: 'idle' } : state.calculation,
      }
    }
    case 'sign':
      return {
        ...state,
        display:
          value === 0 ? '0' : state.display.startsWith('-') ? state.display.slice(1) : `-${state.display}`,
      }
    case 'sqrt':
      return value < 0
        ? { ...state, display: 'Invalid input for function', entry: 'error' }
        : result(state, Math.sqrt(value))
    case 'reciprocal':
      return calculate(state, 1, '/', value)
    case 'percent':
      return result(state, state.calculation.kind === 'pending' ? (state.calculation.left * value) / 100 : 0)
    case 'equals': {
      const calc = state.calculation
      if (calc.kind === 'idle') return { ...state, entry: 'replace' }
      const right = calc.kind === 'repeat' ? calc.right : value
      const next = calculate(state, calc.kind === 'repeat' ? value : calc.left, calc.operator, right)
      return { ...next, calculation: { kind: 'repeat', operator: calc.operator, right } }
    }
    case '+':
    case '-':
    case '*':
    case '/': {
      const calc = state.calculation
      const next =
        calc.kind === 'pending' && state.entry !== 'waiting'
          ? calculate(state, calc.left, calc.operator, value)
          : state
      if (next.entry === 'error') return next
      return {
        ...next,
        entry: 'waiting',
        calculation: { kind: 'pending', left: Number(next.display), operator: key },
      }
    }
  }
}

export function keyboardAction(key: string): Action | undefined {
  if (/^\d$/.test(key)) return { kind: 'digit', digit: key }
  switch (key) {
    case '+':
    case '-':
    case '*':
    case '/':
      return { kind: 'key', key }
    case 'Enter':
    case '=':
      return { kind: 'key', key: 'equals' }
    case '.':
    case ',':
      return { kind: 'key', key: 'decimal' }
    case 'Escape':
      return { kind: 'key', key: 'clear' }
    case 'Delete':
      return { kind: 'key', key: 'clearEntry' }
    case 'Backspace':
      return { kind: 'key', key: 'back' }
    case '%':
      return { kind: 'key', key: 'percent' }
    case 'F9':
      return { kind: 'key', key: 'sign' }
    case '@':
      return { kind: 'key', key: 'sqrt' }
  }
}
