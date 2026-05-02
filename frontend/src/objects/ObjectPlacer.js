import * as THREE from 'three'
import { PodDecorator } from './PodDecorator.js'

const SPACING = 1.4
const COLS = 4
const SERVICE_Y = 4.5
const NS_GAP = 6.0 // 名前空間同士の間隔

// 文字列からハッシュ形式で色を生成
function stringToColor(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return `hsl(${Math.abs(hash) % 360}, 70%, 60%)`
}

function podPosition(startX, idx) {
  return new THREE.Vector3(startX + (idx % COLS) * SPACING, 0, Math.floor(idx / COLS) * SPACING)
}

function servicePosition(posMap, targets) {
  const positions = targets.map(t => posMap.get(t)).filter(Boolean)
  if (!positions.length) return null // ターゲットが見つからないServiceは配置しない
  const avg = positions.reduce((acc, p) => acc.add(p), new THREE.Vector3()).divideScalar(positions.length)
  return new THREE.Vector3(avg.x, SERVICE_Y, avg.z)
}

function buildZonePlane(startX, podCount, color) {
  if (podCount === 0) return null
  const cols = Math.min(podCount, COLS)
  const rows = Math.ceil(podCount / COLS)
  const geo = new THREE.PlaneGeometry(
    (cols - 1) * SPACING + 1.2,
    (rows - 1) * SPACING + 1.2,
  )
  const mat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(color), transparent: true, opacity: 0.08,
    side: THREE.DoubleSide, depthWrite: false,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.set(
    startX + ((cols - 1) * SPACING) / 2,
    0.01,
    ((rows - 1) * SPACING) / 2,
  )
  return mesh
}

/**
 * 実データ JSON を元にオブジェクトを配置する
 */
export function placeClusterObjects(data, models) {
  const pods = []
  const services = []
  const namespaceZones = []
  const posMap = new Map()

  // Namespace ごとに Pod をグループ化
  const nsMap = new Map()
  data.pods.forEach(p => {
    if (!nsMap.has(p.namespace)) nsMap.set(p.namespace, [])
    nsMap.get(p.namespace).push(p)
  })

  // 1. 全ての Namespace を同じルールでソートして並べる（特別扱いを解除）
  const sortedNamespaces = Array.from(nsMap.keys()).sort()

  let currentX = 0

  // 2. ワークロードの配置
  sortedNamespaces.forEach(nsName => {
    const nsPods = nsMap.get(nsName)
    const color = stringToColor(nsName)

    nsPods.forEach((def, idx) => {
      const pos = podPosition(currentX, idx)
      posMap.set(def.name, pos)
      const mesh = createPodMesh(def, models, pos)
      pods.push({ mesh, meta: mesh.userData.meta })
    })

    placeServices(data, nsName, models, posMap, services)

    const zone = buildZonePlane(currentX, nsPods.length, color)
    if (zone) {
      zone.userData.namespace = nsName
      namespaceZones.push(zone)
    }

    const colsInNs = Math.min(nsPods.length, COLS)
    currentX += (colsInNs * SPACING) + NS_GAP
  })

  return { pods, services, namespaceZones }
}

function createPodMesh(def, models, pos) {
  const phase = def.phase.toLowerCase()
  const modelKey = `pod-${['running', 'pending', 'failed'].includes(phase) ? phase : 'running'}`
  const mesh = models[modelKey].clone()
  mesh.position.copy(pos)
  mesh.userData.meta = { ...def, type: 'pod' }
  
  // デコレーター適用をオプトアウト
  // PodDecorator.decorate(mesh, mesh.userData.meta)
  
  return mesh
}

function placeServices(data, nsName, models, posMap, services) {
  const nsServices = data.services.filter(s => s.namespace === nsName)
  nsServices.forEach(def => {
    const rel = data.relationships.serviceToPods.find(r => r.name === def.name && r.namespace === nsName)
    const targets = rel ? rel.pods : []
    const pos = servicePosition(posMap, targets)
    if (pos) {
      const mesh = models['service-hex'].clone()
      mesh.position.copy(pos)
      mesh.userData.meta = { ...def, type: 'service', targets }
      services.push({ mesh, meta: mesh.userData.meta })
    }
  })
}
