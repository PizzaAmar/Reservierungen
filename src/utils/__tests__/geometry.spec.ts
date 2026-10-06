import { describe, expect, it } from 'vitest'
import {
  chairPositions,
  ensureClockwise,
  isOutsideRoom,
  isRect,
  nearestWallSegment,
  normalizeAngle,
  placeOnWallSegment,
  pointInPolygon,
  polygonArea,
  rectPoints,
  rotatePoint,
  snap,
  snapVertex,
} from '../geometry'
describe('snap', () => {
  it('rastet auf das Raster ein', () => {
    expect(snap(123, 10)).toBe(120)
    expect(snap(126, 10)).toBe(130)
    expect(snap(123, 0)).toBe(123)
  })
})

describe('normalizeAngle', () => {
  it('bringt Winkel in 0..359', () => {
    expect(normalizeAngle(-90)).toBe(270)
    expect(normalizeAngle(450)).toBe(90)
  })
})

describe('rotatePoint', () => {
  it('dreht 90° im Uhrzeigersinn (SVG-Koordinaten)', () => {
    const p = rotatePoint({ x: 10, y: 0 }, 90)
    expect(p.x).toBeCloseTo(0)
    expect(p.y).toBeCloseTo(10)
  })
})

describe('chairPositions', () => {
  it('liefert genau so viele Stühle wie gewünscht', () => {
    for (const seats of [0, 1, 2, 4, 5, 6, 8]) {
      expect(chairPositions('rect', 120, 80, seats)).toHaveLength(seats)
      expect(chairPositions('round', 100, 100, seats)).toHaveLength(seats)
    }
  })

  it('verteilt 4 Stühle am 4er-Tisch auf beide langen Seiten', () => {
    const chairs = chairPositions('rect', 120, 80, 4)
    expect(chairs.filter((c) => c.y < 0)).toHaveLength(2)
    expect(chairs.filter((c) => c.y > 0)).toHaveLength(2)
  })

  it('setzt Stühle außerhalb der Tischfläche', () => {
    for (const c of chairPositions('rect', 120, 80, 6)) {
      expect(Math.abs(c.x) > 60 || Math.abs(c.y) > 40).toBe(true)
    }
    for (const c of chairPositions('round', 100, 100, 6)) {
      expect(Math.hypot(c.x, c.y)).toBeGreaterThan(50)
    }
  })
})

// L-Form: 8 × 6 m, oben rechts fehlt ein 3 × 3 m Stück
const L = [
  { x: 0, y: 0 },
  { x: 500, y: 0 },
  { x: 500, y: 300 },
  { x: 800, y: 300 },
  { x: 800, y: 600 },
  { x: 0, y: 600 },
]

describe('Raumform', () => {
  it('Rechteck ist im Uhrzeigersinn (positive Fläche)', () => {
    expect(polygonArea(rectPoints(800, 600))).toBe(480000)
    expect(isRect(rectPoints(800, 600))).toBe(true)
    expect(isRect(L)).toBe(false)
  })

  it('dreht gegen den Uhrzeigersinn gezeichnete Formen um', () => {
    const ccw = [...L].reverse()
    expect(ensureClockwise(ccw).reversed).toBe(true)
    expect(polygonArea(ensureClockwise(ccw).points)).toBeGreaterThan(0)
    expect(ensureClockwise(L).reversed).toBe(false)
  })

  it('erkennt Punkte in der L-Form', () => {
    expect(pointInPolygon({ x: 200, y: 200 }, L)).toBe(true)
    expect(pointInPolygon({ x: 700, y: 450 }, L)).toBe(true)
    expect(pointInPolygon({ x: 700, y: 150 }, L)).toBe(false) // fehlendes Stück
  })
})

