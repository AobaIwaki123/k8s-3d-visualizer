import * as THREE from 'three'

/**
 * 監視網レイヤー (Monitoring Neural Network)
 * Beyla, Prometheus, Loki などの監視スタックが Pod をスキャンしている様子を可視化する
 */
export class MonitoringLayer {
  constructor(scene, clusterData, pods) {
    this.group = new THREE.Group()
    this.scene = scene
    this.clusterData = clusterData
    this.pods = pods
    this.lines = []
    this.particles = []
    
    scene.add(this.group)
    this._init()
  }

  /**
   * 監視PodからターゲットPodへの接続を初期化する
   * 全接続を描画すると重いため、同一Namespace内または低確率のランダムサンプリングで間引く
   */
  _init() {
    const monitoringPods = this.pods.filter(p => p.meta.isMonitoring)
    const targetPods = this.pods.filter(p => !p.meta.isMonitoring)

    monitoringPods.forEach(mPod => {
      const type = this._getMonitoringType(mPod.meta.name)
      const color = this._getColorByType(type)
      
      const targets = targetPods.filter(t => 
        t.meta.namespace === mPod.meta.namespace || Math.random() < 0.05
      )

      targets.forEach(tPod => {
        this._createConnection(mPod, tPod, color, type)
      })
    })
  }

  _getMonitoringType(name) {
    if (name.includes('beyla')) return 'beyla'
    if (name.includes('prometheus')) return 'prometheus'
    if (name.includes('loki')) return 'loki'
    return 'generic'
  }

  _getColorByType(type) {
    switch (type) {
      case 'beyla': return 0x00ffff // 鋭いシアン (eBPF)
      case 'prometheus': return 0xffaa00 // オレンジ (Metrics)
      case 'loki': return 0xaa00ff // パープル (Logs)
      default: return 0x00ff00
    }
  }

  /**
   * 2つのPod間に光の線と流れる粒子を作成する
   */
  _createConnection(fromPod, toPod, color, type) {
    const points = [
      fromPod.mesh.position,
      toPod.mesh.position
    ]
    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    const material = new THREE.LineBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending
    })
    const line = new THREE.Line(geometry, material)
    line.userData = { 
      fromNamespace: fromPod.meta.namespace,
      toNamespace: toPod.meta.namespace,
      type
    }
    this.group.add(line)
    this.lines.push(line)

    // 流れる光の粒
    const particleGeometry = new THREE.SphereGeometry(0.05, 8, 8)
    const particleMaterial = new THREE.MeshBasicMaterial({ 
      color: color,
      transparent: true,
      blending: THREE.AdditiveBlending
    })
    const particle = new THREE.Mesh(particleGeometry, particleMaterial)
    
    this.particles.push({
      mesh: particle,
      from: fromPod.mesh.position.clone(),
      to: toPod.mesh.position.clone(),
      progress: Math.random(),
      // BeylaはeBPFなので高速にスキャンしているイメージ
      speed: type === 'beyla' ? 0.01 + Math.random() * 0.02 : 0.002 + Math.random() * 0.005,
      type
    })
    this.group.add(particle)
  }

  setVisibility(visible) {
    this.group.visible = visible
  }

  /**
   * 毎フレームの更新。粒子の移動とパルス演出を行う
   */
  update(time) {
    this.particles.forEach(p => {
      p.progress += p.speed
      if (p.progress > 1) p.progress = 0
      
      p.mesh.position.lerpVectors(p.from, p.to, p.progress)
      
      // Prometheus はゆっくりとしたパルスで生存確認しているイメージ
      if (p.type === 'prometheus') {
        const pulse = (Math.sin(time * 2 + p.progress * 10) + 1) / 2
        p.mesh.scale.setScalar(0.5 + pulse * 1.5)
        p.mesh.material.opacity = 0.3 + pulse * 0.7
      } else {
        p.mesh.scale.setScalar(1.0)
        p.mesh.material.opacity = 1.0
      }
    })
  }

  /**
   * Namespace選択時に該当する線のみを強調し、他を減衰させる
   */
  setNamespaceFilter(activeNs) {
    this.lines.forEach(l => {
      if (activeNs === 'all') {
        l.material.opacity = 0.2
        l.visible = true
      } else {
        const isRelated = l.userData.fromNamespace === activeNs || l.userData.toNamespace === activeNs
        l.material.opacity = isRelated ? 0.6 : 0.05
        l.visible = isRelated || Math.random() < 0.1 // 関連外も薄く残して「網」の継続性を出す
      }
    })
    
    this.particles.forEach(p => {
      const isRelated = activeNs === 'all' || 
                        this.lines[this.particles.indexOf(p)].userData.fromNamespace === activeNs ||
                        this.lines[this.particles.indexOf(p)].userData.toNamespace === activeNs
      p.mesh.visible = isRelated
    })
  }

  destroy() {
    this.group.clear()
    this.scene.remove(this.group)
  }
}
