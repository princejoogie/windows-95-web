import { describe, expect, it } from 'vitest'
import { type Calculator, initialCalculator, type Key, keyboardAction, reduceCalculator } from './engine'

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
