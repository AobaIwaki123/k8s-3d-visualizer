# K8s 3D Network Visualizer

自宅Kubernetesクラスターのネットワーク構成をThree.jsで3D可視化するWebアプリケーション。

Claude Blender Connectorで生成した3Dモデルを活用し、Pod・Node・Serviceの状態をリアルタイムで描画する。

## ドキュメント一覧
ちょっt
| # | ファイル | 内容 |
|---|---|---|
| 1 | [要件定義書](docs/01_requirements.md) | 機能要件・非機能要件・画面仕様 |
| 2 | [アーキテクチャ設計書](docs/02_architecture.md) | システム全体構成・Mermaid図 |
| 3 | [フロントエンド設計書](docs/03_frontend_design.md) | Three.js構成・コンポーネント設計・描画仕様 |
| 4 | [バックエンド設計書](docs/04_backend_design.md) | API設計・WebSocket仕様・k8sクライアント |
| 5 | [k8sクラスタ接続ガイド](docs/05_k8s_connection.md) | RBAC設定・ServiceAccount・クラスタ内外接続方法 |
| 6 | [デプロイ手順書](docs/06_deployment.md) | k8sマニフェスト・デプロイ手順 |
| 7 | [開発手順書](docs/07_development_guide.md) | 環境構築から動作確認まで（初心者向け） |

## ディレクトリ構成

```
k8s-3d-visualizer/
├── README.md
├── docs/                    # 設計書類（本ディレクトリ）
├── frontend/                # Three.js Webアプリ
│   ├── src/
│   │   ├── components/      # 3Dオブジェクトコンポーネント
│   │   ├── services/        # API・WebSocket通信
│   │   ├── store/           # 状態管理
│   │   └── assets/          # Blender生成GLBモデル
│   ├── public/
│   └── package.json
├── backend/                 # Node.js APIサーバー
│   ├── src/
│   │   ├── routes/          # REST API
│   │   ├── ws/              # WebSocketハンドラ
│   │   └── k8s/             # Kubernetesクライアント
│   └── package.json
└── k8s/                     # Kubernetesマニフェスト
    ├── namespace.yaml
    ├── serviceaccount.yaml
    ├── rbac.yaml
    ├── backend-deployment.yaml
    ├── frontend-deployment.yaml
    └── service.yaml
```

## 技術スタック

| 役割 | 技術 |
|---|---|
| 3Dモデル生成 | Blender + Claude Blender Connector → GLB |
| フロントエンド | Vite + Three.js |
| バックエンド | Node.js + @kubernetes/client-node |
| リアルタイム通信 | WebSocket |
| デプロイ先 | 自宅k8sクラスター |

## クイックスタート

詳細は [開発手順書](docs/07_development_guide.md) を参照。

```bash
# バックエンド
cd backend && npm install && npm run dev

# フロントエンド
cd frontend && npm install && npm run dev
```

ブラウザで `http://localhost:5173` を開く。
