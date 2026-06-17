import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import Parser from "rss-parser";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const ARCHIVE_DIR = path.join(DATA_DIR, "archive");
const NEWS_PATH = path.join(DATA_DIR, "news.json");
const ARCHIVE_INDEX_PATH = path.join(ARCHIVE_DIR, "index.json");

const parser = new Parser({
  timeout: 18_000,
  headers: {
    "User-Agent": "Mozilla/5.0 RealEstateNewsTracker/1.0",
  },
});

const args = new Map(
  process.argv
    .slice(2)
    .map((arg) => arg.split("="))
    .filter(([key, value]) => key?.startsWith("--") && value)
    .map(([key, value]) => [key.slice(2), value]),
);

const LOOKBACK_DAYS = Number(args.get("days") || process.env.LOOKBACK_DAYS || 45);
const RSSHUB_BASE = (process.env.RSSHUB_BASE || "https://rsshub.app").replace(/\/$/, "");
const FETCH_TIMEOUT = Number(process.env.FETCH_TIMEOUT_MS || 20_000);
const MAX_ITEMS = Number(process.env.MAX_ITEMS || 900);

const sourceStatuses = [];

const sourceHomes = {
  cninfo: "https://www.cninfo.com.cn/new/commonUrl/pageOfSearch?url=disclosure/list/search",
  hkex: "https://www.hkexnews.hk/search/titlesearch.xhtml?lang=zh",
  hkexRegulatory: "https://www.hkex.com.hk/Services/RSS-Feeds/Regulatory-Announcements?sc_lang=zh-HK",
  guandian: "https://www.guandian.cn/",
  cls: "https://www.cls.cn/telegraph",
};

const topicUrls = {
  中央政策: "https://www.guandian.cn/",
  城市政策: "https://www.cls.cn/telegraph",
  "拿地/土储": "https://www.guandian.cn/",
  "销售/均价": "https://www.guandian.cn/",
  "融资/债券": "https://www.cls.cn/telegraph",
  A股公告: sourceHomes.cninfo,
  港股公告: sourceHomes.hkex,
  行业趋势: "https://www.guandian.cn/",
};

const companies = [
  { name: "保利发展", aliases: ["保利发展", "保利发展控股", "保利地产"], a: { code: "600048", orgId: "9900000161" } },
  { name: "绿城中国", aliases: ["绿城中国", "綠城中國", "绿城"], hk: "03900" },
  { name: "中国海外发展", aliases: ["中国海外发展", "中國海外發展", "中海地产", "中海地產"], hk: "00688" },
  { name: "华润置地", aliases: ["华润置地", "華潤置地"], hk: "01109" },
  { name: "招商蛇口", aliases: ["招商蛇口", "招商局蛇口"], a: { code: "001979", orgId: "GD014107" } },
  { name: "万科", aliases: ["万科", "萬科", "万科A", "万科企业", "萬科企業"], a: { code: "000002", orgId: "gssz0000002" }, hk: "02202" },
  { name: "建发房产", aliases: ["建发房产", "建發房產", "建发国际", "建發國際", "建发国际集团", "建發國際集團"], hk: "01908" },
  { name: "中国金茂", aliases: ["中国金茂", "中國金茂"], hk: "00817" },
  { name: "越秀地产", aliases: ["越秀地产", "越秀地產"], hk: "00123" },
  { name: "滨江集团", aliases: ["滨江集团", "濱江集團"], a: { code: "002244", orgId: "9900004730" } },
  { name: "华发股份", aliases: ["华发股份", "華發股份"], a: { code: "600325", orgId: "gssh0600325" } },
  { name: "绿地控股", aliases: ["绿地控股", "綠地控股"], a: { code: "600606", orgId: "gssh0600606" } },
  { name: "龙湖集团", aliases: ["龙湖集团", "龍湖集團", "龙湖"], hk: "00960" },
  { name: "保利置业", aliases: ["保利置业", "保利置業", "保利置业集团", "保利置業集團"], hk: "00119" },
  { name: "金地集团", aliases: ["金地集团", "金地集團"], a: { code: "600383", orgId: "gssh0600383" } },
];

