import * as THREE from 'three'

export class PodDecorator {
  /**
   * 生成された Pod メッシュに対し、メタデータに基づいて装飾を施す
   * @param {THREE.Object3D} group - GLTF からロードされたメッシュのグループ（通常は THREE.Group）
   * @param {object} meta - Pod のメタデータ
   */
  static decorate(group, meta) {
    if (!group || !meta) return

    const { name, labels } = meta
    const nameLower = name.toLowerCase()

    // 1. 役割別のスケーリング
    // DB系: 重厚感を出すため X-Z方向に少し太くする
    const isDB = nameLower.includes('db') || 
                 nameLower.includes('redis') || 
                 nameLower.includes('postgres') || 
                 nameLower.includes('mysql') || 
                 nameLower.includes('mongo') ||
                 nameLower.includes('storage') ||
                 (labels && (labels['app.kubernetes.io/component'] === 'database' || labels['component'] === 'database'))
    
    // API系: 軽快さを出すため Y方向に少し伸ばす
    const isAPI = nameLower.includes('api') || 
                  nameLower.includes('gateway') || 
                  nameLower.includes('server') || 
                  nameLower.includes('backend') ||
                  nameLower.includes('controller')

    if (isDB) {
      group.scale.set(1.3, 1.0, 1.3)
    } else if (isAPI) {
      group.scale.set(1.0, 1.4, 1.0)
    }

    // 2. マテリアルをクローンする — 個別の Pod ごとに見た目を変え、他へ影響させないため
    // GLB に焼き込まれたフェーズ色（Running=緑、Pending=オレンジ、Failed=赤）はそのまま使用
    group.traverse(child => {
      if (child.isMesh) {
        child.material = child.material.clone()
      }
    })
  }
}
