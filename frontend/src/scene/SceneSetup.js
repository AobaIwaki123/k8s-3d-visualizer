import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

// OUT: { scene, camera, renderer, controls, startLoop }
//      startLoop(onFrame) — 描画ループ開始。非同期処理完了後に呼ぶ前提
export function initScene(canvasId) {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x0a0a0f)

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000)
  camera.position.set(0, 6, 12)
  camera.lookAt(0, 0, 0)

  const canvas = document.getElementById(canvasId)
  const renderer = new THREE.WebGLRenderer({ antialias: true, canvas })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(window.devicePixelRatio)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  controls.target.set(0, 2, 0) // Pod グリッド(Y=0)と Service 層(Y=5)の中間に orbit の中心を置く — 0 にすると Service が見切れる

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  })

  // ループをここで開始しない — GLB ロード等の非同期処理が完了してから呼び出し元が startLoop を呼ぶ設計
  function startLoop(onFrame) {
    function animate() {
      requestAnimationFrame(animate)
      onFrame()
      controls.update() // dampingFactor のアニメーションはフレームごとの呼び出しで進む — 省略すると即座に止まる
      renderer.render(scene, camera)
    }
    animate()
  }

  return { scene, camera, renderer, controls, startLoop }
}