const policyKeywords = [
  "国务院",
  "住建部",
  "住房城乡建设部",
  "自然资源部",
  "央行",
  "金融监管",
  "公积金",
  "限购",
  "限售",
  "限贷",
  "认房",
  "首付",
  "房贷",
  "保交房",
  "保障房",
  "城市更新",
  "房地产政策",
  "住房政策",
];

const cityKeywords = [
  "北京",
  "上海",
  "广州",
  "深圳",
  "杭州",
  "南京",
  "成都",
  "武汉",
  "苏州",
  "西安",
  "天津",
  "重庆",
  "厦门",
  "青岛",
  "宁波",
  "合肥",
  "福州",
  "济南",
  "长沙",
  "郑州",
  "佛山",
  "东莞",
];

const trendKeywords = [
  "拿地",
  "土地",
  "土储",
  "土地储备",
  "销售",
  "均价",
  "成交",
  "百强房企",
  "库存",
  "去化",
  "开工",
  "竣工",
  "房地产投资",
  "楼市",
  "房价",
  "融资",
  "债券",
  "并购",
  "资产处置",
];

const realEstateKeywords = [
  "房地产",
  "房企",
  "物业",
  "地产",
  "住宅",
  "商品住宅",
  "二手房",
  "新房",
  "房价",
  "房贷",
  "楼市",
  "住房",
  "公积金",
  "限购",
  "限售",
  "限贷",
  "首付",
  "保交房",
  "保障房",
  "拿地",
  "土拍",
  "土储",
  "土地储备",
  "销售均价",
  "销售价格",
  "去化",
  "商业地产",
  "城中村",
  "旧改",
  "城市更新",
  "住房租赁",
];

const defaultClsFeeds = [
  `${RSSHUB_BASE}/cls/telegraph`,
  `${RSSHUB_BASE}/cls/depth/1006`,
];

const defaultGuandianFeeds = [
  `${RSSHUB_BASE}/guandian/news`,
  `${RSSHUB_BASE}/guandian/finance`,
];

const rssSources = [
  {
    id: "hkex-regulatory-rss",
    name: "香港交易所",
    url: sourceHomes.hkexRegulatory,
    sourceHome: sourceHomes.hkex,
    sectionHint: "industry",
  },
  ...envList("CLS_RSS_URLS", defaultClsFeeds).map((url, index) => ({
    id: `cls-rss-${index + 1}`,
    name: "财联社",
    url,
    sourceHome: sourceHomes.cls,
    sectionHint: "industry",
  })),
  ...envList("GUANDIAN_RSS_URLS", defaultGuandianFeeds).map((url, index) => ({
    id: `guandian-rss-${index + 1}`,
    name: "观点网",
    url,
    sourceHome: sourceHomes.guandian,
    sectionHint: "industry",
  })),
];

try {
  await main();
  process.exit(0);
} catch (error) {
  console.error(error);
  process.exit(1);
}

async function main() {
  await fs.mkdir(ARCHIVE_DIR, { recursive: true });
  const previous = await readJson(NEWS_PATH, { items: [] });
  const previousItems = Array.isArray(previous.items) ? previous.items : [];
  const now = new Date();
  const fetched = [];

  fetched.push(...(await fetchCninfoAnnouncements(now)));
  fetched.push(...(await fetchHkexCompanyAnnouncements(now)));
  fetched.push(...(await fetchRssFeeds()));
  fetched.push(...(await fetchHtmlFallbacks()));

  const merged = mergeItems(previousItems, fetched, now);
  const sorted = merged
    .sort((a, b) => new Date(b.publishedAt || b.firstSeenAt || 0) - new Date(a.publishedAt || a.firstSeenAt || 0))
    .slice(0, MAX_ITEMS);

  const payload = buildPayload(sorted, now);
  await writeJson(NEWS_PATH, payload);
  await writeArchive(payload, now);

  console.log(`Updated ${payload.items.length} items from ${payload.sources.length} sources.`);
}

