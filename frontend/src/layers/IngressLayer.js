import * as THREE from 'three'
import { buildConnectionLines } from '../connections/ConnectionLine.js'

export class IngressLayer {
  constructor(scene, clusterData, models) {
    this.scene = scene
    this.clusterData = clusterData
    this.models = models
    this.group = new THREE.Group()
    this.scene.add(this.group)

    this.ingressPods = []
    this.services = []
    this.portal = null
    this.visible = true
    this.activeNs = 'all'

    this.init()
  }

  init() {
    // 1. Ingress Pod の特定と移動
    this.scene.traverse(obj => {
      if (obj.userData?.meta?.type === 'pod' && obj.userData.meta.isIngress) {
        obj.position.y = 10
        this.ingressPods.push(obj)
      }
      if (obj.userData?.meta?.type === 'service') {
        this.services.push(obj)
      }
    })

    if (this.ingressPods.length === 0) return

    // 2. クラスター全体の「真上センター」に巨大ポータルを作成
    // 全 Pod の X, Z の中心を求める
    const box = new THREE.Box3()
    this.scene.traverse(obj => {
      if (obj.userData?.meta?.type === 'pod') box.expandByPoint(obj.position)
    })
    const center = new THREE.Vector3()
    box.getCenter(center)
    const portalPos = new THREE.Vector3(center.x, 12, center.z)

    // Cloudflare オレンジ (#f38020)
    const orange = 0xf38020

    // 巨大なポータルの作成
    const portalGeo = new THREE.TorusGeometry(3.5, 0.15, 16, 100)
    const portalMat = new THREE.MeshStandardMaterial({
      color: orange,
      emissive: orange,
      emissiveIntensity: 2,
      transparent: true,
      opacity: 0.8
    })
    this.portal = new THREE.Mesh(portalGeo, portalMat)
    this.portal.rotation.x = Math.PI / 2
    this.portal.position.copy(portalPos)
    this.group.add(this.portal)

    // 補助的な光（ディスク）
    const diskGeo = new THREE.CircleGeometry(3.3, 32)
    const diskMat = new THREE.MeshBasicMaterial({
      color: orange,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide
    })
    const disk = new THREE.Mesh(diskGeo, diskMat)
    disk.rotation.x = Math.PI / 2
    disk.position.copy(portalPos)
    this.group.add(disk)

    // 3. トラフィックラインの作成
    const lineMat = new THREE.LineBasicMaterial({
      color: orange,
      transparent: true,
      opacity: 0.5
    })

    // Portal -> Ingress Pod (放射状に降りてくる)
    this.ingressPods.forEach(pod => {
      const geo = new THREE.BufferGeometry().setFromPoints([portalPos, pod.position])
      const line = new THREE.Line(geo, lineMat)
      line.userData.namespace = pod.userData.meta.namespace
      this.group.add(line)

      // Ingress Pod -> 関連 Service
      this._connectToServices(pod, orange)
    })
  }

  _connectToServices(pod, color) {
    const ingressSvcNames = new Set()
    if (this.clusterData.ingresses) {
      this.clusterData.ingresses.forEach(ing => {
        ing.hosts?.forEach(h => h.paths?.forEach(p => {
          if (p.serviceName) ingressSvcNames.add(p.serviceName)
        }))
      })
    }

    const targetSvcs = this.services.filter(s => ingressSvcNames.has(s.userData.meta.name))
    const lineMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.3 })

    targetSvcs.forEach(svc => {
      const geo = new THREE.BufferGeometry().setFromPoints([pod.position, svc.position])
      const line = new THREE.Line(geo, lineMat)
      line.userData.namespace = svc.userData.meta.namespace
      this.group.add(line)
    })
  }

  update(time) {
    if (!this.visible || !this.portal) return
    this.portal.rotation.z += 0.01
    const s = 1 + Math.sin(time * 2) * 0.05
    this.portal.scale.set(s, s, s)
  }

  setNamespaceFilter(activeNs) {
    this.activeNs = activeNs
    this.group.children.forEach(obj => {
      if (obj === this.portal) return
      const ns = obj.userData?.namespace
      obj.visible = (activeNs === 'all' || ns === activeNs)
    })
  }

  setVisibility(visible) {
    this.visible = visible
    this.group.visible = visible
  }

  destroy() {
    this.scene.remove(this.group)
    this.group.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose()
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose())
        else obj.material.dispose()
      }
    })
  }
}
