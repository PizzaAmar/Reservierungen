<script setup lang="ts">
import { computed } from 'vue'
import { KIND_NAMES } from '../../catalog'
import { usePlanStore } from '../../stores/plan'
import { useReservationsStore } from '../../stores/reservations'
import type { PlanObject } from '../../types'

const plan = usePlanStore()
const reservations = useReservationsStore()
const obj = computed(() => plan.selected)

function num(field: keyof PlanObject, e: Event) {
  const raw = (e.target as HTMLInputElement).value
  const value = Number(raw)
  // Leeres Feld beim Tippen ignorieren, sonst springt der Wert auf das Minimum
  if (!obj.value || raw === '' || !Number.isFinite(value)) return
  plan.updateObject(obj.value.id, { [field]: value })
}

function text(e: Event) {
  if (obj.value) plan.updateObject(obj.value.id, { label: (e.target as HTMLInputElement).value })
}

function setShape(shape: 'rect' | 'round') {
  if (!obj.value) return
  const patch: Partial<PlanObject> = { shape }
  if (shape === 'round') patch.depth = obj.value.width
  plan.updateObject(obj.value.id, patch)
}

function remove() {
  if (!obj.value) return
  const id = obj.value.id
  if (obj.value.kind === 'table' && reservations.reservations.some((r) => r.tableIds.includes(id))) {
    if (!confirm('Für diesen Tisch gibt es Reservierungen. Trotzdem löschen?')) return
    reservations.dropTables([id])
  }
  plan.removeObject(id)
}
</script>

<template>
  <section class="panel">
    <h2>Eigenschaften</h2>
    <p v-if="!obj" class="hint">Objekt im Plan anklicken, um es zu bearbeiten.</p>
    <form v-else class="fields" @submit.prevent>
      <p class="kind">{{ KIND_NAMES[obj.kind] }}</p>

      <label class="full">
        {{ obj.kind === 'table' ? 'Tischnummer / Name' : 'Beschriftung' }}
        <input type="text" :value="obj.label ?? ''" @input="text" />
      </label>

      <template v-if="obj.kind === 'table'">
        <label>
          Stühle
          <input type="number" min="0" max="30" :value="obj.seats ?? 0" @input="num('seats', $event)" />
        </label>
        <div class="seg">
          <span>Form</span>
          <div>
            <button type="button" :class="{ on: obj.shape !== 'round' }" @click="setShape('rect')">eckig</button>
            <button type="button" :class="{ on: obj.shape === 'round' }" @click="setShape('round')">rund</button>
          </div>
        </div>
      </template>

      <label>
        {{ obj.shape === 'round' ? 'Durchmesser (cm)' : 'Breite (cm)' }}
        <input type="number" min="5" step="5" :value="obj.width" @input="num('width', $event)" />
      </label>
      <div v-if="obj.kind === 'door'" class="seg">
        <span>Anschlag</span>
        <div>
          <button type="button" :class="{ on: !obj.flip }" @click="plan.updateObject(obj.id, { flip: false })">links</button>
          <button type="button" :class="{ on: obj.flip }" @click="plan.updateObject(obj.id, { flip: true })">rechts</button>
        </div>
        <p class="hint">Türen rasten automatisch an der nächsten Wand ein.</p>
      </div>
      <label v-if="obj.shape !== 'round' && obj.kind !== 'door'">
        Tiefe (cm)
        <input type="number" min="5" step="5" :value="obj.depth" @input="num('depth', $event)" />
      </label>
      <label>
        X (cm)
        <input type="number" step="10" :value="Math.round(obj.x)" @input="num('x', $event)" />
      </label>
      <label>
        Y (cm)
        <input type="number" step="10" :value="Math.round(obj.y)" @input="num('y', $event)" />
      </label>
      <label v-if="obj.kind !== 'door'">
        Drehung (°)
        <input type="number" step="15" :value="Math.round(obj.rotation)" @input="num('rotation', $event)" />
      </label>

      <div class="actions full">
        <button type="button" @click="plan.duplicateObject(obj.id)">Duplizieren</button>
        <button type="button" class="danger" @click="remove">Löschen</button>
      </div>
    </form>
  </section>
</template>

<style scoped>
.fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.kind {
  grid-column: 1 / -1;
  margin: 0;
  font-weight: 700;
}
.full,
.seg {
  grid-column: 1 / -1;
}
.seg > div {
  display: flex;
  gap: 4px;
  margin-top: 4px;
}
.seg button {
  flex: 1;
}
.seg button.on {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.actions {
  display: flex;
  gap: 8px;
}
.actions button {
  flex: 1;
}
</style>
