import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

const paths = {
  'pod-running': '/models/pod-running.glb',
  'pod-pending': '/models/pod-pending.glb',
  'pod-failed':  '/models/pod-failed.glb',
  'service-hex': '/models/service-hex.glb',
}

// モジュールスコープに置く — loadModels() 呼び出しごとにインスタンスを生成しないため
const loader = new GLTFLoader()

// OUT: Promise<[key, THREE.Object3D]> — Object.fromEntries に渡す entry
function loadOne(key, path) {
  return new Promise((resolve, reject) => {
    loader.load(
      path,
      // gltf.scene をそのまま返す — clone() は呼び出し元の責務。シーンごとに独立した変換行列が必要なため
      (gltf) => resolve([key, gltf.scene]),
      undefined,
      (err) => {
        console.error(`GlbLoader: failed to load ${path}`, err)
        reject(err)
      }
    )
  })
}

// OUT: { 'pod-running' | 'pod-pending' | 'pod-failed' | 'service-hex' → THREE.Object3D }
// ERR: rejects — 1ファイルでも失敗した場合（.clone() は呼び出し元の責務）
export async function loadModels() {
  const entries = await Promise.all(
    Object.entries(paths).map(([key, path]) => loadOne(key, path))
  )
  return Object.fromEntries(entries)
}
