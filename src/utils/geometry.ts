import type { PlanObject, Point } from '../types'

export type { Point }

export const CHAIR_SIZE = 40
const CHAIR_GAP = 8
/** Strichstärke der Raumwand; Türen haben genau diese Tiefe und decken die Wand ab. */
export const WALL_THICKNESS = 12

export function snap(value: number, step: number): number {
  if (step <= 0) return value
  return Math.round(value / step) * step
}

export function normalizeAngle(deg: number): number {
  return ((deg % 360) + 360) % 360
}

/** Dreht einen Punkt um den Ursprung. */
export function rotatePoint(p: Point, deg: number): Point {
  const r = (deg * Math.PI) / 180
  const cos = Math.cos(r)
  const sin = Math.sin(r)
  return { x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos }
}

/**
 * Stuhlpositionen relativ zum Tischmittelpunkt (ungedreht) samt Blickrichtung zum Tisch.
 * Eckige Tische: Stühle auf die langen Seiten verteilt, ab 2 Stühlen pro langer Seite
 * bzw. bei kurzen Tischen auch an die Stirnseiten.
 */
export function chairPositions(
  shape: 'rect' | 'round',
  width: number,
  depth: number,
  seats: number,
): { x: number; y: number; rotation: number }[] {
  if (seats <= 0) return []
  const offset = CHAIR_SIZE / 2 + CHAIR_GAP

  if (shape === 'round') {
    const r = Math.max(width, depth) / 2 + offset
    return Array.from({ length: seats }, (_, i) => {
      const angle = (360 / seats) * i - 90
      const rad = (angle * Math.PI) / 180
      return { x: Math.cos(rad) * r, y: Math.sin(rad) * r, rotation: angle + 90 }
    })
  }

  // Verteilung: zuerst lange Seiten (oben/unten), Rest an die Stirnseiten.
  const longIsWidth = width >= depth
  const longLen = longIsWidth ? width : depth
  const perLongSide = Math.max(1, Math.floor(longLen / (CHAIR_SIZE + 15)))
  let top = 0
  let bottom = 0
  let left = 0
  let right = 0
  let remaining = seats
  // Bei 1-2 Stühlen gegenüber setzen, sonst auffüllen.
  while (remaining > 0) {
    if (top < perLongSide && top <= bottom) {
      top++
    } else if (bottom < perLongSide) {
      bottom++
    } else if (left <= right) {
      left++
    } else {
      right++
    }
    remaining--
  }

  const result: { x: number; y: number; rotation: number }[] = []
  const halfW = width / 2
  const halfD = depth / 2
  const spread = (count: number, len: number) =>
    Array.from({ length: count }, (_, i) => -len / 2 + (len / count) * (i + 0.5))

  if (longIsWidth) {
    for (const x of spread(top, width)) result.push({ x, y: -halfD - offset, rotation: 0 })
    for (const x of spread(bottom, width)) result.push({ x, y: halfD + offset, rotation: 180 })
    for (const y of spread(left, depth)) result.push({ x: -halfW - offset, y, rotation: 270 })
    for (const y of spread(right, depth)) result.push({ x: halfW + offset, y, rotation: 90 })
  } else {
    for (const y of spread(top, depth)) result.push({ x: -halfW - offset, y, rotation: 270 })
    for (const y of spread(bottom, depth)) result.push({ x: halfW + offset, y, rotation: 90 })
    for (const x of spread(left, width)) result.push({ x, y: -halfD - offset, rotation: 0 })
    for (const x of spread(right, width)) result.push({ x, y: halfD + offset, rotation: 180 })
  }
  return result
}

/** Eckpunkte des gedrehten Objekts (ohne Stühle) in Raumkoordinaten. */
export function objectCorners(obj: Pick<PlanObject, 'x' | 'y' | 'width' | 'depth' | 'rotation'>): Point[] {
  const hw = obj.width / 2
  const hd = obj.depth / 2
  return [
    { x: -hw, y: -hd },
    { x: hw, y: -hd },
    { x: hw, y: hd },
    { x: -hw, y: hd },
  ].map((p) => {
    const r = rotatePoint(p, obj.rotation)
    return { x: r.x + obj.x, y: r.y + obj.y }
  })
}


// --- Raumform (Polygon) ---
// Eckpunkte liegen im Uhrzeigersinn (Bildschirmkoordinaten, y nach unten) → positive Fläche.

export function rectPoints(width: number, depth: number): Point[] {
  return [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: depth },
    { x: 0, y: depth },
  ]
}

export function boundingBox(points: Point[]): { minX: number; minY: number; maxX: number; maxY: number } {
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) }
}

