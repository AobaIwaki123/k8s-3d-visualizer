import * as THREE from 'three'

/**
 * Storage Bedrock Layer (Rook-Ceph 可視化)
 * クラスターの地下 (Y < 0) に Rook-Ceph のストレージ基盤を配置し、
 * PVC を介したデータ保存の繋がりを垂直方向の「パイプ」として表現する。
 */
export class StorageLayer {
  constructor(scene, clusterData, pods) {
    this.scene = scene
    this.pods = pods
    this.group = new THREE.Group()
    this.scene.add(this.group)

    this.storageMeshes = []
    this.pipelines = []

    this.init()
  }

  init() {
    // 1. Ceph Bedrock: isStorage: true の Pod を地下（Y=-3）に配置
    const storageMaterial = new THREE.MeshStandardMaterial({
      color: 0x555555,
      metalness: 0.9,
      roughness: 0.1,
      emissive: 0x222222
    })

    this.pods.forEach(p => {
      if (p.meta.isStorage) {
        // 地下に配置
        p.mesh.position.y = -3
        
        // 重厚なマテリアルに変更
        p.mesh.traverse(child => {
          if (child.isMesh) {
            child.material = storageMaterial
          }
        })

        // Storage Pod はこのレイヤーのグループで管理する（可視性連動のため）
        this.group.add(p.mesh)
        this.storageMeshes.push(p.mesh)
      }
    })

    // 2. Storage Pipeline: PVC を持つ Pod から Ceph 層へ垂直ライン
    const pipelineMaterial = new THREE.LineBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.4
    })

    this.pods.forEach(p => {
      // isStorage 自体は Pipeline を引かない（Ceph 層そのものなので）
      if (!p.meta.isStorage && p.meta.pvcNames && p.meta.pvcNames.length > 0) {
        const from = p.mesh.position.clone()
        // Pod の底面あたりから開始
        from.y -= 0.2 
        
        const to = new THREE.Vector3(from.x, -3, from.z)
        
        const geometry = new THREE.BufferGeometry().setFromPoints([from, to])
        const line = new THREE.Line(geometry, pipelineMaterial)
        
        line.userData.namespace = p.meta.namespace
        this.group.add(line)
        this.pipelines.push(line)
      }
    })

    // 3. 地下空間の演出: 暗く重厚なプレート
    // クラスターの広がりに合わせてサイズ調整（仮で 100x100）
    const plateGeo = new THREE.PlaneGeometry(100, 100)
    const plateMat = new THREE.MeshStandardMaterial({
      color: 0x0a0a0a,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false // 背景として扱う
    })
    const plate = new THREE.Mesh(plateGeo, plateMat)
    plate.rotation.x = -Math.PI / 2
    plate.position.y = -3.1 // Ceph Pods のわずかに下
    
    this.group.add(plate)
    this.bedrockPlate = plate
  }

  /**
   * レイヤー全体の表示・非表示を切り替える
   * @param {boolean} visible 
   */
  setVisibility(visible) {
    this.group.visible = visible
  }

  /**
   * 名前空間フィルタリングの適用
   * @param {string} activeNs 
   */
  setNamespaceFilter(activeNs) {
    this.pipelines.forEach(pipe => {
      // 既存の実装が pipelines.push({ line, pod }) 形式の場合と line 形式の場合があるため
      const pod = pipe.pod || { meta: { namespace: pipe.userData?.namespace } }
      const nsMatch = (activeNs === 'all' || pod.meta.namespace === activeNs)
      const line = pipe.line || pipe
      line.visible = nsMatch
    })

    // Rook-Ceph 自体はインフラなので、ALLの時、または rook-ceph が選択されている時に表示
    const showInfra = (activeNs === 'all' || activeNs === 'rook-ceph')
    
    this.storagePods.forEach(p => {
      p.mesh.visible = this.isVisible && showInfra
      if (p.label && p.label.element) {
        p.label.element.style.display = (this.isVisible && showInfra) ? '' : 'none'
      }
    })
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

    // storage meshes を元のシーンに戻す必要はない（destroy 時はシーン全体が破棄される想定か、
    // あるいは完全に消し去る）
    this.storageMeshes = []
    this.pipelines = []
  }
}
