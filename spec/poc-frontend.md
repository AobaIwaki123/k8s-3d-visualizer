# PoC フロントエンド 仕様（正解ドキュメント）

並列実装（Task A〜D）の整合性確認用。各タスク完了後にこのドキュメントと突き合わせる。

---

## ファイル構成

```
frontend/
├── src/
│   ├── poc.js                          # 統合エントリ（変更禁止）
│   ├── scene/
│   │   └── SceneSetup.js               # Task A
│   ├── loaders/
│   │   └── GlbLoader.js                # Task B
│   ├── objects/
│   │   └── ObjectPlacer.js             # Task C
│   └── connections/
│       └── ConnectionLine.js           # Task D
└── public/
    └── models/
        ├── pod-running.glb
        ├── pod-pending.glb
        ├── pod-failed.glb
        └── service-hex.glb
```

---

## モジュールインターフェース

### Task A — `SceneSetup.js`

```js
export function initScene(canvasId: string): {
  scene:    THREE.Scene,
  camera:   THREE.PerspectiveCamera,
  renderer: THREE.WebGLRenderer,
  controls: OrbitControls,
  startLoop: (onFrame: () => void) => void,
}
```

### Task B — `GlbLoader.js`

```js
export async function loadModels(): Promise<{
  'pod-running': THREE.Object3D,
  'pod-pending': THREE.Object3D,
  'pod-failed':  THREE.Object3D,
  'service-hex': THREE.Object3D,
}>
```

### Task C — `ObjectPlacer.js`

```js
export function placePocObjects(models: ReturnType<typeof loadModels>): {
  pods:     Array<{ mesh: THREE.Object3D, meta: PodMeta }>,
  services: Array<{ mesh: THREE.Object3D, meta: ServiceMeta }>,
}

type PodMeta     = { name: string, phase: string }
type ServiceMeta = { name: string, targets: string[] }  // targets は Pod name の配列
```

### Task D — `ConnectionLine.js`

```js
export function buildConnectionLines(connections: Array<{
  from: THREE.Vector3,
  to:   THREE.Vector3,
}>): THREE.Line[]
```

---

## 定数（マジックナンバー）

### SceneSetup (Task A)

| 項目 | 値 |
|---|---|
| scene.background | `0x0a0a0f` |
| camera fov | `60` |
| camera near | `0.1` |
| camera far | `1000` |
| camera position | `(0, 6, 12)` |
| camera lookAt | `(0, 0, 0)` |
| controls.enableDamping | `true` |
| controls.dampingFactor | `0.05` |
| controls.target | `(0, 2, 0)` |
| antialias | `true` |

### GlbLoader (Task B)

| キー | パス |
|---|---|
| `pod-running` | `/models/pod-running.glb` |
| `pod-pending` | `/models/pod-pending.glb` |
| `pod-failed`  | `/models/pod-failed.glb`  |
| `service-hex` | `/models/service-hex.glb` |

- ロード方式: `Promise.all` で並列ロード
- 返却値: `gltf.scene`（clone なし）
- 呼び出し元が `model.clone()` してシーンに追加する

### ObjectPlacer (Task C)

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

- Pod モデル選択: `models['pod-' + phase.toLowerCase()].clone()`
- 座標設定: `mesh.position.set(...position)`
- メタ格納: `mesh.userData.meta = { name, phase }` または `{ name, targets }`

### ConnectionLine (Task D)

```js
// マテリアル
new THREE.LineBasicMaterial({
  color:       0xffffff,
  transparent: true,
  opacity:     0.35,
})

// ジオメトリ（1接続 = 1本のLine）
new THREE.BufferGeometry().setFromPoints([from, to])
```

---

## 統合フロー（poc.js — 変更禁止）

```js
async function main() {
  const { scene, startLoop } = initScene('canvas')

  const models = await loadModels()

  const { pods, services } = placePocObjects(models)
  pods.forEach(p => scene.add(p.mesh))
  services.forEach(s => scene.add(s.mesh))

  const connections = []
  for (const svc of services) {
    for (const podName of svc.meta.targets) {
      const pod = pods.find(p => p.meta.name === podName)
      if (pod) connections.push({ from: svc.mesh.position, to: pod.mesh.position })
    }
  }
  buildConnectionLines(connections).forEach(l => scene.add(l))

  startLoop(() => {})
}
```

`poc.js` はすでに実装済み。各モジュールのインターフェースはこの呼び出しパターンを満たす必要がある。

---

## モジュール依存ルール

| モジュール | 許可されるインポート |
|---|---|
| `SceneSetup.js` | `three` のみ |
| `GlbLoader.js` | `three`, `three/addons/loaders/GLTFLoader.js` のみ |
| `ObjectPlacer.js` | `three` のみ |
| `ConnectionLine.js` | `three` のみ |

- 各モジュールは **他の `src/` ファイルに依存しない**
- モジュール間の結合は `poc.js` が担う

---

## 整合性チェックリスト

実装後に以下を確認する。

### インターフェース
- [ ] `initScene(canvasId)` が `{ scene, camera, renderer, controls, startLoop }` を返す
- [ ] `loadModels()` が 4キー（`pod-running`, `pod-pending`, `pod-failed`, `service-hex`）を返す
- [ ] `placePocObjects(models)` が `{ pods: [...], services: [...] }` を返す
- [ ] `buildConnectionLines(connections)` が `THREE.Line[]` を返す

### 定数
- [ ] `scene.background` が `0x0a0a0f`
- [ ] `camera.position` が `(0, 6, 12)`
- [ ] `controls.target` が `(0, 2, 0)`
- [ ] ConnectionLine の `opacity` が `0.35`
- [ ] ObjectPlacer の Pod 数が 4、Service 数が 1

### 統合
- [ ] `poc.js` を変更せずにシーンが表示される
- [ ] Pod 4体と Service 1体がシーンに追加される
- [ ] Service→Pod の接続線が 2本（svc-a → pod-a, svc-a → pod-b）生成される
