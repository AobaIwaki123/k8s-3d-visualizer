# フロントエンド設計書

## ディレクトリ構成

```
frontend/
├── src/
│   ├── main.js               # エントリーポイント
│   ├── App.js                # アプリルート（Canvas + UI）
│   ├── scene/
│   │   ├── SceneManager.js   # Three.js シーン・カメラ・レンダラー管理
│   │   ├── CameraController.js  # OrbitControls ラッパー
│   │   └── Lights.js         # 環境光・ディレクショナルライト設定
│   ├── objects/
│   │   ├── NodeObject.js     # k8s Node の3D表現
│   │   ├── PodObject.js      # k8s Pod の3D表現
│   │   ├── ServiceObject.js  # k8s Service の3D表現
│   │   ├── NamespaceBubble.js  # Namespace ゾーン
│   │   └── ConnectionLine.js   # Pod↔Service 接続線
│   ├── services/
│   │   ├── WebSocketClient.js  # WS接続・イベント受信
│   │   └── ApiClient.js        # REST API呼び出し
│   ├── store/
│   │   └── clusterStore.js     # Zustand ストア（クラスター状態）
│   ├── ui/
│   │   ├── DetailPanel.js      # 選択オブジェクト詳細パネル
│   │   ├── NamespaceFilter.js  # Namespace フィルター UI
│   │   └── StatusBar.js        # 接続状態・Pod数表示
│   └── assets/
│       ├── models/             # Blender生成GLBファイル（public/models/ に配置）
│       │   ├── pod-running.glb
│       │   ├── pod-pending.glb
│       │   ├── pod-failed.glb
│       │   └── service-hex.glb
│       └── textures/           # 背景・テクスチャ
├── public/
│   └── index.html
├── vite.config.js
└── package.json
```

---

## コンポーネント依存関係

```mermaid
graph TD
    main["main.js"] --> App["App.js"]
    App --> SM["SceneManager.js"]
    App --> WS["WebSocketClient.js"]
    App --> Store["clusterStore.js"]
    App --> UI["UI Components"]

    SM --> CC["CameraController.js"]
    SM --> Lights["Lights.js"]
    SM --> NO["NodeObject.js"]
    SM --> PO["PodObject.js"]
    SM --> SO["ServiceObject.js"]
    SM --> NB["NamespaceBubble.js"]
    SM --> CL["ConnectionLine.js"]

    WS --> Store
    Store --> SM

    UI --> DP["DetailPanel.js"]
    UI --> NF["NamespaceFilter.js"]
    UI --> SB["StatusBar.js"]

    PO --> |GLB読込| Assets["assets/models/"]
    SO --> |GLB読込| Assets
```

---

## 3Dオブジェクト仕様

### NodeObject（k8s Node）

```
形状: GLBモデルなし（Nodeは空間的グルーピングのみ）
配置: X軸方向に均等配置 (間隔: 6)
子オブジェクト: PodObject を上面にグリッド配置
注意: k8s Node に対応する3Dオブジェクトは描画しない。
     Pod の配置位置によって Node の所在を暗示する。
```

### PodObject（k8s Pod）

```
形状: フェーズ別GLBモデル (Blender製)
  Running     → pod-running.glb  emissive #00ff88 (緑)
  Pending     → pod-pending.glb  emissive #ffaa00 (黄)
  Failed      → pod-failed.glb   emissive #ff4444 (赤)
  Terminating → pod-running.glb  emissive #888888 (グレー、フォールバック)
配置: 親Node上面にグリッド (4列 × n行、間隔 0.6)
アニメーション: Pending時はゆっくりパルス
```

### ServiceObject（k8s Service）

```
形状: 六角形プリズムGLBモデル (service-hex.glb, Blender製)
色: emissive #4488ff (青白く発光)
配置: Node群の中央上方に浮遊 (Y=5)
接続: 対応Podへ ConnectionLine で結ぶ
```

