const state = {
  data: null,
  items: [],
  section: "all",
  company: "all",
  source: "all",
  query: "",
  archive: "latest",
};

const els = {
  lastUpdated: document.querySelector("#lastUpdated"),
  statTotal: document.querySelector("#statTotal"),
  statToday: document.querySelector("#statToday"),
  statSources: document.querySelector("#statSources"),
  sourceFilter: document.querySelector("#sourceFilter"),
  archiveSelect: document.querySelector("#archiveSelect"),
  searchInput: document.querySelector("#searchInput"),
  companyList: document.querySelector("#companyList"),
  companyCount: document.querySelector("#companyCount"),
  newsList: document.querySelector("#newsList"),
  emptyState: document.querySelector("#emptyState"),
  statusList: document.querySelector("#statusList"),
  feedTitle: document.querySelector("#feedTitle"),
  feedSubTitle: document.querySelector("#feedSubTitle"),
  refreshView: document.querySelector("#refreshView"),
};

const sectionLabels = {
  industry: "行业信息",
  company: "房企信息",
};

const fallbackCompanies = [
  "保利发展",
  "绿城中国",
  "中国海外发展",
  "华润置地",
  "招商蛇口",
  "万科",
  "建发房产",
  "中国金茂",
  "越秀地产",
  "滨江集团",
  "华发股份",
  "绿地控股",
  "龙湖集团",
  "保利置业",
  "金地集团",
];

async function init() {
  bindEvents();
  await loadLatest();
  await loadArchiveIndex();
  renderAll();
}

function bindEvents() {
  document.querySelectorAll("[data-section]").forEach((button) => {
    button.addEventListener("click", () => {
      setSection(button.dataset.section);
      renderNews();
    });
  });

  els.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    renderNews();
  });

  els.sourceFilter.addEventListener("change", (event) => {
    state.source = event.target.value;
    renderNews();
  });

  els.archiveSelect.addEventListener("change", async (event) => {
    state.archive = event.target.value;
    if (state.archive === "latest") {
      await loadLatest();
    } else {
      await loadArchive(state.archive);
    }
    renderAll();
  });

  els.refreshView.addEventListener("click", async () => {
    if (state.archive === "latest") {
      await loadLatest();
    } else {
      await loadArchive(state.archive);
    }
    renderAll();
  });
}

async function loadLatest() {
  const response = await fetch(`data/news.json?ts=${Date.now()}`);
  state.data = await response.json();
  state.items = Array.isArray(state.data.items) ? state.data.items : [];
}

async function loadArchive(date) {
  const response = await fetch(`data/archive/${date}.json?ts=${Date.now()}`);
  const data = await response.json();
  state.data = data;
  state.items = Array.isArray(data.items) ? data.items : [];
}

async function loadArchiveIndex() {
  try {
    const response = await fetch(`data/archive/index.json?ts=${Date.now()}`);
    const archive = await response.json();
    const days = Array.isArray(archive.days) ? archive.days : [];
    els.archiveSelect.innerHTML = `<option value="latest">最新收纳</option>`;
    days.forEach((day) => {
      const option = document.createElement("option");
      option.value = day.date;
      option.textContent = `${day.date} (${day.count})`;
      els.archiveSelect.append(option);
    });
  } catch {
    els.archiveSelect.innerHTML = `<option value="latest">最新收纳</option>`;
  }
}

function renderAll() {
  renderSummary();
  renderSources();
  renderStatuses();
  renderCompanies();
  renderNews();
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function renderSummary() {
  const generatedAt = state.data?.generatedAt ? formatDateTime(state.data.generatedAt) : "暂无更新时间";
  els.lastUpdated.textContent = `更新于 ${generatedAt}`;
  els.statTotal.textContent = String(state.items.length);
  els.statToday.textContent = String(state.data?.stats?.today ?? countToday(state.items));
  els.statSources.textContent = String(new Set(state.items.map((item) => item.sourceName)).size);
  els.feedTitle.textContent = state.archive === "latest" ? "最新收纳" : `${state.archive} 收纳`;
  els.feedSubTitle.textContent = `${state.items.length} 条记录`;
}

function renderSources() {
  const selected = els.sourceFilter.value || "all";
  const sources = [...new Set(state.items.map((item) => item.sourceName).filter(Boolean))].sort();
  els.sourceFilter.innerHTML = `<option value="all">全部来源</option>`;
  sources.forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    els.sourceFilter.append(option);
  });
  els.sourceFilter.value = sources.includes(selected) ? selected : "all";
  state.source = els.sourceFilter.value;
}

