<script setup lang="ts">
import { CATALOG } from '../../catalog'
import { usePlanStore } from '../../stores/plan'

const plan = usePlanStore()
</script>

<template>
  <section class="panel">
    <h2>Objekte</h2>
    <p class="hint">Klicken zum Einfügen – landet in der Raummitte.</p>
    <div class="items">
      <button v-for="item in CATALOG" :key="item.key" type="button" class="item" @click="plan.addFromCatalog(item)">
        <span class="swatch" :class="`sw-${item.kind}`" :data-round="item.shape === 'round' || undefined" />
        <span>{{ item.name }}</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.items {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.item {
  display: flex;
  align-items: center;
  gap: 10px;
  text-align: left;
  background: var(--bg-panel);
}
.swatch {
  width: 18px;
  height: 14px;
  border-radius: 3px;
  flex: none;
  border: 2px solid transparent;
}
.swatch[data-round] {
  border-radius: 50%;
  height: 18px;
}
.sw-table {
  background: var(--wood);
  border-color: var(--wood-stroke);
}
.sw-plant {
  background: #4f8a3c;
  border-radius: 50%;
  height: 18px;
}
.sw-bar {
  background: #7a5232;
}
.sw-wall {
  background: var(--wall);
  height: 6px;
}
.sw-pillar {
  background: #9a9a9a;
  width: 14px;
}
.sw-door {
  border: 2px dashed var(--muted);
  border-radius: 0 100% 0 0;
}
.sw-text {
  border: 1px dashed var(--muted);
}
</style>