### NamespaceBubble

```
形状: 透過球 / 透過ボックス
素材: MeshBasicMaterial, transparent: true, opacity: 0.05
色: Namespaceごとにハッシュから自動生成
ラベル: Sprite (テクスチャ文字) で名前表示
```

### ConnectionLine（Pod ↔ Service 接続）

```
形状: THREE.Line または TubeGeometry
色: #ffffff, opacity: 0.3
アニメーション: パーティクル（小さな球）が線上を流れる
  - 速度: 1.0 units/sec
  - 間隔: 0.5 sec
```

---

## シーンレイアウトアルゴリズム

```mermaid
flowchart TD
    A["クラスター状態受信"] --> B["Node数を取得"]
    B --> C["Node を X軸に均等配置<br/>gap = 6 units"]
    C --> D["各Nodeについて<br/>Pod一覧取得"]
    D --> E["Pod をNode上面に<br/>グリッド配置<br/>(4列 × ceil(n/4)行)"]
    E --> F["Namespace ごとに<br/>包含するNode群を計算"]
    F --> G["NamespaceBubble を<br/>AABB で囲む"]
    G --> H["Service を<br/>中央上方 Y=5 に配置"]
    H --> I["Service→Pod の<br/>selector でマッチング"]
    I --> J["ConnectionLine 生成"]
```

---

## カメラ・インタラクション

### OrbitControls 設定

```js
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 3;
controls.maxDistance = 50;
controls.target.set(0, 2, 0);  // シーン中心を向く
```

### Raycasting（クリック検出）

```mermaid
flowchart LR
    Click["マウスクリック"] --> Ray["Raycaster.setFromCamera"]
    Ray --> Intersect["intersectObjects(allObjects)"]
    Intersect -->|ヒット| Dispatch["Store: selectObject(obj.userData)"]
    Dispatch --> Panel["DetailPanel 表示"]
    Intersect -->|ミス| Clear["選択解除"]
```

### キーボードショートカット

| キー | 動作 |
|---|---|
| `R` | カメラリセット |
| `F` | 選択オブジェクトにフォーカス |
| `Esc` | 選択解除・パネル閉じる |

---

## WebSocket プロトコル

### 受信メッセージ形式

```json
// 初期化（接続直後）
{
  "type": "INIT",
  "payload": {
    "nodes": [...],
    "pods": [...],
    "services": [...],
    "namespaces": [...]
  }
}

// 差分更新
{
  "type": "ADDED" | "MODIFIED" | "DELETED",
  "resource": "pod" | "node" | "service",
  "payload": { ...リソース情報 }
}
```

### 接続管理

```js
// 切断時は自動再接続（3秒後）
ws.onclose = () => setTimeout(connect, 3000);
```

---

## パフォーマンス考慮

| 対策 | 内容 |
|---|---|
| InstancedMesh | Pod数が多い場合、同形状をまとめてインスタンスレンダリング |
| LOD | 遠距離のNodeはシンプルなBoxに切り替え |
| Frustum Culling | Three.js デフォルトで有効（変更不要） |
| アニメーション | requestAnimationFrame ループは60fps上限 |

---

## 状態管理（Zustand Store）

```js
// clusterStore.js のシェイプ
{
  nodes: Map<name, NodeData>,
  pods: Map<name, PodData>,
  services: Map<name, ServiceData>,
  namespaces: string[],
  selectedObject: null | { type, name, data },
  activeNamespaces: Set<string>,   // フィルター用

  // Actions
  initCluster: (payload) => void,
  applyEvent: (event) => void,
  selectObject: (obj) => void,
  toggleNamespace: (ns) => void,
}
```

---

## package.json（主要依存）

```json
{
  "dependencies": {
    "three": "^0.167.0",
    "zustand": "^4.5.0"
  },
  "devDependencies": {
    "vite": "^5.0.0"
  }
}
```
