# Blender MCP 技術検証設計書

## 概要

Blender MCP Server を通じて Claude が直接 Blender を操作し、
Kubernetes クラスタの状態を 3D シーンとして生成する。
コードは書かず、構造化されたプロンプトを MCP に渡すことで描画を実現する。

---

## アプローチ

```
kubectl → 正規化 JSON → 構造化プロンプト → Blender MCP → .blend / .glb
```

1. `kubectl` で生 JSON を取得
2. 必要フィールドだけ抽出した正規化 JSON に変換
3. 正規化 JSON をもとに Blender MCP へ渡す構造化プロンプトを生成
4. Claude が MCP 経由で Blender を操作してシーンを構築

---

## フェーズ構成

```
Phase 1: ノード種別ごとの形状をBlenderに作成できるか検証
Phase 2: k8s クラスタ情報の取得・正規化
Phase 3: 正規化データを構造化プロンプトに変換してシーン生成
```

---

## Phase 1: ノード種別ごとの形状定義

### リソース → 形状マッピング

| k8s リソース | 形状              | カラー                   | サイズ             |
|-------------|------------------|--------------------------|--------------------|
| Node        | 直方体            | グレー `#aaaaaa`          | W=4, H=2, D=2      |
| Pod         | 立方体            | フェーズ依存（下表）       | W=H=D=0.4          |
| Service     | 六角形プリズム     | 青白 `#4488ff`（発光）    | 半径=0.6, 高さ=0.3  |
| Namespace   | 透過ボックス       | 名前ハッシュから自動生成   | 内包 Node を囲う   |

### Pod フェーズ → カラー

| フェーズ      | Emission カラー |
|-------------|----------------|
| Running     | `#00ff88`      |
| Pending     | `#ffaa00`      |
| Failed      | `#ff4444`      |
| Terminating | `#888888`      |

### Phase 1 検証プロンプト（Blender MCP へ渡す形式）

```
Create the following 4 objects in Blender to validate k8s resource type representations.
Clear the default scene first.

1. K8s Node (name: "node-sample")
   - Shape: rectangular box, W=4 H=2 D=2
   - Material: gray, color=#aaaaaa, no emission
   - Position: (0, 0, 0)

2. Pod (name: "pod-running")
   - Shape: cube, W=H=D=0.4
   - Material: emissive green #00ff88
   - Position: (0.6, 1.2, 0)

3. Pod (name: "pod-pending")
   - Shape: cube, W=H=D=0.4
   - Material: emissive orange #ffaa00
   - Position: (1.2, 1.2, 0)

4. Service (name: "service-sample")
   - Shape: hexagonal prism (cylinder with 6 vertices), radius=0.6 depth=0.3
   - Material: emissive blue #4488ff
   - Position: (0, 5, 0)

Name each object exactly as specified above.
After creation, export the scene as /tmp/poc_node_types.glb.
```

---

## Phase 2: k8s クラスタ情報の正規化

### 取得元

```bash
kubectl get nodes            -o json
kubectl get pods             --all-namespaces -o json
kubectl get services         --all-namespaces -o json
```

### 正規化 JSON スキーマ（Blender MCP への入力形式）

Blender MCP プロンプトに埋め込む前に、生の kubectl JSON からこの構造に変換する。

```json
{
  "nodes": [
    {
      "name": "k8s-worker-1",
      "status": "Ready"
    }
  ],
  "pods": [
    {
      "name": "argocd-server-xxx",
      "namespace": "argocd",
      "nodeName": "k8s-worker-1",
      "phase": "Running",
      "labels": {
        "app.kubernetes.io/name": "argocd-server"
      }
    }
  ],
  "services": [
    {
      "name": "argocd-server",
      "namespace": "argocd",
      "type": "ClusterIP",
      "selector": {
        "app.kubernetes.io/name": "argocd-server"
      }
    }
  ]
}
```

### 抽出ルール

