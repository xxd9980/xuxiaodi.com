(() => {
  "use strict";

  const money = new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  });

  const compactNumber = new Intl.NumberFormat("zh-CN", {
    notation: "compact",
    maximumFractionDigits: 1,
  });

  const state = {
    data: null,
    managerId: null,
    quarterByManager: {},
    showAll: false,
  };

  const elements = {
    dashboard: document.querySelector("[data-dashboard]"),
    latestQuarter: document.querySelector("[data-latest-quarter]"),
    generatedDate: document.querySelector("[data-generated-date]"),
    managerGrid: document.querySelector("[data-manager-grid]"),
    managerTitle: document.querySelector("[data-manager-title]"),
    managerLegal: document.querySelector("[data-manager-legal]"),
    quarterSelect: document.querySelector("[data-quarter-select]"),
    totalValue: document.querySelector("[data-total-value]"),
    valueChange: document.querySelector("[data-value-change]"),
    positionCount: document.querySelector("[data-position-count]"),
    topFive: document.querySelector("[data-top-five]"),
    topSymbol: document.querySelector("[data-top-symbol]"),
    topWeight: document.querySelector("[data-top-weight]"),
    selectedQuarter: document.querySelector("[data-selected-quarter]"),
    trendChart: document.querySelector("[data-trend-chart]"),
    holdingsCaption: document.querySelector("[data-holdings-caption]"),
    holdingsBody: document.querySelector("[data-holdings-body]"),
    showAll: document.querySelector("[data-show-all]"),
    changesCaption: document.querySelector("[data-changes-caption]"),
    changesList: document.querySelector("[data-changes-list]"),
    sourceLinks: document.querySelector("[data-source-links]"),
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function totalValue(filing) {
    return filing.holdings.reduce((sum, holding) => sum + holding.value, 0);
  }

  function quarterLabel(date) {
    const [year, month] = date.split("-").map(Number);
    return `${year} Q${Math.ceil(month / 3)}`;
  }

  function percent(value, withSign = false) {
    const sign = withSign && value > 0 ? "+" : "";
    return `${sign}${(value * 100).toFixed(1)}%`;
  }

  function currentManager() {
    return (
      state.data.managers.find((manager) => manager.id === state.managerId) ??
      state.data.managers[0]
    );
  }

  function currentSelection(manager) {
    const latestIndex = manager.filings.length - 1;
    const selectedIndex = state.quarterByManager[manager.id] ?? latestIndex;
    return {
      selectedIndex,
      filing: manager.filings[selectedIndex],
      previous: manager.filings[selectedIndex - 1],
    };
  }

  function getChanges(current, previous) {
    if (!previous) return [];
    const currentMap = new Map(
      current.holdings.map((holding) => [`${holding.cusip}|${holding.title}`, holding]),
    );
    const previousMap = new Map(
      previous.holdings.map((holding) => [`${holding.cusip}|${holding.title}`, holding]),
    );
    const keys = new Set([...currentMap.keys(), ...previousMap.keys()]);

    return [...keys]
      .map((key) => {
        const currentHolding = currentMap.get(key);
        const previousHolding = previousMap.get(key);
        const holding = currentHolding ?? previousHolding;
        const shareDelta = (currentHolding?.shares ?? 0) - (previousHolding?.shares ?? 0);
        let kind = "unchanged";
        if (!previousHolding) kind = "new";
        else if (!currentHolding) kind = "exited";
        else if (shareDelta > 0) kind = "increased";
        else if (shareDelta < 0) kind = "reduced";

        return {
          key,
          holding,
          kind,
          shareDelta,
          shareDeltaPercent:
            previousHolding && previousHolding.shares
              ? shareDelta / previousHolding.shares
              : null,
          weightDelta: (currentHolding?.weight ?? 0) - (previousHolding?.weight ?? 0),
        };
      })
      .filter((change) => change.kind !== "unchanged")
      .sort((a, b) => Math.abs(b.weightDelta) - Math.abs(a.weightDelta));
  }

  function renderManagerGrid(manager) {
    elements.managerGrid.innerHTML = state.data.managers
      .map((item, index) => {
        const latest = item.filings.at(-1);
        const before = item.filings.at(-2);
        const latestTotal = totalValue(latest);
        const delta = latestTotal / totalValue(before) - 1;
        const active = item.id === manager.id;

        return `
          <button
            class="manager-card${active ? " active" : ""}"
            type="button"
            data-manager-id="${escapeHtml(item.id)}"
            aria-pressed="${active}"
          >
            <span class="manager-index">0${index + 1}</span>
            <span class="manager-name">${escapeHtml(item.shortName)}</span>
            <span class="manager-lead">${escapeHtml(item.lead)}</span>
            <span class="manager-total">${escapeHtml(money.format(latestTotal))}</span>
            <span class="manager-delta ${delta >= 0 ? "positive" : "negative"}">
              QoQ ${escapeHtml(percent(delta, true))} · ${latest.holdings.length} 项
            </span>
          </button>`;
      })
      .join("");

    elements.managerGrid.querySelectorAll("[data-manager-id]").forEach((button) => {
      const item = state.data.managers.find((managerItem) => managerItem.id === button.dataset.managerId);
      button.style.setProperty("--card-accent", item.accent);
      button.addEventListener("click", () => {
        state.managerId = item.id;
        state.showAll = false;
        render();
      });
    });
  }

  function renderQuarterSelect(manager, selectedIndex) {
    elements.quarterSelect.innerHTML = manager.filings
      .map(
        (filing, index) =>
          `<option value="${index}"${index === selectedIndex ? " selected" : ""}>${quarterLabel(filing.reportDate)}</option>`,
      )
      .join("");
  }

  function renderMetrics(manager, filing, previous) {
    const filingValue = totalValue(filing);
    const previousValue = previous ? totalValue(previous) : 0;
    const valueChange = previousValue ? filingValue / previousValue - 1 : 0;
    const topFiveWeight = filing.holdings
      .slice(0, 5)
      .reduce((sum, holding) => sum + holding.weight, 0);
    const top = filing.holdings[0];

    elements.managerTitle.textContent = manager.shortName;
    elements.managerLegal.textContent = `${manager.legalName} · CIK ${manager.cik}`;
    elements.totalValue.textContent = money.format(filingValue);
    elements.valueChange.textContent = previous ? `${percent(valueChange, true)} QoQ` : "起始季度";
    elements.valueChange.className = previous
      ? valueChange >= 0
        ? "positive"
        : "negative"
      : "";
    elements.positionCount.textContent = filing.holdings.length;
    elements.topFive.textContent = percent(topFiveWeight);
    elements.topSymbol.textContent = top?.ticker ?? top?.cusip ?? "—";
    elements.topWeight.textContent = top ? percent(top.weight) : "—";
  }

  function renderTrend(manager, selectedIndex) {
    const values = manager.filings.map(totalValue);
    const maximum = Math.max(...values);
    const minimum = Math.min(...values);

    elements.trendChart.setAttribute("aria-label", `${manager.shortName}申报市值趋势`);
    elements.trendChart.innerHTML = manager.filings
      .map((filing, index) => {
        const value = values[index];
        const height = 22 + ((value - minimum) / Math.max(1, maximum - minimum)) * 78;
        const active = selectedIndex === index;
        const label =
          index % 4 === 0 || index === manager.filings.length - 1
            ? quarterLabel(filing.reportDate).replace(" ", "·")
            : "";

        return `
          <button
            class="trend-column${active ? " active" : ""}"
            type="button"
            data-quarter-index="${index}"
            aria-label="${escapeHtml(`${quarterLabel(filing.reportDate)}，${money.format(value)}`)}"
            aria-pressed="${active}"
          >
            <span class="trend-value">${escapeHtml(money.format(value))}</span>
            <span class="trend-bar" style="height: ${height.toFixed(2)}%"></span>
            <span class="trend-label">${escapeHtml(label)}</span>
          </button>`;
      })
      .join("");

    elements.trendChart.querySelectorAll("[data-quarter-index]").forEach((button) => {
      button.addEventListener("click", () => {
        state.quarterByManager[manager.id] = Number(button.dataset.quarterIndex);
        state.showAll = false;
        render();
      });
    });
  }

  function renderHoldings(filing) {
    const visible = state.showAll ? filing.holdings : filing.holdings.slice(0, 12);
    elements.holdingsCaption.textContent = `${quarterLabel(filing.reportDate)} · 按市值排序`;
    elements.holdingsBody.innerHTML = visible
      .map(
        (holding, index) => `
          <tr>
            <td class="rank">${String(index + 1).padStart(2, "0")}</td>
            <td>
              <div class="security-name">
                <strong>${escapeHtml(holding.ticker ?? holding.cusip)}</strong>
                <span>${escapeHtml(holding.issuer)}</span>
              </div>
            </td>
            <td>${escapeHtml(compactNumber.format(holding.shares))}</td>
            <td>${escapeHtml(money.format(holding.value))}</td>
            <td>
              <div class="weight-cell">
                <span>${escapeHtml(percent(holding.weight))}</span>
                <i style="width: ${Math.min(100, holding.weight * 250).toFixed(2)}%"></i>
              </div>
            </td>
          </tr>`,
      )
      .join("");

    elements.showAll.hidden = filing.holdings.length <= 12;
    elements.showAll.textContent = state.showAll
      ? "收起明细"
      : `查看全部 ${filing.holdings.length} 项`;
  }

  function renderChanges(filing, previous) {
    const labels = {
      new: "新进",
      increased: "增持",
      reduced: "减持",
      exited: "退出",
    };
    const changes = getChanges(filing, previous);
    elements.changesCaption.textContent = previous
      ? `vs. ${quarterLabel(previous.reportDate)}`
      : "起始季度";

    if (!changes.length) {
      elements.changesList.innerHTML =
        '<p class="empty-state">这是数据序列的起始季度，暂无上期可比数据。</p>';
      return;
    }

    elements.changesList.innerHTML = changes
      .slice(0, 10)
      .map((change) => {
        const deltaText =
          change.shareDeltaPercent === null
            ? change.kind === "new"
              ? "NEW"
              : "—"
            : percent(change.shareDeltaPercent, true);

        return `
          <div class="change-row">
            <div>
              <strong>${escapeHtml(change.holding.ticker ?? change.holding.cusip)}</strong>
              <span>${escapeHtml(change.holding.issuer)}</span>
            </div>
            <div class="change-result">
              <span class="change-badge ${change.kind}">${labels[change.kind]}</span>
              <span class="${change.shareDelta >= 0 ? "positive" : "negative"}">${escapeHtml(deltaText)}</span>
            </div>
          </div>`;
      })
      .join("");
  }

  function renderSourceLinks() {
    elements.sourceLinks.innerHTML = [
      ...state.data.managers.map(
        (manager) =>
          `<a href="${escapeHtml(manager.entityUrl)}" target="_blank" rel="noreferrer">${escapeHtml(manager.shortName)} SEC ↗</a>`,
      ),
      '<a href="https://www.sec.gov/rules-regulations/staff-guidance/division-investment-management-frequently-asked-questions/frequently-asked-questions-about-form-13f" target="_blank" rel="noreferrer">13F 口径说明 ↗</a>',
    ].join("");
  }

  function render() {
    const manager = currentManager();
    const { selectedIndex, filing, previous } = currentSelection(manager);

    elements.dashboard.style.setProperty("--accent", manager.accent);
    elements.selectedQuarter.textContent = quarterLabel(filing.reportDate);
    renderManagerGrid(manager);
    renderQuarterSelect(manager, selectedIndex);
    renderMetrics(manager, filing, previous);
    renderTrend(manager, selectedIndex);
    renderHoldings(filing);
    renderChanges(filing, previous);
    renderSourceLinks();
  }

  function showError(error) {
    const message = document.createElement("p");
    message.className = "load-error";
    message.textContent = "持仓数据暂时无法载入，请稍后刷新页面。";
    elements.managerGrid.replaceChildren(message);
    console.error(error);
  }

  elements.quarterSelect.addEventListener("change", () => {
    const manager = currentManager();
    state.quarterByManager[manager.id] = Number(elements.quarterSelect.value);
    state.showAll = false;
    render();
  });

  elements.showAll.addEventListener("click", () => {
    state.showAll = !state.showAll;
    render();
  });

  fetch("./data/holdings.json", { cache: "no-cache" })
    .then((response) => {
      if (!response.ok) throw new Error(`Holdings request failed: ${response.status}`);
      return response.json();
    })
    .then((data) => {
      state.data = data;
      state.managerId = data.managers[0].id;
      const latest = data.managers[0].filings.at(-1);
      elements.latestQuarter.textContent = `更新至 ${quarterLabel(latest.reportDate)}`;
      elements.generatedDate.textContent = new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(data.generatedAt));
      render();
    })
    .catch(showError);
})();
