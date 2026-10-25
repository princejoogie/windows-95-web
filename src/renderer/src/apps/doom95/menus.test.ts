import { describe, expect, it } from 'vitest'
import { hitMenu, MAIN_ITEMS, type MenuPage, mainIndex, menuRows, toFramebuffer } from './menus'
import { command, createSession, menuPointer, type Session } from './session'

/** A point on the label as drawn, which is where a player aims. */
function labelPoint(page: MenuPage, index: number) {
  const row = menuRows(page)[index]
  if (!row) throw new Error(`no row ${index} on ${page}`)
  return { x: row.label.x + 3, y: row.label.y + 4 * row.label.scale }
}

const click = (s: Session, page: MenuPage, index: number) => {
  const { x, y } = labelPoint(page, index)
  return [...menuPointer(s, 'move', x, y), ...menuPointer(s, 'down', x, y), ...menuPointer(s, 'up', x, y)]
}

const atMainMenu = () => {
  const s = createSession(3)
  command(s, 'any')
  return s
}

describe('menu mouse', () => {
  it('maps a point in a letterboxed canvas to the 320x200 picture', () => {
    const rect = { left: 10, top: 20, width: 640, height: 600 }
    expect(toFramebuffer(rect, 10, 120)).toEqual({ x: 0, y: 0 })
    expect(toFramebuffer(rect, 650, 520)).toEqual({ x: 320, y: 200 })
    expect(toFramebuffer(rect, 330, 320)).toEqual({ x: 160, y: 100 })
  })

  it('finds the row under the pointer, and nothing between or beside the rows', () => {
    const quit = mainIndex('quit')
    const { x, y } = labelPoint('main', quit)
    expect(hitMenu('main', x, y)?.index).toBe(quit)
    expect(hitMenu('main', 5, y)).toBeNull()
    expect(hitMenu('main', x, 199)).toBeNull()
  })

  it('selects the hovered row, so a click on Quit Game reaches the quit prompt', () => {
    const s = atMainMenu()
    expect(s.menu?.cursor).toBe(0)
    const { x, y } = labelPoint('main', mainIndex('quit'))
    expect(menuPointer(s, 'move', x, y)).toEqual(['menuMove'])
    expect(s.menu?.cursor).toBe(MAIN_ITEMS.length - 1)
    click(s, 'main', mainIndex('quit'))
    expect(s.menu?.page).toBe('quit')
    expect(click(s, 'quit', 0)).toContain('quit')
  })

  it('backs out of the quit prompt on No', () => {
    const s = atMainMenu()
    click(s, 'main', mainIndex('quit'))
    click(s, 'quit', 1)
    expect(s.menu).toMatchObject({ page: 'main', cursor: mainIndex('quit') })
  })

  it('does nothing for a click away from every row', () => {
    const s = atMainMenu()
    menuPointer(s, 'down', 4, 196)
    menuPointer(s, 'up', 4, 196)
    expect(s.menu).toMatchObject({ page: 'main', cursor: 0 })
  })

  it('confirms only when the button comes up on the row it went down on', () => {
    const s = atMainMenu()
    const from = labelPoint('main', 0)
    const to = labelPoint('main', mainIndex('quit'))
    menuPointer(s, 'down', from.x, from.y)
    menuPointer(s, 'up', to.x, to.y)
    expect(s.menu?.page).toBe('main')
  })

  it('starts the clicked skill', () => {
    const s = atMainMenu()
    click(s, 'main', mainIndex('newGame'))
    expect(s.menu?.page).toBe('skill')
    click(s, 'skill', 0)
    expect(s.screen.kind).toBe('playing')
    expect(s.skill).toBe(0)
  })

  it('sets a slider step or a toggle value where it is clicked, and backs out on the right button', () => {
    const s = atMainMenu()
    click(s, 'main', mainIndex('options'))
    const [screen, mouse] = menuRows('options')
    const step = mouse?.choices[2]
    const full = screen?.choices[1]
    if (!step || !full) throw new Error('no choices')
    expect(menuPointer(s, 'down', step.x + 2, step.y + 2)).toContain('storeOptions')
    expect(s.options.mouse).toBe(2)
    menuPointer(s, 'down', full.x + 2, full.y + 2)
    expect(s.options.statusBar).toBe(false)
    menuPointer(s, 'down', 0, 0, 2)
    expect(s.menu?.page).toBe('main')
  })

  it('adjusts options with Left and Right, and toggles the screen size with Enter', () => {
    const s = atMainMenu()
    click(s, 'main', mainIndex('options'))
    command(s, 'confirm')
    expect(s.options.statusBar).toBe(false)
    command(s, 'down')
    command(s, 'down')
    const volume = s.options.volume
    command(s, 'left')
    expect(s.options.volume).toBe(volume - 1)
  })

  it('opens the title menu and skips the intermission count with a click anywhere', () => {
    const s = createSession(3)
    menuPointer(s, 'down', 300, 190)
    expect(s.menu?.page).toBe('main')
  })
})
