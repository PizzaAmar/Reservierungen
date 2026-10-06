<script setup lang="ts">
import { computed, ref } from 'vue'
import PlanCanvas from '../components/plan/PlanCanvas.vue'
import RoomTabs from '../components/editor/RoomTabs.vue'
import ReservationForm, { type ReservationDraft } from '../components/reservations/ReservationForm.vue'
import ReservationList from '../components/reservations/ReservationList.vue'
import type { TableStatus } from '../components/plan/PlanObjectShape.vue'
import { usePlanStore } from '../stores/plan'
import { useReservationsStore } from '../stores/reservations'
import type { PlanObject, Reservation } from '../types'
import { DEFAULT_DURATION_MIN, isActiveAt, todayIso } from '../utils/time'

const plan = usePlanStore()
const store = useReservationsStore()

const date = ref(todayIso())
const time = ref('19:00')
const draft = ref<ReservationDraft | null>(null)

const dayList = computed(() => store.forDate(date.value))

function statusFor(obj: PlanObject): TableStatus {
  if (obj.kind !== 'table') return null
  if (draft.value?.tableIds.includes(obj.id)) return 'picked'
  const active = store.activeForTable(obj.id, date.value, time.value)
  // Die gerade bearbeitete Reservierung nicht als „belegt“ zählen
  return active && active.id !== draft.value?.id ? 'busy' : 'free'
}

function newDraft(tableIds: string[] = []): ReservationDraft {
  return {
    tableIds,
    date: date.value,
    time: time.value,
    durationMin: DEFAULT_DURATION_MIN,
    guests: 2,
    name: '',
    phone: '',
    note: '',
  }
}

function open(r: Reservation) {
  draft.value = { ...r, tableIds: [...r.tableIds] }
  date.value = r.date
  time.value = r.time
}

function onTableClick(obj: PlanObject) {
  if (draft.value) {
    const ids = draft.value.tableIds
    draft.value.tableIds = ids.includes(obj.id) ? ids.filter((i) => i !== obj.id) : [...ids, obj.id]
    return
  }
  const active = store.activeForTable(obj.id, date.value, time.value)
  if (active) open(active)
  else draft.value = newDraft([obj.id])
}

function save() {
  if (!draft.value) return
  const saved = store.save({ ...draft.value, name: draft.value.name.trim() })
  date.value = saved.date
  draft.value = null
}

function remove() {
  if (draft.value?.id && confirm(`Reservierung von ${draft.value.name} löschen?`)) {
    store.remove(draft.value.id)
    draft.value = null
  }
}

const freeTables = computed(() => plan.tables.filter((t) => statusFor(t) === 'free').length)
</script>

<template>
  <div class="reservations">
    <header class="toolbar">
      <RoomTabs />
      <div class="when">
        <label>
          Datum
          <input v-model="date" type="date" />
        </label>
        <label>
          Uhrzeit
          <input v-model="time" type="time" step="900" />
        </label>
        <span class="summary">
          <span class="dot free" /> {{ freeTables }} frei
          <span class="dot busy" /> {{ plan.tables.length - freeTables }} belegt
        </span>
        <button v-if="!draft" type="button" class="primary" @click="draft = newDraft()">+ Reservierung</button>
      </div>
    </header>

    <div class="layout">
      <main class="stage">
        <PlanCanvas mode="view" :status-for="statusFor" @table-click="onTableClick" />
      </main>
      <aside class="side">
        <ReservationForm v-if="draft" v-model="draft" @save="save" @cancel="draft = null" @delete="remove" />
        <ReservationList v-else :items="dayList" :active-at="(r) => isActiveAt(r, date, time)" @open="open" />
      </aside>
    </div>
  </div>
</template>

<style scoped>
.reservations {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 12px;
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: flex-end;
  gap: 12px;
}
.when {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 10px;
}
.summary {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-bottom: 8px;
  color: var(--muted);
}
.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  display: inline-block;
  margin-left: 6px;
}
.dot.free {
  background: var(--free);
}
.dot.busy {
  background: var(--busy);
}
.layout {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 12px;
}
.stage {
  min-height: 420px;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}
.side {
  overflow-y: auto;
}
@media (max-width: 1000px) {
  .layout {
    grid-template-columns: 1fr;
  }
  .stage {
    height: 60vh;
  }
}
</style>
