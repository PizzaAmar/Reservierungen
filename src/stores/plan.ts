import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { PlanObject, Point, Room } from '../types'
import { objectFromCatalog, type CatalogItem } from '../catalog'
import { newId } from '../utils/id'
import {
  boundingBox,
  ensureClockwise,
  nearestWallSegment,
  normalizeAngle,
  placeOnWallSegment,
  rectPoints,
  snap,
  WALL_THICKNESS,
} from '../utils/geometry'

interface Snapshot {
  rooms: Room[]
  objects: PlanObject[]
}

const HISTORY_LIMIT = 100
const COALESCE_MS = 1000

function makeRoom(name: string, width: number, depth: number, id = newId()): Room {
  return { id, name, points: rectPoints(width, depth), width, depth }
}

/** Bounding-Box-Maße aus der Form ableiten. */
function syncSize(room: Room) {
  const bb = boundingBox(room.points)
  room.width = bb.maxX - bb.minX
  room.depth = bb.maxY - bb.minY
}

export function sampleLayout(): Snapshot {
  const roomId = newId()
  const t = (label: string, x: number, y: number, seats: number, shape: 'rect' | 'round' = 'rect'): PlanObject => ({
    id: newId(),
    roomId,
    kind: 'table',
    shape,
    x,
    y,
    width: shape === 'round' ? 100 : seats > 4 ? 180 : seats > 2 ? 120 : 70,
    depth: shape === 'round' ? 100 : seats > 2 ? 80 : 70,
    rotation: 0,
    seats,
    label,
  })
  return {
    rooms: [makeRoom('Gastraum', 1000, 700, roomId)],
    objects: [
      t('1', 200, 150, 4),
      t('2', 450, 150, 4),
      t('3', 200, 400, 2),
      t('4', 450, 400, 6),
      t('5', 750, 300, 4, 'round'),
      { id: newId(), roomId, kind: 'bar', x: 800, y: 620, width: 300, depth: 70, rotation: 0, label: 'Theke' },
      { id: newId(), roomId, kind: 'plant', x: 950, y: 50, width: 50, depth: 50, rotation: 0 },
      { id: newId(), roomId, kind: 'door', x: 100, y: 700, width: 90, depth: WALL_THICKNESS, rotation: 180 },
    ],
  }
}

