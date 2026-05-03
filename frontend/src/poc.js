import * as THREE from 'three'
import { initScene, fitCamera }     from './scene/SceneSetup.js'
import { loadModels }               from './loaders/GlbLoader.js'
import { placeClusterObjects }      from './objects/ObjectPlacer.js'
import { buildConnectionLines }     from './connections/ConnectionLine.js'
import { initLabelRenderer }        from './labels/LabelRenderer.js'
import { attachLabel }              from './labels/ObjectLabel.js'
import { setupHoverHandler }        from './interaction/HoverHandler.js'
import { initLogo }                 from './ui/LogoRenderer.js'
import { PodDecorator }             from './objects/PodDecorator.js'

import { IngressLayer }             from './layers/IngressLayer.js'
import { MonitoringLayer }          from './layers/MonitoringLayer.js'
import { StorageLayer }             from './layers/StorageLayer.js'

const LAYER_CONFIG = {
  INGRESS: true,
  MONITORING: true,
  STORAGE: true,
}

const PHASE_CLASSES = {
  running:     'label-phase--running',
  pending:     'label-phase--pending',
  failed:      'label-phase--failed',
  terminating: 'label-phase--terminating',
}

// ---- Mutable scene build state ----

let currentBuild    = null
let currentData     = null
let hoverDispose    = null
let clickDispose    = null
let activeNamespace = 'all'   // namespace filter を rebuildScene 越しに保持
let isRebuilding    = false
let pendingRebuild  = false

// ---- Connection status UI ----

let lastEventTs = null
let ageTimerId  = null

function setConnBadge(state) {
  const el = document.getElementById('conn-badge')
  el.className = `state-${state}`
  const labels = {
    connecting: '● CONNECTING',
    live:       '● LIVE · watch',
    static:     '● STATIC · json',
    error:      '● ERROR',
  }
  el.textContent = labels[state] ?? state
}

