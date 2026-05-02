# Task D: ConnectionLine

## 担当ファイル

```
frontend/src/connections/ConnectionLine.js
```

## 依存ライブラリ

- `three`
- 他の src/ ファイルへの依存なし

## このモジュールの責務

Service の位置と接続先 Pod の位置を受け取り、
接続を表す `THREE.Line` オブジェクトの配列を返す。
Scene への追加は呼び出し元が行う。

## export するインターフェース

```js
/**
 * @param {Array<{
 *   from: THREE.Vector3,   // Service の位置
 *   to:   THREE.Vector3,   // Pod の位置
 * }>} connections
 *
 * @returns {THREE.Line[]}
 */
export function buildConnectionLines(connections) { ... }
```

## 実装仕様

### 線のマテリアル
```js
new THREE.LineBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.35,
})
```

### ジオメトリ
```js
// 1 接続につき 1 本の Line
const geometry = new THREE.BufferGeometry().setFromPoints([from, to])
```

## 呼び出し元での使用例（実装不要、参考）

```js
// ObjectPlacer の結果から接続リストを構築する想定
const connections = []
for (const svc of services) {
  for (const podName of svc.meta.targets) {
    const pod = pods.find(p => p.meta.name === podName)
    if (pod) connections.push({ from: svc.mesh.position, to: pod.mesh.position })
  }
}
const lines = buildConnectionLines(connections)
lines.forEach(l => scene.add(l))
```

## 完了条件

- `buildConnectionLines([{ from, to }])` が `THREE.Line` を 1 本返す
- 複数渡すと本数分の `THREE.Line` が返る
- 線が半透明（opacity=0.35）になっている
