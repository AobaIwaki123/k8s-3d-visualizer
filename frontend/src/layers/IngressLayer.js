import * as THREE from 'three'
import { buildConnectionLines } from '../connections/ConnectionLine.js'

export class IngressLayer {
  constructor(scene, clusterData, models) {
    this.scene = scene
    this.clusterData = clusterData
    this.models = models
    this.layerObjects = []
    this.portals = []
    this.visible = true
    this.activeNs = 'all'

    // シーン内のオブジェクトを走査して必要なメッシュを特定・操作する
    // constructor で実行することで、レイヤー追加時に即座に反映される
    this.init()
  }

  /**
   * レイヤーの初期化: Ingress Podの移動、ポータル、トラフィックラインの生成
   */
  init() {
    const ingressPodMeshes = []
    const serviceMeshes = []

    // 1. シーン内の全オブジェクトを一度走査して必要なものを集める
    this.scene.traverse(obj => {
      if (!obj.userData || !obj.userData.meta) return

      // Ingress Pod を Y=10 へ移動
      if (obj.userData.meta.type === 'pod' && obj.userData.meta.isIngress) {
        obj.position.y = 10
        ingressPodMeshes.push(obj)
      }

      // 接続先の候補となる Service を集める
      if (obj.userData.meta.type === 'service') {
        serviceMeshes.push(obj)
      }
    })

    // 2. 可視化オブジェクト（ポータル、ライン）の生成
    ingressPodMeshes.forEach(podMesh => {
      const meta = podMesh.userData.meta
      const ns = meta.namespace

      // Cloudflare Portal: Y=12 に「輝く円盤（トーラス）」を配置
      const portalGeo = new THREE.TorusGeometry(0.5, 0.05, 16, 48)
      const portalMat = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.8,
      })
      const portal = new THREE.Mesh(portalGeo, portalMat)
      portal.rotation.x = Math.PI / 2
      portal.position.set(podMesh.position.x, 12, podMesh.position.z)
      portal.userData.namespace = ns
      
      this.scene.add(portal)
      this.layerObjects.push(portal)
      this.portals.push(portal)

      // トラフィックライン (垂直): Portal (Y=12) -> Ingress Pod (Y=10)
      const portalToPodLines = buildConnectionLines([{
        from: new THREE.Vector3(podMesh.position.x, 12, podMesh.position.z),
        to: new THREE.Vector3(podMesh.position.x, 10, podMesh.position.z)
      }])
      portalToPodLines.forEach(line => {
        // デフォルトのマテリアルは共有されているため、個別に色を変えたい場合はクローンする
        line.material = line.material.clone()
        line.material.color.set(0x00ffff)
        line.material.opacity = 0.6
        line.userData.namespace = ns
        this.scene.add(line)
        this.layerObjects.push(line)
      })

      // トラフィックライン (下向き): Ingress Pod (Y=10) -> Service (Y=4.5)
      // 全ての Ingress リソースを走査して、この Pod と関連があるか（簡易的に全 Ingress を対象とする）
      if (this.clusterData.ingresses) {
        this.clusterData.ingresses.forEach(ig => {
          ig.hosts.forEach(h => {
            h.paths.forEach(p => {
              const targetSvcName = p.serviceName
              const targetSvcMesh = serviceMeshes.find(s => 
                s.userData.meta.name === targetSvcName && s.userData.meta.namespace === ig.namespace
              )
              
              if (targetSvcMesh) {
                const podToSvcLines = buildConnectionLines([{
                  from: new THREE.Vector3(podMesh.position.x, 10, podMesh.position.z),
                  to: targetSvcMesh.position.clone()
                }])
                podToSvcLines.forEach(line => {
                  line.material = line.material.clone()
                  line.material.color.set(0x00ffff)
                  line.material.opacity = 0.35
                  line.userData.namespace = ig.namespace // ラインはターゲットのNamespaceに所属させる
                  this.scene.add(line)
                  this.layerObjects.push(line)
                })
              }
            })
          })
        })
      }
    })

    // 初期状態の可視性を適用
    this.updateVisibility()
  }

  /**
   * レイヤー全体の表示/非表示を切り替える
   */
  setVisibility(visible) {
    this.visible = visible
    this.updateVisibility()
  }

  /**
   * 特定の名前空間のみを表示するようにフィルタリングする
   */
  setNamespaceFilter(activeNs) {
    this.activeNs = activeNs
    this.updateVisibility()
  }

  /**
   * 内部状態に基づいてオブジェクトの visible フラグを更新する
   */
  updateVisibility() {
    this.layerObjects.forEach(obj => {
      // ポータルは Ingress Pod の Namespace、ラインはターゲットの Namespace に従う
      const nsMatch = (this.activeNs === 'all' || obj.userData.namespace === this.activeNs)
      obj.visible = this.visible && nsMatch
    })
  }

  /**
   * フレームごとの更新処理（アニメーション等）
   */
  update(time) {
    if (!this.visible) return
    
    // ポータルのアニメーション: 回転と脈動
    this.portals.forEach((portal, i) => {
      portal.rotation.z += 0.02
      const pulse = 1 + Math.sin(time * 0.003 + i) * 0.1
      portal.scale.set(pulse, pulse, pulse)
    })
  }

  /**
   * レイヤーの破棄: メモリ解放とオブジェクトの削除
   */
  destroy() {
    this.layerObjects.forEach(obj => {
      this.scene.remove(obj)
      if (obj.geometry) obj.geometry.dispose()
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose())
        } else {
          obj.material.dispose()
        }
      }
    })
    this.layerObjects = []
    this.portals = []
  }
}
