const POC_PODS = [
  { name: 'pod-a', phase: 'Running',  position: [0.0, 0, 0] },
  { name: 'pod-b', phase: 'Running',  position: [0.6, 0, 0] },
  { name: 'pod-c', phase: 'Running',  position: [1.2, 0, 0] },
  { name: 'pod-d', phase: 'Pending',  position: [1.8, 0, 0] },
]

const POC_SERVICES = [
  { name: 'svc-a', position: [0.9, 4.0, 0], targets: ['pod-a', 'pod-b'] },
]

// IN:  models — loadModels() の返り値
// OUT: { pods: { mesh: Object3D, meta: { name, phase } }[], services: { mesh: Object3D, meta: { name, targets } }[] }
//      scene.add() は呼び出し元の責務 — このモジュールをシーンに依存させないため
export function placePocObjects(models) {
  const pods = POC_PODS.map(({ name, phase, position }) => {
    // clone() しないと同一インスタンスを複数箇所に配置することになり、最後の position だけが反映される
    const mesh = models[`pod-${phase.toLowerCase()}`].clone()
    mesh.position.set(...position)
    // Raycaster のヒット結果は mesh のみなので、userData に持たせることでクリック時に O(1) でメタを取得できる
    mesh.userData.meta = { name, phase }
    return { mesh, meta: { name, phase } }
  })

  const services = POC_SERVICES.map(({ name, position, targets }) => {
    const mesh = models['service-hex'].clone()
    mesh.position.set(...position)
    mesh.userData.meta = { name, targets }
    return { mesh, meta: { name, targets } }
  })

  return { pods, services }
}
