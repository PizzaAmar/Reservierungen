import { describe, expect, it } from 'vitest'
import { fromMinutes, isActiveAt, overlaps, reservationsOverlap, toMinutes } from '../time'

describe('Zeitumrechnung', () => {
  it('rechnet HH:MM in Minuten und zurück', () => {
    expect(toMinutes('19:30')).toBe(1170)
    expect(fromMinutes(1170)).toBe('19:30')
    expect(fromMinutes(toMinutes('23:00') + 120)).toBe('01:00')
  })
})

describe('overlaps', () => {
  it('direkt aufeinanderfolgende Zeiten überschneiden sich nicht', () => {
    expect(overlaps(1140, 120, 1260, 120)).toBe(false)
  })
  it('erkennt Überschneidungen', () => {
    expect(overlaps(1140, 120, 1200, 60)).toBe(true)
    expect(overlaps(1200, 60, 1140, 120)).toBe(true)
  })
})

describe('isActiveAt', () => {
  const r = { date: '2026-10-10', time: '19:00', durationMin: 120 }
  it('aktiv innerhalb der Dauer', () => {
    expect(isActiveAt(r, '2026-10-10', '19:00')).toBe(true)
    expect(isActiveAt(r, '2026-10-10', '20:59')).toBe(true)
  })
  it('nicht aktiv davor, danach oder an anderem Tag', () => {
    expect(isActiveAt(r, '2026-10-10', '18:59')).toBe(false)
    expect(isActiveAt(r, '2026-10-10', '21:00')).toBe(false)
    expect(isActiveAt(r, '2026-10-11', '19:30')).toBe(false)
  })
})

describe('reservationsOverlap', () => {
  it('nur am selben Tag', () => {
    const a = { date: '2026-10-10', time: '19:00', durationMin: 120 }
    expect(reservationsOverlap(a, { ...a, time: '20:00' })).toBe(true)
    expect(reservationsOverlap(a, { ...a, date: '2026-10-11' })).toBe(false)
  })
})
