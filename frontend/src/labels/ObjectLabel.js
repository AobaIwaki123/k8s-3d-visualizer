import * as THREE from 'three'
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'

const PHASE_CLASSES = {
  running:     'label-phase--running',
  pending:     'label-phase--pending',
  failed:      'label-phase--failed',
  terminating: 'label-phase--terminating',
}

/**
 * CSS2DObject ラベルを生成し object にアタッチする（scene.add 不要）。
 *
 * @param {THREE.Object3D}   object
 * @param {string}           text        — 表示テキスト（Pod名 / Service名）
 * @param {'pod'|'service'}  kind
 * @param {{ y?: number }}   [opts]      — Y オフセット（デフォルト 0.7）
 * @returns {CSS2DObject}
 */
export function attachLabel(object, text, kind, opts = {}) {
  const el = document.createElement('div')
  el.className = `label label--${kind}`

  const nameEl = document.createElement('span')
  nameEl.className = 'label-name'
  nameEl.textContent = text
  el.appendChild(nameEl)

  if (kind === 'pod') {
    const phase = (object.userData.meta?.phase ?? '').toLowerCase()
    const badge = document.createElement('span')
    badge.className = `label-phase ${PHASE_CLASSES[phase] ?? ''}`
    badge.textContent = object.userData.meta?.phase ?? ''
    el.appendChild(badge)
  } else {
    const badge = document.createElement('span')
    badge.className = 'label-kind'
    badge.textContent = 'Service'
    el.appendChild(badge)
  }

  const labelObj = new CSS2DObject(el)
  labelObj.position.set(0, opts.y ?? 0.7, 0)
  object.add(labelObj)

  return labelObj
}
