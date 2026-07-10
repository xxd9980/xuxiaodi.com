import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const SEC_ORIGIN = "https://www.sec.gov";
const START_DATE = "2022-01-01";
const OUTPUT_FILE = path.resolve("data/holdings.json");
const REQUEST_DELAY_MS = 140;

const managers = [
  {
    id: "berkshire",
    shortName: "伯克希尔",
    legalName: "Berkshire Hathaway Inc",
    lead: "Warren Buffett",
    cik: "0001067983",
    accent: "#d6ff4b",
  },
  {
    id: "hh",
    shortName: "H&H（段永平）",
    legalName: "H&H International Investment, LLC",
    lead: "Duan Yongping",
    cik: "0001759760",
    accent: "#ff9f6e",
  },
  {
    id: "himalaya",
    shortName: "喜马拉雅（李录）",
    legalName: "Himalaya Capital Management LLC",
    lead: "Li Lu",
    cik: "0001709323",
    accent: "#6ee7d8",
  },
];

const tickerByCusip = {
  "02079K107": "GOOG",
  "02079K305": "GOOGL",
  "025816109": "AXP",
  "037833100": "AAPL",
  "060505104": "BAC",
  "084670702": "BRK.B",
  "166764100": "CVX",
  "171232101": "CB",
  "191216100": "KO",
  "23918K108": "DVA",
  "277432100": "EWBC",
  "500754106": "KHC",
  "615369105": "MCO",
  "674599105": "OXY",
  "713448108": "PEP",
  "742718109": "PG",
  "78462F103": "SPY",
  "808513105": "SCHW",
  "92343E102": "VRSN",
  "92826C839": "V",
};

