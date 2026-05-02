# add-comments

対象ファイルのコメントを以下のルールに従って追加・修正する。

---

## ルール1: インラインコメント — WHY/WHY NOT のみ

書く条件（AND）:
1. コードから読み取れない
2. 削除すると将来の読者が困る
3. WHY か WHY NOT を含む

書かない:
- 関数名・変数名の言い換え
- 実装を日本語に翻訳しただけの記述

```js
// 良い例: モジュールスコープに置く — 呼び出しごとにインスタンスを生成しないため
// 悪い例: // GLTFLoader を生成する
```

---

## ルール2: 関数コメント

フォーマット（自明な項目は省略）:
```
// IN:  引数の形・型（名前から非自明な場合）
// OUT: 戻り値の形・型（名前から非自明な場合）
// ERR: 失敗時の挙動（throws / rejects / silent 等）
// PRE: 呼び出し前提条件（ある場合のみ）
```

書かない:
- 関数名を言い換えただけの説明文

```js
// 良い例:
// OUT: { 'pod-running' | 'pod-pending' | 'pod-failed' | 'service-hex' → THREE.Object3D }
// ERR: rejects — 1ファイルでも失敗した場合
export async function loadModels() { ... }

// 悪い例:
// モデルをロードして返す
export async function loadModels() { ... }
```
