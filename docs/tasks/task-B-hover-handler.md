---
task: B
title: ホバーインタラクションハンドラ
branch: task/hover-handler
---

## 目的

マウスホバーで Pod/Service を強調表示（emissive 輝度アップ）し、
カーソルをオブジェクト上に置いた瞬間にコールバックで外部に通知する。
クリックによる detail パネルと組み合わせて「ホバー＝プレビュー、クリック＝固定」の UX を実現する。

## 担当ファイル（新規作成のみ）

```
frontend/src/interaction/HoverHandler.js
```

**触ってはならないファイル:** `poc.js`, `poc.html`, `SceneSetup.js`, `ObjectPlacer.js`, `ConnectionLine.js`

## 依存ライブラリ（import してよいもの）

```js
import * as THREE from 'three'
```

## export するインターフェース

```js
/**
 * mousemove イベントで Raycaster を走らせ、ホバー対象の変化時にコールバックを呼ぶ。
 *
 * @param {{
 *   renderer:  THREE.WebGLRenderer,
 *   camera:    THREE.PerspectiveCamera,
 *   objects:   THREE.Object3D[],          // Pod/Service の root mesh 配列
 *   onEnter:   (meta: object) => void,    // object.userData.meta を渡す
 *   onLeave:   () => void,
 * }} options
 *
 * @returns {{ dispose: () => void }}      // イベントリスナーの解除用
 */
export function setupHoverHandler({ renderer, camera, objects, onEnter, onLeave }) { ... }
```

## 実装要件

### Raycaster

- `mousemove` に throttle は不要（`requestAnimationFrame` で間引かれるので十分）
- `raycaster.intersectObjects(objects, true)` — GLB が Group 構造のため `recursive=true` 必須
- ヒット結果の `.object` から `userData.meta` を持つ祖先を `while (obj && !obj.userData.meta)` でたどる

### ハイライト

- ホバー時: 対象 Object3D 以下の全 Mesh を `traverse` し `material.emissiveIntensity` を `2.0` に上書き
- ホバー解除時: 退避した元の値（`Map<Mesh, number>` で保持）に戻す
- `material` が共有インスタンスの場合は `material.clone()` して個別化してから変更する（元のモデルへの影響を避けるため）

### カーソルスタイル

- ホバー時: `renderer.domElement.style.cursor = 'pointer'`
- ホバー解除時: `renderer.domElement.style.cursor = ''`

### 前回ホバー対象の管理

- `let current = null` でモジュール内に保持
- 同一オブジェクト上で mousemove が来ても `onEnter` を連続発火しない（`current === hit` ならスキップ）

## 完了条件

- `setupHoverHandler` が上記シグネチャで export されていること
- `dispose()` でリスナーが確実に解除されること
- 共有マテリアルへの破壊的変更がないこと（clone して個別化）
- 副作用なし（import しただけでは何も起きない）

## ブランチ・PR

```
ブランチ名: task/hover-handler
PR タイトル: [Task B] ホバーインタラクションハンドラ
PR 作成後に URL を報告すること
```

npm install・npm run dev は実行しない。
