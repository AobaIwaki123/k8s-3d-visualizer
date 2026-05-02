import * as THREE from 'three'

export class PodDecorator {
  /**
   * 生成された Pod メッシュに対し、メタデータに基づいて装飾を施す
   * @param {THREE.Object3D} group - GLTF からロードされたメッシュのグループ（通常は THREE.Group）
   * @param {object} meta - Pod のメタデータ
   */
  static decorate(group, meta) {
    if (!group || !meta) return

    const { name, restartCount, creationTimestamp, labels } = meta
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

    // 2. リソース/状態の表現
    // 作成からの経過時間を計算
    // データ内の最新タイムスタンプ（2026-05-02）を基準にする
    const BASE_TIME = new Date('2026-05-02T13:28:11.889Z').getTime()
    const created = new Date(creationTimestamp).getTime()
    const ageHours = (BASE_TIME - created) / (1000 * 60 * 60)
    const isNew = ageHours >= 0 && ageHours < 48 // 48時間以内を「新しい」と定義

    group.traverse(child => {
      if (child.isMesh) {
        // マテリアルをクローンする — 個別の Pod ごとに見た目を変え、他へ影響させないため
        child.material = child.material.clone()

        // restartCount がある場合はマゼンタ色の発光を付与（Failedの赤と区別）
        if (restartCount > 0) {
          child.material.emissive = new THREE.Color(0xff00ff)
          child.material.emissiveIntensity = Math.min(restartCount * 0.2, 0.8)
        }

        // 新しい Pod は青白く発光させる
        if (isNew) {
          const freshColor = new THREE.Color(0x00ffff)
          if (restartCount === 0) {
            child.material.emissive = freshColor
            child.material.emissiveIntensity = 0.6
          } else {
            // 両方の場合は色を混ぜる
            child.material.emissive.lerp(freshColor, 0.5)
            child.material.emissiveIntensity = Math.min(child.material.emissiveIntensity + 0.3, 1.0)
          }
        }
      }
    })
  }
}