async function fetchCninfoAnnouncements(now) {
  const items = [];
  const from = dateKey(addDays(now, -LOOKBACK_DAYS), "Asia/Shanghai");
  const to = dateKey(now, "Asia/Shanghai");
  const seDate = `${from}~${to}`;

  for (const company of companies.filter((entry) => entry.a)) {
    const sourceId = `cninfo-${company.a.code}`;
    try {
      const body = new URLSearchParams({
        pageNum: "1",
        pageSize: "30",
        column: "szse",
        tabName: "fulltext",
        stock: `${company.a.code},${company.a.orgId}`,
        seDate,
        isHLtitle: "true",
      });
      const data = await fetchJson("https://www.cninfo.com.cn/new/hisAnnouncement/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          Referer: sourceHomes.cninfo,
          "User-Agent": "Mozilla/5.0 RealEstateNewsTracker/1.0",
        },
        body,
      });
      const announcements = Array.isArray(data.announcements) ? data.announcements : [];
      for (const announcement of announcements) {
        const title = cleanText(announcement.announcementTitle || announcement.shortTitle);
        if (!title) continue;
        const publishedAt = announcement.announcementTime
          ? new Date(announcement.announcementTime).toISOString()
          : now.toISOString();
        const url = announcement.adjunctUrl
          ? `https://static.cninfo.com.cn/${announcement.adjunctUrl}`
          : sourceHomes.cninfo;
        items.push(
          normalizeItem({
            sourceId,
            sourceName: "巨潮",
            sourceHome: sourceHomes.cninfo,
            title,
            summary: `${company.name} ${announcement.secCode || ""}`.trim(),
            url,
            publishedAt,
            section: "company",
            topic: "A股公告",
            topicUrl: topicUrls.A股公告,
            entities: [company.name],
          }),
        );
      }
      recordSource(sourceId, "巨潮", "ok", announcements.length);
      await pause(180);
    } catch (error) {
      recordSource(sourceId, "巨潮", "error", 0, error);
    }
  }
  return items;
}

async function fetchHkexCompanyAnnouncements(now) {
  const items = [];
  let stockMap = new Map();
  try {
    const active = await fetchJson("https://www1.hkexnews.hk/ncms/script/eds/activestock_sehk_c.json", {
      headers: { "User-Agent": "Mozilla/5.0 RealEstateNewsTracker/1.0" },
    });
    stockMap = new Map(active.map((stock) => [stock.c, stock]));
  } catch (error) {
    recordSource("hkex-stock-map", "香港交易所", "error", 0, error);
    return items;
  }

  const fromDate = compactDate(addDays(now, -LOOKBACK_DAYS));
  const toDate = compactDate(now);

  for (const company of companies.filter((entry) => entry.hk)) {
    const stock = stockMap.get(company.hk);
    const sourceId = `hkex-${company.hk}`;
    if (!stock?.i) {
      recordSource(sourceId, "香港交易所", "error", 0, new Error(`No HKEX stock id for ${company.hk}`));
      continue;
    }

    try {
      const params = new URLSearchParams({
        sortDir: "0",
        sortByOptions: "DateTime",
        category: "0",
        market: "SEHK",
        stockId: String(stock.i),
        documentType: "-1",
        fromDate,
        toDate,
        title: "",
        searchType: "0",
        t1code: "",
        t2Gcode: "",
        t2code: "",
        rowRange: "30",
        lang: "ZH",
      });
      const data = await fetchJson(`https://www1.hkexnews.hk/search/titleSearchServlet.do?${params}`, {
        headers: {
          Referer: sourceHomes.hkex,
          "User-Agent": "Mozilla/5.0 RealEstateNewsTracker/1.0",
        },
      });
      const result = data.result && data.result !== "null" ? JSON.parse(data.result) : [];
      for (const announcement of result) {
        const title = cleanText(announcement.TITLE || announcement.LONG_TEXT || announcement.SHORT_TEXT);
        if (!title) continue;
        const publishedAt = parseHkexDate(announcement.DATE_TIME)?.toISOString() || now.toISOString();
        const url = announcement.FILE_LINK
          ? `https://www1.hkexnews.hk${announcement.FILE_LINK}`
          : sourceHomes.hkex;
        items.push(
          normalizeItem({
            sourceId,
            sourceName: "香港交易所",
            sourceHome: sourceHomes.hkex,
            title,
            summary: cleanText(`${announcement.STOCK_NAME || company.name} ${announcement.LONG_TEXT || ""}`),
            url,
            publishedAt,
            section: "company",
            topic: "港股公告",
            topicUrl: topicUrls.港股公告,
            entities: [company.name],
          }),
        );
      }
      recordSource(sourceId, "香港交易所", "ok", result.length);
      await pause(180);
    } catch (error) {
      recordSource(sourceId, "香港交易所", "error", 0, error);
    }
  }

  return items;
}

