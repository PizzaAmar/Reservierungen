<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, useId, watch } from 'vue'
import type { PlanObject, Point } from '../../types'
import { usePlanStore } from '../../stores/plan'
import {
  boundingBox,
  isOutsideRoom,
  normalizeAngle,
  rotatePoint,
  snap,
  snapVertex,
  WALL_THICKNESS,
} from '../../utils/geometry'
import PlanObjectShape, { type TableStatus } from './PlanObjectShape.vue'

const props = defineProps<{
  mode: 'edit' | 'view'
  /** Editor: Raumform statt Objekte bearbeiten */
  wallEdit?: boolean
  /** Ansicht: Farbe je Tisch */
  statusFor?: (obj: PlanObject) => TableStatus
}>()

const emit = defineEmits<{ tableClick: [obj: PlanObject] }>()

const plan = usePlanStore()
const svg = ref<SVGSVGElement | null>(null)
const pixelSize = reactive({ w: 800, h: 600 })
const view = reactive({ x: 0, y: 0, w: 1000, h: 700 })
const MARGIN = 120
const clipId = `room-clip-${useId()}`

const room = computed(() => plan.activeRoom)
const editable = computed(() => props.mode === 'edit')
const objectsEditable = computed(() => editable.value && !props.wallEdit)
/** cm pro Bildschirmpixel (für Griffgrößen) */
const unit = computed(() => Math.max(view.w / Math.max(1, pixelSize.w), view.h / Math.max(1, pixelSize.h)))
const step = computed(() => (plan.snapEnabled ? plan.gridSize : 1))

const pointsAttr = computed(() => room.value?.points.map((p) => `${p.x},${p.y}`).join(' ') ?? '')

/** Wände mit Mittelpunkt, Länge, Normale nach außen und lesbarer Beschriftungs-Drehung */
const walls = computed(() => {
  const pts = room.value?.points ?? []
  return pts.map((a, i) => {
    const b = pts[(i + 1) % pts.length]!
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.hypot(dx, dy) || 1
    // Uhrzeigersinn: (-dy, dx) zeigt nach innen, also (dy, -dx) nach außen
    const out = { x: dy / len, y: -dx / len }
    let angle = normalizeAngle((Math.atan2(dy, dx) * 180) / Math.PI)
    if (angle > 90 && angle <= 270) angle -= 180
    return { i, a, b, len, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, out, angle }
  })
})

function fit() {
  if (!room.value) return
  const bb = boundingBox(room.value.points)
  view.x = bb.minX - MARGIN
  view.y = bb.minY - MARGIN
  view.w = bb.maxX - bb.minX + MARGIN * 2
  view.h = bb.maxY - bb.minY + MARGIN * 2
}

watch(() => room.value?.id, fit)
defineExpose({ fit })

let resizeObs: ResizeObserver | undefined
onMounted(() => {
  fit()
  if (svg.value) {
    resizeObs = new ResizeObserver(() => {
      pixelSize.w = svg.value?.clientWidth ?? 800
      pixelSize.h = svg.value?.clientHeight ?? 600
    })
    resizeObs.observe(svg.value)
  }
})
onBeforeUnmount(() => resizeObs?.disconnect())

function toSvg(e: { clientX: number; clientY: number }): Point {
  const ctm = svg.value?.getScreenCTM()
  if (!ctm) return { x: 0, y: 0 }
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse())
  return { x: p.x, y: p.y }
}

// --- Zoom ---
function onWheel(e: WheelEvent) {
  e.preventDefault()
  const p = toSvg(e)
  const factor = e.deltaY > 0 ? 1.12 : 1 / 1.12
  const newW = Math.min(20000, Math.max(100, view.w * factor))
  const k = newW / view.w
  view.x = p.x - (p.x - view.x) * k
  view.y = p.y - (p.y - view.y) * k
  view.w = newW
  view.h *= k
}

function zoomBy(factor: number) {
  const cx = view.x + view.w / 2
  const cy = view.y + view.h / 2
  view.w *= factor
  view.h *= factor
  view.x = cx - view.w / 2
  view.y = cy - view.h / 2
}

// --- Ziehen (Ansicht, Objekte, Ecken, Wände) ---
type Drag =
  | { type: 'pan'; startX: number; startY: number; viewX: number; viewY: number }
  | { type: 'move'; id: string; start: Point; objX: number; objY: number; moved: boolean }
  | { type: 'rotate'; id: string }
  | { type: 'resize'; id: string; sx: number; sy: number; cx: number; cy: number; w: number; d: number; rot: number }
  | { type: 'vertex'; roomId: string; index: number; moved: boolean }
  | { type: 'wall'; roomId: string; index: number; start: Point; startPoints: Point[]; normal: Point; moved: boolean }

