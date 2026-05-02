import * as THREE from 'three'
import { initScene, fitCamera }     from './scene/SceneSetup.js'
import { loadModels }               from './loaders/GlbLoader.js'
import { placeClusterObjects }      from './objects/ObjectPlacer.js'
import { buildConnectionLines }     from './connections/ConnectionLine.js'
import { initLabelRenderer }        from './labels/LabelRenderer.js'
import { attachLabel }              from './labels/ObjectLabel.js'
import { setupHoverHandler }        from './interaction/HoverHandler.js'

// レイヤーのインポート
import { IngressLayer }             from './layers/IngressLayer.js'
import { MonitoringLayer }          from './layers/MonitoringLayer.js'
import { StorageLayer }             from './layers/StorageLayer.js'

async function main() {
  const { scene, camera, renderer, controls, startLoop } = initScene('canvas')
  const { updateSize, render: renderLabels } = initLabelRenderer(document.body)

  const models = await loadModels()
  
  // 実データのロード
  const response = await fetch('/cluster-state.json')
  const clusterData = await response.json()

  const { pods, services, namespaceZones } = placeClusterObjects(clusterData, models)

  namespaceZones.forEach(z => scene.add(z))
  pods.forEach(p => {
    scene.add(p.mesh)
    p.label = attachLabel(p.mesh, p.meta.name, 'pod')
  })
  services.forEach(s => {
    scene.add(s.mesh)
    s.label = attachLabel(s.mesh, s.meta.name, 'service', { y: 1.0 })
  })

  // レイヤーの初期化（一旦オプトアウト：必要に応じて戻せます）
  const layers = [
    // new IngressLayer(scene, clusterData, models),
    // new MonitoringLayer(scene, clusterData, pods),
    // new StorageLayer(scene, clusterData, pods)
  ]

  fitCamera(camera, controls, [...pods.map(p => p.mesh), ...services.map(s => s.mesh)])

  const connections = []
  for (const svc of services) {
    for (const podName of svc.meta.targets) {
      const pod = pods.find(p => p.meta.name === podName)
      if (pod) {
        const line = buildConnectionLines([{ from: svc.mesh.position, to: pod.mesh.position }])[0]
        line.userData.namespace = svc.meta.namespace
        scene.add(line)
        connections.push(line)
      }
    }
  }

  document.getElementById('stats').textContent =
    `${pods.length} pods · ${services.length} services · ${namespaceZones.length} namespaces`

  setupClickInspector(renderer, camera, pods, services)
  setupHoverHandler({
    renderer,
    camera,
    objects: [...pods.map(p => p.mesh), ...services.map(s => s.mesh)],
    onEnter: showTooltip,
    onLeave: hideTooltip,
  })

  // フィルタリングUIの構築
  setupNamespaceFilter(namespaceZones, pods, services, connections, camera, controls, layers)

  window.addEventListener('resize', updateSize)

  // 毎フレームのループ処理をレイヤーに伝播
  startLoop((time) => {
    layers.forEach(l => l.update?.(time))
    renderLabels(scene, camera)
  })
}

