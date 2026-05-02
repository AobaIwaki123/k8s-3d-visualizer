# Task B: GlbLoader

## 担当ファイル

```
frontend/src/loaders/GlbLoader.js
```

## 依存ライブラリ

- `three`
- `three/addons/loaders/GLTFLoader.js`
- 他の src/ ファイルへの依存なし

## このモジュールの責務

4 種の GLB ファイルを非同期でロードし、
キー名をつけた Map として返す。
呼び出し元は await するだけでモデルを使える状態にすること。

## GLB ファイルの配置

`frontend/public/models/` に配置済み。Vite が `/models/xxx.glb` として静的配信する。

## export するインターフェース

```js
/**
 * 4 種の GLB を並列ロードして返す。
 * @returns {Promise<{
 *   'pod-running':  THREE.Object3D,
 *   'pod-pending':  THREE.Object3D,
 *   'pod-failed':   THREE.Object3D,
 *   'service-hex':  THREE.Object3D,
 * }>}
 */
export async function loadModels() { ... }
```

## 実装仕様

- `GLTFLoader` で各ファイルを `Promise.all` で並列ロード
- ロードした `gltf.scene` をそのまま返す（clone はしない）
- 呼び出し元が `model.clone()` してシーンに追加する想定

```js
const paths = {
  'pod-running': '/models/pod-running.glb',
  'pod-pending': '/models/pod-pending.glb',
  'pod-failed':  '/models/pod-failed.glb',
  'service-hex': '/models/service-hex.glb',
}
```

## 完了条件

- `const models = await loadModels()` で 4 キーすべてが取得できる
- `models['pod-running']` が `THREE.Object3D` のインスタンスである
- ロード失敗時はコンソールにパスとエラーを出力する
