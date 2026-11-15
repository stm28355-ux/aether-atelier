# Aether Atelier（エーテル・アトリエ）

魔導具の工房を、限られた区画に詰め込む工場パズル。熱や冷気の範囲が、機械だけでなくベルトを流れる素材にも効くので、ベルトの通り道がそのままレシピになる。戦闘も移動も資源探しもない。

**遊ぶ：** https://stm28355-ux.github.io/aether-atelier/

今は作り始めたところです。進み具合は [Milestones](https://github.com/stm28355-ux/aether-atelier/milestones)、計画は [docs/plan.md](docs/plan.md) を見てください。

## 開発

```bash
npm run serve    # http://localhost:5191/
npm test         # テスト
npm run calc -- plate=30 dust=30   # 目標の毎分の量から、機械の台数と原料を出す
```

静的HTML＋JavaScript（ESモジュール）で、ビルドはありません。