function recordEvent(type, resource, name) {
  lastEventTs = Date.now()

  const now = new Date(lastEventTs)
  const hms = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`

  document.getElementById('last-event-time').textContent = hms
  document.getElementById('last-event-type').textContent = type
  document.getElementById('last-event-name').textContent = name ? `${resource}/${name}` : resource
  document.getElementById('last-event-age').textContent  = '0s ago'

  if (!ageTimerId) {
    ageTimerId = setInterval(() => {
      if (!lastEventTs) return
      const sec = Math.floor((Date.now() - lastEventTs) / 1000)
      const age = sec < 60 ? `${sec}s ago`
                : sec < 3600 ? `${Math.floor(sec/60)}m ago`
                : `${Math.floor(sec/3600)}h ago`
      document.getElementById('last-event-age').textContent = age
    }, 1000)
  }
}

function setupVerifyButton() {
  const btn    = document.getElementById('verify-btn')
  const result = document.getElementById('verify-result')

  btn.addEventListener('click', async () => {
    btn.disabled = true
    result.className = ''
    result.textContent = 'checking…'

    try {
      const res  = await fetch('/api/cluster')
      const data = await res.json()
      const pods = data.pods?.length ?? '?'
      result.className = 'ok'
      result.textContent = `${res.status} OK · ${pods} pods`
      recordEvent('verify', 'api/cluster', '')
    } catch (err) {
      result.className = 'err'
      result.textContent = `failed: ${err.message}`
    } finally {
      btn.disabled = false
      setTimeout(() => { result.textContent = '' }, 5000)
    }
  })
}

// ---- Main ----

async function main() {
  const { scene, camera, renderer, controls, startLoop } = initScene('canvas')
  const { updateSize, render: renderLabels } = initLabelRenderer(document.body)

  const models = await loadModels()
  setupVerifyButton()
  initLogo('logo-canvas')

  // ---- WebSocket with static-JSON fallback ----

  setConnBadge('connecting')

  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  const ws = new WebSocket(`${protocol}//${location.host}/ws`)
  let wsConnected = false

  const fallbackTimeout = setTimeout(async () => {
    if (wsConnected) return
    ws.close()
    await loadStaticJson()
  }, 4000)

  ws.onmessage = async (e) => {
    const msg = JSON.parse(e.data)
    switch (msg.type) {
      case 'INIT':
        clearTimeout(fallbackTimeout)
        wsConnected = true
        setConnBadge('live')
        recordEvent('INIT', 'cluster', '')
        await rebuildScene(msg.payload)
        break
      case 'MODIFIED':
        recordEvent('MODIFIED', msg.resource, msg.payload?.name)
        handleModified(msg.resource, msg.payload, scene, models)
        break
      case 'ADDED':
        recordEvent('ADDED', msg.resource, msg.payload?.name)
        handleAdded(msg.resource, msg.payload)
        break
      case 'DELETED':
        recordEvent('DELETED', msg.resource, msg.payload?.name)
        handleDeleted(msg.resource, msg.payload)
        break
      case 'ERROR':
        console.error('WS server error:', msg.message)
        break
    }
  }

  ws.onclose = async () => {
    if (!wsConnected) await loadStaticJson()
  }

  async function loadStaticJson() {
    if (wsConnected) return
    try {
      const res = await fetch('/cluster-state.json')
      const data = await res.json()
      await rebuildScene(data)
      setConnBadge('static')
      recordEvent('INIT', 'static/json', '')
    } catch (err) {
      setConnBadge('error')
      console.error('Failed to load cluster-state.json:', err)
    }
  }

  // ---- Scene build / rebuild ----

  async function rebuildScene(data) {
    if (isRebuilding) {
      pendingRebuild = true
      currentData = data // 最新しいデータを保持
      return
    }

    isRebuilding = true
    try {
      clearBuild(scene)
      currentData = data

      const { pods, services, namespaceZones } = placeClusterObjects(data, models)

      namespaceZones.forEach(z => scene.add(z))
      pods.forEach(p => {
        scene.add(p.mesh)
        p.label = attachLabel(p.mesh, p.meta.name, 'pod')
      })
      services.forEach(s => {
        scene.add(s.mesh)
        s.label = attachLabel(s.mesh, s.meta.name, 'service', { y: 1.0 })
      })

      const layers = []
      if (LAYER_CONFIG.INGRESS)    layers.push(new IngressLayer(scene, data, models))
      if (LAYER_CONFIG.MONITORING) layers.push(new MonitoringLayer(scene, data, pods))
      if (LAYER_CONFIG.STORAGE)    layers.push(new StorageLayer(scene, data, pods, namespaceZones))

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

      currentBuild = { pods, services, namespaceZones, connections, layers }

      fitCamera(camera, controls, [...pods.map(p => p.mesh), ...services.map(s => s.mesh)])
      updateStats(pods.length, services.length, namespaceZones.length)

      hoverDispose?.()
      hoverDispose = setupHoverHandler({
        renderer,
        camera,
        objects: [...pods.map(p => p.mesh), ...services.map(s => s.mesh)],
        onEnter: showTooltip,
        onLeave: hideTooltip,
      }).dispose

      clickDispose?.()
      clickDispose = setupClickInspector(renderer, camera, pods, services)

      setupNamespaceFilter(namespaceZones, pods, services, connections, camera, controls, layers)
    } finally {
      isRebuilding = false
      if (pendingRebuild) {
        pendingRebuild = false
        rebuildScene(currentData)
      }
    }
  }

  // ---- Real-time update handlers ----

  function handleModified(resource, payload, sc, mdls) {
    if (resource !== 'pod' || !currentData) return

    // 1. currentData (永続データ) を更新する
    const podData = currentData.pods.find(
      p => p.name === payload.name && p.namespace === payload.namespace
    )
    if (podData) {
      Object.assign(podData, payload)
    }

    // 2. 現在のビルド (表示中メッシュ) を更新する
    if (!currentBuild) return // rebuildScene 中なら表示更新はスキップ（再描画時に反映される）

    const podObj = currentBuild.pods.find(
      p => p.meta.name === payload.name && p.meta.namespace === payload.namespace
    )
    if (!podObj) return

    const prevPhase = podObj.meta.phase
    Object.assign(podObj.meta, payload)
    podObj.mesh.userData.meta = podObj.meta

    if (payload.phase !== prevPhase) {
      swapPodModel(podObj, payload.phase, mdls, sc)
    }
    updatePodLabel(podObj)
  }

  function handleAdded(resource, payload) {
    if (resource !== 'pod' || !currentData) return
    const exists = currentData.pods.some(p => p.name === payload.name && p.namespace === payload.namespace)
    if (!exists) {
      currentData.pods.push(payload)
      currentData.relationships.serviceToPods = recomputeServiceToPods(currentData.services, currentData.pods)
      rebuildScene(currentData)
    }
  }

  function handleDeleted(resource, payload) {
    if (resource !== 'pod' || !currentData) return
    const before = currentData.pods.length
    currentData.pods = currentData.pods.filter(
      p => !(p.name === payload.name && p.namespace === payload.namespace)
    )
    if (currentData.pods.length !== before) {
      currentData.relationships.serviceToPods = recomputeServiceToPods(currentData.services, currentData.pods)
      rebuildScene(currentData)
    }
  }

  // ---- Render loop ----

  startLoop((time) => {
    currentBuild?.layers.forEach(l => l.update?.(time))
    renderLabels(scene, camera)
  })

  window.addEventListener('resize', updateSize)
}

