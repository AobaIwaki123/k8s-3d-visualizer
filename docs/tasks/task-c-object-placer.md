# Task C: ObjectPlacer

## 担当ファイル

```
frontend/src/objects/ObjectPlacer.js
```

## 依存ライブラリ

- `three`
- 他の src/ ファイルへの依存なし

## このモジュールの責務

モデルオブジェクトとハードコードしたデータを受け取り、
座標を設定した Pod / Service のメッシュ群を返す。
Scene への追加は呼び出し元が行う。

## export するインターフェース

```js
/**
 * @param {{
 *   'pod-running':  THREE.Object3D,
 *   'pod-pending':  THREE.Object3D,
 *   'pod-failed':   THREE.Object3D,
 *   'service-hex':  THREE.Object3D,
 * }} models  - GlbLoader.loadModels() の戻り値
 *
 * @returns {{
 *   pods:     Array<{ mesh: THREE.Object3D, meta: PodMeta }>,
 *   services: Array<{ mesh: THREE.Object3D, meta: ServiceMeta }>,
 * }}
 */
export function placePocObjects(models) { ... }

// meta の型定義
// PodMeta     = { name: string, phase: string }
// ServiceMeta = { name: string, targets: string[] }  ← targets は Pod name の配列
```

## ハードコードするデータ

```js
const POC_PODS = [
  { name: 'pod-a', phase: 'Running',  position: [0.0, 0, 0] },
  { name: 'pod-b', phase: 'Running',  position: [0.6, 0, 0] },
  { name: 'pod-c', phase: 'Running',  position: [1.2, 0, 0] },
  { name: 'pod-d', phase: 'Pending',  position: [1.8, 0, 0] },
]

const POC_SERVICES = [
  { name: 'svc-a', position: [0.9, 4.0, 0], targets: ['pod-a', 'pod-b'] },
]
```

## 実装仕様

- 各 Pod は `models['pod-{phase.toLowerCase()}'].clone()` を使う
- `mesh.position.set(...position)` で座標を設定する
- `mesh.userData` に meta を格納する（後でクリック判定に使う）

## 完了条件

- `placePocObjects(models)` が `pods` 4件、`services` 1件を返す
- 各 mesh の `position` が仕様通りに設定されている
- 各 mesh の `userData.meta` に name / phase が入っている
