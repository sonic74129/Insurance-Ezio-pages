(function initApplication(global) {
  "use strict";

  const Data = global.AZXDemoData;
  const Reports = global.AZXDemoReports;
  const Workflows = global.AZXDemoWorkflows;
  const loadResult = Data.load();

  const state = {
    db: loadResult.db,
    warning: loadResult.warning,
    accountId: loadSessionAccount(),
    selectedAccountId: null,
    filters: {
      period: "year",
      regionId: "",
      industryId: "",
      insurerId: "",
      providerId: "",
    },
    userMenuOpen: false,
    presentation: false,
    marketFilters: {
      insurerId: "",
      serviceLevel: "",
    },
    currentDetail: null,
    pendingScenario: null,
  };

  const ROLE_LABELS = {
    regulator: "监管单位",
    insurer: "保险公司",
    service: "技术服务机构",
    enterprise: "生产经营单位",
  };

  const ROLE_HOME = {
    regulator: "/regulator/dashboard",
    insurer: "/insurer/dashboard",
    service: "/service/dashboard",
    enterprise: "/enterprise/dashboard",
  };

  const MENUS = {
    regulator: [
      { path: "/regulator/dashboard", icon: "总", label: "监管驾驶舱" },
      { path: "/regulator/analytics", icon: "统", label: "统计分析" },
      { path: "/regulator/alerts", icon: "预", label: "待办与预警" },
      { path: "/regulator/assessments", icon: "考", label: "机构考核" },
      { path: "/regulator/brief", icon: "报", label: "监管简报" },
    ],
    insurer: [
      { path: "/insurer/dashboard", icon: "首", label: "保险工作台" },
      { path: "/insurer/applications", icon: "核", label: "投保核保" },
      { path: "/insurer/policies", icon: "单", label: "保单与服务" },
      { path: "/insurer/claims", icon: "赔", label: "报案理赔" },
    ],
    service: [
      { path: "/service/dashboard", icon: "首", label: "服务工作台" },
      { path: "/service/tasks", icon: "任", label: "服务任务" },
      { path: "/service/hazards", icon: "患", label: "隐患与复查" },
      { path: "/service/archive", icon: "档", label: "回访与归档" },
    ],
    enterprise: [
      { path: "/enterprise/dashboard", icon: "首", label: "企业首页" },
      { path: "/enterprise/market", icon: "险", label: "产品与投保" },
      { path: "/enterprise/policies", icon: "单", label: "保单与服务" },
      { path: "/enterprise/hazards", icon: "改", label: "隐患整改" },
      { path: "/enterprise/claims", icon: "赔", label: "报案理赔" },
    ],
  };

  const PAGE_TITLES = {
    "/regulator/dashboard": ["监管驾驶舱", "全域安责险运行态势与重点风险"],
    "/regulator/analytics": ["统计分析", "按专题、地区、行业和机构下钻分析"],
    "/regulator/alerts": ["待办与预警", "低覆盖、重大隐患、服务时限和理赔进度"],
    "/regulator/assessments": ["机构考核", "保险机构与技术服务机构综合表现"],
    "/regulator/brief": ["监管运行简报", "面向汇报、投屏和打印的自动汇总"],
    "/insurer/dashboard": ["保险工作台", "投保、承保、事故预防和理赔业务概览"],
    "/insurer/applications": ["投保核保", "处理本机构投保申请和核保决定"],
    "/insurer/policies": ["保单与事故预防服务", "管理有效保单和服务委托"],
    "/insurer/claims": ["报案理赔", "受理报案并维护理赔进度"],
    "/service/dashboard": ["技术服务工作台", "任务执行、隐患闭环和时限概览"],
    "/service/tasks": ["服务任务", "接单、派单、现场执行和隐患登记"],
    "/service/hazards": ["隐患与复查", "跟踪企业整改并执行复查销号"],
    "/service/archive": ["回访与归档", "完成回访并形成服务档案"],
    "/enterprise/dashboard": ["企业首页", "查看保障、服务、整改和理赔事项"],
    "/enterprise/market": ["保险产品市场", "比较保险机构和产品并提交投保"],
    "/enterprise/policies": ["保单与服务", "查看投保申请、保单和事故预防计划"],
    "/enterprise/hazards": ["隐患整改", "查看整改要求并提交整改证据"],
    "/enterprise/claims": ["报案理赔", "使用有效保单报案并跟踪进度"],
    "/demo-control": ["演示设置", "恢复固定场景和查看演示环境状态"],
  };

  function loadSessionAccount() {
    try {
      return global.sessionStorage.getItem(Data.SESSION_KEY);
    } catch (error) {
      console.warn("无法读取登录会话。", error);
      return null;
    }
  }

  function saveSessionAccount(accountId) {
    if (accountId) global.sessionStorage.setItem(Data.SESSION_KEY, accountId);
    else global.sessionStorage.removeItem(Data.SESSION_KEY);
  }

  function route() {
    const hash = global.location.hash.replace(/^#/, "") || "/portal";
    const [path, queryString = ""] = hash.split("?");
    return { path, query: new URLSearchParams(queryString) };
  }

  function navigate(path) {
    state.userMenuOpen = false;
    global.location.hash = path.startsWith("#") ? path.slice(1) : path;
  }

  function currentAccount() {
    return state.db.accounts.find(item => item.id === state.accountId) || null;
  }

  function entity(collection, id) {
    return state.db[collection].find(item => item.id === id) || null;
  }

  function label(collection, id) {
    const item = entity(collection, id);
    return item?.name || item?.shortName || id || "-";
  }

  function statusClass(status) {
    if (status === "重大") return "danger";
    if (status === "较大") return "warning";
    if (["已承保", "生效中", "已归档", "已销号", "复查通过", "已赔付", "已结案", "已办结"].includes(status)) return "success";
    if (["已拒保", "已退保", "失败"].includes(status)) return "danger";
    if (["核保中", "待补正", "待接单", "执行中", "待整改", "待复查", "待回访", "待归档", "查勘中", "审核中", "待赔付", "处理中", "待反馈"].includes(status)) return "warning";
    return "info";
  }

  function statusTag(status) {
    return `<span class="status ${statusClass(status)}">${Reports.escapeHtml(status)}</span>`;
  }

  function pageHeading(title, description, actions = "") {
    return `
      <div class="page-heading">
        <div>
          <h2>${Reports.escapeHtml(title)}</h2>
          <p>${Reports.escapeHtml(description)}</p>
        </div>
        ${actions ? `<div class="page-actions no-print">${actions}</div>` : ""}
      </div>
    `;
  }

  function emptyState(title, description) {
    return `<div class="empty-state"><strong>${Reports.escapeHtml(title)}</strong>${Reports.escapeHtml(description)}</div>`;
  }

  function renderTable(columns, rows, emptyTitle = "暂无数据") {
    return `
      <div class="table-scroll">
        <table class="data-table">
          <thead><tr>${columns.map(column => `<th>${Reports.escapeHtml(column.label)}</th>`).join("")}</tr></thead>
          <tbody>
            ${rows.length ? rows.map(row => `
              <tr>${columns.map(column => `<td>${column.render ? column.render(row) : Reports.escapeHtml(row[column.key])}</td>`).join("")}</tr>
            `).join("") : `<tr><td colspan="${columns.length}">${emptyState(emptyTitle, "当前条件下没有需要显示的记录。")}</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  }

  function kpiCards(cards, compact = false) {
    return `
      <div class="kpi-grid${compact ? " compact" : ""}">
        ${cards.map(card => {
          const comparison = card.comparison;
          const sentimentClass = comparison?.sentiment ? `trend-${comparison.sentiment}` : "trend-neutral";
          const progress = card.target ? Math.min(100, (Number(card.raw || 0) / card.target) * 100) : null;
          return `
            <button type="button" class="kpi-card chart-action${card.emphasis ? " emphasis" : ""}" data-drill="${Reports.escapeHtml(card.drill || "")}">
              <span class="kpi-label">${Reports.escapeHtml(card.label)}</span>
              <strong class="kpi-value">${Reports.escapeHtml(card.value)}</strong>
              <span class="kpi-meta">
                <span class="${sentimentClass}">${comparison ? `较上期 ${Reports.escapeHtml(comparison.text)}` : "由业务明细汇总"}</span>
                ${card.target ? `<span>目标 ${card.target}%</span>` : ""}
              </span>
              ${progress !== null ? `<span class="progress"><span style="--progress:${progress}%"></span></span>` : ""}
            </button>
          `;
        }).join("")}
      </div>
    `;
  }

  function reportCard(title, content, description = "", className = "") {
    return `
      <section class="report-card ${className}">
        <div class="card-head">
          <div><h3>${Reports.escapeHtml(title)}</h3>${description ? `<p>${Reports.escapeHtml(description)}</p>` : ""}</div>
        </div>
        ${content}
      </section>
    `;
  }

  function filterBar() {
    const f = state.filters;
    return `
      <div class="filter-bar no-print">
        <div class="field">
          <label for="filterPeriod">统计周期</label>
          <select id="filterPeriod" data-filter="period">
            ${[["month", "本月"], ["quarter", "本季度"], ["year", "本年度"], ["all", "全部"]].map(([value, text]) => `<option value="${value}"${f.period === value ? " selected" : ""}>${text}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="filterRegion">地区</label>
          <select id="filterRegion" data-filter="regionId">
            <option value="">全部地区</option>
            ${state.db.regions.map(item => `<option value="${item.id}"${f.regionId === item.id ? " selected" : ""}>${Reports.escapeHtml(item.name)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="filterIndustry">行业</label>
          <select id="filterIndustry" data-filter="industryId">
            <option value="">全部行业</option>
            ${state.db.industries.map(item => `<option value="${item.id}"${f.industryId === item.id ? " selected" : ""}>${Reports.escapeHtml(item.name)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="filterInsurer">保险机构</label>
          <select id="filterInsurer" data-filter="insurerId">
            <option value="">全部保险机构</option>
            ${state.db.insurers.map(item => `<option value="${item.id}"${f.insurerId === item.id ? " selected" : ""}>${Reports.escapeHtml(item.shortName)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="filterProvider">服务机构</label>
          <select id="filterProvider" data-filter="providerId">
            <option value="">全部服务机构</option>
            ${state.db.serviceProviders.map(item => `<option value="${item.id}"${f.providerId === item.id ? " selected" : ""}>${Reports.escapeHtml(item.shortName)}</option>`).join("")}
          </select>
        </div>
        <button type="button" class="btn btn-quiet" data-action="clearFilters">清除筛选</button>
        <span class="filter-summary">当前口径：${Reports.escapeHtml(Reports.filterLabel(state.db, state.filters))}</span>
      </div>
    `;
  }

  function publicLayout(content, active = "portal") {
    return `
      <div class="public-shell">
        <header class="public-header">
          <a class="brand" href="#/portal">
            <span class="brand-mark">安</span>
            <span class="brand-copy"><strong>安责险信息管理平台</strong><span>监管 · 保险 · 服务 · 企业</span></span>
          </a>
          <nav class="public-nav" aria-label="公共门户导航">
            <a class="${active === "portal" ? "active" : ""}" href="#/portal">平台首页</a>
            <a class="${active === "market" ? "active" : ""}" href="#/market">保险产品</a>
            <a href="#/portal" data-action="scrollNotices">政策通知</a>
            <a class="btn btn-primary" href="#/login">登录平台</a>
          </nav>
        </header>
        <main class="public-main">${content}</main>
        <footer class="public-footer">
          <strong>安责险信息管理平台</strong>
          <p>以统一业务数据支撑投保承保、事故预防、隐患整改、理赔回流和监管分析。</p>
        </footer>
      </div>
    `;
  }

  function renderPortal() {
    const report = Reports.dashboard(state.db, { period: "year" });
    const stats = [
      ["纳管企业", Reports.number(report.current.enterpriseCount), "家"],
      ["有效保单", Reports.number(report.current.activePolicyCount), "张"],
      ["参保覆盖率", Reports.percent(report.current.coverageRate), ""],
      ["服务任务", Reports.number(state.db.serviceTasks.length), "项"],
      ["隐患整改率", Reports.percent(report.current.hazardRectificationRate), ""],
      ["累计赔付", Reports.money(report.current.paidAmount), ""],
    ];
    const features = [
      ["保", "保险产品服务", "多家保险机构和产品集中展示，企业自主比较并提交投保。", "/market"],
      ["服", "事故预防服务", "保险、服务机构和企业围绕服务计划、隐患与整改协同。", "/login"],
      ["监", "监管分析", "覆盖率、服务质量、隐患和理赔数据自动汇总并支持下钻。", "/login"],
      ["证", "业务证据链", "业务动作形成状态、时间、责任主体和审计记录。", "/login"],
    ];
    return publicLayout(`
      <section class="hero">
        <div class="hero-copy">
          <span class="eyebrow">互联网 + 安责险 + 监管 + 服务</span>
          <h1>让每张保单、每次服务和每条隐患都可追踪</h1>
          <p>连接监管单位、保险公司、安全技术服务机构和生产经营单位，形成从投保承保到事故预防、隐患整改和理赔回流的业务闭环。</p>
          <div class="hero-actions">
            <a class="btn btn-primary" href="#/login">进入业务平台</a>
            <a class="btn btn-link" href="#/market">浏览保险产品</a>
          </div>
        </div>
        <div class="hero-panel">
          <div class="card-head"><div><h2>平台运行概览</h2><p>数据日期 ${state.db.meta.businessDate}</p></div><span class="status success">运行正常</span></div>
          <div class="hero-metrics">
            ${stats.slice(0, 4).map(([name, value, unit]) => `<div class="hero-metric"><span>${name}</span><strong>${value}${unit ? `<small>${unit}</small>` : ""}</strong></div>`).join("")}
          </div>
        </div>
      </section>
      <section class="section">
        <div class="section-heading"><div><h2>平台服务</h2><p>围绕安责险全流程提供统一的数据和业务入口</p></div></div>
        <div class="feature-grid">
          ${features.map(([icon, title, description, path]) => `<a class="feature-card" href="#${path}"><span class="feature-icon">${icon}</span><h3>${title}</h3><p>${description}</p></a>`).join("")}
        </div>
      </section>
      <section class="section">
        <div class="section-heading"><div><h2>业务数据</h2><p>由保单、服务、隐患和理赔明细自动汇总</p></div></div>
        <div class="public-stat-grid">
          ${stats.map(([name, value, unit]) => `<div class="public-stat"><span>${name}</span><strong>${value}${unit ? `<small>${unit}</small>` : ""}</strong></div>`).join("")}
        </div>
      </section>
      <section class="section" id="notices">
        <div class="section-heading"><div><h2>政策通知</h2><p>示范通知用于展示公共门户信息组织方式</p></div><a href="#/login">进入通知中心 →</a></div>
        <div class="panel notice-list">
          ${[
            ["2026-09-05", "关于加强高危行业安责险事故预防服务工作的通知", "业务通知"],
            ["2026-08-26", "安责险重点行业参保数据质量核查提示", "数据治理"],
            ["2026-08-18", "事故预防服务档案完整性检查工作安排", "监督检查"],
            ["2026-08-02", "保险机构和技术服务机构季度考核说明", "考核评价"],
          ].map(item => `<div class="notice-item"><time>${item[0]}</time><strong>${item[1]}</strong><span>${item[2]}</span></div>`).join("")}
        </div>
      </section>
    `);
  }

  function filteredProducts() {
    return state.db.products.filter(product => (
      (!state.marketFilters.insurerId || product.insurerId === state.marketFilters.insurerId)
      && (!state.marketFilters.serviceLevel || product.serviceLevel === state.marketFilters.serviceLevel)
    ));
  }

  function productCards(publicMode = false) {
    return filteredProducts().map(product => {
      const insurer = entity("insurers", product.insurerId);
      return `
        <article class="product-card">
          <div class="product-insurer"><span class="product-logo">${Reports.escapeHtml(insurer.shortName.slice(0, 1))}</span><div><strong>${Reports.escapeHtml(insurer.shortName)}</strong><div class="product-version">产品版本 ${Reports.escapeHtml(product.version)}</div></div></div>
          <h3>${Reports.escapeHtml(product.name)}</h3>
          <div class="product-coverage"><span>每人责任限额</span><strong>${Reports.money(product.coveragePerPerson, false)}</strong></div>
          <div class="tag-list">${product.tags.map(tag => `<span class="tag">${Reports.escapeHtml(tag)}</span>`).join("")}</div>
          <button type="button" class="btn ${publicMode ? "btn-link" : "btn-primary"}" ${publicMode ? `data-nav="/login"` : `data-workflow="submitApplication" data-id="${product.id}"`}>${publicMode ? "登录后投保" : "选择并提交投保"}</button>
        </article>
      `;
    }).join("");
  }

  function renderPublicMarket() {
    return publicLayout(`
      <section class="section">
        <div class="section-heading"><div><span class="eyebrow">保险服务</span><h2>安责险产品市场</h2><p>企业可自主比较保险机构、保障方案和事故预防服务内容</p></div><a class="btn btn-primary" href="#/login">企业登录</a></div>
        <div class="filter-bar">
          <div class="field"><label>承保机构</label><select data-market-filter="insurerId"><option value="">全部保险机构</option>${state.db.insurers.map(item => `<option value="${item.id}"${state.marketFilters.insurerId === item.id ? " selected" : ""}>${Reports.escapeHtml(item.shortName)}</option>`).join("")}</select></div>
          <div class="field"><label>服务等级</label><select data-market-filter="serviceLevel"><option value="">全部方案</option>${["基础", "标准", "全面", "增强", "行业", "专项"].map(item => `<option value="${item}"${state.marketFilters.serviceLevel === item ? " selected" : ""}>${item}</option>`).join("")}</select></div>
          <button type="button" class="btn btn-quiet" data-action="clearMarketFilters">清除筛选</button>
          <span class="filter-summary">共 ${filteredProducts().length} 个在售方案</span>
        </div>
        <div class="product-grid">${filteredProducts().length ? productCards(true) : emptyState("没有匹配的保险产品", "请调整承保机构或服务等级。")}</div>
      </section>
    `, "market");
  }

  function renderLogin() {
    const selected = state.selectedAccountId || state.db.accounts[0].id;
    state.selectedAccountId = selected;
    return `
      <div class="login-page">
        <section class="login-intro">
          <a class="brand" href="#/portal"><span class="brand-mark">安</span><span class="brand-copy"><strong>安责险信息管理平台</strong><span>返回公共门户</span></span></a>
          <h1>统一入口，按职责进入业务工作台</h1>
          <p>四类主体共享同一业务事实，所有演示操作均会同步反映到待办、报表、状态和审计记录。</p>
          <div class="login-points">
            <div class="login-point"><i>✓</i><span>数据完全本地运行，断网也可使用</span></div>
            <div class="login-point"><i>✓</i><span>固定业务日期和场景，演示结果稳定</span></div>
            <div class="login-point"><i>✓</i><span>独立角色权限，不在工作台直接切换身份</span></div>
          </div>
        </section>
        <section class="login-panel">
          <div class="login-panel-head"><h2>登录业务平台</h2><p>选择演示账号并输入统一演示密码</p></div>
          <div class="account-grid">
            ${state.db.accounts.map(account => `
              <button type="button" class="account-card${selected === account.id ? " selected" : ""}" data-account="${account.id}">
                <span class="account-role">${ROLE_LABELS[account.role]}</span>
                <strong>${Reports.escapeHtml(account.name)}</strong>
                <p>${Reports.escapeHtml(account.organization)}</p>
                <span class="table-secondary">账号：${Reports.escapeHtml(account.username)}</span>
              </button>
            `).join("")}
          </div>
          <div class="login-actions">
            <div class="field">
              <label for="demoPassword">演示密码</label>
              <input id="demoPassword" type="password" value="demo123" autocomplete="off" />
            </div>
            <button type="button" class="btn btn-primary" data-action="login">进入工作台</button>
          </div>
          <p class="login-hint">统一演示密码：demo123。操作手册独立保存在 docs 目录。</p>
        </section>
      </div>
    `;
  }

  function notificationsFor(account) {
    return state.db.notifications.filter(item => (
      item.role === account.role
      && (!item.orgId || item.orgId === account.orgId)
    ));
  }

  function workbenchLayout(account, path, content) {
    const menu = MENUS[account.role] || [];
    const [title, description] = PAGE_TITLES[path] || ["业务工作台", ""];
    const notifications = notificationsFor(account);
    return `
      <div class="workbench">
        <aside class="sidebar">
          <a class="sidebar-brand" href="#${ROLE_HOME[account.role]}">
            <span class="brand-mark">安</span>
            <span><strong>安责险信息管理平台</strong><span>${ROLE_LABELS[account.role]}工作台</span></span>
          </a>
          <div class="sidebar-role">${ROLE_LABELS[account.role]}</div>
          <nav class="side-nav">
            ${menu.map(item => `<a class="${path === item.path || (path === "/regulator/analytics" && item.path === path) ? "active" : ""}" href="#${item.path}"><i class="nav-icon">${item.icon}</i><span>${item.label}</span></a>`).join("")}
          </nav>
          <div class="sidebar-footer">
            <div class="business-date">演示业务日期<br><strong>${state.db.meta.businessDate}</strong><br>${Reports.escapeHtml(state.db.meta.scenarioName)}</div>
          </div>
        </aside>
        <section class="workspace">
          <header class="workspace-header">
            <div class="workspace-title"><div class="breadcrumb">首页 / ${ROLE_LABELS[account.role]} / ${Reports.escapeHtml(title)}</div><h1>${Reports.escapeHtml(title)}</h1></div>
            <div class="header-actions">
              ${account.role === "regulator" ? `<button type="button" class="btn btn-quiet" data-action="togglePresentation">${state.presentation ? "退出投屏" : "驾驶舱投屏"}</button>` : ""}
              <button type="button" class="btn btn-icon notification-button" data-action="showNotifications" aria-label="通知">信${notifications.filter(item => !item.read).length ? `<span class="notification-count">${notifications.filter(item => !item.read).length}</span>` : ""}</button>
              <div class="user-menu">
                <button type="button" class="user-trigger" data-action="toggleUserMenu">
                  <span class="avatar">${Reports.escapeHtml(account.name.slice(0, 1))}</span>
                  <span class="user-copy"><strong>${Reports.escapeHtml(account.name)}</strong><span>${Reports.escapeHtml(account.organization)}</span></span>
                </button>
                ${state.userMenuOpen ? `
                  <div class="dropdown">
                    <a href="#/demo-control">演示设置</a>
                    <a href="../docs/demo-script.md" target="_blank" rel="noreferrer">帮助与演示指南</a>
                    <button type="button" data-action="logout">退出登录</button>
                  </div>
                ` : ""}
              </div>
            </div>
          </header>
          <main class="page">
            ${content || `${pageHeading(title, description)}${emptyState("页面建设中", "该页面尚未完成。")}`}
          </main>
        </section>
      </div>
    `;
  }

  function renderRegulatorDashboard() {
    const report = Reports.dashboard(state.db, state.filters);
    return `
      ${pageHeading("监管驾驶舱", "从参保覆盖、业务规模、事故预防、隐患和理赔把握全域运行态势", `
        <button type="button" class="btn btn-quiet" data-nav="/regulator/brief">生成监管简报</button>
      `)}
      ${filterBar()}
      ${kpiCards(report.cards)}
      <div class="dashboard-grid">
        ${reportCard("地区参保覆盖率", Reports.renderChart({ type: "bar", data: report.regionCoverage, suffix: "%", decimals: 1, drill: "regionCoverage" }), "点击地区查看企业参保明细")}
        ${reportCard("重点待办与预警", `
          <div class="alert-list">
            ${report.alerts.length ? report.alerts.slice(0, 7).map(item => `
              <button type="button" class="alert-item ${item.level}" data-drill="${item.drill}" data-key="${item.key || ""}">
                <span class="alert-type">${Reports.escapeHtml(item.type)}</span>
                <span class="alert-copy"><strong>${Reports.escapeHtml(item.title)}</strong><span>${Reports.escapeHtml(item.description)}</span></span>
                <span>查看 →</span>
              </button>
            `).join("") : emptyState("暂无预警", "当前筛选条件下没有需要处理的异常。")}
          </div>
        `, "从预警直接进入业务明细")}
      </div>
      <div class="report-grid" style="margin-top:14px">
        ${reportCard("行业覆盖率对比", Reports.renderChart({ type: "bar", data: report.industryCoverage, suffix: "%", decimals: 1, drill: "industryCoverage" }), "八类高危行业参保差异")}
        ${reportCard("月度投保与承保趋势", Reports.renderChart({ type: "line", data: report.trend, series: [{ key: "applications", label: "投保申请" }, { key: "policies", label: "承保出单" }], drill: "applications" }), "最近 12 个月")}
        ${reportCard("隐患等级与闭环", Reports.renderChart({ type: "donut", data: report.hazardStatus.map(item => ({ label: item.label, value: item.value })), drill: "hazards" }), "点击等级查看隐患记录")}
        ${reportCard("服务机构质量排名", Reports.renderChart({ type: "ranking", data: report.providerRanking.map(item => ({ id: item.id, label: item.label, value: item.score, meta: `完成率 ${Reports.percent(item.completionRate)}` })), suffix: "分", drill: "provider" }), "综合任务、时限、整改和评价")}
      </div>
    `;
  }

  function analyticsTabs(topic) {
    const tabs = [
      ["coverage", "参保覆盖"],
      ["insurance", "保险业务"],
      ["prevention", "事故预防"],
      ["hazards", "隐患整改"],
      ["claims", "理赔运行"],
      ["assessment", "机构考核"],
    ];
    return `<nav class="report-tabs">${tabs.map(([id, name]) => `<a class="${topic === id ? "active" : ""}" href="#/regulator/analytics?topic=${id}">${name}</a>`).join("")}</nav>`;
  }

  function renderRegulatorAnalytics(query) {
    const topic = query.get("topic") || "coverage";
    const report = Reports.topicReport(state.db, topic, state.filters);
    return `
      ${pageHeading(report.title, report.description, `<button type="button" class="btn btn-quiet" data-action="exportTopic" data-topic="${topic}">导出当前明细 CSV</button>`)}
      ${analyticsTabs(topic)}
      ${filterBar()}
      ${kpiCards(report.cards, true)}
      <div class="report-grid">
        ${report.charts.map((chart, index) => reportCard(chart.title, Reports.renderChart(chart), "", chart.type === "heatmap" || (report.charts.length % 2 === 1 && index === report.charts.length - 1) ? "wide" : "")).join("")}
      </div>
    `;
  }

  function renderRegulatorAlerts() {
    const report = Reports.dashboard(state.db, state.filters);
    return `
      ${pageHeading("待办与预警", "聚合低覆盖、重大隐患、服务时限和理赔进度异常")}
      ${filterBar()}
      <section class="card">
        <div class="card-head"><div><h3>重点监管事项</h3><p>按风险等级排序，点击查看关联明细</p></div><span class="status warning">${report.alerts.length} 项</span></div>
        <div class="alert-list">
          ${report.alerts.length ? report.alerts.map(item => `
            <button type="button" class="alert-item ${item.level}" data-drill="${item.drill}" data-key="${item.key || ""}">
              <span class="alert-type">${Reports.escapeHtml(item.type)}</span>
              <span class="alert-copy"><strong>${Reports.escapeHtml(item.title)}</strong><span>${Reports.escapeHtml(item.description)}</span></span>
              <span>查看明细 →</span>
            </button>
          `).join("") : emptyState("暂无预警", "当前筛选条件下没有需要处理的异常。")}
        </div>
      </section>
    `;
  }

  function renderRegulatorAssessments() {
    const report = Reports.topicReport(state.db, "assessment", state.filters);
    return `
      ${pageHeading("机构考核", "综合展示保险机构与技术服务机构业务贡献、质量、时效和投诉")}
      ${filterBar()}
      ${kpiCards(report.cards, true)}
      <div class="report-grid">
        ${report.charts.map(chart => reportCard(chart.title, Reports.renderChart(chart), chart.title.includes("保险") ? "覆盖贡献 25% + 承保时效 20% + 服务投入 20% + 理赔时效 20% + 投诉评价 15%" : "任务完成 25% + 隐患闭环 25% + 回访归档 20% + 档案完整 15% + 企业评价 15%")).join("")}
      </div>
      <section class="card" style="margin-top:14px">
        <div class="card-head"><div><h3>口径说明</h3><p>以下权重为演示建议口径，不代表正式监管规则</p></div></div>
        <div class="summary-list">
          <div class="summary-row"><span>保险机构评分</span><strong>覆盖贡献、承保时效、事故预防投入、理赔时效、投诉评价</strong></div>
          <div class="summary-row"><span>服务机构评分</span><strong>任务完成、隐患闭环、回访归档时效、档案完整、企业评价</strong></div>
        </div>
      </section>
    `;
  }

  function renderRegulatorBrief() {
    const brief = Reports.brief(state.db, state.filters);
    return `
      ${pageHeading("监管运行简报", "由当前筛选数据自动生成，适合会议投屏和打印", `
        <button type="button" class="btn btn-quiet" data-action="printBrief">打印 / 保存 PDF</button>
        <button type="button" class="btn btn-primary" data-action="exportBrief">导出明细 CSV</button>
      `)}
      ${filterBar()}
      <article class="brief-sheet">
        <div class="brief-cover">
          <div><span class="eyebrow">安全生产责任保险</span><h2>监管运行简报</h2><p>${Reports.escapeHtml(Reports.filterLabel(state.db, state.filters))}</p></div>
          <div class="brief-number">数据日期<br><strong>${state.db.meta.businessDate}</strong><br>数据场景：${Reports.escapeHtml(state.db.meta.scenarioName)}</div>
        </div>
        <div style="margin-top:18px">${kpiCards(brief.cards)}</div>
        <div class="brief-narratives">${brief.narratives.map(item => `<p>${Reports.escapeHtml(item)}</p>`).join("")}</div>
        <div class="report-grid">
          ${reportCard("地区参保覆盖率", Reports.renderChart({ type: "bar", data: brief.regionCoverage, suffix: "%", decimals: 1, drill: "regionCoverage" }))}
          ${reportCard("月度投保与承保趋势", Reports.renderChart({ type: "line", data: brief.trend, series: [{ key: "applications", label: "投保申请" }, { key: "policies", label: "承保出单" }], drill: "applications" }))}
          ${reportCard("隐患等级分布", Reports.renderChart({ type: "donut", data: brief.hazardStatus.map(item => ({ label: item.label, value: item.value })), drill: "hazards" }))}
          ${reportCard("服务机构质量排名", Reports.renderChart({ type: "ranking", data: brief.providerRanking.map(item => ({ id: item.id, label: item.label, value: item.score, meta: `完成率 ${Reports.percent(item.completionRate)}` })), suffix: "分", drill: "provider" }))}
        </div>
        <div class="brief-signature">安责险信息管理平台自动汇总 · 指标均可下钻至业务明细</div>
      </article>
    `;
  }

  function renderInsurerDashboard(account) {
    const applications = state.db.applications.filter(item => item.insurerId === account.orgId);
    const policies = state.db.policies.filter(item => item.insurerId === account.orgId);
    const policyIds = new Set(policies.map(item => item.id));
    const tasks = state.db.serviceTasks.filter(item => item.insurerId === account.orgId);
    const claims = state.db.claims.filter(item => policyIds.has(item.policyId));
    const cards = [
      { label: "待核保申请", value: Reports.number(applications.filter(item => item.status === "核保中").length), drill: "applications" },
      { label: "有效保单", value: Reports.number(policies.filter(item => item.status === "生效中").length), drill: "policies" },
      { label: "有效保费", value: Reports.money(policies.filter(item => item.status === "生效中").reduce((sum, item) => sum + item.premium, 0)), drill: "policies" },
      { label: "在途理赔", value: Reports.number(claims.filter(item => item.status !== "已结案").length), drill: "openClaims" },
    ];
    const report = Reports.topicReport(state.db, "insurance", { period: "year", insurerId: account.orgId });
    return `
      ${pageHeading("保险工作台", "集中处理投保、保单、事故预防服务和理赔事项")}
      ${kpiCards(cards, true)}
      <div class="report-grid">
        ${reportCard("投保转化漏斗", Reports.renderChart(report.charts[0]), "从提交申请到承保出单")}
        ${reportCard("月度投保与承保趋势", Reports.renderChart(report.charts[1]), "本机构最近 12 个月")}
      </div>
      <section class="card" style="margin-top:14px">
        <div class="card-head"><div><h3>当前待办</h3><p>优先显示待核保、待委托和待推进理赔事项</p></div></div>
        ${renderTable([
          { label: "事项", render: row => Reports.escapeHtml(row.type) },
          { label: "业务编号", render: row => `<span class="table-primary">${Reports.escapeHtml(row.id)}</span>` },
          { label: "对象", render: row => Reports.escapeHtml(row.enterprise) },
          { label: "状态", render: row => statusTag(row.status) },
        ], [
          ...applications.filter(item => item.status === "核保中").slice(0, 4).map(item => ({ type: "投保核保", id: item.id, enterprise: label("enterprises", item.enterpriseId), status: item.status })),
          ...tasks.filter(item => item.status === "待接单").slice(0, 3).map(item => ({ type: "服务委托", id: item.id, enterprise: label("enterprises", item.enterpriseId), status: item.status })),
          ...claims.filter(item => item.status !== "已结案").slice(0, 3).map(item => ({ type: "理赔处理", id: item.id, enterprise: label("enterprises", item.enterpriseId), status: item.status })),
        ])}
      </section>
    `;
  }

  function renderInsurerApplications(account) {
    const rows = state.db.applications
      .filter(item => item.insurerId === account.orgId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    return `
      ${pageHeading("投保核保", "核验企业资料并作出补正、承保或拒保决定")}
      <section class="card">
        <div class="card-head"><div><h3>投保申请</h3><p>本机构共 ${rows.length} 笔申请</p></div></div>
        ${renderTable([
          { label: "申请编号", render: row => `<span class="table-primary">${Reports.escapeHtml(row.id)}</span><span class="table-secondary">${Reports.escapeHtml(row.createdAt)}</span>` },
          { label: "企业", render: row => Reports.escapeHtml(label("enterprises", row.enterpriseId)) },
          { label: "产品", render: row => Reports.escapeHtml(label("products", row.productId)) },
          { label: "人数", render: row => Reports.number(row.insuredCount) },
          { label: "保费", render: row => Reports.money(row.premium, false) },
          { label: "状态", render: row => statusTag(row.status) },
          { label: "操作", render: row => row.status === "核保中" ? `
            <div class="btn-row">
              <button type="button" class="btn btn-primary btn-quiet" data-workflow="approveApplication" data-id="${row.id}">核保通过</button>
              <button type="button" class="btn btn-quiet" data-workflow="requestCorrection" data-id="${row.id}">要求补正</button>
              <button type="button" class="btn btn-danger btn-quiet" data-workflow="rejectApplication" data-id="${row.id}">拒保</button>
            </div>
          ` : "-" },
        ], rows)}
      </section>
    `;
  }

  function renderInsurerPolicies(account) {
    const rows = state.db.policies
      .filter(item => item.insurerId === account.orgId)
      .sort((left, right) => right.startDate.localeCompare(left.startDate));
    return `
      ${pageHeading("保单与事故预防服务", "查看有效保单并创建事故预防服务委托")}
      <section class="card">
        <div class="card-head"><div><h3>保单清单</h3><p>服务委托会同步到技术服务机构和企业</p></div></div>
        ${renderTable([
          { label: "保单号", render: row => `<span class="table-primary">${Reports.escapeHtml(row.policyNo)}</span><span class="table-secondary">${Reports.escapeHtml(row.startDate)} 至 ${Reports.escapeHtml(row.endDate)}</span>` },
          { label: "企业", render: row => Reports.escapeHtml(label("enterprises", row.enterpriseId)) },
          { label: "产品", render: row => Reports.escapeHtml(label("products", row.productId)) },
          { label: "保费", render: row => Reports.money(row.premium, false) },
          { label: "保额", render: row => Reports.money(row.sumInsured) },
          { label: "状态", render: row => statusTag(row.status) },
          { label: "事故预防服务", render: row => {
            const task = state.db.serviceTasks.find(item => item.policyId === row.id && item.status !== "已归档");
            return task
              ? `${statusTag(task.status)}<span class="table-secondary">${Reports.escapeHtml(label("serviceProviders", task.providerId))}</span>`
              : row.status === "生效中"
                ? `<button type="button" class="btn btn-primary btn-quiet" data-workflow="delegateService" data-id="${row.id}">创建并委托</button>`
                : "-";
          } },
        ], rows)}
      </section>
    `;
  }

  function renderInsurerClaims(account) {
    const rows = state.db.claims
      .filter(item => item.insurerId === account.orgId)
      .sort((left, right) => right.reportedAt.localeCompare(left.reportedAt));
    return `
      ${pageHeading("报案理赔", "受理企业报案并维护查勘、审核、赔付和结案进度")}
      <section class="card">
        ${renderTable([
          { label: "赔案编号", render: row => `<span class="table-primary">${Reports.escapeHtml(row.id)}</span><span class="table-secondary">${Reports.escapeHtml(row.reportedAt)}</span>` },
          { label: "企业", render: row => Reports.escapeHtml(label("enterprises", row.enterpriseId)) },
          { label: "事故类型", render: row => Reports.escapeHtml(row.incidentType) },
          { label: "估损金额", render: row => Reports.money(row.estimatedLoss, false) },
          { label: "赔付金额", render: row => Reports.money(row.paidAmount, false) },
          { label: "状态", render: row => statusTag(row.status) },
          { label: "操作", render: row => row.status !== "已结案" ? `<button type="button" class="btn btn-primary btn-quiet" data-workflow="advanceClaim" data-id="${row.id}">推进下一状态</button>` : "-" },
        ], rows)}
      </section>
    `;
  }

  function serviceContext(account) {
    const tasks = state.db.serviceTasks.filter(item => item.providerId === account.orgId);
    const taskIds = new Set(tasks.map(item => item.id));
    const hazards = state.db.hazards.filter(item => taskIds.has(item.taskId));
    return { tasks, taskIds, hazards };
  }

  function renderServiceDashboard(account) {
    const { tasks, hazards } = serviceContext(account);
    const cards = [
      { label: "服务任务", value: Reports.number(tasks.length), drill: "services" },
      { label: "待执行", value: Reports.number(tasks.filter(item => ["待接单", "执行中"].includes(item.status)).length), drill: "services" },
      { label: "隐患整改率", value: Reports.percent(hazards.length ? hazards.filter(item => item.status === "已销号").length / hazards.length * 100 : 0), drill: "hazards" },
      { label: "超期隐患", value: Reports.number(hazards.filter(item => Reports.overdueHazard(item, state.db.meta.businessDate)).length), drill: "overdueHazards" },
    ];
    const statusData = Object.entries(tasks.reduce((map, item) => ({ ...map, [item.status]: (map[item.status] || 0) + 1 }), {})).map(([labelText, value]) => ({ label: labelText, value }));
    const hazardData = Object.entries(hazards.reduce((map, item) => ({ ...map, [item.level]: (map[item.level] || 0) + 1 }), {})).map(([labelText, value]) => ({ label: labelText, value }));
    return `
      ${pageHeading("技术服务工作台", "掌握服务任务执行、隐患整改、回访和归档时限")}
      ${kpiCards(cards, true)}
      <div class="report-grid">
        ${reportCard("任务状态分布", Reports.renderChart({ type: "donut", data: statusData, drill: "services" }))}
        ${reportCard("隐患等级分布", Reports.renderChart({ type: "donut", data: hazardData, drill: "hazards" }))}
      </div>
      <section class="card" style="margin-top:14px">
        <div class="card-head"><div><h3>近期任务</h3><p>优先显示未归档任务</p></div></div>
        ${renderServiceTaskTable(tasks.filter(item => item.status !== "已归档").slice(0, 10))}
      </section>
    `;
  }

  function taskAction(task) {
    if (task.status === "待接单") return `<button type="button" class="btn btn-primary btn-quiet" data-workflow="acceptTask" data-id="${task.id}">接单并派专家</button>`;
    if (task.status === "执行中") return `<button type="button" class="btn btn-primary btn-quiet" data-workflow="recordHazard" data-id="${task.id}">提交现场结果</button>`;
    if (task.status === "待回访") return `<button type="button" class="btn btn-primary btn-quiet" data-workflow="completeFollowUp" data-id="${task.id}">完成回访</button>`;
    if (task.status === "待归档") return `<button type="button" class="btn btn-primary btn-quiet" data-workflow="archiveTask" data-id="${task.id}">归档</button>`;
    return "-";
  }

  function renderServiceTaskTable(tasks) {
    return renderTable([
      { label: "任务编号", render: row => `<span class="table-primary">${Reports.escapeHtml(row.id)}</span><span class="table-secondary">${Reports.escapeHtml(row.serviceType)}</span>` },
      { label: "企业", render: row => Reports.escapeHtml(label("enterprises", row.enterpriseId)) },
      { label: "专家", render: row => Reports.escapeHtml(row.expertName) },
      { label: "计划日期", render: row => Reports.escapeHtml(row.plannedDate) },
      { label: "完成期限", render: row => Reports.escapeHtml(row.dueDate) },
      { label: "状态", render: row => statusTag(row.status) },
      { label: "操作", render: taskAction },
    ], tasks);
  }

  function renderServiceTasks(account) {
    const { tasks } = serviceContext(account);
    return `
      ${pageHeading("服务任务", "接受保险机构委托、安排专家并提交现场服务结果")}
      <section class="card">${renderServiceTaskTable(tasks.sort((left, right) => right.plannedDate.localeCompare(left.plannedDate)))}</section>
    `;
  }

  function renderServiceHazards(account) {
    const { hazards } = serviceContext(account);
    return `
      ${pageHeading("隐患与复查", "查看企业整改证据并执行复查销号")}
      <section class="card">
        ${renderTable([
          { label: "隐患编号", render: row => `<span class="table-primary">${Reports.escapeHtml(row.id)}</span><span class="table-secondary">${Reports.escapeHtml(row.type)}</span>` },
          { label: "企业", render: row => Reports.escapeHtml(label("enterprises", row.enterpriseId)) },
          { label: "等级", render: row => statusTag(row.level) },
          { label: "隐患描述", render: row => Reports.escapeHtml(row.description) },
          { label: "整改期限", render: row => Reports.escapeHtml(row.deadline) },
          { label: "证据", render: row => `${row.evidenceCount} 份` },
          { label: "状态", render: row => statusTag(row.status) },
          { label: "操作", render: row => row.status === "待复查" ? `<button type="button" class="btn btn-primary btn-quiet" data-workflow="reviewRectification" data-id="${row.id}">复查通过</button>` : "-" },
        ], hazards.sort((left, right) => right.discoveredAt.localeCompare(left.discoveredAt)))}
      </section>
    `;
  }

  function renderServiceArchive(account) {
    const { tasks } = serviceContext(account);
    return `
      ${pageHeading("回访与归档", "完成企业回访并归集服务方案、现场记录、整改和复查资料")}
      <section class="card">
        ${renderTable([
          { label: "任务编号", render: row => `<span class="table-primary">${Reports.escapeHtml(row.id)}</span><span class="table-secondary">${Reports.escapeHtml(row.serviceType)}</span>` },
          { label: "企业", render: row => Reports.escapeHtml(label("enterprises", row.enterpriseId)) },
          { label: "服务完成", render: row => Reports.escapeHtml(row.completedAt || "-") },
          { label: "回访日期", render: row => Reports.escapeHtml(row.followUpAt || "-") },
          { label: "档案完整度", render: row => {
            const archive = state.db.archives.find(item => item.taskId === row.id);
            return archive ? `${archive.completeness}%` : "-";
          } },
          { label: "状态", render: row => statusTag(row.status) },
          { label: "操作", render: taskAction },
        ], tasks.filter(item => ["待回访", "待归档", "已归档"].includes(item.status)).sort((left, right) => right.plannedDate.localeCompare(left.plannedDate)))}
      </section>
    `;
  }

  function enterpriseContext(account) {
    const enterprise = entity("enterprises", account.orgId);
    const applications = state.db.applications.filter(item => item.enterpriseId === enterprise.id);
    const policies = state.db.policies.filter(item => item.enterpriseId === enterprise.id);
    const policyIds = new Set(policies.map(item => item.id));
    const tasks = state.db.serviceTasks.filter(item => item.enterpriseId === enterprise.id);
    const taskIds = new Set(tasks.map(item => item.id));
    const hazards = state.db.hazards.filter(item => item.enterpriseId === enterprise.id && taskIds.has(item.taskId));
    const claims = state.db.claims.filter(item => item.enterpriseId === enterprise.id && policyIds.has(item.policyId));
    return { enterprise, applications, policies, tasks, hazards, claims };
  }

  function renderEnterpriseDashboard(account) {
    const ctx = enterpriseContext(account);
    const activePolicies = ctx.policies.filter(item => item.status === "生效中");
    return `
      ${pageHeading("企业首页", "查看企业保障状态、服务计划、隐患整改和理赔事项")}
      <section class="identity-card">
        <span class="identity-logo">${Reports.escapeHtml(ctx.enterprise.name.slice(0, 1))}</span>
        <div class="identity-copy"><h2>${Reports.escapeHtml(ctx.enterprise.name)}</h2><p>${Reports.escapeHtml(label("industries", ctx.enterprise.industryId))} · ${Reports.escapeHtml(label("regions", ctx.enterprise.regionId))} · 风险等级 ${Reports.escapeHtml(ctx.enterprise.riskLevel)}</p></div>
        <div class="identity-meta"><span>统一信用代码<br><strong>${Reports.escapeHtml(ctx.enterprise.creditCode)}</strong></span><span>从业人员<br><strong>${ctx.enterprise.employees} 人</strong></span><span>联系人<br><strong>${Reports.escapeHtml(ctx.enterprise.contact)}</strong></span><span>当前保障<br><strong>${activePolicies.length ? "已参保" : "待投保"}</strong></span></div>
      </section>
      <div class="quick-actions">
        <button type="button" class="quick-action" data-nav="/enterprise/market"><strong>选择保险产品</strong><span>比较方案并提交投保</span></button>
        <button type="button" class="quick-action" data-nav="/enterprise/policies"><strong>查看保单与服务</strong><span>${activePolicies.length} 张有效保单</span></button>
        <button type="button" class="quick-action" data-nav="/enterprise/hazards"><strong>处理隐患整改</strong><span>${ctx.hazards.filter(item => item.status === "待整改").length} 项待整改</span></button>
        <button type="button" class="quick-action" data-nav="/enterprise/claims"><strong>报案与理赔</strong><span>${ctx.claims.filter(item => item.status !== "已结案").length} 起在途案件</span></button>
      </div>
      <div class="content-grid two">
        ${reportCard("保障概览", `
          <div class="summary-list">
            <div class="summary-row"><span>有效保单</span><strong>${activePolicies.length} 张</strong></div>
            <div class="summary-row"><span>总保额</span><strong>${Reports.money(activePolicies.reduce((sum, item) => sum + item.sumInsured, 0))}</strong></div>
            <div class="summary-row"><span>事故预防任务</span><strong>${ctx.tasks.length} 项</strong></div>
            <div class="summary-row"><span>隐患整改率</span><strong>${Reports.percent(ctx.hazards.length ? ctx.hazards.filter(item => item.status === "已销号").length / ctx.hazards.length * 100 : 0)}</strong></div>
          </div>
        `)}
        ${reportCard("最新业务进度", `
          <div class="timeline">
            ${[
              ...ctx.applications.slice(0, 2).map(item => ({ title: `投保申请 ${item.status}`, note: item.id, date: item.updatedAt })),
              ...ctx.tasks.slice(0, 2).map(item => ({ title: `服务任务 ${item.status}`, note: item.id, date: item.plannedDate })),
              ...ctx.claims.slice(0, 2).map(item => ({ title: `理赔 ${item.status}`, note: item.id, date: item.updatedAt })),
            ].sort((left, right) => right.date.localeCompare(left.date)).slice(0, 5).map(item => `<div class="timeline-item"><span class="timeline-dot"></span><span class="timeline-copy"><strong>${Reports.escapeHtml(item.title)}</strong><span>${Reports.escapeHtml(item.note)}</span></span><time>${Reports.escapeHtml(item.date)}</time></div>`).join("") || emptyState("暂无业务进度", "可从产品市场发起投保。")}
          </div>
        `)}
      </div>
    `;
  }

  function renderEnterpriseMarket() {
    return `
      ${pageHeading("保险产品市场", "自主比较保险机构、保障额度和事故预防服务内容")}
      <div class="filter-bar">
        <div class="field"><label>承保机构</label><select data-market-filter="insurerId"><option value="">全部保险机构</option>${state.db.insurers.map(item => `<option value="${item.id}"${state.marketFilters.insurerId === item.id ? " selected" : ""}>${Reports.escapeHtml(item.shortName)}</option>`).join("")}</select></div>
        <div class="field"><label>服务等级</label><select data-market-filter="serviceLevel"><option value="">全部类型</option>${["基础", "标准", "全面", "增强", "行业", "专项"].map(item => `<option value="${item}"${state.marketFilters.serviceLevel === item ? " selected" : ""}>${item}</option>`).join("")}</select></div>
        <button type="button" class="btn btn-quiet" data-action="clearMarketFilters">清除筛选</button>
        <span class="filter-summary">共 ${filteredProducts().length} 个方案，点击即可提交当前企业投保申请</span>
      </div>
      <div class="product-grid">${filteredProducts().length ? productCards(false) : emptyState("没有匹配的保险产品", "请调整承保机构或服务等级。")}</div>
    `;
  }

  function renderEnterprisePolicies(account) {
    const ctx = enterpriseContext(account);
    return `
      ${pageHeading("保单与服务", "跟踪投保申请、有效保单和事故预防服务计划")}
      <section class="card">
        <div class="card-head"><div><h3>投保申请</h3></div></div>
        ${renderTable([
          { label: "申请编号", render: row => Reports.escapeHtml(row.id) },
          { label: "保险机构", render: row => Reports.escapeHtml(label("insurers", row.insurerId)) },
          { label: "产品", render: row => Reports.escapeHtml(label("products", row.productId)) },
          { label: "申请日期", render: row => Reports.escapeHtml(row.createdAt) },
          { label: "保费", render: row => Reports.money(row.premium, false) },
          { label: "状态", render: row => statusTag(row.status) },
        ], ctx.applications.sort((left, right) => right.createdAt.localeCompare(left.createdAt)), "尚未提交投保申请")}
      </section>
      <section class="card">
        <div class="card-head"><div><h3>保单与服务计划</h3></div></div>
        ${renderTable([
          { label: "保单号", render: row => Reports.escapeHtml(row.policyNo) },
          { label: "保险机构", render: row => Reports.escapeHtml(label("insurers", row.insurerId)) },
          { label: "保险期间", render: row => `${Reports.escapeHtml(row.startDate)} 至 ${Reports.escapeHtml(row.endDate)}` },
          { label: "保障额度", render: row => Reports.money(row.sumInsured) },
          { label: "保单状态", render: row => statusTag(row.status) },
          { label: "服务计划", render: row => {
            const task = ctx.tasks.find(item => item.policyId === row.id);
            return task ? `${Reports.escapeHtml(task.serviceType)} ${statusTag(task.status)}` : "待保险机构安排";
          } },
        ], ctx.policies, "尚无保单")}
      </section>
    `;
  }

  function renderEnterpriseHazards(account) {
    const ctx = enterpriseContext(account);
    return `
      ${pageHeading("隐患整改", "按整改期限处理隐患并提交说明和模拟证据")}
      <section class="card">
        ${renderTable([
          { label: "隐患编号", render: row => `<span class="table-primary">${Reports.escapeHtml(row.id)}</span><span class="table-secondary">${Reports.escapeHtml(row.type)}</span>` },
          { label: "等级", render: row => statusTag(row.level) },
          { label: "隐患描述", render: row => Reports.escapeHtml(row.description) },
          { label: "整改期限", render: row => Reports.escapeHtml(row.deadline) },
          { label: "证据", render: row => `${row.evidenceCount} 份` },
          { label: "状态", render: row => statusTag(row.status) },
          { label: "操作", render: row => row.status === "待整改" ? `<button type="button" class="btn btn-primary btn-quiet" data-workflow="submitRectification" data-id="${row.id}">提交整改证据</button>` : "-" },
        ], ctx.hazards.sort((left, right) => right.discoveredAt.localeCompare(left.discoveredAt)), "暂无隐患整改事项")}
      </section>
    `;
  }

  function renderEnterpriseClaims(account) {
    const ctx = enterpriseContext(account);
    const activePolicy = ctx.policies.find(item => item.status === "生效中");
    return `
      ${pageHeading("报案理赔", "使用有效保单提交事故报案并查看理赔时间线", activePolicy ? `<button type="button" class="btn btn-primary" data-workflow="reportClaim" data-id="${activePolicy.id}">使用 ${Reports.escapeHtml(activePolicy.policyNo)} 报案</button>` : "")}
      <section class="card">
        ${renderTable([
          { label: "赔案编号", render: row => Reports.escapeHtml(row.id) },
          { label: "事故类型", render: row => Reports.escapeHtml(row.incidentType) },
          { label: "报案日期", render: row => Reports.escapeHtml(row.reportedAt) },
          { label: "估损金额", render: row => Reports.money(row.estimatedLoss, false) },
          { label: "赔付金额", render: row => Reports.money(row.paidAmount, false) },
          { label: "当前状态", render: row => statusTag(row.status) },
          { label: "进度", render: row => `<button type="button" class="btn btn-quiet" data-action="showClaimTimeline" data-id="${row.id}">查看时间线</button>` },
        ], ctx.claims.sort((left, right) => right.reportedAt.localeCompare(left.reportedAt)), "暂无报案记录")}
      </section>
    `;
  }

  function renderDemoControl(account) {
    return workbenchLayout(account, "/demo-control", `
      ${pageHeading("演示设置", "该入口不属于业务菜单，用于恢复固定数据和准备演示")}
      <section class="card">
        <div class="card-head"><div><h3>固定演示场景</h3><p>切换场景会覆盖当前操作数据，请在演示前选择</p></div><span class="status info">${Reports.escapeHtml(state.db.meta.scenarioName)}</span></div>
        <div class="demo-control-grid">
          ${Data.SCENARIOS.map(scenario => `
            <article class="scenario-card${state.db.meta.scenarioId === scenario.id ? " active" : ""}">
              <h3>${Reports.escapeHtml(scenario.name)}</h3>
              <p>${Reports.escapeHtml(scenario.description)}</p>
              <button type="button" class="btn ${state.db.meta.scenarioId === scenario.id ? "btn-ghost" : "btn-link"}" data-action="confirmScenario" data-id="${scenario.id}">${state.db.meta.scenarioId === scenario.id ? "当前场景" : "载入场景"}</button>
            </article>
          `).join("")}
        </div>
      </section>
      <div class="content-grid two" style="margin-top:14px">
        <section class="card">
          <div class="card-head"><div><h3>演示环境</h3></div></div>
          <div class="summary-list">
            <div class="summary-row"><span>业务日期</span><strong>${state.db.meta.businessDate}</strong></div>
            <div class="summary-row"><span>数据版本</span><strong>v${state.db.meta.schemaVersion}</strong></div>
            <div class="summary-row"><span>重点企业</span><strong>12 家</strong></div>
            <div class="summary-row"><span>背景企业</span><strong>${state.db.enterprises.length - 12} 家</strong></div>
          </div>
        </section>
        <section class="card">
          <div class="card-head"><div><h3>帮助文档</h3></div></div>
          <div class="summary-list">
            <div class="summary-row"><span>完整操作手册</span><a href="../docs/demo-script.md" target="_blank" rel="noreferrer">打开文档</a></div>
            <div class="summary-row"><span>演示账号</span><a href="../docs/demo-accounts.md" target="_blank" rel="noreferrer">打开文档</a></div>
            <div class="summary-row"><span>离线运行说明</span><a href="../docs/demo-setup.md" target="_blank" rel="noreferrer">打开文档</a></div>
          </div>
        </section>
      </div>
    `);
  }

  function renderRolePage(account, path, query) {
    if (path === "/demo-control") return renderDemoControl(account);
    if (account.role === "regulator") {
      if (path === "/regulator/dashboard") return workbenchLayout(account, path, renderRegulatorDashboard());
      if (path === "/regulator/analytics") return workbenchLayout(account, path, renderRegulatorAnalytics(query));
      if (path === "/regulator/alerts") return workbenchLayout(account, path, renderRegulatorAlerts());
      if (path === "/regulator/assessments") return workbenchLayout(account, path, renderRegulatorAssessments());
      if (path === "/regulator/brief") return workbenchLayout(account, path, renderRegulatorBrief());
    }
    if (account.role === "insurer") {
      if (path === "/insurer/dashboard") return workbenchLayout(account, path, renderInsurerDashboard(account));
      if (path === "/insurer/applications") return workbenchLayout(account, path, renderInsurerApplications(account));
      if (path === "/insurer/policies") return workbenchLayout(account, path, renderInsurerPolicies(account));
      if (path === "/insurer/claims") return workbenchLayout(account, path, renderInsurerClaims(account));
    }
    if (account.role === "service") {
      if (path === "/service/dashboard") return workbenchLayout(account, path, renderServiceDashboard(account));
      if (path === "/service/tasks") return workbenchLayout(account, path, renderServiceTasks(account));
      if (path === "/service/hazards") return workbenchLayout(account, path, renderServiceHazards(account));
      if (path === "/service/archive") return workbenchLayout(account, path, renderServiceArchive(account));
    }
    if (account.role === "enterprise") {
      if (path === "/enterprise/dashboard") return workbenchLayout(account, path, renderEnterpriseDashboard(account));
      if (path === "/enterprise/market") return workbenchLayout(account, path, renderEnterpriseMarket());
      if (path === "/enterprise/policies") return workbenchLayout(account, path, renderEnterprisePolicies(account));
      if (path === "/enterprise/hazards") return workbenchLayout(account, path, renderEnterpriseHazards(account));
      if (path === "/enterprise/claims") return workbenchLayout(account, path, renderEnterpriseClaims(account));
    }
    return workbenchLayout(account, path, `${pageHeading("无权访问", "当前账号不能访问该页面")}<section class="card">${emptyState("权限不足", "请返回本角色首页。")}<div class="btn-row"><button type="button" class="btn btn-primary" data-nav="${ROLE_HOME[account.role]}">返回工作台</button></div></section>`);
  }

  function render() {
    const root = document.getElementById("app");
    const { path, query } = route();
    const account = currentAccount();
    document.body.classList.toggle("presentation", state.presentation);

    if (path === "/portal") root.innerHTML = renderPortal();
    else if (path === "/market") root.innerHTML = renderPublicMarket();
    else if (path === "/login") root.innerHTML = renderLogin();
    else if (!account) {
      global.location.hash = "/login";
      return;
    } else {
      const rolePrefix = path.split("/")[1];
      if (path !== "/demo-control" && rolePrefix && rolePrefix !== account.role) {
        root.innerHTML = renderRolePage(account, path, query);
      } else {
        root.innerHTML = renderRolePage(account, path, query);
      }
    }
    const publicTitles = {
      "/portal": "安责险信息管理平台",
      "/market": "保险产品市场 - 安责险信息管理平台",
      "/login": "登录 - 安责险信息管理平台",
    };
    document.title = publicTitles[path] || `${PAGE_TITLES[path]?.[0] || "业务工作台"} - 安责险信息管理平台`;
  }

  function showToast(message, error = false) {
    const root = document.getElementById("toastRoot");
    const toast = document.createElement("div");
    toast.className = `toast${error ? " error" : ""}`;
    toast.textContent = message;
    root.appendChild(toast);
    global.setTimeout(() => toast.remove(), 3600);
  }

  function closeDrawer() {
    state.currentDetail = null;
    document.getElementById("drawerRoot").innerHTML = "";
  }

  function openDrawer(detailData, contextText) {
    state.currentDetail = detailData;
    document.getElementById("drawerRoot").innerHTML = `
      <div class="drawer-backdrop" data-action="closeDrawer"></div>
      <aside class="drawer" aria-modal="true" role="dialog">
        <div class="drawer-head">
          <div><h2>${Reports.escapeHtml(detailData.title)}</h2><p>${Reports.escapeHtml(contextText)}</p></div>
          <button type="button" class="btn btn-icon" data-action="closeDrawer" aria-label="关闭">×</button>
        </div>
        <div class="drawer-body">${Reports.detailTable(detailData)}</div>
        <div class="drawer-footer">
          <button type="button" class="btn btn-quiet" data-action="exportCurrentDetail">导出 CSV</button>
          <button type="button" class="btn btn-primary" data-action="closeDrawer">关闭</button>
        </div>
      </aside>
    `;
  }

  function closeModal() {
    state.pendingScenario = null;
    document.getElementById("modalRoot").innerHTML = "";
  }

  function openScenarioConfirmation(scenarioId) {
    const scenario = Data.SCENARIOS.find(item => item.id === scenarioId);
    if (!scenario) return;
    state.pendingScenario = scenario.id;
    document.getElementById("modalRoot").innerHTML = `
      <div class="modal-backdrop" data-action="closeModal">
        <section class="modal" role="dialog" aria-modal="true" aria-labelledby="scenarioTitle">
          <div class="modal-head"><div><h2 id="scenarioTitle">载入“${Reports.escapeHtml(scenario.name)}”</h2><p>当前操作数据将被覆盖</p></div><button type="button" class="btn btn-icon" data-action="closeModal">×</button></div>
          <div class="modal-body"><p>载入后，所有账号、报表和业务记录会恢复为该固定场景。该操作用于演示准备，不可撤销。</p></div>
          <div class="modal-footer"><button type="button" class="btn" data-action="closeModal">取消</button><button type="button" class="btn btn-danger" data-action="loadScenario">确认载入</button></div>
        </section>
      </div>
    `;
  }

  function showNotifications() {
    const account = currentAccount();
    if (!account) return;
    const notifications = notificationsFor(account);
    notifications.forEach(item => { item.read = true; });
    Data.save(state.db);
    const detailData = {
      title: "通知中心",
      columns: [["createdAt", "时间"], ["title", "通知"], ["detail", "内容"]],
      rows: notifications.map(item => ({ createdAt: item.createdAt, title: item.title, detail: item.detail })),
    };
    openDrawer(detailData, `${ROLE_LABELS[account.role]} · ${notifications.length} 条通知`);
    render();
  }

  function showClaimTimeline(claimId) {
    const claim = entity("claims", claimId);
    if (!claim) return;
    const progress = state.db.claimProgress
      .filter(item => item.claimId === claim.id)
      .sort((left, right) => left.at.localeCompare(right.at));
    const detailData = {
      title: `理赔时间线 ${claim.id}`,
      columns: [["at", "日期"], ["status", "状态"], ["note", "说明"]],
      rows: progress,
    };
    openDrawer(detailData, `${label("enterprises", claim.enterpriseId)} · ${claim.incidentType}`);
  }

  function openDrill(type, key = "") {
    if (!type) return;
    const detailData = Reports.detail(state.db, type, key, state.filters);
    openDrawer(detailData, Reports.filterLabel(state.db, state.filters));
  }

  function downloadCsv(detailData, filename) {
    const blob = new Blob([Reports.toCsv(detailData)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function executeWorkflow(name, id) {
    const account = currentAccount();
    if (!account || typeof Workflows[name] !== "function") {
      showToast("当前操作不可用。", true);
      return;
    }
    const result = Workflows[name](state.db, account.id, id);
    showToast(result.message, !result.ok);
    if (result.ok) render();
  }

  function handleClick(event) {
    const target = event.target.closest("[data-action], [data-nav], [data-account], [data-workflow], [data-drill]");
    if (!target) {
      if (state.userMenuOpen && !event.target.closest(".user-menu")) {
        state.userMenuOpen = false;
        render();
      }
      return;
    }

    if (target.dataset.nav) {
      navigate(target.dataset.nav);
      return;
    }
    if (target.dataset.account) {
      state.selectedAccountId = target.dataset.account;
      render();
      return;
    }
    if (target.dataset.workflow) {
      executeWorkflow(target.dataset.workflow, target.dataset.id);
      return;
    }
    if (target.dataset.drill) {
      openDrill(target.dataset.drill, target.dataset.key || "");
      return;
    }

    const action = target.dataset.action;
    if (action === "login") {
      const account = entity("accounts", state.selectedAccountId);
      const password = document.getElementById("demoPassword")?.value || "";
      if (!account || password !== account.password) {
        showToast("账号或演示密码不正确。", true);
        return;
      }
      state.accountId = account.id;
      saveSessionAccount(account.id);
      navigate(ROLE_HOME[account.role]);
      return;
    }
    if (action === "logout") {
      state.accountId = null;
      saveSessionAccount(null);
      state.presentation = false;
      navigate("/login");
      return;
    }
    if (action === "toggleUserMenu") {
      state.userMenuOpen = !state.userMenuOpen;
      render();
      return;
    }
    if (action === "togglePresentation") {
      state.presentation = !state.presentation;
      render();
      return;
    }
    if (action === "clearFilters") {
      state.filters = { period: "year", regionId: "", industryId: "", insurerId: "", providerId: "" };
      render();
      return;
    }
    if (action === "clearMarketFilters") {
      state.marketFilters = { insurerId: "", serviceLevel: "" };
      render();
      return;
    }
    if (action === "scrollNotices") {
      if (route().path !== "/portal") {
        navigate("/portal");
        global.setTimeout(() => document.getElementById("notices")?.scrollIntoView({ behavior: "smooth" }), 80);
      } else {
        document.getElementById("notices")?.scrollIntoView({ behavior: "smooth" });
      }
      return;
    }
    if (action === "showNotifications") {
      showNotifications();
      return;
    }
    if (action === "showClaimTimeline") {
      showClaimTimeline(target.dataset.id);
      return;
    }
    if (action === "closeDrawer") {
      closeDrawer();
      return;
    }
    if (action === "closeModal") {
      if (event.target.classList.contains("modal-backdrop") && event.target !== event.currentTarget) return;
      closeModal();
      return;
    }
    if (action === "confirmScenario") {
      openScenarioConfirmation(target.dataset.id);
      return;
    }
    if (action === "loadScenario") {
      state.db = Data.reset(state.pendingScenario || "baseline");
      closeModal();
      showToast(`已载入“${state.db.meta.scenarioName}”。`);
      render();
      return;
    }
    if (action === "exportCurrentDetail" && state.currentDetail) {
      downloadCsv(state.currentDetail, `${state.currentDetail.title}-${state.db.meta.businessDate}.csv`);
      return;
    }
    if (action === "exportTopic") {
      const topic = target.dataset.topic || "coverage";
      const typeMap = { coverage: "coverage", insurance: "applications", prevention: "services", hazards: "hazards", claims: "claims", assessment: "insurer" };
      const detailData = Reports.detail(state.db, typeMap[topic], "", state.filters);
      downloadCsv(detailData, `${detailData.title}-${state.db.meta.businessDate}.csv`);
      return;
    }
    if (action === "exportBrief") {
      const detailData = Reports.detail(state.db, "coverage", "", state.filters);
      downloadCsv(detailData, `监管简报企业参保明细-${state.db.meta.businessDate}.csv`);
      return;
    }
    if (action === "printBrief") {
      global.print();
    }
  }

  function handleChange(event) {
    const filter = event.target.dataset.filter;
    if (filter) {
      state.filters[filter] = event.target.value;
      render();
      return;
    }
    const marketFilter = event.target.dataset.marketFilter;
    if (marketFilter) {
      state.marketFilters[marketFilter] = event.target.value;
      render();
    }
  }

  global.addEventListener("hashchange", render);
  document.addEventListener("click", handleClick);
  document.addEventListener("change", handleChange);
  render();

  if (state.warning) {
    global.setTimeout(() => showToast(state.warning, true), 120);
  }
})(globalThis);
