# Task A: SceneSetup

## 担当ファイル

```
frontend/src/scene/SceneSetup.js
```

## 依存ライブラリ

- `three` （three.js 本体のみ）
- 他の src/ ファイルへの依存なし

## このモジュールの責務

Three.js の基盤（Scene / Camera / Renderer / OrbitControls）を初期化し、
レンダリングループを起動する。他のモジュールが `scene` にオブジェクトを
追加できる状態を作ることがゴール。

## export するインターフェース

```js
/**
 * @param {string} canvasId  - HTML の canvas 要素の id
 * @returns {{
 *   scene:    THREE.Scene,
 *   camera:   THREE.PerspectiveCamera,
 *   renderer: THREE.WebGLRenderer,
 *   controls: OrbitControls,
 *   startLoop: (onFrame: () => void) => void
 * }}
 */
export function initScene(canvasId) { ... }
```

## 実装仕様

### Scene
```js
scene.background = new THREE.Color(0x0a0a0f)  // 暗い宇宙色
```

### Camera
```js
fov: 60, near: 0.1, far: 1000
position: (0, 6, 12)
lookAt: (0, 0, 0)
```

### Renderer
```js
antialias: true
canvas: document.getElementById(canvasId)
// ウィンドウリサイズ時に renderer.setSize と camera.aspect を更新すること
```

### OrbitControls
```js
controls.enableDamping = true
controls.dampingFactor = 0.05
controls.target.set(0, 2, 0)
```

### startLoop
```js
// requestAnimationFrame ループを開始する
// 毎フレーム onFrame() を呼んでから controls.update() と renderer.render() を実行
function startLoop(onFrame) { ... }
```

## 完了条件

- `initScene('canvas')` を呼ぶと暗い背景のシーンが表示される
- マウスドラッグでカメラが回転する（OrbitControls）
- ブラウザウィンドウをリサイズしてもアスペクト比が崩れない
