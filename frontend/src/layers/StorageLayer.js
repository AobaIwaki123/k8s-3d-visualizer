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
    this.isVisible = true

    this.init()
  }

  init() {
    this.storagePods = []

    // 1. Ceph Bedrock: isStorage: true の Pod を地下（Y=-3）に配置
    const storageMaterial = new THREE.MeshStandardMaterial({
      color: 0x555555,
      metalness: 0.9,
      roughness: 0.1,
      emissive: 0x222222
    })

    this.pods.forEach(p => {
      if (p.meta.isStorage) {
        p.mesh.position.y = -3

        p.mesh.traverse(child => {
          if (child.isMesh) {
            child.material = storageMaterial
          }
        })

        // グループに移さない — poc.js と二重管理を避けるためシーン直下で管理
        this.storagePods.push(p)
        this.storageMeshes.push(p.mesh)
      }
    })

    // Storage Pipeline は Ceph Pod の動的移動に追従する必要があるため
    // poc.js の repositionCephAndPipes で一元管理する（ここでは描画しない）

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
    // パイプラインは選択中 NS のものだけ表示
    this.pipelines.forEach(pipe => {
      const line = pipe.line || pipe
      line.visible = (activeNs === 'all' || line.userData.namespace === activeNs)
    })
    // ストレージ Pod の可視性は poc.js の isStorageZone チェックに委譲
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
