import type { Reservation } from '../types'

export const DEFAULT_DURATION_MIN = 120

export function toMinutes(time: string): number {
  const [h = 0, m = 0] = time.split(':').map(Number)
  return h * 60 + m
}

export function fromMinutes(total: number): string {
  const t = ((total % 1440) + 1440) % 1440
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

/** Halb-offene Intervalle: 19:00–21:00 und 21:00–23:00 überschneiden sich nicht. */
export function overlaps(startA: number, durA: number, startB: number, durB: number): boolean {
  return startA < startB + durB && startB < startA + durA
}

/** Ist die Reservierung zum Zeitpunkt `time` am Tag `date` aktiv? */
export function isActiveAt(res: Pick<Reservation, 'date' | 'time' | 'durationMin'>, date: string, time: string): boolean {
  if (res.date !== date) return false
  const start = toMinutes(res.time)
  const t = toMinutes(time)
  return t >= start && t < start + res.durationMin
}

export function reservationsOverlap(
  a: Pick<Reservation, 'date' | 'time' | 'durationMin'>,
  b: Pick<Reservation, 'date' | 'time' | 'durationMin'>,
): boolean {
  return a.date === b.date && overlaps(toMinutes(a.time), a.durationMin, toMinutes(b.time), b.durationMin)
}

export function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
