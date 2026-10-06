// Alle Maße in Zentimetern, Positionen = Mittelpunkt des Objekts im Raum.

export interface Point {
  x: number
  y: number
}

export interface Room {
  id: string
  name: string
  /** Raumform: Eckpunkte im Uhrzeigersinn */
  points: Point[]
  /** Abgeleitete Größe (Bounding-Box), wird bei jeder Formänderung neu berechnet */
  width: number
  depth: number
}

export type ObjectKind = 'table' | 'plant' | 'bar' | 'wall' | 'pillar' | 'door' | 'text'

export type TableShape = 'rect' | 'round'

export interface PlanObject {
  id: string
  roomId: string
  kind: ObjectKind
  x: number
  y: number
  width: number
  depth: number
  /** Grad, im Uhrzeigersinn */
  rotation: number
  label?: string
  /** nur bei Tischen */
  seats?: number
  shape?: TableShape
  /** nur bei Türen: Anschlag auf der anderen Seite (gespiegelt) */
  flip?: boolean
  /** nur bei Türen: Wand-Nr. (Kante von points[i] nach points[i+1]) und Position 0..1 darauf */
  wallIndex?: number
  wallT?: number
}

export interface Reservation {
  id: string
  tableIds: string[]
  /** YYYY-MM-DD */
  date: string
  /** HH:MM */
  time: string
  durationMin: number
  guests: number
  name: string
  phone?: string
  note?: string
}

export interface PlanData {
  version: 1
  rooms: Room[]
  objects: PlanObject[]
  reservations: Reservation[]
}