describe('Türen an der Wand', () => {
  it('findet die nächste Wand samt Position', () => {
    const hit = nearestWallSegment({ x: 650, y: 290 }, L)
    expect(hit.index).toBe(2) // Wand (500,300) → (800,300)
    expect(hit.t).toBeCloseTo(0.5)
  })

  it('dreht die Tür entlang der Wand, Öffnung zeigt in den Raum', () => {
    const rect = rectPoints(800, 600)
    expect(placeOnWallSegment(rect, 0, 0.5, 90)).toMatchObject({ x: 400, y: 0, rotation: 0 })
    expect(placeOnWallSegment(rect, 1, 0.5, 90)).toMatchObject({ x: 800, y: 300, rotation: 90 })
    expect(placeOnWallSegment(rect, 2, 0.5, 90)).toMatchObject({ x: 400, y: 600, rotation: 180 })
    // Lokal +y der Tür muss ins Rauminnere zeigen
    const placed = placeOnWallSegment(L, 2, 0.5, 90)
    const inward = rotatePoint({ x: 0, y: 50 }, placed.rotation)
    expect(pointInPolygon({ x: placed.x + inward.x, y: placed.y + inward.y }, L)).toBe(true)
  })

  it('funktioniert auf schrägen Wänden', () => {
    // Dreieck mit schräger Wand (0,0) → (400,300)
    const tri = [
      { x: 0, y: 0 },
      { x: 400, y: 300 },
      { x: 0, y: 300 },
    ]
    const placed = placeOnWallSegment(tri, 0, 0.5, 90)
    expect(placed.x).toBeCloseTo(200)
    expect(placed.y).toBeCloseTo(150)
    expect(placed.rotation).toBeCloseTo(36.87, 1)
    const inward = rotatePoint({ x: 0, y: 30 }, placed.rotation)
    expect(pointInPolygon({ x: placed.x + inward.x, y: placed.y + inward.y }, tri)).toBe(true)
  })

  it('lässt die Tür nicht über die Ecke ragen', () => {
    const rect = rectPoints(800, 600)
    expect(placeOnWallSegment(rect, 0, 0, 90).x).toBe(45)
    expect(placeOnWallSegment(rect, 0, 1, 90).x).toBe(755)
  })
})

describe('snapVertex', () => {
  const prev = { x: 0, y: 0 }
  const next = { x: 500, y: 300 }

  it('rastet in der Nähe der Nachbarecken rechtwinklig ein', () => {
    expect(snapVertex({ x: 488, y: 13 }, prev, next, 10, false)).toEqual({ x: 500, y: 0 })
  })

  it('mit Shift nur aufs Raster (schräg möglich)', () => {
    expect(snapVertex({ x: 488, y: 13 }, prev, next, 10, true)).toEqual({ x: 490, y: 10 })
  })
})

describe('isOutsideRoom', () => {
  const room = rectPoints(500, 400)
  const obj = { x: 250, y: 200, width: 100, depth: 50, rotation: 0 }

  it('erkennt Objekte im Raum', () => {
    expect(isOutsideRoom(obj, room)).toBe(false)
  })

  it('erkennt Objekte, die über den Rand ragen', () => {
    expect(isOutsideRoom({ ...obj, x: 470 }, room)).toBe(true)
  })

  it('berücksichtigt die Drehung', () => {
    const wallSide = { x: 250, y: 10, width: 100, depth: 10, rotation: 0 }
    expect(isOutsideRoom(wallSide, room)).toBe(false)
    expect(isOutsideRoom({ ...wallSide, rotation: 90 }, room)).toBe(true)
  })

  it('erkennt Objekte im fehlenden Stück der L-Form', () => {
    expect(isOutsideRoom({ x: 650, y: 450, width: 100, depth: 80, rotation: 0 }, L)).toBe(false)
    expect(isOutsideRoom({ x: 650, y: 150, width: 100, depth: 80, rotation: 0 }, L)).toBe(true)
    // Ecken außen, aber die Innenecke (500,300) ragt in den Tisch
    expect(isOutsideRoom({ x: 500, y: 300, width: 60, depth: 60, rotation: 0 }, L)).toBe(true)
  })
})