// ---- Scene clear ----

/**
 * メッシュとその子要素（ラベルなど）をシーンから完全に削除し、メモリを解放する
 */
function removeMeshAndLabel(scene, mesh) {
  if (!mesh) return

  // ラベル (CSS2DObject) のクリーンアップ
  const labels = mesh.children.filter(c => c.isCSS2DObject)
  labels.forEach(label => {
    mesh.remove(label)
    if (label.element && label.element.parentNode) {
      label.element.parentNode.removeChild(label.element)
    }
  })

  // メッシュの削除とジオメトリ・マテリアルの解放
  scene.remove(mesh)
  if (mesh.geometry) mesh.geometry.dispose()
  if (mesh.material) {
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    materials.forEach(m => m.dispose())
  }
}

function clearBuild(scene) {
  // currentBuild がない場合でも、シーン内に残っている管理対象オブジェクトを掃除する
  if (!currentBuild) {
    const toRemove = []
    scene.traverse(obj => {
      if (obj.userData?.meta?.type === 'pod' || obj.userData?.meta?.type === 'service') {
        toRemove.push(obj)
      }
    })
    toRemove.forEach(obj => removeMeshAndLabel(scene, obj))
    return
  }

  const b = currentBuild
  b.layers.forEach(l => l.destroy?.())
  b.connections.forEach(c => { scene.remove(c); c.geometry?.dispose() })
  b.namespaceZones.forEach(z => { scene.remove(z); z.geometry?.dispose() })
  b.services.forEach(s => removeMeshAndLabel(scene, s.mesh))
  b.pods.forEach(p => removeMeshAndLabel(scene, p.mesh))

  currentBuild = null
}

// ---- Service→Pod 関係の再計算（pod ADDED/DELETED 後に呼ぶ）----

function recomputeServiceToPods(services, pods) {
  return services.map(svc => {
    if (!svc.selector || Object.keys(svc.selector).length === 0) {
      return { name: svc.name, namespace: svc.namespace, pods: [] }
    }
    const matched = pods
      .filter(p => {
        if (p.namespace !== svc.namespace) return false
        return Object.entries(svc.selector).every(([k, v]) => p.labels?.[k] === v)
      })
      .map(p => p.name)
    return { name: svc.name, namespace: svc.namespace, pods: matched }
  })
}

// ---- Pod model swap on phase change ----

function swapPodModel(podObj, newPhase, models, scene) {
  const phaseLower = (newPhase ?? '').toLowerCase()
  const allowedPhases = ['running', 'pending', 'failed']
  const modelKey = allowedPhases.includes(phaseLower) ? `pod-${phaseLower}` : 'pod-running'

  const newMesh = models[modelKey].clone()
  newMesh.position.copy(podObj.mesh.position)
  newMesh.userData.meta = podObj.meta

  // デコレーション（スケーリング等）を再適用
  PodDecorator.decorate(newMesh, newMesh.userData.meta)

  // 古いメッシュから全てのラベルを新しいメッシュに付け替える（重複防止のため走査）
  const labels = podObj.mesh.children.filter(c => c.isCSS2DObject)
  labels.forEach(label => {
    podObj.mesh.remove(label)
    newMesh.add(label)
    podObj.label = label // 最後のラベルを参照として保持（通常は1つのみ）
  })

  // 古いメッシュを削除してクリーンアップ（ラベルは移動済みなので removeMeshAndLabel は使わない）
  scene.remove(podObj.mesh)
  if (podObj.mesh.geometry) podObj.mesh.geometry.dispose()
  if (podObj.mesh.material) {
    const materials = Array.isArray(podObj.mesh.material) ? podObj.mesh.material : [podObj.mesh.material]
    materials.forEach(m => m.dispose())
  }

  scene.add(newMesh)
  podObj.mesh = newMesh
}

// ---- Label DOM update on phase change ----

function updatePodLabel(podObj) {
  const labelEl = podObj.label?.element
  if (!labelEl) return
  const badge = labelEl.querySelector('.label-phase')
  if (!badge) return
  const phase = (podObj.meta.phase ?? '').toLowerCase()
  badge.textContent = podObj.meta.phase ?? ''
  badge.className = `label-phase ${PHASE_CLASSES[phase] ?? ''}`
}

// ---- Namespace filter UI ----

