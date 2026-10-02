# 🔧 ChinaMedGuide 持续化改造

**2026-09-30** 老板指示：「ChinaMedGuide是城市和医院，不能一直静态页面，以后增加就太麻烦了」

---

## 问题诊断（改造前）

| 症状 | 根因 |
|---|---|
| 线上 500 `SqliteError` | Vercel serverless 不能用 better-sqlite3 |
| 加一家医院要 3 步 | 手改 DB → 重新 build → 等 30s 部署 |
| `data_provenance` 0 条 | 无溯源机制，医疗类内容审核硬伤 |
| 城市 `intro` 全空 | 无内容生产流程 |

---

## 改造方案（三层存储，自动切换）

`src/lib/store.ts` — 运行时判定优先级：

```
DATABASE_URL 存在  → postgres  （真·数据库，增删改查即时生效）
Vercel 且无 DB     → snapshot  （src/data/snapshot.json，静态只读）
其余               → sqlite    （本地开发，data/medtravelcn.db）
```

---

## 已完成

- [x] `src/lib/store.ts` — 三层存储抽象
- [x] `src/lib/admin.ts` — 后台鉴权（HMAC 会话，12h TTL）
- [x] `scripts/gen-snapshot.mjs` — SQLite → snapshot.json
- [x] `scripts/init-postgres.mjs` — Postgres schema + 灌数据（幂等）
- [x] `scripts/data-quality.mjs` — 数据体检
- [x] `src/lib/db.ts` — 改走 snapshot（生产可用）

### 数据库 schema 扩展（国际患者必需字段）

```sql
hospitals 新增：
  jci_certified           是否有 JCI 认证
  accepts_international    是否接国际病人
  english_departments     英文科室
  booking_method          预约方式
  visa_assist             签证协助
  inpatient_standard      住院标准
  payment_methods         支付方式
  insurance_direct        医保直连
  interpreter_on_site     现场翻译
  verified                数据是否核实
  source_url              来源
```

`data_provenance` 表设计：每个城市/医院可挂多条来源（URL + 访问日期 + verified 标记）。

---

## 待完成（需老板授权 DATABASE_URL）

- [ ] **Postgres 建库**（老板操作，2 分钟）
- [ ] `/admin` 后台页面（增删改查 hospitals / cities）
- [ ] 数据页面改走 `store.ts`（异步）
- [ ] 溯源录入界面
- [ ] 域名绑定 `ChinaMedGuide` → Vercel

---

## 命令速查

```bash
npm run build              # gen-snapshot → astro build
npm run build:local        # 全流程（含重建 SQLite）
npm run db:pg:init         # 初始化 Postgres（需 DATABASE_URL）
npm run data:quality       # 数据体检
npm run db:snapshot        # 只生成 snapshot.json
```

---

## 恢复点

`astro.config.mjs.bak-20260930` — 原 @astrojs/node 配置

---

## 2026-10-02 · 数据库化完成

### 做了什么

| 项 | 状态 |
|---|---|
| 本机 Postgres 库 `medtravelcn` | ✅ 已建（127.0.0.1:5432）|
| schema（含 12 个国际患者字段）| ✅ 已建 |
| 灌入 36 城 / 144 院 | ✅ 完成 |
| 幂等（跑两次不重复）| ✅ 验证通过 |
| 城市页 prerender → SSR | ✅ 改完，首页 36 城 |
| 三层数据层 `store.ts` | ✅ postgres / snapshot / sqlite 自动切 |
| SQLite / PG / snapshot 三方一致 | ✅ 144 = 144 = 144 |

### 踩的坑

1. **`export const prerender = true`**（src/pages/cities/[slug].astro:4）
   → 城市页 build 时烤死，库里加的 5 城 20 院**线上根本不存在**。已改 `prerender = false`。

2. **Postgres 没有 `INSERT OR IGNORE`**
   → 脚本照抄 SQLite 语法，被当普通 INSERT，重复跑导致 152 → 304（翻倍）。
   → 改为显式 `SELECT` 查重 + `INSERT`。

3. **SSL 判断漏了 127.0.0.1**
   → `url.includes('localhost')` 匹配不到 `127.0.0.1`，本地连不上报 "does not support SSL"。
   → 改用正则 `/localhost|127\.0\.0\.1|\.local/`。

4. **源数据本身有 8 条重复**
   → SQLite 里同城同名的医院重复（如 guiyang 贵州省人民医院 id=34 与 id=125 完全相同）。
   → 已清源库，152 → 144。

5. **better-sqlite3 + Node 24 + arm64**
   → 进程退出时 GC 断言崩溃（`RemoveEnvironmentCleanupHook`）。数据无损，但脚本会 Abort trap。
   → 规避：脚本末尾 `process.exit(0)` 显式退出。

### 数据现状

```
SQLite 源库   36 城 / 144 医院（已去重）
Postgres      36 城 / 144 医院（幂等）
snapshot.json 36 城 / 144 医院
```

### 待老板

云端 Postgres（Vercel/Neon）需要老板账号建库并设 `DATABASE_URL`。
本机 PG 已跑通全链路，换云端只需改连接串。