let lastRequestAt = 0;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function secFetch(url) {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < REQUEST_DELAY_MS) await wait(REQUEST_DELAY_MS - elapsed);
  lastRequestAt = Date.now();

  const response = await fetch(url, {
    headers: {
      Accept: "application/json, application/xml, text/xml, */*",
      "User-Agent": "xuxiaodi-invest-tracker contact@xuxiaodi.com",
    },
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${url}`);
  }

  return response;
}

function decodeXml(value = "") {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .trim();
}

function tag(block, name) {
  const match = block.match(
    new RegExp(
      `<(?:[A-Za-z0-9_-]+:)?${name}[^>]*>([\\s\\S]*?)<\\/(?:[A-Za-z0-9_-]+:)?${name}>`,
      "i",
    ),
  );
  return decodeXml(match?.[1]?.replace(/<[^>]+>/g, "") ?? "");
}

function numberTag(block, name) {
  const value = Number(tag(block, name).replaceAll(",", ""));
  return Number.isFinite(value) ? value : 0;
}

function parseInformationTable(xml, filedAt) {
  const blocks = [
    ...xml.matchAll(
      /<(?:[A-Za-z0-9_-]+:)?infoTable\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_-]+:)?infoTable>/gi,
    ),
  ];
  const valuesAreDollars = filedAt >= "2023-01-03";

  const holdings = blocks.map((match) => {
    const block = match[1];
    return {
      issuer: tag(block, "nameOfIssuer"),
      title: tag(block, "titleOfClass"),
      cusip: tag(block, "cusip"),
      figi: tag(block, "figi") || null,
      putCall: tag(block, "putCall") || null,
      shares: numberTag(block, "sshPrnamt"),
      shareType: tag(block, "sshPrnamtType") || "SH",
      value: numberTag(block, "value") * (valuesAreDollars ? 1 : 1000),
    };
  });

  // A small number of post-2023 filings continued to submit legacy
  // "thousands of dollars" values despite using the newer schema. Detect the
  // unmistakable unit mismatch by looking at the median value per share.
  const impliedPrices = holdings
    .filter((holding) => holding.shareType === "SH" && holding.shares > 0)
    .map((holding) => holding.value / holding.shares)
    .sort((a, b) => a - b);
  const medianPrice = impliedPrices[Math.floor(impliedPrices.length / 2)] ?? 0;
  const unitAdjusted = valuesAreDollars && medianPrice > 0 && medianPrice < 1;

  if (unitAdjusted) {
    for (const holding of holdings) holding.value *= 1000;
  }

  return { holdings, unitAdjusted };
}

function consolidate(holdings) {
  const consolidated = new Map();

  for (const holding of holdings) {
    const key = [holding.cusip, holding.title, holding.putCall ?? ""].join("|");
    const existing = consolidated.get(key);
    if (existing) {
      existing.shares += holding.shares;
      existing.value += holding.value;
      continue;
    }
    consolidated.set(key, { ...holding });
  }

  const rows = [...consolidated.values()].filter((holding) => holding.value > 0);
  const totalValue = rows.reduce((sum, holding) => sum + holding.value, 0);

  return rows
    .map((holding) => ({
      ...holding,
      ticker: tickerByCusip[holding.cusip] ?? null,
      weight: totalValue ? holding.value / totalValue : 0,
    }))
    .sort((a, b) => b.value - a.value);
}

function recentFilings(submissions) {
  const recent = submissions.filings.recent;
  const filings = [];

  for (let index = 0; index < recent.form.length; index += 1) {
    const form = recent.form[index];
    const reportDate = recent.reportDate[index];
    if (!form.startsWith("13F-HR") || reportDate < START_DATE) continue;
    filings.push({
      accession: recent.accessionNumber[index],
      filedAt: recent.filingDate[index],
      form,
      reportDate,
    });
  }

  return filings.sort((a, b) => {
    if (a.reportDate !== b.reportDate) return a.reportDate.localeCompare(b.reportDate);
    if (a.filedAt !== b.filedAt) return a.filedAt.localeCompare(b.filedAt);
    return a.accession.localeCompare(b.accession);
  });
}

async function fetchFiling(manager, filing) {
  const cik = String(Number(manager.cik));
  const accessionPath = filing.accession.replaceAll("-", "");
  const filingBase = `${SEC_ORIGIN}/Archives/edgar/data/${cik}/${accessionPath}`;
  const index = await (await secFetch(`${filingBase}/index.json`)).json();
  const files = index.directory?.item ?? [];
  const primary = files.find((file) => file.name.toLowerCase() === "primary_doc.xml");
  const informationTable = files.find((file) => {
    const name = file.name.toLowerCase();
    return name.endsWith(".xml") && name !== "primary_doc.xml" && !name.includes("xsl");
  });

  if (!primary || !informationTable) {
    throw new Error(`Could not locate filing XML files for ${filing.accession}`);
  }

  const [primaryXml, holdingsXml] = await Promise.all([
    (await secFetch(`${filingBase}/${primary.name}`)).text(),
    (await secFetch(`${filingBase}/${informationTable.name}`)).text(),
  ]);

  const parsedTable = parseInformationTable(holdingsXml, filing.filedAt);

  return {
    ...filing,
    amendmentType: tag(primaryXml, "amendmentType") || null,
    holdings: parsedTable.holdings,
    unitAdjusted: parsedTable.unitAdjusted,
    sourceUrl: `${filingBase}/${filing.accession}-index.html`,
  };
}

async function fetchManager(manager) {
  const submissionsUrl = `https://data.sec.gov/submissions/CIK${manager.cik}.json`;
  const submissions = await (await secFetch(submissionsUrl)).json();
  const filings = recentFilings(submissions);
  const byQuarter = new Map();

  for (const filing of filings) {
    const parsed = await fetchFiling(manager, filing);
    const quarter = byQuarter.get(filing.reportDate) ?? {
      reportDate: filing.reportDate,
      filedAt: filing.filedAt,
      sourceUrl: parsed.sourceUrl,
      accessions: [],
      holdings: [],
      unitAdjusted: false,
    };

    if (filing.form === "13F-HR" || parsed.amendmentType === "RESTATEMENT") {
      quarter.holdings = parsed.holdings;
      quarter.accessions = [filing.accession];
    } else {
      quarter.holdings.push(...parsed.holdings);
      quarter.accessions.push(filing.accession);
    }

    quarter.filedAt = filing.filedAt;
    quarter.sourceUrl = parsed.sourceUrl;
    quarter.unitAdjusted = parsed.unitAdjusted;
    quarter.holdings = consolidate(quarter.holdings);
    byQuarter.set(filing.reportDate, quarter);
    process.stdout.write(
      `${manager.id} ${filing.reportDate} ${filing.form} ${filing.accession}\n`,
    );
  }

  return {
    ...manager,
    entityUrl: `${SEC_ORIGIN}/edgar/browse/?CIK=${manager.cik}`,
    filings: [...byQuarter.values()].sort((a, b) =>
      a.reportDate.localeCompare(b.reportDate),
    ),
  };
}

const result = {
  generatedAt: new Date().toISOString(),
  startDate: START_DATE,
  methodology: {
    source: "SEC EDGAR Form 13F-HR filings",
    valueCurrency: "USD",
    valueBasis: "Quarter-end fair market value reported by each manager",
    coverage:
      "Section 13(f) securities only; excludes cash, shorts, most non-U.S.-listed securities and undisclosed confidential positions until amendments are filed.",
  },
  managers: [],
};

for (const manager of managers) {
  result.managers.push(await fetchManager(manager));
}

await mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
await writeFile(OUTPUT_FILE, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(`Wrote ${OUTPUT_FILE}`);
