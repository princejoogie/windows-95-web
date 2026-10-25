export type Operator = '+' | '-' | '*' | '/' | 'power' | 'root' | 'mod' | 'and' | 'or' | 'xor' | 'lsh' | 'rsh'
export type NumberBase = 2 | 8 | 10 | 16
export type Angle = 'degrees' | 'radians' | 'grads'
export type WordSize = 8 | 16 | 32
export type ScientificKey =
  | 'sin'
  | 'cos'
  | 'tan'
  | 'ln'
  | 'log'
  | 'square'
  | 'cube'
  | 'factorial'
  | 'pi'
  | 'int'
  | 'not'
  | 'dms'
  | 'exp'
  | 'open'
  | 'close'
  | 'FE'
  | 'Dat'
  | 'Ave'
  | 'Sum'
  | 's'
export const decimalOnly: readonly Key[] = [
  'FE',
  'dms',
  'exp',
  'ln',
  'sin',
  'cos',
  'tan',
  'power',
  'log',
  'cube',
  'square',
  'factorial',
  'decimal',
  'pi',
  'reciprocal',
  'int',
  'Ave',
  'Sum',
  's',
  'Dat',
]
export type Key =
  | Operator
  | ScientificKey
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
  | { kind: 'view'; view: 'standard' | 'scientific' }
  | { kind: 'base'; base: NumberBase }
  | { kind: 'angle'; angle: Angle }
  | { kind: 'word'; bits: WordSize }
  | { kind: 'toggle'; option: 'inverse' | 'hyperbolic' }
  | { kind: 'statistics'; command: 'clear' }
  | { kind: 'statistics'; command: 'delete'; id: number }
  | { kind: 'statistics'; command: 'load'; id: number }
interface Term {
  left: number
  operator: Operator
}
type Calculation =
  | { kind: 'idle' }
  | { kind: 'pending'; left: number; operator: Operator }
  | { kind: 'repeat'; right: number; operator: Operator }
export interface Calculator {
  display: string
  entry: 'typing' | 'replace' | 'waiting' | 'error'
  calculation: Calculation
  memory: number
  view: 'standard' | 'scientific'
  base: NumberBase
  angle: Angle
  bits: WordSize
  inverse: boolean
  hyperbolic: boolean
  exponential: boolean
  terms: readonly Term[]
  parentheses: readonly (readonly Term[])[]
  samples: readonly { id: number; value: number }[]
}

export const initialCalculator: Calculator = {
  display: '0',
  entry: 'replace',
  calculation: { kind: 'idle' },
  memory: 0,
  view: 'standard',
  base: 10,
  angle: 'degrees',
  bits: 32,
  inverse: false,
  hyperbolic: false,
  exponential: false,
  terms: [],
  parentheses: [],
  samples: [],
}

function formatted(value: number): string {
  return Number(value.toPrecision(15)).toString()
}

function result(state: Calculator, value: number): Calculator {
  return Number.isFinite(value)
    ? {
        ...state,
        display:
          state.base === 10
            ? formatted(value)
            : integer(value, state.bits).toString(state.base).toUpperCase(),
        entry: 'replace',
      }
    : { ...state, display: 'Result of function is undefined', entry: 'error' }
}

export function displayValue(state: Calculator): number {
  return state.base === 10 ? Number(state.display) : Number.parseInt(state.display, state.base)
}

function integer(value: number, bits: WordSize): bigint {
  return BigInt.asUintN(bits, BigInt(Math.trunc(value)))
}

export function displayText(state: Calculator): string {
  if (state.entry === 'error' || state.base !== 10) return state.display
  if (state.exponential && state.entry !== 'typing') return displayValue(state).toExponential(14)
  return /[.e]/i.test(state.display) ? state.display : `${state.display}.`
}

function invalid(state: Calculator): Calculator {
  return { ...state, display: 'Invalid input for function', entry: 'error', inverse: false }
}

