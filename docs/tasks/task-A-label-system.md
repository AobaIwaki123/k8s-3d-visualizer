---
task: A
title: CSS2D ラベルシステム
branch: task/label-system
---

## 目的

Three.js の CSS2DRenderer を使い、3D 空間上のオブジェクトに HTML ラベルを常時表示する。
ラベルは Pod 名・phase・Service 名を示し、カメラに常に正面を向く（CSS2D の仕様により自動）。

## 担当ファイル（新規作成のみ）

```
frontend/src/labels/LabelRenderer.js   ← CSS2DRenderer の初期化・更新
frontend/src/labels/ObjectLabel.js     ← 個別ラベルの生成・スタイリング
```

**触ってはならないファイル:** `poc.js`, `poc.html`, `SceneSetup.js`, `ObjectPlacer.js`

## 依存ライブラリ（import してよいもの）

```js
import * as THREE from 'three'
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
```

## export するインターフェース

### `LabelRenderer.js`

```js
/**
 * CSS2DRenderer を初期化し、canvas の兄弟要素として DOM に追加する。
 * @param {HTMLElement} container — canvas の親要素（通常 document.body）
 * @returns {{ labelRenderer: CSS2DRenderer, updateSize: () => void, render: (scene, camera) => void }}
 *   render: アニメーションループ内で毎フレーム呼ぶ
 *   updateSize: window resize 時に呼ぶ
 */
export function initLabelRenderer(container) { ... }
```

### `ObjectLabel.js`

```js
/**
 * CSS2DObject ラベルを生成して Object3D にアタッチする。
 * @param {THREE.Object3D} object     — ラベルを貼る対象
 * @param {string}          text      — 表示テキスト
 * @param {'pod'|'service'} kind      — CSSクラス名の選択に使う
 * @param {{ y?: number }}  [opts]    — ラベルのオフセット（デフォルト y=0.7）
 * @returns {CSS2DObject}             — scene.add() 不要（object の子として追加済み）
 */
export function attachLabel(object, text, kind, opts = {}) { ... }
```

## 実装要件

### LabelRenderer

- `CSS2DRenderer` を `new` して `renderer.domElement.style` と同様に `position: absolute; top: 0; pointer-events: none` で重ねる
- `domElement.style.zIndex = '5'` でキャンバスより手前に
- `setSize` は `window.innerWidth, window.innerHeight` で初期化
- `updateSize()` は renderer の `setSize` を再呼び出しするだけ

### ObjectLabel

Pod ラベルの HTML 構造:
```html
<div class="label label--pod">
  <span class="label-name">frontend-7d9f2</span>
  <span class="label-phase label-phase--running">Running</span>
</div>
```

Service ラベルの HTML 構造:
```html
<div class="label label--service">
  <span class="label-name">svc-frontend</span>
  <span class="label-kind">Service</span>
</div>
```

CSS は `poc.html` 側で定義されるため、このモジュールは DOM の class 付与のみ担う。
`CSS2DObject` の position は `new THREE.Vector3(0, opts.y ?? 0.7, 0)` で Object3D の上方にオフセット。

## 完了条件

- `initLabelRenderer` と `attachLabel` が上記シグネチャで export されていること
- `import` しても副作用（DOM 操作・グローバル変数）が起きないこと（initLabelRenderer 呼び出し時のみ DOM 操作）
- TypeScript 型エラーなし（JSDoc で型が明示されていること）

## ブランチ・PR

```
ブランチ名: task/label-system
PR タイトル: [Task A] CSS2D ラベルシステム
PR 作成後に URL を報告すること
```

npm install・npm run dev は実行しない。
