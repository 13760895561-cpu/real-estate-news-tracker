# 房地产新闻跟踪

一个静态房地产新闻跟踪网站，按“行业信息”和“房企信息”收纳新闻与公告。页面读取 `data/news.json`，更新脚本每小时抓取并生成最新数据和按日归档。

## 覆盖范围

- 行业信息：中央政策、一二线城市政策、拿地、土储、销售、均价、融资、债券等关键词。
- 房企信息：保利发展、绿城中国、中国海外发展、华润置地、招商蛇口、万科、建发房产、中国金茂、越秀地产、滨江集团、华发股份、绿地控股、龙湖集团、保利置业、金地集团。
- 来源：巨潮、香港交易所、观点网、财联社。

## 本地运行

```bash
npm install
npm run update
npm run serve
```

本地预览地址默认是 `http://localhost:4173`。

## 数据更新

```bash
npm run update
```

可选环境变量：

- `LOOKBACK_DAYS`：默认回看 45 天。
- `RSSHUB_BASE`：默认 `https://rsshub.app`。
- `CLS_RSS_URLS`：财联社 RSS 地址，多个地址用英文逗号分隔。
- `GUANDIAN_RSS_URLS`：观点网 RSS 地址，多个地址用英文逗号分隔。

巨潮与香港交易所公司公告使用官方公开接口；HKEX 官方监管公告使用官方 RSS；财联社与观点网优先走 RSSHub 路由，RSS 不可用时会从主站频道页抽取房地产相关标题作为兜底。

## GitHub Pages

仓库推到 GitHub 后，启用 Actions 和 Pages。`.github/workflows/update-news.yml` 会：

- 每小时运行一次采集。
- 提交更新后的 `data/news.json` 和 `data/archive/*.json`。
- 部署静态站点到 GitHub Pages。

公网地址会是：

```text
https://<你的 GitHub 用户名>.github.io/<仓库名>/
```
