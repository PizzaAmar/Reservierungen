<script setup lang="ts">
import { computed } from 'vue'
import type { PlanObject } from '../../types'
import { CHAIR_SIZE, chairPositions } from '../../utils/geometry'

export type TableStatus = 'free' | 'busy' | 'picked' | null

const props = defineProps<{
  obj: PlanObject
  selected: boolean
  outside: boolean
  editable: boolean
  status?: TableStatus
  /** cm pro Bildschirmpixel – hält Griffe unabhängig vom Zoom gleich groß */
  unit: number
}>()

const emit = defineEmits<{
  bodyDown: [e: PointerEvent]
  rotateDown: [e: PointerEvent]
  resizeDown: [e: PointerEvent, sx: number, sy: number]
}>()

const hw = computed(() => props.obj.width / 2)
const hd = computed(() => props.obj.depth / 2)

const chairs = computed(() =>
  props.obj.kind === 'table'
    ? chairPositions(props.obj.shape ?? 'rect', props.obj.width, props.obj.depth, props.obj.seats ?? 0)
    : [],
)

/** Platz für Stühle im Auswahlrahmen */
const pad = computed(() => (props.obj.kind === 'table' && chairs.value.length ? CHAIR_SIZE + 12 : 6))

const tableFill = computed(() => {
  switch (props.status) {
    case 'free':
      return 'var(--free)'
    case 'busy':
      return 'var(--busy)'
    case 'picked':
      return 'var(--picked)'
    default:
      return 'var(--wood)'
  }
})

const labelSize = computed(() => Math.max(14, Math.min(34, Math.min(props.obj.width, props.obj.depth) * 0.4)))
const handleR = computed(() => 7 * props.unit)
const corners = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
] as const
</script>

<template>
  <g
    :transform="`translate(${obj.x} ${obj.y}) rotate(${obj.rotation})`"
    :class="['obj', `obj-${obj.kind}`, { editable, clickable: !editable && obj.kind === 'table' }]"
    @pointerdown="emit('bodyDown', $event)"
  >
    <!-- Tisch -->
    <template v-if="obj.kind === 'table'">
      <rect
        v-for="(c, i) in chairs"
        :key="i"
        :x="-CHAIR_SIZE / 2"
        :y="-CHAIR_SIZE / 2"
        :width="CHAIR_SIZE"
        :height="CHAIR_SIZE"
        rx="10"
        class="chair"
        :transform="`translate(${c.x} ${c.y}) rotate(${c.rotation})`"
      />
      <ellipse v-if="obj.shape === 'round'" :rx="hw" :ry="hd" class="table" :style="{ fill: tableFill }" />
      <rect
        v-else
        :x="-hw"
        :y="-hd"
        :width="obj.width"
        :height="obj.depth"
        rx="6"
        class="table"
        :style="{ fill: tableFill }"
      />
    </template>

    <!-- Pflanze -->
    <template v-else-if="obj.kind === 'plant'">
      <ellipse :rx="hw" :ry="hd" class="plant-pot" />
      <ellipse
        v-for="i in 6"
        :key="i"
        :cx="Math.cos((i * Math.PI) / 3) * hw * 0.45"
        :cy="Math.sin((i * Math.PI) / 3) * hd * 0.45"
        :rx="hw * 0.45"
        :ry="hd * 0.45"
        class="plant-leaf"
      />
    </template>

    <!-- Tür: Öffnung in der Wand (deckt die Wandlinie ab) + Türblatt + Öffnungsbogen in den Raum -->
    <g v-else-if="obj.kind === 'door'" :transform="obj.flip ? 'scale(-1 1)' : undefined">
      <rect :x="-hw" :y="-hd - 1" :width="obj.width" :height="obj.depth + 2" class="door-opening" />
      <line :x1="-hw" :y1="-hd - 1" :x2="-hw" :y2="hd + 1" class="door-jamb" />
      <line :x1="hw" :y1="-hd - 1" :x2="hw" :y2="hd + 1" class="door-jamb" />
      <path :d="`M ${hw} ${hd} A ${obj.width} ${obj.width} 0 0 1 ${-hw} ${hd + obj.width}`" class="door-swing" />
      <line :x1="-hw" :y1="hd" :x2="-hw" :y2="hd + obj.width" class="door-leaf" />
    </g>

    <!-- Beschriftung -->
    <template v-else-if="obj.kind === 'text'">
      <rect :x="-hw" :y="-hd" :width="obj.width" :height="obj.depth" class="text-box" />
    </template>

    <!-- Theke, Wand, Säule -->
    <rect v-else :x="-hw" :y="-hd" :width="obj.width" :height="obj.depth" :class="`shape-${obj.kind}`" />

    <!-- Bezeichnung, bleibt waagerecht lesbar -->
    <text
      v-if="obj.label && obj.kind !== 'door'"
      :transform="`rotate(${-obj.rotation})`"
      :font-size="obj.kind === 'text' ? obj.depth * 0.7 : labelSize"
      :class="['label', `label-${obj.kind}`]"
      dominant-baseline="central"
      text-anchor="middle"
    >
      {{ obj.label }}
    </text>

    <!-- Außerhalb des Raums -->
    <rect
      v-if="outside"
      :x="-hw - 4"
      :y="-hd - 4"
      :width="obj.width + 8"
      :height="obj.depth + 8"
      class="outside"
    />

    <!-- Auswahl + Griffe -->
    <template v-if="selected">
      <rect
        :x="-hw - pad"
        :y="-hd - pad"
        :width="obj.width + pad * 2"
        :height="obj.depth + pad * 2"
        class="selection"
        :stroke-width="1.5 * unit"
        :stroke-dasharray="`${6 * unit} ${4 * unit}`"
      />
      <template v-if="editable">
        <!-- Türen richten sich nach der Wand, daher kein Drehgriff -->
        <template v-if="obj.kind !== 'door'">
          <line
            x1="0"
            :y1="-hd - pad"
            x2="0"
            :y2="-hd - pad - 28 * unit"
            class="handle-line"
            :stroke-width="1.5 * unit"
          />
          <circle
            cx="0"
            :cy="-hd - pad - 28 * unit"
            :r="handleR"
            class="handle rotate"
            :stroke-width="1.5 * unit"
            @pointerdown.stop="emit('rotateDown', $event)"
          />
        </template>
        <rect
          v-for="[sx, sy] in corners"
          :key="`${sx}${sy}`"
          :x="sx * hw - handleR"
          :y="sy * hd - handleR"
          :width="handleR * 2"
          :height="handleR * 2"
          class="handle resize"
          :stroke-width="1.5 * unit"
          @pointerdown.stop="emit('resizeDown', $event, sx, sy)"
        />
      </template>
    </template>
  </g>
