<script setup lang="ts">
import type { Reservation } from '../../types'
import { useTableNames } from '../../utils/tables'
import { fromMinutes, toMinutes } from '../../utils/time'

defineProps<{ items: Reservation[]; activeAt: (r: Reservation) => boolean }>()
const emit = defineEmits<{ open: [r: Reservation] }>()

const { tableName } = useTableNames()
</script>

<template>
  <section class="panel">
    <h2>Reservierungen ({{ items.length }})</h2>
    <p v-if="!items.length" class="hint">Für diesen Tag gibt es noch keine Reservierungen.</p>
    <ul class="list">
      <li v-for="r in items" :key="r.id">
        <button type="button" :class="['entry', { now: activeAt(r) }]" @click="emit('open', r)">
          <span class="time">{{ r.time }}–{{ fromMinutes(toMinutes(r.time) + r.durationMin) }}</span>
          <span class="name">{{ r.name }} · {{ r.guests }} P.</span>
          <span class="tables">{{ r.tableIds.length ? r.tableIds.map(tableName).join(', ') : 'ohne Tisch' }}</span>
          <span v-if="r.note" class="note">{{ r.note }}</span>
        </button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.entry {
  width: 100%;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 2px 10px;
  text-align: left;
  background: var(--bg-panel);
}
.entry.now {
  border-color: var(--danger);
  box-shadow: inset 4px 0 0 var(--danger);
}
.time {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.tables,
.note {
  grid-column: 2;
  font-size: 13px;
  color: var(--muted);
}
.note {
  font-style: italic;
}
</style>
