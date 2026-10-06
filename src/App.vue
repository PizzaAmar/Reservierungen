<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <div class="app">
    <nav class="nav">
      <strong class="brand">Pizzahaus</strong>
      <RouterLink to="/">Reservierungen</RouterLink>
      <RouterLink to="/raumplan">Raumplan bearbeiten</RouterLink>
    </nav>
    <div class="content">
      <RouterView />
    </div>
  </div>
</template>

<style scoped>
.app {
  height: 100vh;
  display: flex;
  flex-direction: column;
}
.nav {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-panel);
}
.brand {
  margin-right: 16px;
  color: var(--accent);
  font-size: 18px;
}
.nav a {
  padding: 6px 12px;
  border-radius: 6px;
  color: var(--text);
  text-decoration: none;
}
.nav a.router-link-exact-active {
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 600;
}
.content {
  flex: 1;
  min-height: 0;
  padding: 16px;
}
@media (max-width: 1000px) {
  .app {
    height: auto;
    min-height: 100vh;
  }
}
</style>
