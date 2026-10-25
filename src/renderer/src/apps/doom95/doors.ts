import type { DoorSpec, KeyColor } from './map'

export type DoorPhase = 'closed' | 'opening' | 'open' | 'closing'

export interface Door extends DoorSpec {
  phase: DoorPhase
  /** How far the slab has slid aside, from 0 (shut) to 1 (fully open). */
  open: number
  /** Seconds left before an open door starts to close. */
  wait: number
}

/** Fraction of the slab per second, so a door takes half a second to slide. */
export const DOOR_SPEED = 2
/** Seconds a door stays open before it closes by itself. */
export const DOOR_WAIT = 4

export type OperateDoorResult = 'opening' | 'closing' | 'locked' | 'busy'
export type DoorSound = 'doorOpen' | 'doorClose'

export const createDoor = (spec: DoorSpec): Door => ({ ...spec, phase: 'closed', open: 0, wait: 0 })

/** A door blocks movement until it is fully open. */
export const doorBlocks = (door: Door): boolean => door.open < 1

export function operateDoor(door: Door, keys: Readonly<Record<KeyColor, boolean>>): OperateDoorResult {
  if (door.key && !keys[door.key]) return 'locked'
  switch (door.phase) {
    case 'closed':
    case 'closing':
      door.phase = 'opening'
      return 'opening'
    case 'open':
      door.phase = 'closing'
      return 'closing'
    case 'opening':
      return 'busy'
  }
}

/**
 * Advances one door. `occupied` says whether anything stands in the door's cell. A closing door that
 * finds something in its way opens again instead of crushing it.
 */
export function stepDoor(door: Door, dt: number, occupied: boolean): DoorSound | null {
  switch (door.phase) {
    case 'closed':
      return null
    case 'opening':
      door.open = Math.min(1, door.open + DOOR_SPEED * dt)
      if (door.open === 1) {
        door.phase = 'open'
        door.wait = DOOR_WAIT
      }
      return null
    case 'open':
      door.wait -= dt
      if (door.wait > 0 || occupied) return null
      door.phase = 'closing'
      return 'doorClose'
    case 'closing':
      if (occupied) {
        door.phase = 'opening'
        return 'doorOpen'
      }
      door.open = Math.max(0, door.open - DOOR_SPEED * dt)
      if (door.open === 0) door.phase = 'closed'
      return null
  }
}
