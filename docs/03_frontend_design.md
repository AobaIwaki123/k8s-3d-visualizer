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

## package.json（主要依存）

- `three`: 3D レンダリング
- `vite`: 開発・ビルド環境