function calculate(state: Calculator, left: number, operator: Operator, right: number): Calculator {
  if ((operator === '/' || operator === 'mod') && right === 0) {
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
    case 'power':
      return result(state, left ** right)
    case 'root':
      return result(state, left < 0 && right % 2 !== 0 ? -((-left) ** (1 / right)) : left ** (1 / right))
    case 'mod':
      return result(state, left % right)
    case 'and':
      return result(state, Number(integer(left, state.bits) & integer(right, state.bits)))
    case 'or':
      return result(state, Number(integer(left, state.bits) | integer(right, state.bits)))
    case 'xor':
      return result(state, Number(integer(left, state.bits) ^ integer(right, state.bits)))
    case 'lsh':
      return result(
        state,
        Number(BigInt.asUintN(state.bits, integer(left, state.bits) << BigInt(Math.trunc(right) & 31))),
      )
    case 'rsh':
      return result(state, Number(integer(left, state.bits) >> BigInt(Math.trunc(right) & 31)))
  }
}

const precedence: Record<Operator, number> = {
  or: 1,
  xor: 2,
  and: 3,
  lsh: 4,
  rsh: 4,
  '+': 5,
  '-': 5,
  '*': 6,
  '/': 6,
  mod: 6,
  power: 7,
  root: 7,
}

function finishExpression(state: Calculator): Calculator {
  let next = state
  for (const term of [...state.terms].reverse()) {
    const right = displayValue(next)
    next = calculate(next, term.left, term.operator, right)
    if (next.entry === 'error') break
    next = { ...next, calculation: { kind: 'repeat', operator: term.operator, right } }
  }
  return { ...next, terms: [] }
}

function scientific(state: Calculator, key: ScientificKey): Calculator {
  const value = displayValue(state)
  const next = { ...state, inverse: false }
  const angle = state.angle === 'degrees' ? Math.PI / 180 : state.angle === 'grads' ? Math.PI / 200 : 1
  switch (key) {
    case 'FE':
      return { ...state, exponential: !state.exponential }
    case 'open':
      return {
        ...state,
        terms: [],
        parentheses: [...state.parentheses, state.terms],
        display: '0',
        entry: 'waiting',
        calculation: { kind: 'idle' },
      }
    case 'close': {
      const outer = state.parentheses.at(-1)
      if (!outer) return state
      return {
        ...finishExpression(state),
        terms: outer,
        parentheses: state.parentheses.slice(0, -1),
        calculation: { kind: 'idle' },
      }
    }
    case 'exp':
      return state.base !== 10 || /e/i.test(state.display)
        ? state
        : { ...state, display: `${state.entry === 'waiting' ? '1' : state.display}e+0`, entry: 'typing' }
    case 'pi':
      return result(next, Math.PI)
    case 'square':
      return value < 0 && state.inverse
        ? invalid(next)
        : result(next, state.inverse ? Math.sqrt(value) : value ** 2)
    case 'cube':
      return result(next, state.inverse ? Math.cbrt(value) : value ** 3)
    case 'ln':
      return !state.inverse && value <= 0
        ? invalid(next)
        : result(next, state.inverse ? Math.exp(value) : Math.log(value))
    case 'log':
      return !state.inverse && value <= 0
        ? invalid(next)
        : result(next, state.inverse ? 10 ** value : Math.log10(value))
    case 'int':
      return result(next, state.inverse ? value - Math.trunc(value) : Math.trunc(value))
    case 'not':
      return result(next, Number(BigInt.asUintN(state.bits, ~integer(value, state.bits))))
    case 'factorial': {
      if (value < 0 || value > 170 || !Number.isInteger(value)) return invalid(next)
      let product = 1
      for (let n = 2; n <= value; n++) product *= n
      return result(next, product)
    }
    case 'dms': {
      const absolute = Math.abs(value)
      const whole = Math.trunc(absolute)
      const minutes = (absolute - whole) * (state.inverse ? 100 : 60)
      const fraction = state.inverse
        ? Math.trunc(minutes + 1e-9) / 60 + ((minutes - Math.trunc(minutes + 1e-9)) * 100) / 3600
        : Math.trunc(minutes + 1e-9) / 100 + ((minutes - Math.trunc(minutes + 1e-9)) * 60) / 10000
      return result(next, Math.sign(value) * (whole + fraction))
    }
    case 'sin':
    case 'cos':
    case 'tan': {
      if (!state.hyperbolic && !state.inverse && key === 'tan' && Math.abs(Math.cos(value * angle)) < 1e-15)
        return invalid(next)
      const functions = state.hyperbolic
        ? state.inverse
          ? { sin: Math.asinh, cos: Math.acosh, tan: Math.atanh }
          : { sin: Math.sinh, cos: Math.cosh, tan: Math.tanh }
        : state.inverse
          ? { sin: Math.asin, cos: Math.acos, tan: Math.atan }
          : { sin: Math.sin, cos: Math.cos, tan: Math.tan }
      const input = state.hyperbolic || state.inverse ? value : value * angle
      const answer = functions[key](input) / (!state.hyperbolic && state.inverse ? angle : 1)
      return Number.isNaN(answer) ? invalid(next) : result(next, Math.abs(answer) < 1e-15 ? 0 : answer)
    }
    case 'Dat':
      return {
        ...state,
        samples: [...state.samples, { id: (state.samples.at(-1)?.id ?? 0) + 1, value }],
        entry: 'replace',
      }
    case 'Ave':
    case 'Sum':
    case 's': {
      const samples = state.samples.map((sample) => sample.value)
      if (!samples.length || (key === 's' && !state.inverse && samples.length < 2)) return invalid(next)
      const sum = samples.reduce((total, sample) => total + sample, 0)
      const squares = samples.reduce((total, sample) => total + sample * sample, 0)
      if (key === 'Sum') return result(next, state.inverse ? squares : sum)
      if (key === 'Ave') return result(next, (state.inverse ? squares : sum) / samples.length)
      const mean = sum / samples.length
      const variance = samples.reduce((total, sample) => total + (sample - mean) ** 2, 0)
      return result(next, Math.sqrt(variance / (samples.length - (state.inverse ? 0 : 1))))
    }
  }
}

