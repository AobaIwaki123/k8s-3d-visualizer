---
task: D
title: Three.js シーン透明化（背景パターン表示対応）
branch: task/scene-transparency
---

## 目的

Task C が `body` に CSS ドットグリッドパターンを追加したとき、Three.js キャンバスが
それを隠してしまう。キャンバスを透明化することで CSS 背景がビューポート全体に見えるようにする。

## 担当ファイル（既存ファイルの編集のみ）

```
frontend/src/scene/SceneSetup.js   ← initScene 関数内のみ変更
```

**触ってはならないファイル:** `poc.html`、`src/` 配下の他の全 `.js` ファイル

## 依存ライブラリ（import してよいもの）

```js
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
```

## export するインターフェース

変更なし。`initScene` の戻り値シグネチャは現状を維持すること。

```js
// 変更前後で同一のシグネチャを保つ
export function initScene(canvasId)
// returns: { scene, camera, renderer, controls, startLoop }
```

## 実装要件

### 変更 1: scene.background を null にする

```js
// 変更前
scene.background = new THREE.Color(0x0a0a0f)

// 変更後
scene.background = null
```

`null` を設定すると Three.js はシーン背景を描画せず、キャンバスの `alpha` チャンネルが
CSS 背景を透過させる。

### 変更 2: WebGLRenderer に alpha: true を追加

```js
// 変更前
const renderer = new THREE.WebGLRenderer({ antialias: true, canvas })

// 変更後
const renderer = new THREE.WebGLRenderer({ antialias: true, canvas, alpha: true })
```

`alpha: true` はコンテキスト生成時のオプションのため、後から変更不可。初期化時に必ず指定する。

### 変更してはならない箇所

- `renderer.setSize` / `renderer.setPixelRatio`
- `OrbitControls` の設定
- `fitCamera` 関数（変更対象外）
- `startLoop` の実装
- `window.addEventListener('resize', ...)` のハンドラ

## 完了条件

- `scene.background` が `null` に変更されていること
- `WebGLRenderer` コンストラクタに `alpha: true` が追加されていること
- `initScene` の戻り値の型・プロパティが変更されていないこと
- `poc.js` / `poc.html` が一切変更されていないこと

## ブランチ・PR

```
ブランチ名: task/scene-transparency
PR タイトル: [Task D] Three.js シーン透明化（背景パターン表示対応）
PR 作成後に URL を報告すること
```

npm install・npm run dev は実行しない。
