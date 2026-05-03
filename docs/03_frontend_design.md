# フロントエンド設計書

## ディレクトリ構成

```
frontend/
├── src/
│   ├── main.js               # エントリーポイント (現在は poc.js を使用)
│   ├── layers/               # 各種演出レイヤーのプラグイン
│   │   ├── IngressLayer.js    # 外部流入
│   │   ├── MonitoringLayer.js # 監視網
│   │   └── StorageLayer.js    # ストレージ基盤
│   ├── objects/
│   │   ├── ObjectPlacer.js    # 初期配置ロジック
│   │   └── PodDecorator.js    # Podの個別装飾（スケール/発光）
│   ├── scene/
│   │   └── SceneSetup.js      # シーン・カメラ・レンダラー初期化
│   ├── interaction/
│   │   └── HoverHandler.js    # マウスオーバー処理
│   └── labels/
│       ├── LabelRenderer.js   # CSS2DRenderer 管理
│       └── ObjectLabel.js     # 個別ラベルアタッチ
├── public/
│   ├── models/               # GLB モデルファイル
│   └── cluster-state.json    # クラスタ状態のスナップショット
└── poc.html                  # メインHTML
```

## レイヤーシステム

各演出は `Layer` クラスとしてカプセル化され、以下のインターフェースを持つ。

- `constructor(scene, clusterData, pods)`: 初期化とオブジェクト生成
- `setVisibility(visible)`: レイヤー全体の表示/非表示
- `setNamespaceFilter(activeNs)`: Namespace 選択時のフィルタリング通知
- `update(time)`: フレームごとのアニメーション更新
- `destroy()`: メモリ解放

## 状態管理とフィルタリング

現在は `poc.js` 内の `updateVisibility` 関数が中心となり、以下の制御を一括で行う。

1.  Namespace Zone の表示/非表示。
2.  各 `Layer` へのフィルタリング通知。
3.  インフラ Pod（Storage/Ingress）の動的再配置。
4.  カメラの自動ズーム（`fitCamera`）。

### namespace フィルターの保持

`activeNamespace` をモジュールスコープで保持し、`updateVisibility` が呼ばれるたびに更新する。
`rebuildScene`（Pod の ADDED/DELETED など）が発生した際、`setupNamespaceFilter` は `activeNamespace` を参照して同じ namespace を再選択する。
対象 namespace がなくなった場合（その namespace の最後の Pod が削除された等）は `'all'` にフォールバックする。

### Service→Pod 関係の同期

WebSocket の ADDED/DELETED イベントで Pod が増減した際、`currentData.relationships.serviceToPods` を即時再計算してから `rebuildScene` を呼ぶ。
これにより Service の接続線・位置が常に現在の Pod 状態と整合する。

### IngressLayer のポータル表示制御

`IngressLayer.setNamespaceFilter` は、ポータルリング（Y=12 のトーラス）を以下の条件でのみ表示する：
- `activeNs === 'all'`
- または activeNs が Ingress Pod のいずれかの namespace と一致する

Ingress 以外の namespace を選択中はポータルが非表示になり、「謎の浮いたノード」が出現しない。

## package.json（主要依存）

- `three`: 3D レンダリング
- `vite`: 開発・ビルド環境
