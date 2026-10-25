import { describe, expect, it } from 'vitest'
import {
  type Calculator,
  displayText,
  initialCalculator,
  type Key,
  keyboardAction,
  reduceCalculator,
} from './engine'

function press(sequence: string, state = initialCalculator): Calculator {
  return [...sequence].reduce((current, key) => {
    const action = keyboardAction(key)
    return action ? reduceCalculator(current, action) : current
  }, state)
}
function key(state: Calculator, value: Key) {
  return reduceCalculator(state, { kind: 'key', key: value })
}

describe('Windows standard calculator', () => {
  it('executes immediately from left to right', () => expect(press('12+7*2=').display).toBe('38'))
  it('repeats equals including an omitted second operand', () => {
    expect(press('5*=').display).toBe('25')
    expect(press('5*==').display).toBe('125')
    expect(press('12+7==').display).toBe('26')
  })
  it('replaces a pending operator', () => expect(press('12+*2=').display).toBe('24'))
  it('chains computed operands and recalled memory', () => {
    expect(press('200+10%+5=').display).toBe('225')
    expect(press('*2=', key(press('12+9'), 'sqrt')).display).toBe('30')
    expect(press('+2=', key(press('3+', key(press('4'), 'MS')), 'MR')).display).toBe('9')
  })
  it('takes a percentage of the left operand for Windows percent', () => {
    expect(press('200+10%=').display).toBe('220')
    expect(press('200-10%=').display).toBe('180')
    expect(press('200*10%=').display).toBe('4000')
    expect(press('200/10%=').display).toBe('10')
  })
  it('clears entry without losing the operation and C preserves memory', () => {
    expect(press('7=', key(press('12+99'), 'clearEntry')).display).toBe('19')
    expect(key(key(press('42'), 'MS'), 'clear').memory).toBe(42)
    expect(key(press('12+99'), 'clear').display).toBe('0')
  })
  it('stores, recalls, adds, and clears memory', () => {
    const stored = key(press('12'), 'MS')
    const added = key(press('8', stored), 'M+')
    expect(key(added, 'MR').display).toBe('20')
    expect(key(added, 'MC').memory).toBe(0)
  })
  it('supports backspace, decimal, sign, square root and reciprocal', () => {
    expect(key(press('123'), 'back').display).toBe('12')
    expect(press('1.2.3').display).toBe('1.23')
    expect(key(press('12'), 'sign').display).toBe('-12')
    expect(key(press('81'), 'sqrt').display).toBe('9')
    expect(key(press('4'), 'reciprocal').display).toBe('0.25')
    expect(press('0.1+0.2=').display).toBe('0.3')
  })
  it('shows Windows error text and recovers through clear', () => {
    expect(press('1/0=').display).toBe('Cannot divide by zero')
    expect(press('0/0=').display).toBe('Result of function is undefined')
    expect(key(key(press('1'), 'sign'), 'sqrt').display).toBe('Invalid input for function')
    expect(press('7', key(press('1/0='), 'clear')).display).toBe('7')
  })
  it('pastes only numbers and starts a new calculation after equals', () => {
    expect(reduceCalculator(initialCalculator, { kind: 'paste', text: ' 1,234.5 ' }).display).toBe('1234.5')
    expect(reduceCalculator(initialCalculator, { kind: 'paste', text: 'alert(1)' }).display).toBe('0')
    expect(press('2+3=7=').display).toBe('7')
  })
  it('maps the required keyboard controls', () => {
    expect(keyboardAction('Enter')).toEqual({ kind: 'key', key: 'equals' })
    expect(keyboardAction('Escape')).toEqual({ kind: 'key', key: 'clear' })
    expect(keyboardAction('Delete')).toEqual({ kind: 'key', key: 'clearEntry' })
    expect(keyboardAction('Backspace')).toEqual({ kind: 'key', key: 'back' })
  })
  it('keeps pasted exponential numbers valid when editing', () => {
    const pasted = reduceCalculator(initialCalculator, { kind: 'paste', text: '1e30' })
    expect(key(pasted, 'back').display).toBe('1e+30')
    expect(press('7', pasted).display).toBe('7')
    expect(press('.5', pasted).display).toBe('0.5')
  })
  it('distinguishes a signed operand from memory commands while waiting', () => {
    expect(press('*2=', key(press('5+'), 'sign')).display).toBe('0')
    expect(press('*2=', key(press('5+'), 'MS')).display).toBe('10')
    expect(press('*2=', key(press('5+'), 'M+')).display).toBe('10')
  })
})

const scientificInitial = reduceCalculator(initialCalculator, { kind: 'view', view: 'scientific' })
const inverse = (state: Calculator) => reduceCalculator(state, { kind: 'toggle', option: 'inverse' })
const enter = (number: string, state = scientificInitial) =>
  reduceCalculator(state, { kind: 'paste', text: number })
