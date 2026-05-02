import * as THREE from 'three'

/**
 * Storage Bedrock Layer (Rook-Ceph 可視化)
 * クラスターの地下 (Y < 0) に Rook-Ceph のストレージ基盤を配置し、
 * PVC を介したデータ保存の繋がりを垂直方向の「パイプ」として表現する。
 */
export class StorageLayer {
  constructor(scene, clusterData, pods, zones) {
    this.scene = scene
    this.clusterData = clusterData
    this.pods = pods
    this.zones = zones
    this.group = new THREE.Group()
    this.scene.add(this.group)

    this.storageLines = []
    this.isVisible = true
    this.activeNs = 'all'

    this.init()
  }

  init() {
    this.cephPods = this.pods.filter(p => p.meta.isStorage)
    
    // 地下空間の演出: 暗く重厚なプレート
    const plateGeo = new THREE.PlaneGeometry(200, 200)
    const plateMat = new THREE.MeshStandardMaterial({
      color: 0x0a0a0a,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false
    })
    const plate = new THREE.Mesh(plateGeo, plateMat)
    plate.rotation.x = -Math.PI / 2
    plate.position.y = -3.1
    
    this.group.add(plate)
    this.bedrockPlate = plate

    // 初期配置の実行
    this.updateLayout('all')
  }

  /**
   * Ceph とパイプラインの位置を動的に更新する
   */
  updateLayout(activeNs) {
    this.activeNs = activeNs
    if (this.cephPods.length === 0) return

    // 前回のラインを削除
    this.storageLines.forEach(l => this.group.remove(l))
    this.storageLines.length = 0

    let targetX = 0, targetZ = 0
    if (activeNs === 'all') {
      const box = new THREE.Box3()
      this.pods.filter(p => !p.meta.isStorage).forEach(p => box.expandByPoint(p.mesh.position))
      const center = new THREE.Vector3()
      if (box.isEmpty()) center.set(0, 0, 0); else box.getCenter(center)
      targetX = center.x; targetZ = center.z
    } else {
      const zone = this.zones.find(z => z.userData.namespace === activeNs)
      if (zone) { targetX = zone.position.x; targetZ = zone.position.z }
    }

    // Ceph Pod の配置
    const COLS = 6; const SPACING = 1.4
    const startX = targetX - ((Math.min(this.cephPods.length, COLS) - 1) * SPACING) / 2
    const startZ = targetZ - ((Math.ceil(this.cephPods.length / COLS) - 1) * SPACING) / 2

    this.cephPods.forEach((p, idx) => {
      p.mesh.position.set(startX + (idx % COLS) * SPACING, -3, startZ + Math.floor(idx / COLS) * SPACING)
    })

    // ストレージパイプライン（ノード対応接続線）の生成
    const lineMat = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.5 })
    this.pods.forEach(p => {
      // イングレスコントローラーなどは除外（ノイズ軽減）
      const isAppPod = !p.meta.isStorage && (p.meta.namespace !== 'cloudflare-tunnel-ingress-controller')
      
      // 現在表示されているPodに対してのみラインを引く
      const isVisibleInNs = (activeNs === 'all' || p.meta.namespace === activeNs)
      
      if (isAppPod && isVisibleInNs) {
        const from = p.mesh.position.clone()
        
        // この Pod と同じ Node で動いている Ceph Pod を探す（なければ最初の Ceph へ）
        const targetCeph = this.cephPods.find(c => c.meta.nodeName === p.meta.nodeName) || this.cephPods[0]
        if (!targetCeph) return

        const to = targetCeph.mesh.position.clone()

        const geometry = new THREE.BufferGeometry().setFromPoints([from, to])
        const line = new THREE.Line(geometry, lineMat)
        this.group.add(line)
        this.storageLines.push(line)
      }
    })
  }

  /**
   * レイヤー全体の表示・非表示を切り替える
   */
  setVisibility(visible) {
    this.isVisible = visible
    this.group.visible = visible
  }

  /**
   * 名前空間フィルタリングの適用
   */
  setNamespaceFilter(activeNs) {
    this.updateLayout(activeNs)
  }

  update(time) {
    // パルス演出などが必要な場合はここに追加
  }

  /**
   * リソースの解放
   */
  destroy() {
    this.scene.remove(this.group)
    this.group.traverse(child => {
      if (child.geometry) child.geometry.dispose()
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose())
        } else {
          child.material.dispose()
        }
      }
    })
    this.storageLines = []
  }
}