| フィールド        | kubectl JSON パス                              |
|-----------------|-----------------------------------------------|
| node.name       | `metadata.name`                               |
| node.status     | `status.conditions[type=Ready].status` → `"Ready"` or `"NotReady"` |
| pod.nodeName    | `spec.nodeName`                               |
| pod.phase       | `status.phase`                                |
| pod.labels      | `metadata.labels`                             |
| service.selector| `spec.selector`                               |

---

## Phase 3: 構造化プロンプトの生成

正規化 JSON を Blender MCP へ渡すプロンプトのテンプレート。
Claude がこのテンプレートにデータを埋め込んでシーンを生成する。

### レイアウトルール

```
Node 配置  : X 軸方向、6 unit 間隔
Pod 配置   : 親 Node の上面に 4 列グリッド、間隔 0.6 unit
Service 配置: 全 Node 群の中央、Y=5 に浮遊
接続線     : Service の selector が Pod の labels に完全一致する場合に描画
```

### プロンプトテンプレート

```
Build a 3D Kubernetes cluster visualization in Blender.
Clear the default scene first. Use the data below.

== NODES ==
{nodes_block}

== PODS ==
{pods_block}

== SERVICES ==
{services_block}

== LAYOUT RULES ==
- Place each Node as a rectangular box (W=4, H=2, D=2), gray #aaaaaa.
  Space them 6 units apart along the X axis.
  Node index 0 → X=0, index 1 → X=6, index 2 → X=12, ...

- Place each Pod as a cube (0.4×0.4×0.4) on top of its parent Node.
  Grid layout: 4 columns, 0.6 unit spacing. Start at Y=1.2 above the Node center.
  Color by phase:
    Running     → emissive #00ff88
    Pending     → emissive #ffaa00
    Failed      → emissive #ff4444
    Terminating → #888888 (no emission)

- Place each Service as a hexagonal prism (6-sided cylinder, radius=0.6, depth=0.3).
  Emissive blue #4488ff. Float at Y=5, distributed along X across all Nodes.

- Draw a thin white line (opacity 0.3) between each Service and every Pod
  whose labels contain all key-value pairs in the Service's selector.

== NAMING ==
Name every object exactly as: <resource_type>/<namespace>/<name>
Example: pod/argocd/argocd-server-xxx

After building the scene, export it as /tmp/k8s_cluster.glb.
```

### `{nodes_block}` の展開例

```
- name: k8s-worker-1, status: Ready
- name: k8s-worker-2, status: Ready
- name: k8s-worker-3, status: Ready
- name: k8s-worker-4, status: Ready
```

### `{pods_block}` の展開例（抜粋）

```
- name: argocd-server-xxx, namespace: argocd, node: k8s-worker-1,
  phase: Running, labels: {app.kubernetes.io/name: argocd-server}
- name: cert-manager-xxx, namespace: cert-manager, node: k8s-worker-2,
  phase: Running, labels: {app: cert-manager}
```

### `{services_block}` の展開例（抜粋）

```
- name: argocd-server, namespace: argocd,
  selector: {app.kubernetes.io/name: argocd-server}
- name: cert-manager, namespace: cert-manager,
  selector: {app: cert-manager}
```

---

## 検証チェックリスト

### Phase 1（形状検証）
- [ ] Node（直方体）が配置・色付きで作成できる
- [ ] Pod（立方体）が phase カラーで作成できる
- [ ] Service（六角形プリズム）が作成できる
- [ ] GLB エクスポートが成功する

### Phase 2（データ正規化）
- [ ] 4 Node が正規化 JSON に変換できる
- [ ] 91 Pod が全件正規化できる（nodeName が null の Pod の扱いを確認）
- [ ] 59 Service が正規化できる（selector が空の Service の扱いを確認）

### Phase 3（シーン生成）
- [ ] 構造化プロンプトで 4 Node + 91 Pod + 59 Service のシーンが生成できる
- [ ] Service → Pod の接続線が selector マッチで正しく描画できる
- [ ] GLB を Three.js で読み込んで表示できる
</content>
</invoke>