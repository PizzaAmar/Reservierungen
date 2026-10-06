import { createRouter, createWebHistory } from 'vue-router'
import ReservationsView from '../views/ReservationsView.vue'
import EditorView from '../views/EditorView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'reservations', component: ReservationsView, meta: { title: 'Reservierungen' } },
    { path: '/raumplan', name: 'editor', component: EditorView, meta: { title: 'Raumplan' } },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.afterEach((to) => {
  document.title = `${to.meta.title ?? 'Reservierungen'} – Pizzahaus`
})

export default router
