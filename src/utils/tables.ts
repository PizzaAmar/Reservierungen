import { usePlanStore } from '../stores/plan'

/** Anzeigename eines Tisches, bei mehreren Räumen mit Raumname. */
export function useTableNames() {
  const plan = usePlanStore()

  function tableName(id: string): string {
    const t = plan.objects.find((o) => o.id === id)
    if (!t) return 'gelöschter Tisch'
    const name = t.label ? `Tisch ${t.label}` : 'Tisch'
    if (plan.rooms.length <= 1) return name
    const room = plan.rooms.find((r) => r.id === t.roomId)
    return room ? `${name} (${room.name})` : name
  }

  function seatsOf(ids: string[]): number {
    return ids.reduce((sum, id) => sum + (plan.objects.find((o) => o.id === id)?.seats ?? 0), 0)
  }

  return { tableName, seatsOf }
}
