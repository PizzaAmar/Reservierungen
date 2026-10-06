import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { setupPersistence } from './stores/persistence'

const app = createApp(App)
app.use(createPinia())
setupPersistence()
app.use(router)
app.mount('#app')
