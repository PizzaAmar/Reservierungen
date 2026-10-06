<script setup lang="ts">
import { computed } from 'vue'
import type { Reservation } from '../../types'
import { useReservationsStore } from '../../stores/reservations'
import { useTableNames } from '../../utils/tables'
import { fromMinutes, toMinutes } from '../../utils/time'

export type ReservationDraft = Omit<Reservation, 'id'> & { id?: string }

// Der Entwurf gehört der Ansicht, damit Klicks im Plan Tische hinzufügen/entfernen können.
const draft = defineModel<ReservationDraft>({ required: true })
const emit = defineEmits<{ save: []; cancel: []; delete: [] }>()

const store = useReservationsStore()
const { tableName, seatsOf } = useTableNames()

const seats = computed(() => seatsOf(draft.value.tableIds))
const conflicts = computed(() => (draft.value.tableIds.length ? store.conflictsFor(draft.value) : []))
const until = computed(() => fromMinutes(toMinutes(draft.value.time) + draft.value.durationMin))
const valid = computed(() => draft.value.name.trim() !== '' && draft.value.guests > 0 && !!draft.value.date && !!draft.value.time)

function removeTable(id: string) {
  draft.value.tableIds = draft.value.tableIds.filter((t) => t !== id)
}

function submit() {
  if (valid.value) emit('save')
}
</script>

<template>
  <form class="panel form" @submit.prevent="submit">
    <h2>{{ draft.id ? 'Reservierung bearbeiten' : 'Neue Reservierung' }}</h2>

    <label class="full">
      Name *
      <input v-model="draft.name" type="text" required autofocus />
    </label>
    <label class="full">
      Telefon
      <input v-model="draft.phone" type="tel" />
    </label>
    <label>
      Datum *
      <input v-model="draft.date" type="date" required />
    </label>
    <label>
      Uhrzeit *
      <input v-model="draft.time" type="time" step="900" required />
    </label>
    <label>
      Personen *
      <input v-model.number="draft.guests" type="number" min="1" max="200" required />
    </label>
    <label>
      Dauer
      <select v-model.number="draft.durationMin">
        <option :value="60">1 Std.</option>
        <option :value="90">1,5 Std.</option>
        <option :value="120">2 Std.</option>
        <option :value="150">2,5 Std.</option>
        <option :value="180">3 Std.</option>
        <option :value="240">4 Std.</option>
      </select>
    </label>

    <div class="full">
      <span class="lbl">Tische (bis {{ until }} Uhr)</span>
      <p class="hint">Tische im Plan anklicken, um sie hinzuzufügen oder zu entfernen.</p>
      <div class="chips">
        <span v-for="id in draft.tableIds" :key="id" class="chip">
          {{ tableName(id) }}
          <button type="button" title="Entfernen" @click="removeTable(id)">×</button>
        </span>
        <span v-if="!draft.tableIds.length" class="hint">noch kein Tisch gewählt</span>
      </div>
    </div>

    <label class="full">
      Notiz
      <textarea v-model="draft.note" rows="2" />
    </label>

    <div class="full warnings">
      <p v-if="draft.tableIds.length && draft.guests > seats" class="warn">
        {{ draft.guests }} Personen, aber nur {{ seats }} Stühle an den gewählten Tischen.
      </p>
      <p v-for="c in conflicts" :key="c.id" class="warn">
        Überschneidung mit {{ c.name }} ({{ c.time }} Uhr, {{ c.tableIds.map(tableName).join(', ') }})
      </p>
    </div>

    <div class="full actions">
      <button type="submit" class="primary" :disabled="!valid">Speichern</button>
      <button type="button" @click="emit('cancel')">Abbrechen</button>
      <button v-if="draft.id" type="button" class="danger" @click="emit('delete')">Löschen</button>
    </div>
  </form>
</template>

<style scoped>
.form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.form h2,
.full {
  grid-column: 1 / -1;
}
.lbl {
  font-size: 13px;
  color: var(--muted);
}
.hint {
  margin: 2px 0 6px;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--picked);
  border-radius: 999px;
  padding: 2px 4px 2px 10px;
  font-size: 14px;
}
.chip button {
  border: none;
  background: transparent;
  padding: 0 6px;
  font-size: 16px;
  line-height: 1;
}
.warnings p {
  margin: 0 0 4px;
}
.warn {
  color: var(--danger);
  font-size: 14px;
}
.actions {
  display: flex;
  gap: 8px;
}
</style>
