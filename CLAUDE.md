# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

PoC 進行中。GLB アセット生成済み。Three.js PoC を `frontend/` で実装中。
All specs are in `docs/`. K8s manifests in `k8s/` are ready to apply.

## Commands

```bash
# Frontend
cd frontend && npm run dev      # http://localhost:5173

# Backend
cd backend && npm run dev       # http://localhost:3001

# Deploy
kubectl apply -f k8s/
docker build -t k8s-visualizer-backend:latest ./backend
docker build -t k8s-visualizer-frontend:latest ./frontend
```

## Architecture Decisions

### Vanilla JS (no React/Vue) for frontend
- WHY: Single-user personal tool. Framework overhead not justified.
- WHY NOT React: Three.js manages its own render loop; reconciler fights it.

### Zustand (not Redux/Context) for state
- WHY: Minimal boilerplate; store shape is flat (`nodes`, `pods`, `services`, `namespaces`, `selectedObject`).
- WHY NOT Context: Re-render scope is too coarse for frequent WebSocket updates.

### Fastify (not Express) for backend
- WHY: Lower overhead for WebSocket + REST on a home cluster.

### WebSocket for real-time + REST for detail
- WHY: WebSocket streams ADDED/MODIFIED/DELETED events efficiently. REST is only called on click (detail panel).
- WHY NOT polling: Kubernetes Watch API is push-based; polling wastes resources and adds latency.

### NodePort (not Ingress) for cluster access
- WHY: Home LAN only. No external exposure, no TLS needed. NodePort `:30080` is sufficient.

### Read-only RBAC ServiceAccount
- WHY NOT write permissions: Visualizer never mutates cluster state. Least-privilege by design. See `k8s/rbac.yaml`.

### GLB models via Blender MCP (not procedural geometry)
- WHY: Richer visual fidelity for Pod/Service objects. Assets in `frontend/src/assets/models/`.
- WHY NOT for Pods at scale: Use `InstancedMesh` when Pod count exceeds ~100 to maintain 60 fps.
- k8s Node has no rendered GLB. Three.js holds Node data only; spatial grouping is handled by Pod placement logic.

### GLB asset list
- `pod-running.glb`  — Pod (Running),     emissive #00ff88
- `pod-pending.glb`  — Pod (Pending),     emissive #ffaa00
- `pod-failed.glb`   — Pod (Failed),      emissive #ff4444
- `service-hex.glb`  — Service (hexagonal prism), emissive #4488ff

### In-cluster auto-detection for k8s connection
- WHY: Same binary works in production (reads ServiceAccount token) and local dev (reads `~/.kube/config`) without config changes. Triggered by presence of `KUBERNETES_SERVICE_HOST`.

## Key Protocols

**WebSocket** (`/ws`):
```jsonc
// on connect
{ "type": "INIT", "data": { "nodes": [...], "pods": [...], "services": [...] } }
// ongoing
{ "type": "ADDED" | "MODIFIED" | "DELETED", "resource": "pod" | "node" | "service", "data": { ... } }
```

**REST**:
```
GET /api/cluster           → snapshot
GET /api/pod/:ns/:name
GET /api/node/:name
GET /api/service/:ns/:name
```

## 3D Layout (non-obvious)

Pods are placed on a flat grid (4 columns, 0.6-unit spacing). Services float at Y=5. Namespace bubbles are transparent zones (procedural, no GLB). Service→Pod connection lines are drawn by matching selector labels.
k8s Nodes have no visual object — Pod proximity implies Node grouping.

Pod phase → emissive color: Running=`#00ff88`, Pending=`#ffaa00` (pulsing), Failed=`#ff4444`, Terminating=`#888888`.

## Docs Index

- `docs/03_frontend_design.md` — Three.js scene structure, Zustand store shape
- `docs/04_backend_design.md` — full API + WebSocket spec
- `docs/05_k8s_connection.md` — RBAC details
- `docs/06_deployment.md` — Dockerfile + deployment steps
