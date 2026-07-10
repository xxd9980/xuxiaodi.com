# Long View 机构持仓观察

主站 `/invest/` 下的纯静态持仓看板，跟踪伯克希尔、H&H（段永平）与喜马拉雅资本（李录）的公开 SEC 13F 数据。

目录中的 `index.html`、`styles.css`、`script.js` 和 `data/holdings.json` 可由主站现有 OSS 发布流程直接托管。

更新数据：

```bash
cd invest
node scripts/fetch-sec-13f.mjs
```

数据脚本会合并 13F 修订申报与保密期结束后补充的持仓，并将历史值统一为美元口径。
