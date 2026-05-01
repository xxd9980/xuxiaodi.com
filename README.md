# xuxiaodi.com

静态网站源码。可以使用项目内的 Node.js 脚本发布到阿里云 OSS。

## 发布到 OSS

脚本位置：

```bash
scripts/deploy-oss.js
```

先预览将要上传的文件：

```bash
OSS_ACCESS_KEY_ID='你的 AccessKey ID' \
OSS_ACCESS_KEY_SECRET='你的 AccessKey Secret' \
node scripts/deploy-oss.js --dry-run
```

确认无误后发布：

```bash
OSS_ACCESS_KEY_ID='你的 AccessKey ID' \
OSS_ACCESS_KEY_SECRET='你的 AccessKey Secret' \
node scripts/deploy-oss.js
```

默认配置：

- Bucket: `xuxiaodi-com`
- Endpoint: `oss-rg-china-mainland.aliyuncs.com`

如需覆盖默认值，可以额外传入：

```bash
OSS_BUCKET='xuxiaodi-com' \
OSS_ENDPOINT='oss-rg-china-mainland.aliyuncs.com' \
OSS_ACCESS_KEY_ID='你的 AccessKey ID' \
OSS_ACCESS_KEY_SECRET='你的 AccessKey Secret' \
node scripts/deploy-oss.js
```

注意：不要把 AccessKey 写进仓库。建议放在本机 shell 环境变量、临时命令行变量，或未提交的 `.env` 文件中。
