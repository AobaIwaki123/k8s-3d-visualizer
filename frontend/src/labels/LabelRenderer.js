import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js'

/**
 * CSS2DRenderer を初期化し container に DOM 追加する。
 * WebGLRenderer の domElement と同じサイズで重ねる前提。
 *
 * @param {HTMLElement} container
 * @returns {{ labelRenderer: CSS2DRenderer, updateSize: () => void, render: (scene: THREE.Scene, camera: THREE.Camera) => void }}
 */
export function initLabelRenderer(container) {
  const labelRenderer = new CSS2DRenderer()
  labelRenderer.setSize(window.innerWidth, window.innerHeight)

  Object.assign(labelRenderer.domElement.style, {
    position: 'absolute',
    top: '0',
    left: '0',
    pointerEvents: 'none',
    zIndex: '5',
  })

  container.appendChild(labelRenderer.domElement)

  return {
    labelRenderer,
    updateSize() {
      labelRenderer.setSize(window.innerWidth, window.innerHeight)
    },
    render(scene, camera) {
      labelRenderer.render(scene, camera)
    },
  }
}
