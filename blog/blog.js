const blogPosts = Array.isArray(window.BLOG_POSTS) ? window.BLOG_POSTS : [];

function noteUrl(post) {
  return `/blog/post.html?slug=${encodeURIComponent(post.slug)}`;
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

function renderInlineMarkdown(value) {
  return escapeHtml(value).replace(/`([^`]+)`/g, "<code>$1</code>");
}

function stripFrontMatter(markdown) {
  return markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
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

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed) {
      closeList();
      return;
    }

    const heading = trimmed.match(/^##\s+(.+)$/);
    if (heading) {
      closeList();
      html.push(`<h2>${renderInlineMarkdown(heading[1])}</h2>`);
      return;
    }

    const unordered = trimmed.match(/^-\s+(.+)$/);
    if (unordered) {
      openList("ul");
      html.push(`<li>${renderInlineMarkdown(unordered[1])}</li>`);
      return;
    }

    const ordered = trimmed.match(/^\d+\.\s+(.+)$/);
    if (ordered) {
      openList("ol");
      html.push(`<li>${renderInlineMarkdown(ordered[1])}</li>`);
      return;
    }

    closeList();
    html.push(`<p>${renderInlineMarkdown(trimmed)}</p>`);
  });

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
              <span class="writing-excerpt">${escapeHtml(post.summary)}</span>
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
                        <span class="blog-note-summary">${escapeHtml(post.summary)}</span>
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

function setMeta(name, value) {
  const selector = `meta[name="${name}"], meta[property="${name}"]`;
  const element = document.querySelector(selector);

  if (element) {
    element.setAttribute("content", value);
  }
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

  document.title = `${post.title} | Field Notes | Moody 许晓笛`;
  setMeta("description", post.summary);
  setMeta("og:title", post.title);
  setMeta("og:description", post.summary);
  setText("[data-post-title]", post.title);
  setText("[data-post-era]", notesFrom(post.era));
  setText("[data-post-summary]", post.summary);
  document.querySelectorAll("[data-post-tags]").forEach((element) => {
    element.innerHTML = renderTags(post.tags);
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
