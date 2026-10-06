import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Reservation } from '../types'
import { newId } from '../utils/id'
import { isActiveAt, reservationsOverlap, toMinutes } from '../utils/time'

export const useReservationsStore = defineStore('reservations', () => {
  const reservations = ref<Reservation[]>([])

  function load(list: Reservation[]) {
    reservations.value = list
  }

  function forDate(date: string): Reservation[] {
    return reservations.value
      .filter((r) => r.date === date)
      .sort((a, b) => toMinutes(a.time) - toMinutes(b.time))
  }

  /** Reservierung, die den Tisch zum Zeitpunkt belegt (falls vorhanden). */
  function activeForTable(tableId: string, date: string, time: string): Reservation | undefined {
    return reservations.value.find((r) => r.tableIds.includes(tableId) && isActiveAt(r, date, time))
  }

  /** Andere Reservierungen, die sich zeitlich mit `res` überschneiden und einen Tisch teilen. */
  function conflictsFor(res: Omit<Reservation, 'id'> & { id?: string }): Reservation[] {
    return reservations.value.filter(
      (r) =>
        r.id !== res.id &&
        r.tableIds.some((t) => res.tableIds.includes(t)) &&
        reservationsOverlap(r, res),
    )
  }

  function save(res: Omit<Reservation, 'id'> & { id?: string }): Reservation {
    if (res.id) {
      const existing = reservations.value.find((r) => r.id === res.id)
      if (existing) {
        Object.assign(existing, res)
        return existing
      }
    }
    const created: Reservation = { ...res, id: newId() }
    reservations.value.push(created)
    return created
  }

  function remove(id: string) {
    reservations.value = reservations.value.filter((r) => r.id !== id)
  }

  /** Nach dem Löschen von Tischen deren IDs aus Reservierungen entfernen. */
  function dropTables(tableIds: string[]) {
    if (!tableIds.length) return
    for (const r of reservations.value) {
      r.tableIds = r.tableIds.filter((t) => !tableIds.includes(t))
    }
  }

  return { reservations, load, forDate, activeForTable, conflictsFor, save, remove, dropTables }
})