let drag: Drag | null = null

function capture(e: PointerEvent) {
  try {
    svg.value?.setPointerCapture(e.pointerId)
  } catch {
    // Zeiger bereits weg – Ziehen funktioniert trotzdem, solange er über der Fläche bleibt
  }
}

function onBackgroundDown(e: PointerEvent) {
  if (e.button !== 0) return
  if (editable.value) {
    plan.selectedId = null
    plan.selectedVertex = null
  }
  drag = { type: 'pan', startX: e.clientX, startY: e.clientY, viewX: view.x, viewY: view.y }
  capture(e)
}

function onBodyDown(obj: PlanObject, e: PointerEvent) {
  if (e.button !== 0) return
  e.stopPropagation()
  if (!editable.value) {
    if (obj.kind === 'table') emit('tableClick', obj)
    return
  }
  plan.selectedId = obj.id
  plan.checkpoint()
  drag = { type: 'move', id: obj.id, start: toSvg(e), objX: obj.x, objY: obj.y, moved: false }
  capture(e)
}

function onRotateDown(obj: PlanObject, e: PointerEvent) {
  plan.checkpoint()
  drag = { type: 'rotate', id: obj.id }
  capture(e)
}

function onResizeDown(obj: PlanObject, e: PointerEvent, sx: number, sy: number) {
  plan.checkpoint()
  drag = { type: 'resize', id: obj.id, sx, sy, cx: obj.x, cy: obj.y, w: obj.width, d: obj.depth, rot: obj.rotation }
  capture(e)
}

function onVertexDown(index: number, e: PointerEvent) {
  if (e.button !== 0 || !room.value) return
  e.stopPropagation()
  plan.selectedVertex = index
  plan.checkpoint()
  drag = { type: 'vertex', roomId: room.value.id, index, moved: false }
  capture(e)
}

function onWallDown(index: number, e: PointerEvent) {
  if (e.button !== 0 || !room.value) return
  e.stopPropagation()
  const w = walls.value[index]
  if (!w) return
  plan.selectedVertex = null
  plan.checkpoint()
  drag = {
    type: 'wall',
    roomId: room.value.id,
    index,
    start: toSvg(e),
    startPoints: room.value.points.map((p) => ({ ...p })),
    normal: w.out,
    moved: false,
  }
  capture(e)
}

function onPointerMove(e: PointerEvent) {
  if (!drag) return
  if (drag.type === 'pan') {
    const k = unit.value
    view.x = drag.viewX - (e.clientX - drag.startX) * k
    view.y = drag.viewY - (e.clientY - drag.startY) * k
    return
  }
  const p = toSvg(e)
  const g = drag
  if (g.type === 'move') {
    const nx = snap(g.objX + p.x - g.start.x, step.value)
    const ny = snap(g.objY + p.y - g.start.y, step.value)
    g.moved = true
    plan.updateObjectLive(g.id, { x: nx, y: ny })
  } else if (g.type === 'rotate') {
    const obj = plan.objects.find((o) => o.id === g.id)
    if (!obj) return
    let angle = (Math.atan2(p.y - obj.y, p.x - obj.x) * 180) / Math.PI + 90
    if (!e.shiftKey) angle = snap(angle, 15)
    plan.updateObjectLive(obj.id, { rotation: angle })
  } else if (g.type === 'resize') {
    // Zeiger ins ungedrehte Objekt-Koordinatensystem; gegenüberliegende Ecke bleibt fest.
    const local = rotatePoint({ x: p.x - g.cx, y: p.y - g.cy }, -g.rot)
    const oppX = -g.sx * (g.w / 2)
    const oppY = -g.sy * (g.d / 2)
    const min = 10
    let w = Math.max(min, snap(g.sx * (local.x - oppX), step.value))
    let depth = Math.max(min, snap(g.sy * (local.y - oppY), step.value))
    const obj = plan.objects.find((o) => o.id === g.id)
    if (obj?.shape === 'round') w = depth = Math.max(w, depth)
    const center = rotatePoint({ x: oppX + (g.sx * w) / 2, y: oppY + (g.sy * depth) / 2 }, g.rot)
    plan.updateObjectLive(g.id, { width: w, depth, x: g.cx + center.x, y: g.cy + center.y })
  } else if (g.type === 'vertex') {
    const pts = room.value?.points
    if (!pts) return
    const n = pts.length
    const prev = pts[(g.index - 1 + n) % n]!
    const next = pts[(g.index + 1) % n]!
    // Magnet an Nachbarecken (rechte Winkel), Shift = frei/schräg
    const tolerance = Math.max(15, 12 * unit.value)
    plan.moveVertexLive(g.roomId, g.index, snapVertex(p, prev, next, step.value, e.shiftKey, tolerance))
    g.moved = true
  } else if (g.type === 'wall') {
    // Wand nur senkrecht zu sich selbst verschieben
    const dist = snap((p.x - g.start.x) * g.normal.x + (p.y - g.start.y) * g.normal.y, step.value)
    plan.moveWallLive(g.roomId, g.index, g.startPoints, g.normal.x * dist, g.normal.y * dist)
    g.moved = true
  }
}

