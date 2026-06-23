import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// HTTPS dev (cert mkcert) — requis pour le contexte sécurisé de WebContainers
// sur un vrai domaine (launch.lvh.me). Activé seulement si le cert existe.
const certDir = path.join(path.dirname(fileURLToPath(import.meta.url)), ".certs");
// cert wildcard *.lvh.me (dev.pem) si présent, sinon l'ancien cert
const certFile = fs.existsSync(path.join(certDir, "dev.pem")) ? path.join(certDir, "dev.pem") : path.join(certDir, "launch.lvh.me+4.pem");
const keyFile = fs.existsSync(path.join(certDir, "dev-key.pem")) ? path.join(certDir, "dev-key.pem") : path.join(certDir, "launch.lvh.me+4-key.pem");
const httpsConfig = fs.existsSync(certFile) && fs.existsSync(keyFile)
  ? { cert: fs.readFileSync(certFile), key: fs.readFileSync(keyFile) }
  : undefined;

// Dev : sert les sites déployés sur <slug>.lvh.me (comme <slug>.deltai.fr en prod).
const RESERVED = new Set(["launch", "www", "api", "localhost"]);
function devSites() {
  return {
    name: "dev-sites-subdomain",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const host = (req.headers.host || "").split(":")[0].toLowerCase();
        const m = host.match(/^([a-z0-9-]+)\.lvh\.me$/);
        if (!m || RESERVED.has(m[1])) return next();
        const slug = m[1];
        const reqPath = (req.url === "/" || !req.url) ? "/index.html" : req.url;
        try {
          const r = await fetch(`http://localhost:3001/sites/${slug}${reqPath}`);
          res.statusCode = r.status;
          res.setHeader("content-type", r.headers.get("content-type") || "text/html; charset=utf-8");
          res.end(Buffer.from(await r.arrayBuffer()));
        } catch { next(); }
      });
    }
  };
}

// Isolation cross-origin (requise par WebContainers) UNIQUEMENT sur le host
// launch.* — l'app principale n'est pas affectée en dev.
function launchIsolation() {
  return {
    name: "launch-cross-origin-isolation",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (/^launch\./i.test(req.headers.host || "")) {
          res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
          res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
        }
        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), devSites(), launchIsolation()],
  server: {
    port: 5173,
    https: httpsConfig,
    // Écoute IPv4+IPv6 (0.0.0.0) : lvh.me résout en 127.0.0.1, donc bind ::1 seul = refus.
    host: true,
    // Hosts dev autorisés. lvh.me / localtest.me résolvent vers 127.0.0.1 mais
    // ont un TLD public → acceptés par Google OAuth (contrairement à *.localhost).
    allowedHosts: ["localhost", "launch.localhost", ".lvh.me", ".localtest.me", ".deltai.fr"],
    proxy: {
      "/api": { target: "http://localhost:3001", changeOrigin: true },
      // Sites déployés (servis par le backend depuis la DB)
      "/sites": { target: "http://localhost:3001", changeOrigin: true }
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom"],
          "vendor-markdown": ["react-markdown", "remark-math", "rehype-katex", "rehype-highlight"],
          "vendor-katex": ["katex"],
          "vendor-hljs": ["highlight.js"]
        }
      }
    }
  }
});
