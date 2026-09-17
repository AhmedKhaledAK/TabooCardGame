import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The client lives in client/, the Worker in worker/, the rules both share in
// shared/. `npm run dev` serves the client and proxies /api (HTTP and the room
// WebSocket) to `npm run dev:api` on 8788, so the browser only ever talks to
// one origin -- the same shape as production and as Discord's proxy.
export default defineConfig(({ mode }) => ({
  root: 'client',
  publicDir: 'public',
  build: { outDir: '../dist', emptyOutDir: true },
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Behind `npm run tunnel` the Host header is a trycloudflare.com name.
    allowedHosts: true,
    // Without ws: true the room socket is silently dropped behind the proxy.
    proxy: { '/api': { target: 'http://127.0.0.1:8788', ws: true } },
    // Inside Discord the page arrives over the tunnel, so HMR has to go back
    // over its TLS port. Opt-in (`npm run dev:tunnel`): on plain localhost it
    // would fill the console with socket errors.
    hmr: mode === 'tunnel' ? { protocol: 'wss', clientPort: 443 } : true,
  },
}));