/** Vorzeichenbehaftete Fläche: > 0 = im Uhrzeigersinn auf dem Bildschirm. */
export function polygonArea(points: Point[]): number {
  let sum = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!
    const b = points[(i + 1) % points.length]!
    sum += a.x * b.y - b.x * a.y
  }
  return sum / 2
}

/** Gibt die Punkte im Uhrzeigersinn zurück und ob dafür umgedreht wurde. */
export function ensureClockwise(points: Point[]): { points: Point[]; reversed: boolean } {
  return polygonArea(points) < 0 ? { points: [...points].reverse(), reversed: true } : { points, reversed: false }
}

/** Ist der Raum ein achsenparalleles Rechteck ab (0,0)? */
export function isRect(points: Point[]): boolean {
  if (points.length !== 4) return false
  const bb = boundingBox(points)
  return (
    bb.minX === 0 &&
    bb.minY === 0 &&
    points.every((p) => (p.x === bb.minX || p.x === bb.maxX) && (p.y === bb.minY || p.y === bb.maxY))
  )
}

export function projectOnSegment(p: Point, a: Point, b: Point): { point: Point; t: number; dist: number } {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  const point = { x: a.x + dx * t, y: a.y + dy * t }
  return { point, t, dist: Math.hypot(p.x - point.x, p.y - point.y) }
}

export function wallSegment(points: Point[], index: number): [Point, Point] {
  return [points[index % points.length]!, points[(index + 1) % points.length]!]
}

export function nearestWallSegment(p: Point, points: Point[]): { index: number; t: number; dist: number } {
  let best = { index: 0, t: 0, dist: Infinity }
  for (let i = 0; i < points.length; i++) {
    const [a, b] = wallSegment(points, i)
    const r = projectOnSegment(p, a, b)
    if (r.dist < best.dist) best = { index: i, t: r.t, dist: r.dist }
  }
  return best
}

/**
 * Setzt eine Tür mittig auf die Wandlinie. Die Drehung folgt der Wand, sodass sich die Tür
 * (Öffnungsbogen Richtung lokal +y) in den Raum öffnet. `t` wird so begrenzt, dass die Tür nicht über die Ecke ragt.
 */
export function placeOnWallSegment(
  points: Point[],
  index: number,
  t: number,
  doorWidth: number,
): { x: number; y: number; rotation: number; t: number } {
  const [a, b] = wallSegment(points, index)
  const len = Math.hypot(b.x - a.x, b.y - a.y)
  const half = doorWidth / 2
  const tc = len <= doorWidth ? 0.5 : Math.min(1 - half / len, Math.max(half / len, t))
  const rotation = normalizeAngle((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI)
  return { x: a.x + (b.x - a.x) * tc, y: a.y + (b.y - a.y) * tc, rotation, t: tc }
}

/**
 * Ecke einrasten: Raster und – solange nicht `free` (Shift) – magnetisch an x/y der Nachbarecken,
 * damit Wände leicht waagerecht/senkrecht werden.
 */
export function snapVertex(p: Point, prev: Point, next: Point, grid: number, free: boolean, tolerance = 25): Point {
  const magnet = (v: number, candidates: number[]): number | undefined => {
    if (free) return undefined
    const best = candidates.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a))
    return Math.abs(best - v) <= tolerance ? best : undefined
  }
  return {
    x: magnet(p.x, [prev.x, next.x]) ?? snap(p.x, grid),
    y: magnet(p.y, [prev.y, next.y]) ?? snap(p.y, grid),
  }
}

export function pointInPolygon(p: Point, points: Point[]): boolean {
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i]!
    const b = points[j]!
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

/** true, wenn das Objekt (ohne Stühle) ganz oder teilweise außerhalb der Raumform liegt. */
export function isOutsideRoom(
  obj: Pick<PlanObject, 'x' | 'y' | 'width' | 'depth' | 'rotation'>,
  points: Point[],
): boolean {
  const eps = 0.5
  const onWall = (c: Point) => nearestWallSegment(c, points).dist <= eps
  if (objectCorners(obj).some((c) => !pointInPolygon(c, points) && !onWall(c))) return true
  // Eine nach innen ragende Raumecke (z. B. bei L-Form) kann im Objekt liegen, obwohl alle Objektecken drin sind.
  const hw = obj.width / 2 - eps
  const hd = obj.depth / 2 - eps
  return points.some((v) => {
    const l = rotatePoint({ x: v.x - obj.x, y: v.y - obj.y }, -obj.rotation)
    return Math.abs(l.x) < hw && Math.abs(l.y) < hd
  })
}