function onPointerUp(e: PointerEvent) {
  const g = drag
  drag = null
  if ((g?.type === 'move' || g?.type === 'vertex' || g?.type === 'wall') && !g.moved) {
    // Nur angeklickt: leeren Undo-Schritt wieder verwerfen
    plan.undoIfUnchanged()
  }
  if ((g?.type === 'vertex' || g?.type === 'wall') && g.moved) plan.finishShapeEdit(g.roomId)
  if (svg.value?.hasPointerCapture(e.pointerId)) svg.value.releasePointerCapture(e.pointerId)
}

function onVertexDblClick(index: number) {
  if (room.value) plan.removeVertex(room.value.id, index)
}

function outside(obj: PlanObject) {
  // Türen sitzen absichtlich in der Wand
  return room.value && obj.kind !== 'door' ? isOutsideRoom(obj, room.value.points) : false
}

function meters(cm: number) {
  return (cm / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' m'
}

const dimFont = computed(() => Math.max(16, 13 * unit.value))
const handleR = computed(() => 8 * unit.value)

// Griffe/Auswahl zuletzt zeichnen, damit sie über anderen Objekten liegen.
// Türen kommen in eine eigene Ebene über der Raumwand, damit sie die Wandlinie lückenlos unterbrechen.
const layers = computed(() => {
  const list = [...plan.roomObjects]
  const order = { door: 0, wall: 1, text: 2, plant: 3, pillar: 3, bar: 4, table: 5 } as const
  list.sort((a, b) => order[a.kind] - order[b.kind])
  const i = list.findIndex((o) => o.id === plan.selectedId)
  if (i >= 0) list.push(...list.splice(i, 1))
  return [list.filter((o) => o.kind !== 'door'), list.filter((o) => o.kind === 'door')] as const
})
</script>

<template>
  <div class="canvas-wrap">
    <svg
      ref="svg"
      class="canvas"
      :viewBox="`${view.x} ${view.y} ${view.w} ${view.h}`"
      preserveAspectRatio="xMidYMid meet"
      @wheel="onWheel"
      @pointerdown="onBackgroundDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <defs>
        <pattern id="grid-small" width="50" height="50" patternUnits="userSpaceOnUse">
          <path d="M 50 0 L 0 0 0 50" class="grid-line" />
        </pattern>
        <pattern id="grid-big" width="100" height="100" patternUnits="userSpaceOnUse">
          <rect width="100" height="100" fill="url(#grid-small)" />
          <path d="M 100 0 L 0 0 0 100" class="grid-line big" />
        </pattern>
        <clipPath :id="clipId">
          <polygon :points="pointsAttr" />
        </clipPath>
      </defs>

      <template v-if="room">
        <polygon :points="pointsAttr" class="floor" />
        <rect
          :x="room.points.length ? Math.min(...room.points.map((p) => p.x)) : 0"
          :y="room.points.length ? Math.min(...room.points.map((p) => p.y)) : 0"
          :width="room.width"
          :height="room.depth"
          fill="url(#grid-big)"
          :clip-path="`url(#${clipId})`"
          class="no-events"
        />

        <g :class="{ 'objects-locked': wallEdit }">
          <template v-for="(layer, li) in layers" :key="li">
            <polygon
              v-if="li === 1"
              :points="pointsAttr"
              class="room-border no-events"
              :stroke-width="WALL_THICKNESS"
            />
            <PlanObjectShape
              v-for="obj in layer"
              :key="obj.id"
              :obj="obj"
              :selected="objectsEditable && obj.id === plan.selectedId"
              :outside="outside(obj)"
              :editable="objectsEditable"
              :status="statusFor?.(obj) ?? null"
              :unit="unit"
              @body-down="onBodyDown(obj, $event)"
              @rotate-down="onRotateDown(obj, $event)"
              @resize-down="(e, sx, sy) => onResizeDown(obj, e, sx, sy)"
            />
          </template>
        </g>

        <!-- Wandmaße -->
        <text
          v-for="w in walls"
          :key="`dim${w.i}`"
          :transform="`translate(${w.mid.x + w.out.x * (WALL_THICKNESS + dimFont)} ${w.mid.y + w.out.y * (WALL_THICKNESS + dimFont)}) rotate(${w.angle})`"
          class="dim"
          text-anchor="middle"
          dominant-baseline="central"
          :font-size="dimFont"
        >
          {{ meters(w.len) }}
        </text>

        <!-- Wände bearbeiten: Wand ziehen, + = Ecke einfügen, Ecken ziehen -->
        <g v-if="wallEdit" class="wall-edit">
          <line
            v-for="w in walls"
            :key="`hit${w.i}`"
            :x1="w.a.x"
            :y1="w.a.y"
            :x2="w.b.x"
            :y2="w.b.y"
            class="wall-hit"
            :stroke-width="Math.max(WALL_THICKNESS * 2, 14 * unit)"
            @pointerdown="onWallDown(w.i, $event)"
          >
            <title>Wand ziehen zum Verschieben</title>
          </line>
          <g
            v-for="w in walls"
            :key="`add${w.i}`"
            class="add-vertex"
            :transform="`translate(${w.mid.x} ${w.mid.y})`"
            @pointerdown.stop="room && plan.insertVertex(room.id, w.i)"
          >
            <title>Ecke einfügen</title>
            <circle :r="handleR * 0.9" :stroke-width="1.5 * unit" />
            <path
              :d="`M ${-handleR * 0.5} 0 H ${handleR * 0.5} M 0 ${-handleR * 0.5} V ${handleR * 0.5}`"
              :stroke-width="2 * unit"
            />
          </g>
          <circle
            v-for="(p, i) in room.points"
            :key="`v${i}`"
            :cx="p.x"
            :cy="p.y"
            :r="handleR"
            :class="['vertex', { active: plan.selectedVertex === i }]"
            :stroke-width="2 * unit"
            @pointerdown="onVertexDown(i, $event)"
            @dblclick.stop="onVertexDblClick(i)"
          >
            <title>Ecke ziehen (Shift = schräg), Doppelklick/Entf = löschen</title>
          </circle>
        </g>
      </template>
    </svg>

    <div class="zoom-controls">
      <button type="button" title="Vergrößern" @click="zoomBy(1 / 1.25)">+</button>
      <button type="button" title="Verkleinern" @click="zoomBy(1.25)">−</button>
      <button type="button" title="Ganzen Raum zeigen" @click="fit">⤢</button>
    </div>
  </div>
</template>

<style scoped>
.canvas-wrap {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
}
.canvas {
  width: 100%;
  height: 100%;
  display: block;
  background: var(--bg-canvas);
  touch-action: none;
  user-select: none;
  cursor: grab;
}
.canvas:active {
  cursor: grabbing;
}
.floor {
  fill: var(--floor);
}
.grid-line {
  fill: none;
  stroke: var(--grid);
  stroke-width: 1;
}
.grid-line.big {
  stroke: var(--grid-big);
  stroke-width: 1.5;
}
.no-events {
  pointer-events: none;
}
.objects-locked {
  pointer-events: none;
}
/* Möbel abblenden; Türen bleiben deckend, sonst scheint die Wand durch die Öffnung */
.objects-locked :deep(.obj:not(.obj-door)) {
  opacity: 0.55;
}
.room-border {
  fill: none;
  stroke: var(--wall);
  stroke-linejoin: miter;
  stroke-miterlimit: 10;
}
.dim {
  fill: var(--muted);
  font-weight: 600;
  pointer-events: none;
}
.wall-hit {
  stroke: var(--accent);
  stroke-opacity: 0;
  cursor: move;
}
.wall-hit:hover {
  stroke-opacity: 0.25;
}
.add-vertex {
  cursor: copy;
}
.add-vertex circle {
  fill: #fff;
  stroke: var(--accent);
}
.add-vertex path {
  stroke: var(--accent);
}
.vertex {
  fill: #fff;
  stroke: var(--accent);
  cursor: grab;
}
.vertex.active {
  fill: var(--accent);
}
.zoom-controls {
  position: absolute;
  right: 12px;
  bottom: 12px;
  display: flex;
  gap: 4px;
}
.zoom-controls button {
  width: 36px;
  height: 36px;
  font-size: 18px;
  padding: 0;
}
</style>
