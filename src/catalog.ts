import type { ObjectKind, PlanObject, TableShape } from './types'
import { WALL_THICKNESS } from './utils/geometry'

export interface CatalogItem {
  key: string
  name: string
  kind: ObjectKind
  width: number
  depth: number
  seats?: number
  shape?: TableShape
  label?: string
}

export const CATALOG: CatalogItem[] = [
  { key: 'table-2', name: 'Tisch eckig (2)', kind: 'table', shape: 'rect', width: 70, depth: 70, seats: 2 },
  { key: 'table-4', name: 'Tisch eckig (4)', kind: 'table', shape: 'rect', width: 120, depth: 80, seats: 4 },
  { key: 'table-6', name: 'Tisch eckig (6)', kind: 'table', shape: 'rect', width: 180, depth: 80, seats: 6 },
  { key: 'round-4', name: 'Tisch rund (4)', kind: 'table', shape: 'round', width: 100, depth: 100, seats: 4 },
  { key: 'round-8', name: 'Tisch rund (8)', kind: 'table', shape: 'round', width: 160, depth: 160, seats: 8 },
  { key: 'plant', name: 'Pflanze', kind: 'plant', width: 50, depth: 50 },
  { key: 'bar', name: 'Theke', kind: 'bar', width: 300, depth: 70, label: 'Theke' },
  { key: 'wall', name: 'Wand', kind: 'wall', width: 200, depth: 15 },
  { key: 'pillar', name: 'Säule', kind: 'pillar', width: 40, depth: 40 },
  { key: 'door', name: 'Tür', kind: 'door', width: 90, depth: WALL_THICKNESS },
  { key: 'text', name: 'Beschriftung', kind: 'text', width: 120, depth: 30, label: 'Text' },
]

export const KIND_NAMES: Record<ObjectKind, string> = {
  table: 'Tisch',
  plant: 'Pflanze',
  bar: 'Theke',
  wall: 'Wand',
  pillar: 'Säule',
  door: 'Tür',
  text: 'Beschriftung',
}

export function objectFromCatalog(
  item: CatalogItem,
  roomId: string,
  x: number,
  y: number,
): Omit<PlanObject, 'id'> {
  return {
    roomId,
    kind: item.kind,
    x,
    y,
    width: item.width,
    depth: item.depth,
    rotation: 0,
    label: item.label,
    seats: item.seats,
    shape: item.shape,
  }
}
