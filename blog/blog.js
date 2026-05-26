const blogPosts = Array.isArray(window.BLOG_POSTS) ? window.BLOG_POSTS : [];
const SITE_URL = "https://xuxiaodi.com";
const SITE_NAME = "Moody 许晓笛";

function noteUrl(post) {
  return `/blog/post.html?slug=${encodeURIComponent(post.slug)}`;
}

function absoluteUrl(path) {
  return new URL(path, SITE_URL).toString();
}

function notesFrom(era) {
  return `Notes from ${era}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function combinedSummary(post) {
  return post.summaryEn ? `${post.summary} ${post.summaryEn}` : post.summary;
}

function renderInlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label, url) => {
      const target = /^https?:\/\//.test(url)
        ? ' target="_blank" rel="noreferrer"'
        : "";

      return `<a href="${url}"${target}>${label}</a>`;
    });
}

function stripFrontMatter(markdown) {
  return markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}

function renderImage(line) {
  const image = line.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)$/);

  if (!image) {
    return "";
  }

  return `
    <figure>
      <img src="${escapeHtml(image[2])}" alt="${escapeHtml(image[1])}" loading="lazy" decoding="async" />
    </figure>
  `;
}

function isTableDivider(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function parseTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function renderMarkdownTable(lines) {
  const headers = parseTableRow(lines[0]);
  const rows = lines.slice(2).map(parseTableRow);

  return `
    <div class="markdown-table-scroll">
      <table>
        <thead>
          <tr>
            ${headers.map((header) => `<th>${renderInlineMarkdown(header)}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr>
                  ${headers
                    .map((_, index) => `<td>${renderInlineMarkdown(row[index] || "")}</td>`)
                    .join("")}
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderMarkdown(markdown) {
  const lines = stripFrontMatter(markdown).trim().split(/\r?\n/);
  const html = [];
  let listType = "";

  function closeList() {
    if (!listType) {
      return;
    }

    html.push(`</${listType}>`);
    listType = "";
  }

  function openList(type) {
    if (listType === type) {
      return;
    }

    closeList();
    html.push(`<${type}>`);
    listType = type;
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      const codeLines = [];
      index += 1;

      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }

      closeList();
      html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
      continue;
    }

    if (!trimmed) {
      closeList();
      continue;
    }

    if (/^\|.*\|\s*$/.test(trimmed) && isTableDivider(lines[index + 1] || "")) {
      const tableLines = [trimmed, lines[index + 1]];
      index += 2;

      while (index < lines.length && /^\s*\|.*\|\s*$/.test(lines[index])) {
        tableLines.push(lines[index]);
        index += 1;
      }

      index -= 1;
      closeList();
      html.push(renderMarkdownTable(tableLines));
      continue;
    }

    const image = renderImage(trimmed);

    if (image) {
      closeList();
      html.push(image);
      continue;
    }

    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      const level = Math.max(2, Math.min(4, heading[1].length));

      closeList();
      html.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    const unordered = trimmed.match(/^-\s+(.+)$/);
    if (unordered) {
      openList("ul");
      html.push(`<li>${renderInlineMarkdown(unordered[1])}</li>`);
      continue;
    }

    const ordered = trimmed.match(/^\d+\.\s+(.+)$/);
    if (ordered) {
      openList("ol");
      html.push(`<li>${renderInlineMarkdown(ordered[1])}</li>`);
      continue;
    }

    closeList();
    html.push(`<p>${renderInlineMarkdown(trimmed)}</p>`);
  }

  closeList();
  return html.join("");
}

function renderTags(tags) {
  return tags.map((tag) => `<li>${escapeHtml(tag)}</li>`).join("");
}

function renderFeaturedNotes() {
  const target = document.querySelector("[data-featured-notes]");

  if (!target) {
    return;
  }

  target.innerHTML = blogPosts
    .slice(0, 4)
    .map(
      (post, index) => `
        <li class="writing-item">
          <a class="writing-link" href="${noteUrl(post)}">
            <span class="writing-number">${String(index + 1).padStart(2, "0")}</span>
            <span class="writing-copy">
              <span class="writing-era">${notesFrom(post.era)}</span>
              <span class="writing-title">${escapeHtml(post.title)}</span>
              ${
                post.titleEn
                  ? `<span class="writing-subtitle">${escapeHtml(post.titleEn)}</span>`
                  : ""
              }
              <span class="writing-excerpt">${escapeHtml(post.summary)}</span>
              ${
                post.summaryEn
                  ? `<span class="writing-excerpt writing-excerpt-secondary">${escapeHtml(
                      post.summaryEn,
                    )}</span>`
                  : ""
              }
            </span>
          </a>
        </li>
      `,
    )
    .join("");
}

function renderBlogIndex() {
  const target = document.querySelector("[data-blog-index]");

  if (!target) {
    return;
  }

  const groups = blogPosts.reduce((memo, post) => {
    memo.set(post.era, [...(memo.get(post.era) || []), post]);
    return memo;
  }, new Map());

  target.innerHTML = [...groups.entries()]
    .map(([era, posts]) => {
      const countLabel = posts.length === 1 ? "1 note" : `${posts.length} notes`;

      return `
        <section class="blog-year-group" aria-labelledby="notes-${era}">
          <div class="blog-year-heading">
            <p class="eyebrow">Retrospective</p>
            <h2 id="notes-${era}">${notesFrom(era)}</h2>
            <span>${countLabel}</span>
          </div>
          <ol class="blog-note-list">
            ${posts
              .map(
                (post) => `
                  <li>
                    <a class="blog-note-link" href="${noteUrl(post)}">
                      <span class="blog-note-copy">
                        <span class="blog-note-title">${escapeHtml(post.title)}</span>
                        ${
                          post.titleEn
                            ? `<span class="blog-note-subtitle">${escapeHtml(post.titleEn)}</span>`
                            : ""
                        }
                        <span class="blog-note-summary">${escapeHtml(post.summary)}</span>
                        ${
                          post.summaryEn
                            ? `<span class="blog-note-summary blog-note-summary-secondary">${escapeHtml(
                                post.summaryEn,
                              )}</span>`
                            : ""
                        }
                      </span>
                      <span class="blog-note-tags" aria-label="Tags">
                        ${post.tags
                          .map((tag) => `<span>${escapeHtml(tag)}</span>`)
                          .join("")}
                      </span>
                    </a>
                  </li>
                `,
              )
              .join("")}
          </ol>
        </section>
      `;
    })
    .join("");
}

function setText(selector, value) {
  document.querySelectorAll(selector).forEach((element) => {
    element.textContent = value;
  });
}

function setOptionalText(selector, value) {
  document.querySelectorAll(selector).forEach((element) => {
    element.textContent = value || "";
    element.hidden = !value;
  });
}

function setMeta(name, value) {
  const selector = `meta[name="${name}"], meta[property="${name}"]`;
  const element = document.querySelector(selector);

  if (element) {
    element.setAttribute("content", value);
  }
}

function upsertMeta(attribute, name, value) {
  let element = document.querySelector(`meta[${attribute}="${name}"]`);

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, name);
    document.head.append(element);
  }

  element.setAttribute("content", value);
}

function setCanonical(url) {
  let element = document.querySelector('link[rel="canonical"]');

  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", "canonical");
    document.head.append(element);
  }

  element.setAttribute("href", url);
}

function setJsonLd(id, data) {
  let element = document.getElementById(id);

  if (!element) {
    element = document.createElement("script");
    element.type = "application/ld+json";
    element.id = id;
    document.head.append(element);
  }

  element.textContent = JSON.stringify(data);
}

function renderArticlePager(post) {
  const target = document.querySelector("[data-post-pager]");

  if (!target) {
    return;
  }

  const index = blogPosts.findIndex((item) => item.slug === post.slug);
  const newer = blogPosts[index - 1];
  const older = blogPosts[index + 1];

  target.innerHTML = `
    ${newer ? `<a href="${noteUrl(newer)}"><span>Newer note</span><strong>${escapeHtml(newer.title)}</strong></a>` : "<span></span>"}
    ${older ? `<a href="${noteUrl(older)}"><span>Older note</span><strong>${escapeHtml(older.title)}</strong></a>` : "<span></span>"}
  `;
}

async function renderPost() {
  const content = document.querySelector("[data-post-content]");

  if (!content) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug") || window.location.hash.slice(1);
  const post = blogPosts.find((item) => item.slug === slug);

  if (!post) {
    document.title = "Note not found | Field Notes | Moody 许晓笛";
    setText("[data-post-title]", "Note not found");
    setText("[data-post-era]", "Field Notes");
    setText("[data-post-summary]", "This note is no longer available.");
    content.innerHTML = "<p>The requested note could not be found.</p>";
    return;
  }

  const canonicalUrl = absoluteUrl(noteUrl(post));
  const summary = combinedSummary(post);

  document.title = `${post.title} | Field Notes | ${SITE_NAME}`;
  setCanonical(canonicalUrl);
  setMeta("description", summary);
  setMeta("og:title", post.title);
  setMeta("og:description", summary);
  setMeta("og:url", canonicalUrl);
  upsertMeta("name", "twitter:title", post.title);
  upsertMeta("name", "twitter:description", summary);
  setText("[data-post-title]", post.title);
  setOptionalText("[data-post-title-en]", post.titleEn);
  setText("[data-post-era]", notesFrom(post.era));
  setText("[data-post-summary]", post.summary);
  setOptionalText("[data-post-summary-en]", post.summaryEn);
  document.querySelectorAll("[data-post-tags]").forEach((element) => {
    element.innerHTML = renderTags(post.tags);
  });
  setJsonLd("post-structured-data", {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    alternativeHeadline: post.titleEn || undefined,
    description: summary,
    url: canonicalUrl,
    mainEntityOfPage: canonicalUrl,
    datePublished: post.draftedAt,
    dateModified: post.draftedAt,
    inLanguage: post.titleEn ? "zh-CN" : "en",
    keywords: post.tags.join(", "),
    author: {
      "@type": "Person",
      name: "许晓笛",
      alternateName: ["Moody Xu", "Moody"],
      url: `${SITE_URL}/`,
    },
    publisher: {
      "@type": "Person",
      name: "许晓笛",
      alternateName: ["Moody Xu", "Moody"],
      url: `${SITE_URL}/`,
    },
  });

  try {
    const response = await fetch(`/blog/${post.file}`);

    if (!response.ok) {
      throw new Error(`Unable to load ${post.file}`);
    }

    content.innerHTML = renderMarkdown(await response.text());
    renderArticlePager(post);
  } catch {
    content.innerHTML =
      "<p>This note could not be loaded. Please try again from the blog index.</p>";
  }
}

renderFeaturedNotes();
renderBlogIndex();
renderPost();
