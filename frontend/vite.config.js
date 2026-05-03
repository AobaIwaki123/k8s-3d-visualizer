export default {
  build: {
    rollupOptions: {
      input: 'poc.html'
    }
  },
  server: {
    proxy: {
      '/ws':  { target: 'ws://localhost:3001',  ws: true },
      '/api': { target: 'http://localhost:3001' },
    },
  },
}