function expression(sequence: string, state = scientificInitial): Calculator {
  return [...sequence].reduce((current, character) => {
    const action = keyboardAction(character, true, current.base)
    return action ? reduceCalculator(current, action) : current
  }, state)
}

describe('Windows scientific calculator', () => {
  it('uses precedence, nested parentheses, and repeat equals', () => {
    expect(expression('2+3*4=').display).toBe('14')
    expect(expression('(2+3)*4=').display).toBe('20')
    expect(expression('2*(3+(4*5))=').display).toBe('46')
    expect(expression('2*(3+4=').display).toBe('14')
    expect(expression('2+3==').display).toBe('8')
    expect(expression('2+*3=').display).toBe('6')
    expect(expression('(2+(3').parentheses).toHaveLength(2)
    expect(expression('(2+(3))').parentheses).toHaveLength(0)
  })
  it('clears parentheses and pending work without losing memory or angle settings', () => {
    const state = reduceCalculator(key(expression('2*(3+4'), 'MS'), { kind: 'angle', angle: 'radians' })
    const cleared = key(state, 'clear')
    expect(cleared.parentheses).toHaveLength(0)
    expect(cleared.terms).toHaveLength(0)
    expect(cleared.memory).toBe(4)
    expect(cleared.angle).toBe('radians')
    expect(cleared.view).toBe('scientific')
    expect(expression('7=', key(expression('12+99'), 'clearEntry')).display).toBe('19')
  })
  it('converts among all bases and accepts only their digits', () => {
    const decimal = enter('255.9')
    const hex = reduceCalculator(decimal, { kind: 'base', base: 16 })
    expect(hex.display).toBe('FF')
    expect(displayText(hex)).toBe('FF')
    const binary = reduceCalculator(hex, { kind: 'base', base: 2 })
    expect(binary.display).toBe('11111111')
    expect(expression('2', binary).display).toBe('11111111')
    expect(reduceCalculator(hex, { kind: 'base', base: 8 }).display).toBe('377')
    expect(reduceCalculator(hex, { kind: 'base', base: 10 }).display).toBe('255')
    expect(expression('af+1=', key(hex, 'clear')).display).toBe('B0')
  })
  it('masks results to Dword, Word, and Byte and uses unsigned logical operations', () => {
    const hex = reduceCalculator(enter('-1'), { kind: 'base', base: 16 })
    expect(hex.display).toBe('FFFFFFFF')
    const word = reduceCalculator(hex, { kind: 'word', bits: 16 })
    expect(word.display).toBe('FFFF')
    const byte = reduceCalculator(word, { kind: 'word', bits: 8 })
    expect(byte.display).toBe('FF')
    expect(expression('+1=', byte).display).toBe('0')
    expect(expression('100', key(byte, 'clear')).display).toBe('10')
    expect(key(byte, 'not').display).toBe('0')
    expect(expression('F0&CC=', key(byte, 'clear')).display).toBe('C0')
    expect(expression('80<1=', key(byte, 'clear')).display).toBe('0')
    expect(expression('80>1=', key(byte, 'clear')).display).toBe('40')
    expect(expression('0F|F0=', key(byte, 'clear')).display).toBe('FF')
    expect(key(enter('255'), 'not').display).toBe('4294967040')
    expect(expression('3=', key(enter('7'), 'xor')).display).toBe('4')
  })
  it('calculates powers, inverse powers, logarithms, factorials, and remainders', () => {
    expect(expression('2^3=').display).toBe('8')
    expect(expression('3=', key(inverse(enter('27')), 'power')).display).toBe('3')
    expect(key(enter('5'), 'square').display).toBe('25')
    expect(key(inverse(enter('25')), 'square').display).toBe('5')
    expect(key(enter('3'), 'cube').display).toBe('27')
    expect(key(inverse(enter('-27')), 'cube').display).toBe('-3')
    expect(key(enter('1000'), 'log').display).toBe('3')
    expect(key(inverse(enter('3')), 'log').display).toBe('1000')
    expect(Number(key(enter(String(Math.E)), 'ln').display)).toBeCloseTo(1)
    expect(Number(key(inverse(enter('1')), 'ln').display)).toBeCloseTo(Math.E)
    expect(key(enter('5'), 'factorial').display).toBe('120')
    expect(key(enter('0'), 'factorial').display).toBe('1')
    expect(expression('3=', key(enter('17'), 'mod')).display).toBe('2')
    expect(key(enter('-2.75'), 'int').display).toBe('-2')
    expect(key(inverse(enter('-2.75')), 'int').display).toBe('-0.75')
  })
  it('supports all three angle units and inverse and hyperbolic trigonometry', () => {
    expect(Number(key(enter('30'), 'sin').display)).toBeCloseTo(0.5)
    expect(key(enter('60'), 'cos').display).toBe('0.5')
    expect(Number(key(enter('45'), 'tan').display)).toBeCloseTo(1)
    expect(key(inverse(enter('0.5')), 'sin').display).toBe('30')
    expect(key(inverse(enter('0.5')), 'cos').display).toBe('60')
    expect(key(inverse(enter('1')), 'tan').display).toBe('45')
    expect(key(reduceCalculator(enter('100'), { kind: 'angle', angle: 'grads' }), 'sin').display).toBe('1')
    expect(
      Number(
        key(reduceCalculator(enter(String(Math.PI / 2)), { kind: 'angle', angle: 'radians' }), 'sin').display,
      ),
    ).toBeCloseTo(1)
    const hyp = reduceCalculator(enter('1'), { kind: 'toggle', option: 'hyperbolic' })
    for (const trig of ['sin', 'cos', 'tan'] as const) {
      const answer = key(hyp, trig)
      expect(Number(key(inverse(answer), trig).display)).toBeCloseTo(1)
      expect(answer.hyperbolic).toBe(true)
    }
    expect(key(inverse(enter('0.5')), 'sin').inverse).toBe(false)
  })
  it('converts dms, enters signed exponents, and switches F-E output', () => {
    expect(key(enter('12.5'), 'dms').display).toBe('12.3')
    expect(key(inverse(enter('12.3045')), 'dms').display).toBe('12.5125')
    expect(key(enter('-12.5'), 'dms').display).toBe('-12.3')
    expect(expression('3=', key(expression('1.2'), 'exp')).display).toBe('1.2e+3')
    expect(expression('3*2=', key(key(expression('1.2'), 'exp'), 'sign')).display).toBe('0.0024')
    expect(displayText(key(enter('123'), 'FE'))).toBe('1.23000000000000e+2')
    expect(displayText(key(key(enter('123'), 'FE'), 'FE'))).toBe('123.')
    expect(Number(key(scientificInitial, 'pi').display)).toBeCloseTo(Math.PI)
  })
  it('retains and deletes observations and calculates both standard deviations', () => {
    let data = scientificInitial
    for (const value of ['2', '4', '4', '4', '5', '5', '7', '9']) data = key(enter(value, data), 'Dat')
    expect(key(data, 'Ave').display).toBe('5')
    expect(key(data, 'Sum').display).toBe('40')
    expect(key(inverse(data), 'Sum').display).toBe('232')
    expect(key(inverse(data), 'Ave').display).toBe('29')
    expect(key(inverse(data), 's').display).toBe('2')
    expect(Number(key(data, 's').display)).toBeCloseTo(Math.sqrt(32 / 7))
    const removed = reduceCalculator(data, { kind: 'statistics', command: 'delete', id: 3 })
    expect(removed.samples.map((sample) => sample.value)).toEqual([2, 4, 4, 5, 5, 7, 9])
    expect(reduceCalculator(data, { kind: 'statistics', command: 'clear' }).samples).toHaveLength(0)
    expect(key(data, 'clear').samples).toHaveLength(8)
  })
  it('reports invalid function inputs and recovers with C or CE', () => {
    for (const [value, operation] of [
      ['-1', 'ln'],
      ['-1', 'log'],
      ['-1', 'factorial'],
      ['1.5', 'factorial'],
      ['90', 'tan'],
    ] as const) {
      const error = key(enter(value), operation)
      expect(error.entry).toBe('error')
      expect(key(error, 'clear').display).toBe('0')
      expect(key(error, 'clearEntry').display).toBe('0')
    }
    expect(key(inverse(enter('2')), 'sin').entry).toBe('error')
    expect(key(scientificInitial, 'Ave').entry).toBe('error')
    expect(expression('1/0=').display).toBe('Cannot divide by zero')
    expect(expression('2^(3/0)=').entry).toBe('error')
  })
  it('switches back to Standard without leaking scientific settings', () => {
    const hex = reduceCalculator(key(expression('2*(3'), 'MS'), { kind: 'base', base: 16 })
    const standard = reduceCalculator(hex, { kind: 'view', view: 'standard' })
    expect(standard.base).toBe(10)
    expect(standard.parentheses).toHaveLength(0)
    expect(standard.memory).toBe(3)
    expect(press('12+7*2=', standard).display).toBe('38')
  })
  it('rejects overflowing exponent entry before integer conversion or memory storage', () => {
    const overflow = expression('1x999')
    expect(overflow.entry).toBe('error')
    expect(reduceCalculator(overflow, { kind: 'base', base: 16 }).entry).toBe('error')
    expect(key(overflow, 'not').entry).toBe('error')
    expect(key(overflow, 'MS').memory).toBe(0)
    const hex = reduceCalculator(enter('15'), { kind: 'base', base: 16 })
    expect(key(hex, 'sin').display).toBe('F')
    expect(expression('1234567890123456').display).toBe('123456789012345')
  })
})
