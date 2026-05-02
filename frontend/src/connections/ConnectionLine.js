import * as THREE from 'three'

// 全接続線で共有 — 呼び出しごとに new するとGPUマテリアルが重複コンパイルされるため。個々の線の色を変える必要が生じた場合はインスタンスを分ける。
const material = new THREE.LineBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.35,
})

// IN:  { from: THREE.Vector3, to: THREE.Vector3 }[]
// OUT: THREE.Line[] — scene.add() で使う。geometry は各線で独立、material は共有
export function buildConnectionLines(connections) {
  return connections.map(({ from, to }) => {
    const geometry = new THREE.BufferGeometry().setFromPoints([from, to])
    return new THREE.Line(geometry, material)
  })
}
