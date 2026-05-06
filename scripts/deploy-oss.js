#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const https = require("https");
const crypto = require("crypto");

const cwd = process.cwd();
const bucket = process.env.OSS_BUCKET || "xuxiaodi-com";
const endpoint = process.env.OSS_ENDPOINT || "oss-rg-china-mainland.aliyuncs.com";
const accessKeyId = process.env.OSS_ACCESS_KEY_ID;
const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET;
const dryRun = process.argv.includes("--dry-run");

if (!accessKeyId || !accessKeySecret) {
  console.error("Missing OSS_ACCESS_KEY_ID or OSS_ACCESS_KEY_SECRET.");
  console.error("Example:");
  console.error("  OSS_ACCESS_KEY_ID='...' OSS_ACCESS_KEY_SECRET='...' node scripts/deploy-oss.js");
  process.exit(1);
}

const excludedNames = new Set([
  ".DS_Store",
  ".env",
  ".env.local",
  ".git",
  ".gitignore",
  "node_modules",
  "README.md",
  "scripts",
]);

const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "application/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
  [".svg", "image/svg+xml"],
  [".ico", "image/x-icon"],
  [".txt", "text/plain; charset=utf-8"],
  [".xml", "application/xml; charset=utf-8"],
  [".pdf", "application/pdf"],
]);

const longCacheExtensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico"]);
const shortCacheExtensions = new Set([".css", ".js", ".json", ".txt", ".xml"]);

function objectKey(filePath) {
  return path.relative(cwd, filePath).split(path.sep).join("/");
}

function cacheControlFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".html") {
    return "no-cache";
  }

  if (longCacheExtensions.has(ext)) {
    return "public, max-age=2592000";
  }

  if (shortCacheExtensions.has(ext)) {
    return "public, max-age=3600";
  }

  return "public, max-age=86400";
}

function requestPathForKey(key) {
  return "/" + key.split("/").map(encodeURIComponent).join("/");
}

function xmlTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}>([^<]+)</${tag}>`));
  return match ? match[1] : "";
}

function sign(method, canonicalResource, headers, contentType = "", contentMd5 = "") {
  const ossHeaders = Object.entries(headers)
    .filter(([name]) => name.toLowerCase().startsWith("x-oss-"))
    .map(([name, value]) => [name.toLowerCase(), String(value).trim()])
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => `${name}:${value}\n`)
    .join("");

  const stringToSign = [
    method,
    contentMd5,
    contentType,
    headers.Date,
    ossHeaders + canonicalResource,
  ].join("\n");

  return crypto.createHmac("sha1", accessKeySecret).update(stringToSign).digest("base64");
}

function ossRequest({ method, key = "", body = Buffer.alloc(0), headers = {} }) {
  const host = `${bucket}.${endpoint}`;
  const requestPath = key ? requestPathForKey(key) : "/";
  const canonicalResource = `/${bucket}/${key}`;
  const finalHeaders = {
    Date: new Date().toUTCString(),
    Host: host,
    ...headers,
  };

  if (body.length > 0) {
    finalHeaders["Content-Length"] = body.length;
  }

  const contentType = finalHeaders["Content-Type"] || "";
  finalHeaders.Authorization = `OSS ${accessKeyId}:${sign(method, canonicalResource, finalHeaders, contentType)}`;

  return new Promise((resolve, reject) => {
    const req = https.request(
      { method, hostname: host, path: requestPath, headers: finalHeaders, timeout: 20000 },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      }
    );

    req.on("timeout", () => req.destroy(new Error(`Request timed out for ${host}${requestPath}`)));
    req.on("error", reject);
    if (body.length > 0) req.write(body);
    req.end();
  });
}

function shouldSkip(entryName) {
  return excludedNames.has(entryName) || entryName.startsWith(".env.");
}

function collectFiles(dir) {
  const files = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (shouldSkip(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

async function uploadFile(filePath) {
  const key = objectKey(filePath);
  const body = fs.readFileSync(filePath);
  const contentType = contentTypes.get(path.extname(filePath).toLowerCase()) || "application/octet-stream";
  const cacheControl = cacheControlFor(filePath);

  if (dryRun) {
    console.log(`DRY ${key} (${body.length} bytes, ${contentType}, ${cacheControl})`);
    return;
  }

  const res = await ossRequest({
    method: "PUT",
    key,
    body,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": cacheControl,
    },
  });

  if (res.statusCode < 200 || res.statusCode >= 300) {
    const code = xmlTag(res.body, "Code") || res.statusCode;
    const message = xmlTag(res.body, "Message") || res.body.slice(0, 200);
    const ossEndpoint = xmlTag(res.body, "Endpoint");
    throw new Error(
      `Failed to upload ${key}: ${code} ${message}` + (ossEndpoint ? ` Endpoint=${ossEndpoint}` : "")
    );
  }

  console.log(`PUT ${key} (${body.length} bytes, ${contentType}, ${cacheControl})`);
}

(async () => {
  const files = collectFiles(cwd);
  console.log(`Bucket: ${bucket}`);
  console.log(`Endpoint: ${endpoint}`);
  console.log(`${dryRun ? "Checking" : "Uploading"} ${files.length} file(s)...`);

  for (const file of files) {
    await uploadFile(file);
  }

  console.log(dryRun ? "Dry run complete." : "Upload complete.");
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
