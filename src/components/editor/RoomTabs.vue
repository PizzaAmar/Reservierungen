<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { usePlanStore } from '../../stores/plan'
import { useReservationsStore } from '../../stores/reservations'
import { isRect } from '../../utils/geometry'

defineProps<{ showSettings?: boolean }>()

const plan = usePlanStore()
const reservations = useReservationsStore()

const editingId = ref<string | null>(null)
const editName = ref('')
const renameInput = ref<HTMLInputElement[]>([])

const rectangular = computed(() => (plan.activeRoom ? isRect(plan.activeRoom.points) : false))

function select(id: string) {
  plan.activeRoomId = id
  plan.selectedId = null
  plan.selectedVertex = null
}

async function startRename(id: string, name: string) {
  editingId.value = id
  editName.value = name
  await nextTick()
  renameInput.value[0]?.select()
}

function commitRename() {
  if (editingId.value) plan.renameRoom(editingId.value, editName.value.trim() || 'Ohne Namen')
  editingId.value = null
}

function rename(e: Event) {
  if (plan.activeRoom) plan.renameRoom(plan.activeRoom.id, (e.target as HTMLInputElement).value)
}

function setMeters(field: 'width' | 'depth', e: Event) {
  const room = plan.activeRoom
  const m = Number((e.target as HTMLInputElement).value.replace(',', '.'))
  if (!room || !Number.isFinite(m) || m <= 0) return
  const cm = Math.round(m * 100)
  plan.setRoomRect(room.id, field === 'width' ? cm : room.width, field === 'depth' ? cm : room.depth)
}

function resetToRect() {
  const room = plan.activeRoom
  if (room && confirm('Raumform wieder auf ein Rechteck (Außenmaße) zurücksetzen?')) {
    plan.setRoomRect(room.id, Math.round(room.width), Math.round(room.depth))
  }
}

function removeRoom() {
  const room = plan.activeRoom
  if (!room || plan.rooms.length <= 1) return
  if (!confirm(`Raum „${room.name}“ mit allen Objekten löschen?`)) return
  reservations.dropTables(plan.removeRoom(room.id))
}
</script>

<template>
  <div class="rooms">
    <div class="tabs" role="tablist">
      <template v-for="room in plan.rooms" :key="room.id">
        <input
          v-if="editingId === room.id"
          ref="renameInput"
          v-model="editName"
          class="rename"
          type="text"
          aria-label="Raumname"
          @keydown.enter.prevent="commitRename"
          @keydown.esc.prevent="editingId = null"
          @blur="commitRename"
        />
        <button
          v-else
          type="button"
          role="tab"
          :aria-selected="room.id === plan.activeRoom?.id"
          :class="{ active: room.id === plan.activeRoom?.id }"
          :title="showSettings ? 'Doppelklick zum Umbenennen' : undefined"
          @click="select(room.id)"
          @dblclick="showSettings && startRename(room.id, room.name)"
        >
          {{ room.name || 'Ohne Namen' }}
        </button>
      </template>
      <button v-if="showSettings" type="button" class="add" title="Raum hinzufügen" @click="plan.addRoom()">+ Raum</button>
    </div>

    <div v-if="showSettings && plan.activeRoom" class="settings">
      <label>
        Name
        <input type="text" :value="plan.activeRoom.name" @input="rename" />
      </label>
      <template v-if="rectangular">
        <label>
          Breite (m)
          <input type="number" min="1" step="0.1" :value="plan.activeRoom.width / 100" @change="setMeters('width', $event)" />
        </label>
        <label>
          Länge (m)
          <input type="number" min="1" step="0.1" :value="plan.activeRoom.depth / 100" @change="setMeters('depth', $event)" />
        </label>
      </template>
      <template v-else>
        <span class="shape-info">
          Freie Form, außen {{ (plan.activeRoom.width / 100).toLocaleString('de-DE') }} ×
          {{ (plan.activeRoom.depth / 100).toLocaleString('de-DE') }} m
        </span>
        <button type="button" @click="resetToRect">Als Rechteck</button>
      </template>
      <button type="button" class="danger" :disabled="plan.rooms.length <= 1" @click="removeRoom">Raum löschen</button>
    </div>
  </div>
</template>

<style scoped>
.rooms {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 8px 16px;
}
.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.tabs button.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.tabs .add {
  border-style: dashed;
}
.rename {
  width: 140px;
  padding: 6px 10px;
}
.settings {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 8px;
}
.settings label {
  width: 110px;
}
.settings label:first-child {
  width: 160px;
}
.shape-info {
  color: var(--muted);
  font-size: 13px;
  padding-bottom: 9px;
}
</style>
