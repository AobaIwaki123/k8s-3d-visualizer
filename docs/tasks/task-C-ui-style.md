---
task: C
title: UI スタイル更新（フォントサイズ拡大・ドットグリッド背景）
branch: task/ui-style
---

## 目的

現状の `poc.html` は全体的にフォントサイズが小さく（10–12 px 混在）視認性が低い。
また背景が無地の黒のみで殺風景なため、青系のドットグリッドパターンを CSS で追加する。

Three.js キャンバスの透明化は Task D が担当するため、このタスクは **CSS のみ** を変更する。

## 担当ファイル（既存ファイルの編集のみ）

```
frontend/poc.html   ← <style> ブロック内を編集
```

**触ってはならないファイル:** `src/` 配下の全 `.js` ファイル

## 依存ライブラリ

なし（純粋な HTML/CSS 変更）

## export するインターフェース

なし（Task D との結合点は CSS クラス・ID の命名変更がないこと）

## 実装要件

### 1. body — ドットグリッドパターン

```css
body {
  background-color: #06091a;
  background-image: radial-gradient(circle, rgba(68, 136, 255, 0.18) 1px, transparent 1px);
  background-size: 28px 28px;
  overflow: hidden;
  font-family: 'SF Mono', 'Fira Code', monospace;
}
```

> Task D が Three.js キャンバスを透明化したとき、このパターンが透けて見える設計。
> Task D 適用前は canvas が不透明なのでパターンは見えないが、それは正常動作。

### 2. フォントサイズ変更一覧

| セレクタ | 変更前 | 変更後 |
|---|---|---|
| `.topbar-title` | `font-size: 14px` | `font-size: 16px` |
| `.topbar-status` | `font-size: 12px` | `font-size: 14px` |
| `#stats` | `font-size: 12px; color: #445566` | `font-size: 14px; color: #556677` |
| `#detail-title` | `font-size: 11px` | `font-size: 13px` |
| `.meta-row` | `font-size: 12px` | `font-size: 13px` |
| `.legend-title` | `font-size: 10px` | `font-size: 12px` |
| `.legend-item` | `font-size: 12px` | `font-size: 14px` |
| `.phase-item` | `font-size: 12px` | `font-size: 14px` |
| `.label` | `font-size: 11px` | `font-size: 13px` |
| `.label-phase` | `font-size: 10px` | `font-size: 12px` |
| `.label-kind` | `font-size: 10px` | `font-size: 12px` |
| `#hint` | `font-size: 11px; color: #223344` | `font-size: 12px; color: #334455` |
| `#hover-tooltip` | `font-size: 12px` | `font-size: 13px` |

`#topbar` の `height` を `44px → 48px` に変更する（大きくなったテキストに余白を確保するため）。

### 3. 変更してはならない箇所

- セレクタ名・ID・クラス名（Task D および既存 JS との結合点）
- `canvas` タグのスタイル（透明化は Task D 側で制御）
- `z-index` の値
- `border-color` / `backdrop-filter` などのグラスモーフィズム設定

## 完了条件

- 上記フォントサイズ変更が全セレクタに適用されていること
- `body` に `background-image` が追加され `background-size: 28px 28px` が設定されていること
- `background-color` が `#06091a`（旧 `#0a0a0f`）に変更されていること
- JS ファイルが一切変更されていないこと

## ブランチ・PR

```
ブランチ名: task/ui-style
PR タイトル: [Task C] UI スタイル更新（フォントサイズ拡大・ドットグリッド背景）
PR 作成後に URL を報告すること
```

npm install・npm run dev は実行しない。