function setupNamespaceFilter(zones, pods, services, connections, camera, controls, layers) {
  const list = document.getElementById('ns-filter-list')
  list.innerHTML = ''

  const namespaces = zones.map(z => z.userData.namespace).sort()

  const updateVisibility = (activeNs) => {
    activeNamespace = activeNs   // rebuildScene 越しに選択状態を保持
    layers.forEach(l => {
      try { l.setNamespaceFilter?.(activeNs) } catch (e) { console.error('Layer error:', e) }
    })

    zones.forEach(z => {
      const ns = z.userData.namespace
      const isStorageZone = pods.some(p => p.meta.namespace === ns && p.meta.isStorage)
      const visible = (activeNs === 'all' || activeNs === ns || isStorageZone)

      z.visible = visible
      pods.filter(p => p.meta.namespace === ns).forEach(p => {
        p.mesh.visible = visible
        if (p.label) p.label.element.style.display = visible ? '' : 'none'
      })
      services.filter(s => s.meta.namespace === ns).forEach(s => {
        s.mesh.visible = visible
        if (s.label) s.label.element.style.display = visible ? '' : 'none'
      })
      connections.filter(c => c.userData.namespace === ns).forEach(c => {
        c.visible = visible
      })
    })

    const visibleMeshes = []
    pods.filter(p => p.mesh.visible).forEach(p => visibleMeshes.push(p.mesh))
    services.filter(s => s.mesh.visible).forEach(s => visibleMeshes.push(s.mesh))
    fitCamera(camera, controls, visibleMeshes)
  }

  const createItem = (id, label, color, isAll = false) => {
    const item = document.createElement('div')
    item.className = 'legend-item'
    item.style.cssText = 'cursor:pointer;padding:4px 8px;border-radius:4px;margin-bottom:2px;'
    item.innerHTML = `
      <span class="legend-dot" style="background:${color};width:12px;height:12px;"></span>
      <span style="flex-grow:1">${label}</span>
    `
    item.onclick = () => {
      Array.from(list.children).forEach(child => (child.style.background = ''))
      item.style.background = 'rgba(68,136,255,0.2)'
      updateVisibility(isAll ? 'all' : id)
    }
    return item
  }

  const itemMap = new Map()

  const allItem = createItem('all', 'ALL NAMESPACES', '#ffffff', true)
  list.appendChild(allItem)
  itemMap.set('all', allItem)

  namespaces.forEach(ns => {
    const zone = zones.find(z => z.userData.namespace === ns)
    const color = `#${zone.material.color.getHexString()}`
    const item = createItem(ns, ns, color)
    list.appendChild(item)
    itemMap.set(ns, item)
  })

  // 前回の選択を復元。namespace がなくなっていれば ALL に戻す
  const toRestore = itemMap.has(activeNamespace) ? activeNamespace : 'all'
  if (toRestore !== activeNamespace) activeNamespace = 'all'
  itemMap.get(toRestore).click()
}

// ---- Hover tooltip ----

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

// ---- Stats ----

function updateStats(podCount, svcCount, nsCount) {
  document.getElementById('stats').textContent =
    `${podCount} pods · ${svcCount} services · ${nsCount} namespaces`
}

// ---- Click inspector ----

function setupClickInspector(renderer, camera, pods, services) {
  const raycaster  = new THREE.Raycaster()
  const pointer    = new THREE.Vector2()
  const clickables = [...pods.map(p => p.mesh), ...services.map(s => s.mesh)]
  const detail     = document.getElementById('detail')
  const titleEl    = document.getElementById('detail-title')
  const contentEl  = document.getElementById('detail-content')

  function onClick(e) {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1
    pointer.y = -(e.clientY / window.innerHeight) * 2 + 1
    raycaster.setFromCamera(pointer, camera)

    const hits = raycaster.intersectObjects(clickables, true)
    if (!hits.length) { detail.classList.add('hidden'); return }

    let obj = hits[0].object
    while (obj && !obj.userData.meta) obj = obj.parent
    if (!obj?.userData.meta) { detail.classList.add('hidden'); return }

    const meta = obj.userData.meta
    titleEl.textContent = meta.type === 'pod' ? 'Pod' : 'Service'
    contentEl.innerHTML = renderMeta(meta)
    detail.classList.remove('hidden')
  }

  renderer.domElement.addEventListener('click', onClick)

  const closeBtn = document.getElementById('detail-close')
  function onClose() { detail.classList.add('hidden') }
  closeBtn.addEventListener('click', onClose)

  return () => {
    renderer.domElement.removeEventListener('click', onClick)
    closeBtn.removeEventListener('click', onClose)
  }
}

function renderMeta(meta) {
  return Object.entries(meta)
    .filter(([k]) => k !== 'type')
    .map(([k, v]) => `
      <div class="meta-row">
        <span class="meta-key">${k}</span>
        <span class="meta-val">${Array.isArray(v) ? v.join('<br>') : (typeof v === 'object' ? JSON.stringify(v) : v)}</span>
      </div>`)
    .join('')
}

main()
