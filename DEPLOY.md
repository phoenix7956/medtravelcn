# ChinaMedGuide Astro + SQLite — Deploy Guide

## 当前状态

- ✅ Astro 7 + better-sqlite3 + 11 城 49 院 SQLite 数据库
- ✅ Production build 成功 (`npm run build`)
- ✅ 本地 node production 跑通 (HTTP 200, 2-26ms 响应)
- ✅ dev server 跑通 (`npm run dev` → http://localhost:4321)
- ❌ 还没部署到 Vercel (需要 VERCEL_TOKEN)

---

## 部署 Vercel — 老板 2 步搞定

### 步骤 1: 给 Vercel Token

老板在 https://vercel.com/account/tokens 创建一个 token (scope: Full Account), 然后:

```bash
export VERCEL_TOKEN="vercel_xxxxxxxxxxxxx"
```

或者:

```bash
vercel login
# 浏览器开 OAuth,授权后会自动存到 ~/.vercel/auth.json
```

### 步骤 2: 部署

```bash
cd /Users/feng/Desktop/ChinaMedGuide
vercel --prod --yes
```

会自动:
- 检测项目 (medtravelcn)
- 跑 `npm run build` (init-db + migrate + astro build)
- 部署到 Vercel
- 返回域名 (medtravelcn.vercel.app / medtravelcn.net)

---

## 老板以后自己加 1 城市流程(2 分钟)

```bash
# 1. 编辑 SQLite (用 DB Browser for SQLite / TablePlus / 命令行)
sqlite3 data/medtravelcn.db "INSERT INTO cities (slug, name, chinese_name, region, avg_cost) VALUES ('wuxi', 'Wuxi', '无锡', 'East China', '\$2,000-\$9,000')"

sqlite3 data/medtravelcn.db "INSERT INTO hospitals (city_slug, name, specialties, address, phone, url) VALUES ('wuxi', 'Wuxi People Hospital (无锡人民医院)', 'Cardiology, Oncology, Orthopedics', '299 Qingyang Road', '+86-510-8270-7777', 'http://www.wuxiph.com/')"

# 2. 改 Base.astro (不用! 城市自动出现在所有地方:首页 grid、nav、footer)

# 3. push + 部署
git add data/medtravelcn.db
git commit -m "Add Wuxi city with 4 hospitals"
git push origin main
vercel --prod --yes
```

或者老板装 [DB Browser for SQLite](https://sqlitebrowser.org/) GUI 改:
- 打开 `data/medtravelcn.db`
- cities 表加 1 行
- hospitals 表加 4 行
- 保存 → git push → 自动部署

---

## 技术细节(老板看一遍)

| 项 | 值 |
|---|---|
| Framework | Astro 7 (`output: 'server'`, `@astrojs/node` adapter) |
| Database | better-sqlite3 + SQLite (WAL mode) |
| 文件位置 | `data/medtravelcn.db` (60 KB) |
| Build 时自动 | init-db + migrate + astro build |
| Page count | 7 路由 (首页 + 11 城动态 + reviews + submit-review + 4 API) |
| API | reviews (GET/POST) + search (GET) + track (GET) + stats (GET) |
| 部署平台 | Vercel (已配 .vercel/project.json) |
| 域名 | medtravelcn.net |

---

## 数据备份位置

| 内容 | 路径 |
|---|---|
| Marvis 那一票(89 假城市) | `/tmp/ChinaMedGuide-Marvis-snapshot-20260627/` |
| 老纯 HTML(11 城 49 院) | `/tmp/ChinaMedGuide-html-backup-20260627/` |
| Pre-Astro 完整备份 | `/tmp/ChinaMedGuide-pre-astro-20260627/` |

---

## 下一步建议

1. **部署 Vercel**(30 min)— 等老板给 token
2. **Verify 现有 11 城数据真伪**(1 天)— 价格/wait/growth 是我设的默认值
3. **重启 daily 2 城节奏**(W2)— 老板用 SQLite GUI 加城市,每天 2 个,稳扎
4. **加 admin 页面**(可选)— 老板用浏览器改 city/hospital,不碰 SQL

---

## 已知限制

- **Vercel serverless 函数不能写本地 SQLite**(只读 fs)。生产部署后:
  - 评论 POST 写入会失败(因为 Vercel fs 是只读的临时空间)
  - 浏览量统计也类似
- **修法**: 评论 / 浏览量改用 Vercel KV(已装 @vercel/kv) 或 Vercel Postgres
- 短期方案: 评论改用 Vercel KV, 浏览量也走 KV(2 个 endpoint 改 5 行)
- 或者: 部署到自有服务器(支持 fs 写), 简单很多

如果老板用 Vercel 部署,我先把评论和浏览量迁到 Vercel KV(已装包,免费 tier 30MB 够用)。