</template>

<style scoped>
.obj.editable {
  cursor: move;
}
.obj.clickable {
  cursor: pointer;
}
.chair {
  fill: var(--chair);
  stroke: var(--chair-stroke);
  stroke-width: 2;
}
.table {
  stroke: var(--wood-stroke);
  stroke-width: 3;
}
.plant-pot {
  fill: #6b4f3a;
}
.plant-leaf {
  fill: #4f8a3c;
  stroke: #36682a;
  stroke-width: 1.5;
  opacity: 0.9;
}
.shape-bar {
  fill: #7a5232;
  stroke: #4e321d;
  stroke-width: 3;
}
.shape-wall {
  fill: var(--wall);
}
.shape-pillar {
  fill: #9a9a9a;
  stroke: #666;
  stroke-width: 2;
}
.door-opening {
  fill: var(--floor);
}
.door-jamb {
  stroke: var(--wall);
  stroke-width: 4;
}
.door-swing {
  fill: none;
  stroke: var(--muted);
  stroke-width: 2;
  stroke-dasharray: 8 6;
}
.door-leaf {
  stroke: var(--wall);
  stroke-width: 4;
}
.text-box {
  fill: transparent;
}
.label {
  fill: var(--text);
  font-weight: 600;
  pointer-events: none;
  user-select: none;
}
.label-bar {
  fill: #fff;
}
.outside {
  fill: none;
  stroke: var(--danger);
  stroke-width: 4;
  stroke-dasharray: 10 6;
  pointer-events: none;
}
.selection {
  fill: none;
  stroke: var(--accent);
  pointer-events: none;
}
.handle-line {
  stroke: var(--accent);
}
.handle {
  fill: #fff;
  stroke: var(--accent);
}
.handle.rotate {
  cursor: grab;
}
.handle.resize {
  cursor: nwse-resize;
}
</style>
