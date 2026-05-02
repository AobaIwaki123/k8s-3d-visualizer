import * as THREE from 'three'

const SPACING = 1.4
const COLS = 4
const SERVICE_Y = 4.5

const NAMESPACES = [
  {
    name: 'default',
    startX: -3.5,
    zoneColor: 0x4488ff,
    pods: [
      { name: 'frontend-7d9f2', phase: 'Running' },
      { name: 'frontend-k8s12', phase: 'Running' },
      { name: 'backend-9x1ab',  phase: 'Pending' },
      { name: 'worker-2m8cd',   phase: 'Failed'  },
    ],
    services: [
      { name: 'svc-frontend', targets: ['frontend-7d9f2', 'frontend-k8s12'] },
      { name: 'svc-backend',  targets: ['backend-9x1ab', 'worker-2m8cd'] },
    ],
  },
  {
    name: 'monitoring',
    startX: 2.8,
    zoneColor: 0x44ff88,
    pods: [
      { name: 'prometheus-0',   phase: 'Running' },
      { name: 'grafana-1',      phase: 'Running' },
      { name: 'alertmanager-0', phase: 'Pending' },
    ],
    services: [
      { name: 'svc-prometheus', targets: ['prometheus-0', 'grafana-1', 'alertmanager-0'] },
    ],
  },
]

function podPosition(ns, idx) {
  return new THREE.Vector3(ns.startX + (idx % COLS) * SPACING, 0, Math.floor(idx / COLS) * SPACING)
}

// IN: posMap — Map<podName, THREE.Vector3>
// OUT: THREE.Vector3 — target pod 座標の重心; targets が 1 つも解決しない場合は原点
function servicePosition(posMap, targets) {
  const positions = targets.map(t => posMap.get(t)).filter(Boolean)
  if (!positions.length) return new THREE.Vector3(0, SERVICE_Y, 0)
  const avg = positions.reduce((acc, p) => acc.add(p), new THREE.Vector3()).divideScalar(positions.length)
  return new THREE.Vector3(avg.x, SERVICE_Y, avg.z)
}

// OUT: THREE.Mesh — 水平な半透明プレーン。y=0.01 は地面との z-fighting 回避
function buildZonePlane(ns, podCount) {
  const cols = Math.min(podCount, COLS)
  const rows = Math.ceil(podCount / COLS)
  const geo = new THREE.PlaneGeometry(
    (cols - 1) * SPACING + 0.9,
    (rows - 1) * SPACING + 0.9,
  )
  const mat = new THREE.MeshBasicMaterial({
    color: ns.zoneColor, transparent: true, opacity: 0.07,
    side: THREE.DoubleSide, depthWrite: false,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.set(
    ns.startX + ((cols - 1) * SPACING) / 2,
    0.01,
    ((rows - 1) * SPACING) / 2,
  )
  return mesh
}

// OUT: { pods, services, namespaceZones }
//      scene.add() は呼び出し元の責務
export function placePocObjects(models) {
  const pods = []
  const services = []
  const namespaceZones = []
  const posMap = new Map()

  for (const ns of NAMESPACES) {
    ns.pods.forEach((def, idx) => {
      const pos = podPosition(ns, idx)
      posMap.set(def.name, pos)

      const mesh = models[`pod-${def.phase.toLowerCase()}`].clone()
      mesh.position.copy(pos)
      mesh.userData.meta = { type: 'pod', name: def.name, namespace: ns.name, phase: def.phase }
      pods.push({ mesh, meta: { name: def.name, namespace: ns.name, phase: def.phase } })
    })

    for (const def of ns.services) {
      const pos = servicePosition(posMap, def.targets)
      const mesh = models['service-hex'].clone()
      mesh.position.copy(pos)
      mesh.userData.meta = { type: 'service', name: def.name, namespace: ns.name, targets: def.targets }
      services.push({ mesh, meta: { name: def.name, namespace: ns.name, targets: def.targets } })
    }

    namespaceZones.push(buildZonePlane(ns, ns.pods.length))
  }

  return { pods, services, namespaceZones }
}
