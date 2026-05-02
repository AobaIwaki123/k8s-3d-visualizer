# アーキテクチャ設計書

## システム全体構成

```mermaid
graph TB
    subgraph Browser["ブラウザ"]
        FE["フロントエンド<br/>Vite + Three.js"]
    end

    subgraph K8sCluster["自宅 Kubernetes クラスター"]
        subgraph AppNS["Namespace: k8s-visualizer"]
            BE["バックエンド Pod<br/>Node.js"]
            FEPod["フロントエンド Pod<br/>nginx"]
            SVC["Service<br/>LoadBalancer / NodePort"]
        end

        subgraph TargetNS["監視対象 Namespace 群"]
            N1["Node-1"]
            N2["Node-2"]
            P1["Pod群"]
            P2["Pod群"]
            SV["Services"]
        end

        K8sAPI["Kubernetes API Server<br/>:6443"]
        SA["ServiceAccount<br/>k8s-visualizer"]
    end

    Browser -->|HTTP| SVC
    SVC --> FEPod
    FE -->|WebSocket / REST| SVC
    SVC --> BE
    BE -->|k8s client-node<br/>In-cluster Config| K8sAPI
    SA -->|RBAC: get/list/watch| K8sAPI
    K8sAPI --> N1
    K8sAPI --> N2
    K8sAPI --> SV
```

---

## コンポーネント間データフロー

```mermaid
sequenceDiagram
    participant Browser as ブラウザ<br/>(Three.js)
    participant BE as バックエンド<br/>(Node.js)
    participant K8s as Kubernetes<br/>API Server

    Browser->>BE: WebSocket 接続
    BE->>K8s: Watch API 開始<br/>(pods, nodes, services...)
    K8s-->>BE: 初期状態 (ADDED イベント)
    BE-->>Browser: 初期クラスター状態 JSON

    Browser->>Browser: 3Dシーン初期構築

    loop リアルタイム更新
        K8s-->>BE: 変化イベント<br/>(ADDED/MODIFIED/DELETED)
        BE-->>Browser: 差分更新 JSON
        Browser->>Browser: 3Dオブジェクト<br/>追加/更新/削除
    end

    Browser->>BE: GET /api/pod/:name (クリック時)
    BE->>K8s: Pod詳細取得
    K8s-->>BE: Pod詳細
    BE-->>Browser: 詳細情報 JSON
    Browser->>Browser: 詳細パネル表示
```

---

## ディプロイメント構成

```mermaid
graph LR
    subgraph Home["自宅ネットワーク"]
        subgraph K8s["Kubernetes クラスター"]
            subgraph NS["namespace: k8s-visualizer"]
                FEDeploy["frontend<br/>Deployment<br/>(nginx)"]
                BEDeploy["backend<br/>Deployment<br/>(node.js)"]
                NSvc["NodePort Service<br/>:30080"]
            end
            RBAC["ClusterRole +<br/>ClusterRoleBinding"]
            SAcc["ServiceAccount"]
        end
        Browser["ブラウザ<br/>192.168.x.x:30080"]
    end

    Browser -->|HTTP :30080| NSvc
    NSvc --> FEDeploy
    NSvc -->|/api, /ws| BEDeploy
    BEDeploy -->|In-cluster| SAcc
    SAcc --- RBAC
```

---

## 技術スタック詳細

### フロントエンド

| 項目 | 技術 | 理由 |
|---|---|---|
| ビルドツール | Vite | 高速HMR、設定シンプル |
| 3Dレンダリング | Three.js | 実績・ドキュメント豊富 |
| 状態管理 | Zustand | 軽量、Three.jsとの相性良 |
| WebSocket | ネイティブ WebSocket API | 外部依存不要 |
| 3Dモデル | GLB (Blender生成) + プロシージャル | Claude Blender Connector活用 |

### バックエンド

| 項目 | 技術 | 理由 |
|---|---|---|
| ランタイム | Node.js (Bun互換) | k8sクライアントライブラリが充実 |
| フレームワーク | Fastify | 軽量・高速 |
| k8sクライアント | @kubernetes/client-node | 公式ライブラリ |
| WebSocket | ws | シンプルで軽量 |

### インフラ

| 項目 | 技術 |
|---|---|
| コンテナ | Docker |
| オーケストレーション | Kubernetes |
| サービス公開 | NodePort（自宅LAN内のみ） |
| 権限管理 | ServiceAccount + ClusterRole（read-only） |

---

## データモデル（フロントエンド受信形式）

```mermaid
classDiagram
    class ClusterState {
        +Node[] nodes
        +Namespace[] namespaces
        +Pod[] pods
        +Service[] services
        +Deployment[] deployments
    }

    class Node {
        +string name
        +string status
        +string ip
        +NodeInfo info
    }

    class Pod {
        +string name
        +string namespace
        +string nodeName
        +string phase
        +string ip
        +string[] images
        +Map labels
    }

    class Service {
        +string name
        +string namespace
        +string type
        +string clusterIP
        +Map selector
        +Port[] ports
    }

    class WsEvent {
        +string type  // ADDED | MODIFIED | DELETED | INIT
        +string resource  // pod | node | service
        +object payload
    }

    ClusterState --> Node
    ClusterState --> Pod
    ClusterState --> Service
```

---

## ネットワーク接続まとめ

```mermaid
graph TD
    A["ブラウザ HTTP :30080"] --> B["nginx (frontend Pod)"]
    A2["ブラウザ WS :30080/ws"] --> C["Node.js (backend Pod)"]
    A3["ブラウザ HTTP :30080/api"] --> C
    C --> D["k8s API Server (in-cluster)"]
    D --> E["etcd（クラスター状態）"]
```

| 接続 | プロトコル | ポート |
|---|---|---|
| ブラウザ → nginx | HTTP | 30080 (NodePort) |
| ブラウザ → backend | WebSocket | 30080/ws (nginxでプロキシ) |
| ブラウザ → backend | REST | 30080/api (nginxでプロキシ) |
| backend → k8s API | HTTPS | 443 (in-cluster) |
