# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

PoC 進行中。GLB アセット生成済み。Three.js PoC を `frontend/` で実装中。
ArgoCD による自動デプロイ構成済み（`k8s/argocd`）。

## Commands

```bash
# Frontend
cd frontend && npm run dev      # http://localhost:5173

# Backend
cd backend && npm run dev       # http://localhost:3001

# Docker Build & Push (GHCR)
# Versioning: Use vYYYYMMDD-NN format (e.g., v20260504-01) for consistency and ArgoCD tracking.
docker build --platform linux/amd64 -t ghcr.io/aobaiwaki123/k8s-3d-visualizer-backend:v20260504-01 ./backend
docker build --platform linux/amd64 -t ghcr.io/aobaiwaki123/k8s-3d-visualizer-frontend:v20260504-01 ./frontend
docker push ghcr.io/aobaiwaki123/k8s-3d-visualizer-backend:v20260504-01
docker push ghcr.io/aobaiwaki123/k8s-3d-visualizer-frontend:v20260504-01
```

## Architecture Decisions

### Vanilla JS (no React/Vue) for frontend
- WHY: Single-user personal tool. Framework overhead not justified.
- WHY NOT React: Three.js manages its own render loop; reconciler fights it.

### GitOps via ArgoCD
- WHY: Automated sync with the repository. Manifests in `k8s/manifests`.
- WHY NOT manual kubectl: Inconsistent cluster state and lack of history.
- **Auto-Commit:** After updating images/tags, automatically commit and push the manifest changes to trigger ArgoCD sync.

### GHCR (GitHub Container Registry)
- WHY: Seamless integration with GitHub repository and ArgoCD.
- imagePullSecrets: `ghcr-pull-secret` (automatically managed/external).

### 3D Logo (Candy Tune Logo)
- WHY: Visual branding. Rendered in a separate top-right overlay scene to avoid main camera interference.

### GLB models via Blender MCP (not procedural geometry)
- WHY: Richer visual fidelity for Pod/Service objects. Assets in `frontend/public/models/`.
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
