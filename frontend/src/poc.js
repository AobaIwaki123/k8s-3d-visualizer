// PoC 統合エントリ
import { initScene }          from './scene/SceneSetup.js'
import { loadModels }         from './loaders/GlbLoader.js'
import { placePocObjects }    from './objects/ObjectPlacer.js'
import { buildConnectionLines } from './connections/ConnectionLine.js'

async function main() {
  const { scene, startLoop } = initScene('canvas')

  const models = await loadModels()

  const { pods, services } = placePocObjects(models)
  pods.forEach(p => scene.add(p.mesh))
  services.forEach(s => scene.add(s.mesh))

  const connections = []
  for (const svc of services) {
    for (const podName of svc.meta.targets) {
      const pod = pods.find(p => p.meta.name === podName)
      // 存在しない target は無視 — 本番では Pod と Service が WebSocket で順不同に届くため、throw にすると初期化が壊れる
      if (pod) connections.push({ from: svc.mesh.position, to: pod.mesh.position })
    }
  }
  buildConnectionLines(connections).forEach(l => scene.add(l))

  startLoop(() => {})
}

main()