function renderStatuses() {
  const statuses = Array.isArray(state.data?.sources) ? state.data.sources : [];
  const grouped = new Map();
  statuses.forEach((source) => {
    const old = grouped.get(source.name) || { name: source.name, itemCount: 0, ok: 0, errors: [] };
    old.itemCount += source.itemCount || 0;
    if (source.status === "ok") old.ok += 1;
    if (source.error) old.errors.push(source.error);
    grouped.set(source.name, old);
  });
  els.statusList.innerHTML = "";
  [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name, "zh-CN")).forEach((source) => {
    const pill = document.createElement("span");
    pill.className = `status-pill ${source.ok > 0 ? "ok" : "error"}`;
    pill.title = source.errors.length ? source.errors.join(" / ") : `${source.itemCount || 0} 条`;
    pill.textContent = `${source.name} ${source.itemCount || 0}`;
    els.statusList.append(pill);
  });
}

function renderCompanies() {
  const companies = state.data?.companies?.length ? state.data.companies : fallbackCompanies;
  els.companyCount.textContent = String(companies.length);
  els.companyList.innerHTML = "";

  const allButton = createCompanyButton("all", "全部房企", state.company === "all");
  els.companyList.append(allButton);

  companies.forEach((company) => {
    const count = state.items.filter((item) => item.entities?.includes(company)).length;
    const button = createCompanyButton(company, company, state.company === company, count);
    els.companyList.append(button);
  });
}

function createCompanyButton(value, label, active, count = "") {
  const button = document.createElement("button");
  button.className = `company-button${active ? " active" : ""}`;
  button.type = "button";
  button.dataset.company = value;
  button.innerHTML = `<span>${escapeHtml(label)}</span><span>${count}</span>`;
  button.addEventListener("click", () => {
    state.company = value;
    if (value !== "all") {
      state.query = "";
      els.searchInput.value = "";
      setSection("company");
    }
    renderCompanies();
    renderNews();
  });
  return button;
}

function renderNews() {
  const filtered = state.items.filter(matchesFilters);
  els.feedSubTitle.textContent = `${filtered.length} / ${state.items.length} 条记录`;
  els.newsList.innerHTML = "";
  els.emptyState.hidden = filtered.length > 0;

  filtered.forEach((item) => {
    const article = document.createElement("article");
    article.className = "news-card";
    const published = item.publishedAt ? formatNewsDateTime(item.publishedAt) : "时间未知";
    const section = sectionLabels[item.section] || "未分类";
    const source = item.sourceName || "未知来源";
    const entities = (item.entities || []).slice(0, 4).map((entity) => `<span class="tag">${escapeHtml(entity)}</span>`).join("");
    const topicUrl = item.topicUrl || item.sourceHome || item.url;
    const topic = item.topic || "综合";
    article.innerHTML = `
      <div class="news-meta">
        <span class="section-badge ${item.section === "company" ? "company" : ""}">${section}</span>
        <span>${published}</span>
        <span>${escapeHtml(source)}</span>
      </div>
      <div class="news-body">
        <a class="news-title" href="${safeUrl(item.url)}" target="_blank" rel="noreferrer">
          ${escapeHtml(item.title || "未命名信息")}
          <i data-lucide="external-link"></i>
        </a>
        ${item.summary ? `<p class="news-summary">${escapeHtml(item.summary)}</p>` : ""}
        <div class="tag-row">
          <a class="tag topic" href="${safeUrl(topicUrl)}" target="_blank" rel="noreferrer">${escapeHtml(topic)}</a>
          ${entities}
        </div>
      </div>
    `;
    els.newsList.append(article);
  });

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function setSection(section) {
  state.section = section;
  document.querySelectorAll("[data-section]").forEach((node) => {
    node.classList.toggle("active", node.dataset.section === section);
  });
}

function matchesFilters(item) {
  if (state.section !== "all" && item.section !== state.section) {
    return false;
  }
  if (state.source !== "all" && item.sourceName !== state.source) {
    return false;
  }
  if (state.company !== "all" && !(item.entities || []).includes(state.company)) {
    return false;
  }
  if (state.query) {
    const haystack = [item.title, item.summary, item.topic, item.sourceName, ...(item.entities || [])]
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(state.query)) {
      return false;
    }
  }
  return true;
}

function countToday(items) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date());
  return items.filter((item) => {
    const date = item.publishedAt || item.collectedAt || item.firstSeenAt;
    return date && new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date(date)) === today;
  }).length;
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "时间未知";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatNewsDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "时间未知";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  if (parts.hour === "00" && parts.minute === "00") {
    return `${parts.month}/${parts.day}`;
  }
  return `${parts.month}/${parts.day} ${parts.hour}:${parts.minute}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeUrl(value) {
  const url = String(value || "#");
  return /^https?:\/\//i.test(url) ? url : "#";
}

init().catch((error) => {
  els.lastUpdated.textContent = "数据读取失败";
  els.newsList.innerHTML = `<div class="empty-state"><p>${escapeHtml(error.message)}</p></div>`;
});