async function fetchRssFeeds() {
  const results = await Promise.all(
    rssSources.map(async (source) => {
    try {
      const feed = await parser.parseURL(source.url);
      const normalized = (feed.items || [])
        .map((item) => {
          const title = cleanText(item.title);
          const summary = cleanText(item.contentSnippet || item.content || item.summary || "");
          const publishedAt = parseDate(item.isoDate || item.pubDate || item.created || item.updated);
          const text = `${title} ${summary}`;
          if (!isRelevant(text)) {
            return null;
          }
          const classification = classify(text, source.sectionHint);
          return normalizeItem({
            sourceId: source.id,
            sourceName: source.name,
            sourceHome: source.sourceHome,
            title,
            summary: trimSummary(summary),
            url: item.link || source.sourceHome,
            publishedAt: publishedAt?.toISOString() || new Date().toISOString(),
            section: classification.section,
            topic: classification.topic,
            topicUrl: classification.topicUrl,
            entities: classification.entities,
          });
        })
        .filter(Boolean);
      recordSource(source.id, source.name, "ok", normalized.length);
      return normalized;
    } catch (error) {
      recordSource(source.id, source.name, "error", 0, error);
      return [];
    }
    }),
  );
  return results.flat();
}

async function fetchHtmlFallbacks() {
  const [guandianItems, clsItems] = await Promise.all([fetchGuandianHtml(), fetchClsHtml()]);
  return [...guandianItems, ...clsItems];
}

async function fetchGuandianHtml() {
  const pages = [
    { id: "guandian-html-real-estate", url: "https://www.guandian.cn/real_estate/" },
    { id: "guandian-html-finance", url: "https://www.guandian.cn/finance/" },
    { id: "guandian-html-property", url: "https://www.guandian.cn/property/" },
  ];
  const items = [];

  for (const page of pages) {
    try {
      const html = await fetchText(page.url);
      const anchors = extractAnchors(html, page.url)
        .filter((anchor) => /guandian\.cn\/article\/\d{8}\/\d+\.html/.test(anchor.url))
        .filter((anchor) => isRelevant(anchor.title));

      for (const anchor of uniqueAnchors(anchors)) {
        const text = anchor.title;
        const classification = classify(text, "industry");
        items.push(
          normalizeItem({
            sourceId: page.id,
            sourceName: "观点网",
            sourceHome: sourceHomes.guandian,
            title: text,
            summary: "",
            url: anchor.url,
            publishedAt: parseGuandianDate(anchor.url)?.toISOString() || new Date().toISOString(),
            section: classification.section,
            topic: classification.topic,
            topicUrl: classification.topicUrl,
            entities: classification.entities,
          }),
        );
      }
      recordSource(page.id, "观点网", "ok", anchors.length);
    } catch (error) {
      recordSource(page.id, "观点网", "error", 0, error);
    }
  }

  return items;
}

async function fetchClsHtml() {
  const pages = [
    { id: "cls-html-home", url: "https://www.cls.cn/" },
    { id: "cls-html-telegraph", url: "https://www.cls.cn/telegraph" },
  ];
  const items = [];

  for (const page of pages) {
    try {
      const html = await fetchText(page.url);
      const anchors = extractAnchors(html, page.url)
        .filter((anchor) => /cls\.cn\/detail\/\d+/.test(anchor.url))
        .filter((anchor) => isRelevant(anchor.title));

      for (const anchor of uniqueAnchors(anchors)) {
        const text = anchor.title;
        const classification = classify(text, "industry");
        items.push(
          normalizeItem({
            sourceId: page.id,
            sourceName: "财联社",
            sourceHome: sourceHomes.cls,
            title: text,
            summary: "",
            url: anchor.url,
            publishedAt: new Date().toISOString(),
            section: classification.section,
            topic: classification.topic,
            topicUrl: classification.topicUrl,
            entities: classification.entities,
          }),
        );
      }
      recordSource(page.id, "财联社", "ok", anchors.length);
    } catch (error) {
      recordSource(page.id, "财联社", "error", 0, error);
    }
  }

  return items;
}

