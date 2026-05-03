import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

/**
 * Renders the candy_tune_logo.glb in a separate canvas at the top-right.
 * @param {string} canvasId 
 */
export async function initLogo(canvasId) {
  const canvas = document.getElementById(canvasId)
  if (!canvas) return

  const width = canvas.clientWidth || 150
  const height = canvas.clientHeight || 150

  const scene = new THREE.Scene()
  // No background to keep it transparent
  
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
  camera.position.set(0, 0, 7)

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true // Important for transparency
  })
  renderer.setSize(width, height)
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.outputColorSpace = THREE.SRGBColorSpace // Correct color space for GLTF

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 2.0)
  scene.add(ambientLight)
  
  const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 2.5)
  scene.add(hemisphereLight)
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 3.0)
  directionalLight.position.set(5, 5, 5)
  scene.add(directionalLight)

  const loader = new GLTFLoader()
  
  try {
    const gltf = await new Promise((resolve, reject) => {
      loader.load('/models/candy_tune_logo.glb', resolve, undefined, reject)
    })
    
    const model = gltf.scene
    
    // Center and scale the model
    const box = new THREE.Box3().setFromObject(model)
    const center = box.getCenter(new THREE.Vector3())
    model.position.sub(center) // Center the model at 0,0,0
    
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z)
    const scale = 4 / maxDim // Increased from 3 to 4 for a larger appearance
    model.scale.setScalar(scale)
    
    // Rotate 90 degrees on X-axis to face the camera
    model.rotation.x = Math.PI / 2
    
    scene.add(model)

    function animate() {
      requestAnimationFrame(animate)
      
      // Gentle rotation
      model.rotation.y += 0.01
      
      renderer.render(scene, camera)
    }
    
    animate()
    
    // Handle container resizing if needed
    const resizeObserver = new ResizeObserver(() => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (w === 0 || h === 0) return
      
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    })
    resizeObserver.observe(canvas.parentElement)

  } catch (err) {
    console.error('Failed to load logo model:', err)
  }
}
