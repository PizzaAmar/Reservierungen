<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import PlanCanvas from '../components/plan/PlanCanvas.vue'
import ObjectPalette from '../components/editor/ObjectPalette.vue'
import PropertiesPanel from '../components/editor/PropertiesPanel.vue'
import RoomTabs from '../components/editor/RoomTabs.vue'
import { usePlanStore } from '../stores/plan'
import { useReservationsStore } from '../stores/reservations'
import { exportJson, importJson } from '../stores/persistence'

const plan = usePlanStore()
const reservations = useReservationsStore()
const fileInput = ref<HTMLInputElement | null>(null)
const wallEdit = ref(false)

function toggleWallEdit() {
  wallEdit.value = !wallEdit.value
  plan.selectedId = null
  plan.selectedVertex = null
}

async function onImport(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!confirm('Aktuellen Raumplan und alle Reservierungen durch die Datei ersetzen?')) return
  try {
    await importJson(file)
  } catch (err) {
    alert(`Import fehlgeschlagen: ${err instanceof Error ? err.message : err}`)
  }
}

function isTyping(e: KeyboardEvent) {
  const el = e.target as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
}

function onKey(e: KeyboardEvent) {
  if (isTyping(e)) return
  const ctrl = e.ctrlKey || e.metaKey
  const key = e.key.toLowerCase()
  if (ctrl && key === 'z' && !e.shiftKey) {
    e.preventDefault()
    plan.undo()
    return
  }
  if (ctrl && (key === 'y' || (key === 'z' && e.shiftKey))) {
    e.preventDefault()
    plan.redo()
    return
  }
  if (wallEdit.value) {
    const room = plan.activeRoom
    if (room && plan.selectedVertex !== null && (e.key === 'Delete' || e.key === 'Backspace')) {
      e.preventDefault()
      plan.removeVertex(room.id, plan.selectedVertex)
    } else if (e.key === 'Escape') {
      plan.selectedVertex = null
    }
    return
  }
  const sel = plan.selected
  if (!sel) return
  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault()
    if (sel.kind === 'table' && reservations.reservations.some((r) => r.tableIds.includes(sel.id))) {
      if (!confirm('Für diesen Tisch gibt es Reservierungen. Trotzdem löschen?')) return
      reservations.dropTables([sel.id])
    }
    plan.removeObject(sel.id)
  } else if (ctrl && key === 'd') {
    e.preventDefault()
    plan.duplicateObject(sel.id)
  } else if (e.key === 'Escape') {
    plan.selectedId = null
  } else if (e.key.startsWith('Arrow')) {
    e.preventDefault()
    const s = e.shiftKey ? 50 : plan.snapEnabled ? plan.gridSize : 1
    const dx = e.key === 'ArrowLeft' ? -s : e.key === 'ArrowRight' ? s : 0
    const dy = e.key === 'ArrowUp' ? -s : e.key === 'ArrowDown' ? s : 0
    plan.updateObject(sel.id, { x: sel.x + dx, y: sel.y + dy }, `arrow:${sel.id}`)
  }
}

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="editor">
    <header class="toolbar">
      <RoomTabs show-settings />
      <div class="tools">
        <button
          type="button"
          :class="{ primary: wallEdit }"
          title="Raumform ändern: Ecken und Wände ziehen"
          @click="toggleWallEdit"
        >
          {{ wallEdit ? '✓ Wände fertig' : 'Wände bearbeiten' }}
        </button>
        <button type="button" :disabled="!plan.canUndo" title="Rückgängig (Strg+Z)" @click="plan.undo()">↶ Rückgängig</button>
        <button type="button" :disabled="!plan.canRedo" title="Wiederholen (Strg+Y)" @click="plan.redo()">↷ Wiederholen</button>
        <label class="check">
          <input v-model="plan.snapEnabled" type="checkbox" />
          Raster {{ plan.gridSize }} cm
        </label>
        <button type="button" title="Plan als Datei sichern" @click="exportJson">Exportieren</button>
        <button type="button" title="Plan aus Datei laden" @click="fileInput?.click()">Importieren</button>
        <input ref="fileInput" type="file" accept="application/json,.json" hidden @change="onImport" />
      </div>
    </header>

    <div class="layout">
      <aside class="side"><ObjectPalette /></aside>
      <main class="stage"><PlanCanvas mode="edit" :wall-edit="wallEdit" /></main>
      <aside class="side"><PropertiesPanel /></aside>
    </div>

    <p v-if="wallEdit" class="hint footer-hint">
      Ecke ziehen = verschieben (rastet rechtwinklig ein, Shift = schräg) · Wand ziehen = parallel verschieben · + in der
      Wandmitte = Ecke einfügen · Ecke doppelklicken oder Entf = Ecke löschen
    </p>
    <p v-else class="hint footer-hint">
      Ziehen = verschieben · runder Griff = drehen (Shift: stufenlos) · Ecken = Größe · Entf = löschen · Strg+D =
      duplizieren · Pfeiltasten = fein verschieben · Mausrad = zoomen · Hintergrund ziehen = Ansicht verschieben
    </p>
  </div>
</template>

<style scoped>
.editor {
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
.tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.check {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
  padding: 0 6px;
}
.layout {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 200px 1fr 260px;
  gap: 12px;
}
.side {
  overflow-y: auto;
}
.stage {
  min-height: 420px;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}
.footer-hint {
  margin: 0;
}
@media (max-width: 1000px) {
  .layout {
    grid-template-columns: 1fr;
  }
  .stage {
    order: -1;
    height: 60vh;
  }
}
</style>
