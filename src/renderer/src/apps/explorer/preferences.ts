import { createStore } from '../../lib/store'
import type { Point, Size } from '../../shell/types'
import type { Sort, View } from './model'

export interface FolderPreferences {
  readonly view: View
  readonly sort: Sort
  readonly toolbar: boolean
  readonly status: boolean
  readonly autoArrange: boolean
  readonly geometry?: { position: Point; size: Size }
}
export interface Options {
  readonly hideExtensions: boolean
  readonly sameWindow: boolean
  readonly showHidden: boolean
  readonly confirmDelete: boolean
}
const KEY = 'w95.folders.v1'
export const OPTIONS_KEY = 'w95.folder-options.v1'
const defaults: Options = { hideExtensions: true, sameWindow: false, showHidden: false, confirmDelete: true }
function readOptions(): Options {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(OPTIONS_KEY) ?? 'null')
    if (!parsed || typeof parsed !== 'object') return defaults
    return {
      hideExtensions:
        'hideExtensions' in parsed && typeof parsed.hideExtensions === 'boolean'
          ? parsed.hideExtensions
          : true,
      sameWindow: 'sameWindow' in parsed && parsed.sameWindow === true,
      showHidden: 'showHidden' in parsed && parsed.showHidden === true,
      confirmDelete: !('confirmDelete' in parsed) || parsed.confirmDelete !== false,
    }
  } catch {
    return defaults
  }
}
export const options = createStore<Options, Options>((_old, next) => next, readOptions())
options.subscribe(() => localStorage.setItem(OPTIONS_KEY, JSON.stringify(options.get())))

export function folderPreferences(key: string, exploring: boolean, recycled: boolean): FolderPreferences {
  const fallback: FolderPreferences = {
    view: recycled ? 'details' : 'large',
    sort: { column: 'name', direction: 'ascending' },
    toolbar: exploring,
    status: true,
    autoArrange: true,
  }
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(`${KEY}.${key}`) ?? 'null')
    if (!raw || typeof raw !== 'object') return fallback
    const view =
      'view' in raw && ['large', 'small', 'list', 'details'].some((v) => v === raw.view)
        ? raw.view
        : fallback.view
    if (view !== 'large' && view !== 'small' && view !== 'list' && view !== 'details') return fallback
    return {
      ...fallback,
      view,
      toolbar: 'toolbar' in raw && typeof raw.toolbar === 'boolean' ? raw.toolbar : fallback.toolbar,
      status: !('status' in raw) || raw.status !== false,
      autoArrange: !('autoArrange' in raw) || raw.autoArrange !== false,
      sort: readSort(raw),
      ...readGeometry(raw),
    }
  } catch {
    return fallback
  }
}
function readSort(raw: object): Sort {
  const sort = 'sort' in raw ? raw.sort : null
  const columns = ['name', 'size', 'type', 'modified', 'original', 'deleted'] as const
  if (sort && typeof sort === 'object' && 'column' in sort && 'direction' in sort) {
    const column = columns.find((value) => value === sort.column)
    if (column && (sort.direction === 'ascending' || sort.direction === 'descending'))
      return { column, direction: sort.direction }
  }
  return { column: 'name', direction: 'ascending' }
}
function readGeometry(raw: object): Pick<FolderPreferences, 'geometry'> {
  const geometry = 'geometry' in raw ? raw.geometry : null
  if (!geometry || typeof geometry !== 'object' || !('position' in geometry) || !('size' in geometry))
    return {}
  const { position, size } = geometry
  if (
    position &&
    typeof position === 'object' &&
    'x' in position &&
    'y' in position &&
    typeof position.x === 'number' &&
    typeof position.y === 'number' &&
    size &&
    typeof size === 'object' &&
    'width' in size &&
    'height' in size &&
    typeof size.width === 'number' &&
    typeof size.height === 'number' &&
    size.width >= 240 &&
    size.height >= 180
  )
    return {
      geometry: {
        position: { x: position.x, y: position.y },
        size: { width: size.width, height: size.height },
      },
    }
  return {}
}
export function saveFolderPreferences(key: string, value: FolderPreferences): void {
  localStorage.setItem(`${KEY}.${key}`, JSON.stringify(value))
}
