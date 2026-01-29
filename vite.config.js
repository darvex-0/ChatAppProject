import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  // --- BUILD OPTIMIZATION: Manual Chunk Splitting ---
  // This tells Vite to create separate JavaScript files for large dependencies.
  // Benefits:
  // 1. Browser caches vendor chunks separately (they rarely change)
  // 2. App updates only require re-downloading app code, not Firebase/React
  // 3. Parallel downloading - browser fetches multiple chunks simultaneously
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Firebase SDK is huge (~800KB) - put in separate chunk
          'firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage', 'firebase/database', 'firebase/messaging'],

          // React ecosystem - changes less frequently than app code
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],

          // Virtuoso (virtual list) - only needed in chat view
          'virtuoso': ['react-virtuoso']
        }
      }
    }
  }
})
