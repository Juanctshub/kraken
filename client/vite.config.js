import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  // Cambiado a '/' para que Express sirva los recursos desde la raíz absoluta
  // y evitar los bloqueos de políticas de seguridad (CSP) en el Tor Browser.
  base: '/', 
  plugins: [react()],
})