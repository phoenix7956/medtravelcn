# 运行环境与数据治理（Node 版本 · 原生模块 · 破坏性脚本）

R142 / 2026-09-29 由 xieguanzhi 落地。以下四条是换机器前必读。

---

## 1. Node 版本必须是 22.x

`.nvmrc` 已固定 `22`，`package.json` 已声明 `engines.node = ">=22 <23"`。

**为什么**：`better-sqlite3` 是原生模块，编译时的 `NODE_MODULE_VERSION` 必须和运行时的 Node 大版本一致。
本项目 node_modules 编译于 NODE_MODULE_VERSION 127（Node 22）。用 Node 24 跑任何 db 脚本会直接炸：

```
Error [ERR_DLOPEN_FAILED]: The module '.../better_sqlite3.node' was compiled against
a different Node.js version using NODE_MODULE_VERSION 127.
This version of Node.js requires NODE_MODULE_VERSION 137.
```

这不是代码 bug，是 ABI 不匹配。**不要**把某个个人目录下的 node 可执行文件路径写进脚本。

## 2. 换机器后的标准流程

```bash
cd <项目根>
nvm use            # 读 .nvmrc → Node 22
npm install
npm rebuild better-sqlite3     # 用当前 Node 22 重编原生模块（必做）
npm run db:verify              # 校验 DB ↔ search_index.json
```

`npm rebuild better-sqlite3` 是关键一步。`npm install` 不会自动为新 Node 大版本重编已有二进制。

## 3. ⚠️ `npm run db:migrate` 是破坏性的

`scripts/migrate.mjs` 的行为是：

```sql
DELETE FROM hospitals;
DELETE FROM cities;
```

然后从 `search_index.json` 全量重灌。**它不是增量迁移。**

推论 —— 两条红线：

- **单独执行 `npm run db:migrate` 前，必须先 `npm run db:export`。**
  若 `search_index.json` 落后于 DB（例如停在 25 城/100 院，而 DB 已 31 城/124 院），
  执行 migrate 会**静默丢掉 9 月的三批入库**，且不留痕迹。
- `npm run build` 的顺序是 `db:export → db:init → db:migrate`，闭环安全；
  风险只在**手工单跑** db:migrate。

提交前请先跑 `npm run db:verify`，退出码 0 才算同步。

## 4. 数据溯源：`data_provenance` 表

`cities` 表的 `avg_cost` / `wait_time` / `growth` 三个字段历史上没有出处。
对海外患者展示未经核验的费用区间与增速，等同医疗广告承诺。

R142 起用独立表挂溯源（不 ALTER `cities`，避免污染导出结构）：

| 字段 | 含义 |
|---|---|
| `city_slug` + `field` | 溯源单元（三键唯一，field ∈ avg_cost / wait_time / growth） |
| `source_name` / `source_url` | 来源名称与链接 |
| `metric_basis` | 统计口径与时间范围 |
| `value_type` | `observed` 可追溯公开统计 / `estimated` 估算 / `unverified` 未核验 |
| `verified_at` / `maintainer` | 核验日期与维护人 |

**当前全库 93 条 = 31 城 × 3 字段，全部 `unverified`。**

规则：
1. 核验前不得把这三个字段扩散到新城市。
2. UI 上的 `estimated` 角标只能降低误导风险，**不能替代来源核验**。
3. 无法追溯的数据应下线或改写成非承诺性描述，而不是补一个来源凑数。

建表 / 补录：`npm run db:provenance`（幂等）。