function normalizeItem(input) {
  const title = cleanText(input.title);
  const url = input.url || input.sourceHome;
  const publishedAt = parseDate(input.publishedAt)?.toISOString() || new Date().toISOString();
  const id = hash([input.sourceId, title, url, publishedAt.slice(0, 10)].join("|"));
  return {
    id,
    section: input.section || "industry",
    topic: input.topic || "行业趋势",
    topicUrl: input.topicUrl || topicUrls[input.topic] || input.sourceHome,
    title,
    summary: trimSummary(input.summary || ""),
    url,
    sourceId: input.sourceId,
    sourceName: input.sourceName,
    sourceHome: input.sourceHome,
    publishedAt,
    entities: Array.from(new Set(input.entities || [])),
  };
}

function classify(text, sectionHint = "industry") {
  const entities = matchCompanies(text);
  if (entities.length) {
    return {
      section: "company",
      topic: entities[0],
      topicUrl: companyTopicUrl(entities[0]),
      entities,
    };
  }
  if (containsAny(text, policyKeywords) && containsAny(text, cityKeywords)) {
    return { section: "industry", topic: "城市政策", topicUrl: topicUrls.城市政策, entities: [] };
  }
  if (containsAny(text, policyKeywords)) {
    return { section: "industry", topic: "中央政策", topicUrl: topicUrls.中央政策, entities: [] };
  }
  if (containsAny(text, ["拿地", "土地", "土储", "土地储备"])) {
    return { section: "industry", topic: "拿地/土储", topicUrl: topicUrls["拿地/土储"], entities: [] };
  }
  if (containsAny(text, ["销售", "均价", "成交", "房价", "去化"])) {
    return { section: "industry", topic: "销售/均价", topicUrl: topicUrls["销售/均价"], entities: [] };
  }
  if (containsAny(text, ["融资", "债券", "票据", "贷款", "并购"])) {
    return { section: "industry", topic: "融资/债券", topicUrl: topicUrls["融资/债券"], entities: [] };
  }
  return { section: sectionHint, topic: "行业趋势", topicUrl: topicUrls.行业趋势, entities: [] };
}

function mergeItems(previousItems, fetchedItems, now) {
  const byId = new Map();
  for (const item of previousItems) {
    if (!item?.id) continue;
    if (!isRelevant([item.title, item.summary, item.topic, ...(item.entities || [])].join(" "))) continue;
    byId.set(item.id, item);
  }
  for (const item of fetchedItems) {
    const old = byId.get(item.id);
    byId.set(item.id, {
      ...old,
      ...item,
      firstSeenAt: old?.firstSeenAt || now.toISOString(),
      lastSeenAt: now.toISOString(),
      collectedAt: now.toISOString(),
    });
  }
  return Array.from(byId.values());
}

function buildPayload(items, now) {
  const bySource = {};
  const bySection = {};
  for (const item of items) {
    bySource[item.sourceName] = (bySource[item.sourceName] || 0) + 1;
    bySection[item.section] = (bySection[item.section] || 0) + 1;
  }
  return {
    generatedAt: now.toISOString(),
    lookbackDays: LOOKBACK_DAYS,
    stats: {
      total: items.length,
      today: countToday(items, now),
      bySource,
      bySection,
    },
    sources: sourceStatuses,
    companies: companies.map((company) => company.name),
    items,
  };
}