function setupNamespaceFilter(zones, pods, services, connections, camera, controls, layers) {
  const list = document.getElementById('ns-filter-list')
  const namespaces = zones.map(z => z.userData.namespace).sort()

  const updateVisibility = (activeNs) => {
    // 各レイヤーにフィルタリング状態を通知
    layers.forEach(l => l.setNamespaceFilter?.(activeNs))

    // 1. 表示・非表示の切り替え
    zones.forEach(z => {
      const ns = z.userData.namespace
      const visible = (activeNs === 'all' || activeNs === ns)
      
      z.visible = visible
      pods.filter(p => p.meta.namespace === ns).forEach(p => {
        p.mesh.visible = visible
        p.label.element.style.display = visible ? '' : 'none'
      })
      services.filter(s => s.meta.namespace === ns).forEach(s => {
        s.mesh.visible = visible
        s.label.element.style.display = visible ? '' : 'none'
      })
      connections.filter(c => c.userData.namespace === ns).forEach(c => {
        c.visible = visible
      })
    })

    // 2. カメラのフォーカス
    if (activeNs === 'all') {
      fitCamera(camera, controls, [...pods.map(p => p.mesh), ...services.map(s => s.mesh)])
    } else {
      const nsPods = pods.filter(p => p.meta.namespace === activeNs).map(p => p.mesh)
      const nsSvcs = services.filter(s => s.meta.namespace === activeNs).map(s => s.mesh)
      fitCamera(camera, controls, [...nsPods, ...nsSvcs])
    }
  }

  // "All" オプションの追加
  const createItem = (id, label, color, isAll = false) => {
    const item = document.createElement('div')
    item.className = 'legend-item'
    item.style.cursor = 'pointer'
    item.style.padding = '4px 8px'
    item.style.borderRadius = '4px'
    item.style.marginBottom = '2px'
    
    item.innerHTML = `
      <span class="legend-dot" style="background:${color}; width:12px; height:12px;"></span>
      <span style="flex-grow:1">${label}</span>
    `
    
    item.onclick = () => {
      // 選択状態の見た目更新
      Array.from(list.children).forEach(child => child.style.background = '')
      item.style.background = 'rgba(68, 136, 255, 0.2)'
      updateVisibility(isAll ? 'all' : id)
    }
    return item
  }

  // 初期構築
  const allItem = createItem('all', 'ALL NAMESPACES', '#ffffff', true)
  list.appendChild(allItem)

  namespaces.forEach(ns => {
    const zone = zones.find(z => z.userData.namespace === ns)
    const color = `#${zone.material.color.getHexString()}`
    const item = createItem(ns, ns, color)
    list.appendChild(item)
  })

  // デフォルトで最初の Namespace (通常は 'default') を選択
  const defaultNs = namespaces.includes('default') ? 'default' : namespaces[0]
  const defaultItem = Array.from(list.children).find(el => el.textContent.trim() === defaultNs)
  if (defaultItem) defaultItem.click()
}

// ---- hover tooltip ----

const _tooltip = () => document.getElementById('hover-tooltip')
let _mouseX = 0, _mouseY = 0

window.addEventListener('mousemove', (e) => { _mouseX = e.clientX; _mouseY = e.clientY })

function showTooltip(meta) {
  const el = _tooltip()
  el.textContent = meta.type === 'pod'
    ? `${meta.name}  (${meta.phase})`
    : `${meta.name}  [Service]`
  el.style.left = `${_mouseX + 14}px`
  el.style.top  = `${_mouseY - 8}px`
  el.classList.remove('hidden')
}

function hideTooltip() {
  _tooltip().classList.add('hidden')
}

// PRE: pods, services の各 mesh.userData.meta が設定済みであること
function setupClickInspector(renderer, camera, pods, services) {
  const raycaster = new THREE.Raycaster()
  const pointer   = new THREE.Vector2()
  const clickables = [...pods.map(p => p.mesh), ...services.map(s => s.mesh)]
  const detail     = document.getElementById('detail')
  const titleEl    = document.getElementById('detail-title')
  const contentEl  = document.getElementById('detail-content')

  renderer.domElement.addEventListener('click', (e) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1
    pointer.y = -(e.clientY / window.innerHeight) * 2 + 1
    raycaster.setFromCamera(pointer, camera)

    const hits = raycaster.intersectObjects(clickables, true)
    if (!hits.length) { detail.classList.add('hidden'); return }

    let obj = hits[0].object
    // raycaster は GLB の葉ノードをヒットする — userData.meta は clone の root に付くため親を辿る
    while (obj && !obj.userData.meta) obj = obj.parent
    if (!obj?.userData.meta) { detail.classList.add('hidden'); return }

    const meta = obj.userData.meta
    titleEl.textContent = meta.type === 'pod' ? 'Pod' : 'Service'
    contentEl.innerHTML = renderMeta(meta)
    detail.classList.remove('hidden')
  })

  document.getElementById('detail-close').addEventListener('click', () => {
    detail.classList.add('hidden')
  })
}

// IN: meta.type は detail-title 側で描画済みなため除外
function renderMeta(meta) {
  return Object.entries(meta)
    .filter(([k]) => k !== 'type')
    .map(([k, v]) => `
      <div class="meta-row">
        <span class="meta-key">${k}</span>
        <span class="meta-val">${Array.isArray(v) ? v.join('<br>') : v}</span>
      </div>`)
    .join('')
}

main()
