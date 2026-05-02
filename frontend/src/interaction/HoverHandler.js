import * as THREE from 'three'

/**
 * @param {{
 *   renderer: THREE.WebGLRenderer,
 *   camera:   THREE.PerspectiveCamera,
 *   objects:  THREE.Object3D[],
 *   onEnter:  (meta: object) => void,
 *   onLeave:  () => void,
 * }} options
 * @returns {{ dispose: () => void }}
 */
export function setupHoverHandler({ renderer, camera, objects, onEnter, onLeave }) {
  const raycaster = new THREE.Raycaster()
  const pointer   = new THREE.Vector2()
  // Mesh → { originalMaterial, originalIntensity } — ホバー解除時に元の状態へ戻す
  const saved = new Map()
  let currentObj = null

  function highlight(root) {
    root.traverse((child) => {
      if (!child.isMesh) return
      // 共有マテリアルを個別化してから変更する
      const orig = child.material
      const cloned = orig.clone()
      cloned.emissiveIntensity = 2.0
      saved.set(child, { material: orig, intensity: orig.emissiveIntensity })
      child.material = cloned
    })
  }

  function unhighlight() {
    saved.forEach(({ material }, mesh) => {
      mesh.material.dispose()
      mesh.material = material
    })
    saved.clear()
  }

  function onMouseMove(e) {
    const rect = renderer.domElement.getBoundingClientRect()
    pointer.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1
    pointer.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1

    raycaster.setFromCamera(pointer, camera)
    const hits = raycaster.intersectObjects(objects, true)

    if (!hits.length) {
      if (currentObj) {
        unhighlight()
        renderer.domElement.style.cursor = ''
        onLeave()
        currentObj = null
      }
      return
    }

    let hit = hits[0].object
    while (hit && !hit.userData.meta) hit = hit.parent
    if (!hit?.userData.meta) return

    // 同一オブジェクト上での連続発火を防ぐ
    if (hit === currentObj) return

    if (currentObj) { unhighlight(); onLeave() }

    currentObj = hit
    highlight(hit)
    renderer.domElement.style.cursor = 'pointer'
    onEnter(hit.userData.meta)
  }

  renderer.domElement.addEventListener('mousemove', onMouseMove)

  return {
    dispose() {
      renderer.domElement.removeEventListener('mousemove', onMouseMove)
      unhighlight()
    },
  }
}
