import type { PlanData } from '../types'

/**
 * Austauschbare Speicherschicht. Aktuell lokal im Browser;
 * später kommt hier eine ApiPlanStorage (PHP/MySQL auf Hetzner) dazu.
 */
export interface PlanStorage {
  load(): PlanData | null
  save(data: PlanData): void
}

const KEY = 'pizzahaus-raumplan-v1'

export class LocalStoragePlanStorage implements PlanStorage {
  load(): PlanData | null {
    try {
      const raw = localStorage.getItem(KEY)
      if (!raw) return null
      return parsePlanData(raw)
    } catch (e) {
      console.warn('Raumplan konnte nicht geladen werden', e)
      return null
    }
  }

  save(data: PlanData): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(data))
    } catch (e) {
      console.warn('Raumplan konnte nicht gespeichert werden', e)
    }
  }
}

/** Prüft grob die Struktur (Import-Dateien, gespeicherte Daten). Wirft bei ungültigen Daten. */
export function parsePlanData(raw: string): PlanData {
  const data = JSON.parse(raw)
  if (
    !data ||
    data.version !== 1 ||
    !Array.isArray(data.rooms) ||
    !Array.isArray(data.objects) ||
    !Array.isArray(data.reservations)
  ) {
    throw new Error('Ungültige Raumplan-Datei')
  }
  return data as PlanData
}

export const storage: PlanStorage = new LocalStoragePlanStorage()