export function reduceCalculator(state: Calculator, action: Action): Calculator {
  if (action.kind === 'view')
    return { ...initialCalculator, view: action.view, memory: state.memory, samples: state.samples }
  if (action.kind === 'angle') return { ...state, angle: action.angle }
  if (action.kind === 'toggle') return { ...state, [action.option]: !state[action.option] }
  if (action.kind === 'statistics') {
    if (action.command === 'load') {
      const sample = state.samples.find((sample) => sample.id === action.id)
      return sample ? result(state, sample.value) : state
    }
    return {
      ...state,
      samples: action.command === 'clear' ? [] : state.samples.filter((sample) => sample.id !== action.id),
    }
  }
  if (action.kind === 'base' || action.kind === 'word') {
    if (state.entry === 'error') return state
    const next = action.kind === 'base' ? { ...state, base: action.base } : { ...state, bits: action.bits }
    return result(
      next,
      next.base === 10 ? displayValue(state) : Number(integer(displayValue(state), next.bits)),
    )
  }
  if (action.kind === 'paste') {
    const text = action.text.trim().replaceAll(',', '')
    if (state.base !== 10) {
      if (
        ![...text.toUpperCase()].every(
          (digit) => /^[0-9A-F]$/.test(digit) && Number.parseInt(digit, 16) < state.base,
        ) ||
        !text
      )
        return state
      return result(
        { ...state, calculation: state.calculation.kind === 'repeat' ? { kind: 'idle' } : state.calculation },
        Number.parseInt(text, state.base),
      )
    }
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
    if (
      !/^[0-9A-F]$/i.test(action.digit) ||
      Number.parseInt(action.digit, 16) >= state.base ||
      state.entry === 'error'
    )
      return state
    const digit = action.digit.toUpperCase()
    const display =
      state.entry !== 'typing' || state.display === '0'
        ? digit
        : /e[+-]0$/i.test(state.display)
          ? state.display.slice(0, -1) + digit
          : state.display + digit
    if (
      state.base === 10
        ? display.replace(/e.*$/i, '').replace(/[-.]/g, '').length > 15
        : Number.parseInt(display, state.base) > Number((1n << BigInt(state.bits)) - 1n)
    )
      return state
    if (state.base === 10 && !Number.isFinite(Number(display))) return result(state, Number(display))
    return {
      ...state,
      display,
      entry: 'typing',
      calculation: state.calculation.kind === 'repeat' ? { kind: 'idle' } : state.calculation,
    }
  }
  const key = action.key
  if (key === 'clear')
    return {
      ...state,
      display: '0',
      entry: 'replace',
      calculation: { kind: 'idle' },
      terms: [],
      parentheses: [],
      inverse: false,
    }
  if (key === 'MC') return { ...state, memory: 0 }
  if (key === 'clearEntry') return { ...state, display: '0', entry: 'replace' }
  if (key === 'MR') return result(state, state.memory)
  if (state.entry === 'error') return state
  if (state.base !== 10 && decimalOnly.includes(key)) return state
  const value = displayValue(state)
  switch (key) {
    case 'MS':
      return { ...state, memory: value, entry: state.entry === 'waiting' ? 'waiting' : 'replace' }
    case 'M+':
      return Number.isFinite(state.memory + value)
        ? { ...state, memory: state.memory + value, entry: state.entry === 'waiting' ? 'waiting' : 'replace' }
        : state
    case 'back':
      return state.entry === 'typing'
        ? {
            ...state,
            display: state.display
              .slice(0, -1)
              .replace(/e[+-]?$/i, '')
              .replace(/^-$|^$/, '0'),
          }
        : state
    case 'decimal': {
      if (state.base !== 10 || (state.entry === 'typing' && /e/i.test(state.display))) return state
      const display = state.entry !== 'typing' ? '0' : state.display
      return {
        ...state,
        display: display.includes('.') ? display : `${display}.`,
        entry: 'typing',
        calculation: state.calculation.kind === 'repeat' ? { kind: 'idle' } : state.calculation,
      }
    }
    case 'sign':
      if (/e[+-]/i.test(state.display) && state.entry === 'typing')
        return {
          ...state,
          display: state.display.replace(/e([+-])/i, (_, sign) => (sign === '+' ? 'e-' : 'e+')),
        }
      if (state.base !== 10) return result(state, -value)
      return {
        ...state,
        entry: state.entry === 'waiting' ? 'replace' : state.entry,
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
      if (state.view === 'scientific' && (state.terms.length || state.parentheses.length)) {
        let next = state
        while (next.parentheses.length && next.entry !== 'error') next = scientific(next, 'close')
        return finishExpression(next)
      }
      const calc = state.calculation
      if (calc.kind === 'idle') return { ...state, entry: 'replace' }
      const right = calc.kind === 'repeat' ? calc.right : value
      const next = calculate(state, calc.kind === 'repeat' ? value : calc.left, calc.operator, right)
      return { ...next, calculation: { kind: 'repeat', operator: calc.operator, right } }
    }
    case '+':
    case '-':
    case '*':
    case '/':
    case 'power':
    case 'root':
    case 'mod':
    case 'and':
    case 'or':
    case 'xor':
    case 'lsh':
    case 'rsh': {
      const operator =
        state.inverse && key === 'power' ? 'root' : state.inverse && key === 'lsh' ? 'rsh' : key
      if (state.view === 'scientific') {
        const terms = [...state.terms]
        let next = { ...state, inverse: false }
        if (state.entry === 'waiting' && terms.length) terms.pop()
        else {
          while (terms.length) {
            const term = terms.at(-1)
            if (!term || precedence[term.operator] < precedence[operator]) break
            terms.pop()
            next = calculate(next, term.left, term.operator, displayValue(next))
            if (next.entry === 'error') return next
          }
        }
        terms.push({ left: displayValue(next), operator })
        return { ...next, terms, entry: 'waiting', calculation: { kind: 'idle' } }
      }
      const calc = state.calculation
      const next =
        calc.kind === 'pending' && state.entry !== 'waiting'
          ? calculate(state, calc.left, calc.operator, value)
          : state
      if (next.entry === 'error') return next
      return {
        ...next,
        entry: 'waiting',
        calculation: { kind: 'pending', left: displayValue(next), operator },
      }
    }
    default:
      return scientific(state, key)
  }
}

export function keyboardAction(
  key: string,
  scientificView = false,
  base: NumberBase = 10,
): Action | undefined {
  if (/^\d$/.test(key)) return { kind: 'digit', digit: key }
  if (scientificView && base === 16 && /^[a-f]$/i.test(key)) return { kind: 'digit', digit: key }
  if (scientificView) {
    const keys: Record<string, Key> = {
      '(': 'open',
      ')': 'close',
      '^': 'power',
      '!': 'factorial',
      '&': 'and',
      '|': 'or',
      '~': 'not',
      '<': 'lsh',
      '>': 'rsh',
      s: 'sin',
      c: 'cos',
      t: 'tan',
      l: 'log',
      n: 'ln',
      p: 'pi',
      x: 'exp',
    }
    const mapped = keys[key]
    if (mapped) return { kind: 'key', key: mapped }
  }
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