export const usePlanStore = defineStore('plan', () => {
  const rooms = ref<Room[]>([])
  const objects = ref<PlanObject[]>([])
  const activeRoomId = ref<string | null>(null)
  const selectedId = ref<string | null>(null)
  /** ausgewählte Raumecke im Modus „Wände bearbeiten“ */
  const selectedVertex = ref<number | null>(null)
  const gridSize = ref(10)
  const snapEnabled = ref(true)

  const past = ref<string[]>([])
  const future = ref<string[]>([])
  let lastCoalesceKey: string | null = null
  let lastCoalesceAt = 0
  /** Redo-Liste vor dem letzten Checkpoint – falls der sich als leer herausstellt */
  let futureBeforeCheckpoint: string[] = []

  const activeRoom = computed(() => rooms.value.find((r) => r.id === activeRoomId.value) ?? rooms.value[0] ?? null)
  const roomObjects = computed(() => objects.value.filter((o) => o.roomId === activeRoom.value?.id))
  const selected = computed(() => objects.value.find((o) => o.id === selectedId.value) ?? null)
  const tables = computed(() => objects.value.filter((o) => o.kind === 'table'))
  const canUndo = computed(() => past.value.length > 0)
  const canRedo = computed(() => future.value.length > 0)

  function snapshot(): string {
    return JSON.stringify({ rooms: rooms.value, objects: objects.value })
  }

  function restore(raw: string) {
    const s = JSON.parse(raw) as Snapshot
    rooms.value = s.rooms
    objects.value = s.objects
    if (!rooms.value.some((r) => r.id === activeRoomId.value)) activeRoomId.value = rooms.value[0]?.id ?? null
    if (!objects.value.some((o) => o.id === selectedId.value)) selectedId.value = null
    selectedVertex.value = null
  }

  /**
   * Zustand vor einer Änderung merken. Mehrere Änderungen mit demselben
   * coalesceKey kurz hintereinander (z. B. Tippen in ein Zahlenfeld) ergeben einen Undo-Schritt.
   */
  function checkpoint(coalesceKey?: string) {
    const now = Date.now()
    if (coalesceKey && coalesceKey === lastCoalesceKey && now - lastCoalesceAt < COALESCE_MS) {
      lastCoalesceAt = now
      return
    }
    lastCoalesceKey = coalesceKey ?? null
    lastCoalesceAt = now
    past.value.push(snapshot())
    if (past.value.length > HISTORY_LIMIT) past.value.shift()
    futureBeforeCheckpoint = future.value
    future.value = []
  }

  function undo() {
    const prev = past.value.pop()
    if (!prev) return
    future.value.push(snapshot())
    restore(prev)
    lastCoalesceKey = null
  }

  function redo() {
    const next = future.value.pop()
    if (!next) return
    past.value.push(snapshot())
    restore(next)
    lastCoalesceKey = null
  }

  /** Letzten Undo-Punkt verwerfen, falls sich seitdem nichts geändert hat (z. B. Objekt nur angeklickt). */
  function undoIfUnchanged() {
    if (past.value.length && past.value[past.value.length - 1] === snapshot()) {
      past.value.pop()
      future.value = futureBeforeCheckpoint
    }
  }

  function load(data: Snapshot) {
    // Ältere Daten kennen nur rechteckige Räume (width/depth)
    rooms.value = data.rooms.map((r) => (r.points?.length >= 3 ? r : { ...r, points: rectPoints(r.width, r.depth) }))
    objects.value = data.objects
    for (const room of rooms.value) normalizeShape(room)
    activeRoomId.value = rooms.value[0]?.id ?? null
    selectedId.value = null
    selectedVertex.value = null
    past.value = []
    future.value = []
  }

  // --- Räume ---
  function addRoom(name = 'Neuer Raum') {
    checkpoint()
    const room = makeRoom(name, 800, 600)
    rooms.value.push(room)
    activeRoomId.value = room.id
    selectedId.value = null
    selectedVertex.value = null
    return room
  }

  function renameRoom(id: string, name: string) {
    const room = rooms.value.find((r) => r.id === id)
    if (!room || room.name === name) return
    checkpoint(`room:${id}:name`)
    room.name = name
  }

  /** Raum als Rechteck mit Breite × Länge (cm) setzen. */
  function setRoomRect(id: string, width: number, depth: number) {
    const room = rooms.value.find((r) => r.id === id)
    if (!room) return
    checkpoint(`room:${id}:rect`)
    room.points = rectPoints(width, depth)
    normalizeShape(room)
  }

  /** Löscht den Raum samt Objekten; gibt die IDs der gelöschten Tische zurück. */
  function removeRoom(id: string): string[] {
    if (rooms.value.length <= 1) return []
    checkpoint()
    const removedTables = objects.value.filter((o) => o.roomId === id && o.kind === 'table').map((o) => o.id)
    objects.value = objects.value.filter((o) => o.roomId !== id)
    rooms.value = rooms.value.filter((r) => r.id !== id)
    if (activeRoomId.value === id) activeRoomId.value = rooms.value[0]?.id ?? null
    selectedId.value = null
    selectedVertex.value = null
    return removedTables
  }

  // --- Raumform (Wände) ---
  function roomDoors(roomId: string) {
    return objects.value.filter((o) => o.roomId === roomId && o.kind === 'door')
  }

  /**
   * Nach Formänderungen: Uhrzeigersinn sicherstellen, Größe ableiten, Türen nachführen.
   * Wurde die Reihenfolge umgedreht, stimmen die Wand-Nummern nicht mehr → Türen neu zuordnen.
   */
  function normalizeShape(room: Room) {
    const { points, reversed } = ensureClockwise(room.points)
    room.points = points
    syncSize(room)
    for (const d of roomDoors(room.id)) attachDoor(d, reversed ? 'nearest' : 'keep')
  }

  /** Ecke verschieben während des Ziehens (Checkpoint vorher setzen, danach finishShapeEdit). */
  function moveVertexLive(roomId: string, index: number, p: Point) {
    const room = rooms.value.find((r) => r.id === roomId)
    if (!room || !room.points[index]) return
    room.points[index] = p
    syncSize(room)
    for (const d of roomDoors(roomId)) attachDoor(d, 'keep')
  }

  /** Ganze Wand (beide Endpunkte) verschieben, ausgehend von der Form bei Drag-Beginn. */
  function moveWallLive(roomId: string, edgeIndex: number, start: Point[], dx: number, dy: number) {
    const room = rooms.value.find((r) => r.id === roomId)
    if (!room) return
    const n = start.length
    const a = edgeIndex % n
    const b = (edgeIndex + 1) % n
    const pts = start.map((p) => ({ ...p }))
    pts[a] = { x: start[a]!.x + dx, y: start[a]!.y + dy }
    pts[b] = { x: start[b]!.x + dx, y: start[b]!.y + dy }
    room.points = pts
    syncSize(room)
    for (const d of roomDoors(roomId)) attachDoor(d, 'keep')
  }

  function finishShapeEdit(roomId: string) {
    const room = rooms.value.find((r) => r.id === roomId)
    if (room) normalizeShape(room)
  }

  /** Neue Ecke in der Mitte von Wand `edgeIndex` einfügen. */
  function insertVertex(roomId: string, edgeIndex: number) {
    const room = rooms.value.find((r) => r.id === roomId)
    if (!room) return
    checkpoint()
    const n = room.points.length
    const a = room.points[edgeIndex % n]!
    const b = room.points[(edgeIndex + 1) % n]!
    const step = snapEnabled.value ? gridSize.value : 1
    const mid = { x: snap((a.x + b.x) / 2, step), y: snap((a.y + b.y) / 2, step) }
    room.points.splice(edgeIndex + 1, 0, mid)
    // Türen auf der geteilten Wand landen auf einer der beiden Hälften, spätere Wände rücken eins weiter
    for (const d of roomDoors(roomId)) {
      const wi = d.wallIndex ?? -1
      if (wi > edgeIndex) d.wallIndex = wi + 1
      else if (wi === edgeIndex) attachDoor(d, 'nearest')
    }
    normalizeShape(room)
    selectedVertex.value = edgeIndex + 1
  }

  function removeVertex(roomId: string, index: number) {
    const room = rooms.value.find((r) => r.id === roomId)
    if (!room || room.points.length <= 3) return
    checkpoint()
    const n = room.points.length
    const affected = [(index - 1 + n) % n, index]
    room.points.splice(index, 1)
    for (const d of roomDoors(roomId)) {
      const wi = d.wallIndex ?? -1
      if (affected.includes(wi)) d.wallIndex = undefined
      else if (wi > index) d.wallIndex = wi - 1
    }
    normalizeShape(room)
    selectedVertex.value = null
  }

  // --- Objekte ---
  function nextTableLabel(): string {
    const numbers = tables.value.map((t) => Number(t.label)).filter((n) => Number.isFinite(n))
    return String((numbers.length ? Math.max(...numbers) : 0) + 1)
  }

  function addFromCatalog(item: CatalogItem) {
    const room = activeRoom.value
    if (!room) return
    checkpoint()
    const bb = boundingBox(room.points)
    const cx = (bb.minX + bb.maxX) / 2
    const cy = (bb.minY + bb.maxY) / 2
    const obj: PlanObject = { id: newId(), ...objectFromCatalog(item, room.id, cx, cy) }
    if (obj.kind === 'table') obj.label = nextTableLabel()
    attachDoor(obj, 'nearest')
    objects.value.push(obj)
    selectedId.value = obj.id
  }

  function updateObject(id: string, patch: Partial<Omit<PlanObject, 'id'>>, coalesceKey?: string) {
    const obj = objects.value.find((o) => o.id === id)
    if (!obj) return
    checkpoint(coalesceKey ?? `obj:${id}:${Object.keys(patch).join()}`)
    applyPatch(obj, patch)
  }

  /** Änderung ohne Undo-Punkt – für laufende Drag-Aktionen (Checkpoint vorher setzen). */
  function updateObjectLive(id: string, patch: Partial<Omit<PlanObject, 'id'>>) {
    const obj = objects.value.find((o) => o.id === id)
    if (obj) applyPatch(obj, patch)
  }

  function applyPatch(obj: PlanObject, patch: Partial<Omit<PlanObject, 'id'>>) {
    Object.assign(obj, patch)
    if (patch.rotation !== undefined) obj.rotation = normalizeAngle(obj.rotation)
    obj.width = Math.max(5, obj.width)
    obj.depth = Math.max(5, obj.depth)
    if (obj.shape === 'round') obj.depth = obj.width
    // Verschieben → an die nächste Wand; sonst auf der bisherigen Wand bleiben
    attachDoor(obj, patch.x !== undefined || patch.y !== undefined ? 'nearest' : 'keep')
  }

  /** Türen sitzen immer genau in einer Raumwand (deckt die Wandlinie lückenlos ab). */
  function attachDoor(obj: PlanObject, mode: 'nearest' | 'keep') {
    if (obj.kind !== 'door') return
    const room = rooms.value.find((r) => r.id === obj.roomId)
    if (!room) return
    let index = obj.wallIndex
    let t = obj.wallT
    if (mode === 'nearest' || index === undefined || index >= room.points.length || t === undefined) {
      const hit = nearestWallSegment(obj, room.points)
      index = hit.index
      t = hit.t
    }
    const placed = placeOnWallSegment(room.points, index, t, obj.width)
    obj.x = placed.x
    obj.y = placed.y
    obj.rotation = placed.rotation
    obj.wallIndex = index
    obj.wallT = placed.t
    obj.depth = WALL_THICKNESS
  }

  function removeObject(id: string) {
    if (!objects.value.some((o) => o.id === id)) return
    checkpoint()
    objects.value = objects.value.filter((o) => o.id !== id)
    if (selectedId.value === id) selectedId.value = null
  }

  function duplicateObject(id: string) {
    const obj = objects.value.find((o) => o.id === id)
    if (!obj) return
    checkpoint()
    const copy: PlanObject = { ...obj, id: newId(), x: obj.x + 30, y: obj.y + 30 }
    if (copy.kind === 'table') copy.label = nextTableLabel()
    attachDoor(copy, 'nearest')
    objects.value.push(copy)
    selectedId.value = copy.id
  }

  return {
    rooms,
    objects,
    activeRoomId,
    selectedId,
    selectedVertex,
    gridSize,
    snapEnabled,
    activeRoom,
    roomObjects,
    selected,
    tables,
    canUndo,
    canRedo,
    checkpoint,
    undo,
    redo,
    undoIfUnchanged,
    load,
    addRoom,
    renameRoom,
    setRoomRect,
    removeRoom,
    moveVertexLive,
    moveWallLive,
    finishShapeEdit,
    insertVertex,
    removeVertex,
    addFromCatalog,
    updateObject,
    updateObjectLive,
    removeObject,
    duplicateObject,
  }
})
