import { watch } from 'vue'
import type { PlanData } from '../types'
import { parsePlanData, storage } from '../storage'
import { sampleLayout, usePlanStore } from './plan'
import { useReservationsStore } from './reservations'

const SAVE_DELAY_MS = 400

export function currentData(): PlanData {
  const plan = usePlanStore()
  const res = useReservationsStore()
  return { version: 1, rooms: plan.rooms, objects: plan.objects, reservations: res.reservations }
}

export function applyData(data: PlanData) {
  usePlanStore().load({ rooms: data.rooms, objects: data.objects })
  useReservationsStore().load(data.reservations)
}

/** Lädt die gespeicherten Daten (oder ein Beispiel) und speichert danach jede Änderung automatisch. */
export function setupPersistence() {
  const stored = storage.load()
  if (stored && stored.rooms.length) {
    applyData(stored)
  } else {
    applyData({ version: 1, ...sampleLayout(), reservations: [] })
  }

  const plan = usePlanStore()
  const res = useReservationsStore()
  let timer: ReturnType<typeof setTimeout> | undefined
  watch(
    () => [plan.rooms, plan.objects, res.reservations],
    () => {
      clearTimeout(timer)
      timer = setTimeout(() => storage.save(currentData()), SAVE_DELAY_MS)
    },
    { deep: true },
  )
}

export function exportJson() {
  const blob = new Blob([JSON.stringify(currentData(), null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `raumplan-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function importJson(file: File) {
  const data = parsePlanData(await file.text())
  if (!data.rooms.length) throw new Error('Die Datei enthält keinen Raum')
  applyData(data)
}