async function writeArchive(payload, now) {
  const day = dateKey(now, "Asia/Shanghai");
  const archivePayload = {
    ...payload,
    archiveDate: day,
    items: payload.items.slice(0, MAX_ITEMS),
  };
  await writeJson(path.join(ARCHIVE_DIR, `${day}.json`), archivePayload);

  const index = await readJson(ARCHIVE_INDEX_PATH, { days: [] });
  const days = Array.isArray(index.days) ? index.days.filter((entry) => entry.date !== day) : [];
  days.unshift({
    date: day,
    count: archivePayload.items.length,
    path: `data/archive/${day}.json`,
    updatedAt: now.toISOString(),
  });
  await writeJson(ARCHIVE_INDEX_PATH, {
    updatedAt: now.toISOString(),
    days: days.slice(0, 370),
  });
}

function recordSource(id, name, status, itemCount, error) {
  sourceStatuses.push({
    id,
    name,
    status,
    itemCount,
    lastFetchedAt: new Date().toISOString(),
    error: error ? String(error.message || error).slice(0, 220) : "",
  });
}

async function fetchJson(url, options = {}) {
  const response = await fetchWithTimeout(url, options);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function fetchText(url, options = {}) {
  const response = await fetchWithTimeout(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 RealEstateNewsTracker/1.0",
      ...(options.headers || {}),
    },
    ...options,
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.text();
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function readJson(filePath, fallback) {
  try {
    const text = await fs.readFile(filePath, "utf8");
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(`${filePath}.tmp`, `${JSON.stringify(data, null, 2)}\n`);
  await fs.rename(`${filePath}.tmp`, filePath);
}

function matchCompanies(text) {
  const normalized = String(text || "");
  return companies
    .filter((company) => company.aliases.some((alias) => normalized.includes(alias)))
    .map((company) => company.name);
}

function isRelevant(text) {
  return containsAny(text, realEstateKeywords) || matchCompanies(text).length > 0;
}

function companyTopicUrl(companyName) {
  const company = companies.find((entry) => entry.name === companyName);
  if (company?.a) return sourceHomes.cninfo;
  if (company?.hk) return sourceHomes.hkex;
  return sourceHomes.guandian;
}

function containsAny(text, keywords) {
  return keywords.some((keyword) => String(text || "").includes(keyword));
}

function cleanText(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function extractAnchors(html, baseUrl) {
  const anchors = [];
  const regex = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = regex.exec(html))) {
    const [, attrs, inner] = match;
    const href = attrs.match(/\bhref=["']([^"']+)["']/i)?.[1];
    if (!href || href.startsWith("javascript:")) continue;
    const titleAttr = attrs.match(/\btitle=["']([^"']+)["']/i)?.[1] || "";
    const title = cleanText(titleAttr || inner);
    if (title.length < 8 || title.includes("+ data[")) continue;
    anchors.push({
      title,
      url: absolutizeUrl(href, baseUrl),
    });
  }
  return anchors;
}

function uniqueAnchors(anchors) {
  const seen = new Set();
  return anchors.filter((anchor) => {
    const key = `${anchor.url}|${anchor.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function absolutizeUrl(href, baseUrl) {
  if (href.startsWith("//")) return `https:${href}`;
  return new URL(href, baseUrl).toString();
}

function parseGuandianDate(url) {
  const match = String(url).match(/\/article\/(\d{4})(\d{2})(\d{2})\//);
  if (!match) return null;
  const [, year, month, day] = match;
  return new Date(`${year}-${month}-${day}T00:00:00+08:00`);
}

function trimSummary(value) {
  const text = cleanText(value);
  return text.length > 180 ? `${text.slice(0, 178)}...` : text;
}

function hash(value) {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 24);
}

function parseDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseHkexDate(value) {
  const match = String(value || "").match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, day, month, year, hour, minute] = match;
  return new Date(`${year}-${month}-${day}T${hour}:${minute}:00+08:00`);
}

function compactDate(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}${map.month}${map.day}`;
}

function dateKey(date, timeZone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function countToday(items, now) {
  const today = dateKey(now, "Asia/Shanghai");
  return items.filter((item) => {
    const value = item.publishedAt || item.collectedAt || item.firstSeenAt;
    return value && dateKey(new Date(value), "Asia/Shanghai") === today;
  }).length;
}

function envList(name, fallback) {
  const value = process.env[name];
  if (!value) return fallback;
  return value
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);
}

function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
