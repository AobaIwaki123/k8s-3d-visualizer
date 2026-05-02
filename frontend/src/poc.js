import * as THREE from 'three'
import { initScene, fitCamera }     from './scene/SceneSetup.js'
import { loadModels }               from './loaders/GlbLoader.js'
import { placePocObjects }          from './objects/ObjectPlacer.js'
import { buildConnectionLines }     from './connections/ConnectionLine.js'

async function main() {
  const { scene, camera, renderer, controls, startLoop } = initScene('canvas')

  const models = await loadModels()
  const { pods, services, namespaceZones } = placePocObjects(models)

  namespaceZones.forEach(z => scene.add(z))
  pods.forEach(p => scene.add(p.mesh))
  services.forEach(s => scene.add(s.mesh))

  fitCamera(camera, controls, [...pods.map(p => p.mesh), ...services.map(s => s.mesh)])

  const connections = []
  for (const svc of services) {
    for (const podName of svc.meta.targets) {
      const pod = pods.find(p => p.meta.name === podName)
      if (pod) connections.push({ from: svc.mesh.position, to: pod.mesh.position })
    }
  }
  buildConnectionLines(connections).forEach(l => scene.add(l))

  document.getElementById('stats').textContent =
    `${pods.length} pods · ${services.length} services · 2 namespaces`

  setupClickInspector(renderer, camera, pods, services)

  startLoop(() => {})
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
