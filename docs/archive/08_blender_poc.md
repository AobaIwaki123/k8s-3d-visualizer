# Blender MCP 技術検証設計書

## 概要

Blender MCP Server を通じて Claude が Blender を操作し、
Kubernetes リソース種別ごとの 3D アセット（GLB）を生成する。
レイアウト・接続・リアルタイム更新は Three.js 側で管理する。

---

## 役割分担

| 責務                     | 担当        |
|--------------------------|-------------|
| リソース種別の形状・素材   | Blender MCP |
| 位置・間隔・グリッド配置   | Three.js    |
| Service-Pod 接続線        | Three.js    |
| アニメーション・発光効果   | Three.js    |
| リアルタイム差分更新       | Three.js    |

---

## フェーズ構成

```
Phase 1: Blender MCP でリソース種別ごとに GLB を 1 つずつ生成・保存
Phase 2: Three.js を簡易実装し、GLB 読み込みと接続表現を検証
```

---

## Phase 1: GLB アセット生成

### 生成対象

各リソース種別につき 1 ファイル。位置情報は原点（0,0,0）固定。

| ファイル名              | 対象リソース | 形状              | 素材                       |
|------------------------|-------------|------------------|----------------------------|
| `pod-running.glb`      | Pod         | 立方体            | エミッション緑 `#00ff88`    |
| `pod-pending.glb`      | Pod         | 立方体            | エミッション橙 `#ffaa00`    |
| `pod-failed.glb`       | Pod         | 立方体            | エミッション赤 `#ff4444`    |
| `service-hex.glb`      | Service     | 六角形プリズム    | エミッション青 `#4488ff`    |

> k8s Node は描画オブジェクトを持たない。Three.js が保持するデータとしてのみ扱う。
> Pod は phase ごとに別ファイルとする（Three.js 側でフェーズに応じて使い分ける）。
> Namespace は Three.js 側でプロシージャル生成するため Blender アセット不要。

### サイズ基準

| アセット          | W    | H    | D    | 備考               |
|-----------------|------|------|------|--------------------|
| pod-*.glb       | 0.4  | 0.4  | 0.4  |                    |
| service-hex.glb | r=0.6| 0.3  | r=0.6| 六角形断面、高さ0.3 |

### 保存先

```
frontend/src/assets/models/
├── pod-running.glb
├── pod-pending.glb
├── pod-failed.glb
└── service-hex.glb
```

### Blender MCP プロンプト（1 ファイルずつ実行）

**pod-running.glb**
```
Clear the default scene.
Create a cube: width=height=depth=0.4.
Apply a material with base color=#111111, emissive color=#00ff88, emissive strength=2.0.
Center it at the origin (0,0,0).
Name the object "pod-running".
Export as /path/to/frontend/src/assets/models/pod-running.glb.
```

**pod-pending.glb**
```
Clear the default scene.
Create a cube: width=height=depth=0.4.
Apply a material with base color=#111111, emissive color=#ffaa00, emissive strength=2.0.
Center it at the origin (0,0,0).
Name the object "pod-pending".
Export as /path/to/frontend/src/assets/models/pod-pending.glb.
```

**pod-failed.glb**
```
Clear the default scene.
Create a cube: width=height=depth=0.4.
Apply a material with base color=#111111, emissive color=#ff4444, emissive strength=2.0.
Center it at the origin (0,0,0).
Name the object "pod-failed".
Export as /path/to/frontend/src/assets/models/pod-failed.glb.
```

**service-hex.glb**
```
Clear the default scene.
Create a cylinder with 6 vertices (hexagonal prism): radius=0.6, depth=0.3.
Apply a material with base color=#111111, emissive color=#4488ff, emissive strength=2.0.
Center it at the origin (0,0,0).
Name the object "service".
Export as /path/to/frontend/src/assets/models/service-hex.glb.
```

---

## Phase 2: Three.js 簡易実装による接続表現検証

### 目的

GLB アセットを実際に読み込み、Service-Pod 間の接続をどう表現するかを確認する。

### 検証シーン構成（ハードコード）

実クラスタデータは使わず、以下の固定構成で検証する。

```
Pod (Running) x3
Pod (Pending) x1

Service x1  （上記 Pod のうち Running の 2 つに接続）
```

### 接続表現の候補と比較

| 方式             | 実装                              | 特徴                                        |
|----------------|-----------------------------------|---------------------------------------------|
| A: 直線          | `THREE.Line` + `BufferGeometry`   | 最軽量。視認性は低い                          |
| B: チューブ       | `TubeGeometry` + `CatmullRomCurve3` | 曲線で立体感あり。Pod 数が増えると重い         |
| C: 点線パーティクル | `Points` + アニメーション          | トラフィック感を表現できる。実装コスト高        |
| D: 発光直線       | `Line` + `bloom` (postprocessing) | 軽量かつ視認性高い。`three/addons` が必要     |

**初期検証は A（直線）で実装し、視認性が不十分なら D（発光直線）に切り替える。**

### ファイル構成（Vite プロジェクト）

PoC は `frontend/` に直接実装する。GLB が `frontend/src/assets/models/` にあるため
パスの乖離が生じない。本実装への移行もファイル追加のみで済む。

```
frontend/
├── public/
│   └── models/              # Vite dev server から /models/ で配信
│       ├── pod-running.glb
│       ├── pod-pending.glb
│       ├── pod-failed.glb
│       └── service-hex.glb
├── src/
│   └── poc.js               # PoC シーン（ハードコード）
├── poc.html                 # PoC エントリ（index.html とは別）
├── vite.config.js
└── package.json
```

> GLB は `public/models/` に置くことで Vite が静的配信し、
> `GLTFLoader` から `/models/pod-running.glb` のような絶対パスで参照できる。

### poc.js の責務（概要）

1. シーン・カメラ・レンダラー・OrbitControls を初期化
2. `GLTFLoader` で 4 種の GLB を `/models/` から読み込む
3. ハードコードした位置に Pod・Service を配置
4. Pod と Service の対応リストをもとに接続線を描画
5. レンダリングループを回す

### レイアウト（固定値）

```
Pod[0]:  position=(0.0, 0.0, 0)   ← Running
Pod[1]:  position=(0.6, 0.0, 0)   ← Running
Pod[2]:  position=(1.2, 0.0, 0)   ← Running
Pod[3]:  position=(1.8, 0.0, 0)   ← Pending
Service: position=(0.9, 4.0, 0)   ← 上方に浮遊
```

### 接続線の描画仕様

```
接続元: Service の position
接続先: 対象 Pod の position
形状:   THREE.Line（BufferGeometry に 2 頂点）
色:     #ffffff, opacity=0.3, transparent=true
```

---

## 検証チェックリスト

### Phase 1
- [ ] `pod-running.glb` が生成・保存できる
- [ ] `pod-pending.glb` が生成・保存できる
- [ ] `pod-failed.glb` が生成・保存できる
- [ ] `service-hex.glb` が生成・保存できる

### Phase 2
- [ ] Vite プロジェクトが起動できる（`npm run dev`）
- [ ] 4 種の GLB が `/models/` から読み込める
- [ ] Pod・Service が指定位置に配置できる
- [ ] 直線（案 A）で Service-Pod 接続が描画できる
- [ ] 発光直線（案 D）への切り替えが有効か確認する
</content>
</invoke>