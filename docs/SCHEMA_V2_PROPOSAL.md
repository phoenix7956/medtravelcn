# ChinaMedGuide · Schema V2 提案

> **状态**：草案（PROPOSED · NOT MIGRATED）
> **作者**：谢观止（xieguanzhi）
> **日期**：2026-09-30
> **R142 红线**：医疗内容（YMYL），新增字段必须有可追溯来源，迁移前需老板/墨核准

---

## 一、现状盘点

### 既有 `hospitals` 表（9 字段 + meta）

```
id, city_slug, name, chinese_name, specialties, address, phone, url, type, sort_order, created_at
```

### 体检结果（与 R142 一致）

- `chinese_name` 缺 42/124（33.9%）
- `url` 缺 14/124（11.3%）
- 城市 `intro` 全空（0/31）
- 城市 `region` / `avg_cost` / `wait_time` 缺 6/31
- **`data_provenance` 已建，93 条 = 31 城 × 3 字段，全部 `unverified`** ← R142 治理成果

### 体检外的隐性缺口（医疗旅游 SEO + YMYL 审核硬要求）

| 缺口 | 后果 |
|---|---|
| 无 `intl_clinic` / 无 `jci_accredited` | 海外患者无法快速判断该院是否真接待外国人 |
| 无 `english_website` / 无 `english_staff` | Google E-E-A-T / HCU 直接降权 |
| 无 `languages` | SEO 关键词"Chinese hospital English-speaking" 无法命中 |
| 无 `visa_assistance` / 无 `payment_methods` | 跨境支付 + 医疗签证咨询是医疗旅游最常见的问询 |
| 无 `accommodation_options` / 无 `nearby_hotel` | 海外患者家属的强需求 |
| 无 `accreditations` (JCI / CAP / ISO) | 国际第三方认证是国外保险公司直付前置条件 |
| 无 `international_patients_per_year` | 规模指标，营销话术 |
| 无 `director_english_name` | 国际 MDT 转诊的硬信息 |
| 无 `data_last_verified_at` | YMYL 内容必须可追踪时效性，否则会被 Google 标注"过期" |

---

## 二、Schema V2 设计

### 2.1 `hospitals` 表扩展（向后兼容）

**原则**：不破坏现有 124 院。**新增列均为 NULLABLE，旧数据可保留 unverified**。

```sql
-- 国际医疗核心信息
ALTER TABLE hospitals ADD COLUMN jci_accredited INTEGER DEFAULT 0;          -- boolean
ALTER TABLE hospitals ADD COLUMN intl_clinic TEXT;                          -- 国际医疗部名（如 "International Medical Center"）
ALTER TABLE hospitals ADD COLUMN intl_clinic_url TEXT;                      -- 国际部页面 URL
ALTER TABLE hospitals ADD COLUMN english_website TEXT;                      -- 英文站 URL（独立子域或路径）
ALTER TABLE hospitals ADD COLUMN languages TEXT;                            -- 逗号分隔：English, Japanese, Korean, Arabic, Russian
ALTER TABLE hospitals ADD COLUMN interpreters TEXT;                         -- 同上字段语义更清晰
ALTER TABLE hospitals ADD COLUMN accreditations TEXT;                       -- JCI / CAP / ISO 9001 / JCQHC / Magnet
ALTER TABLE hospitals ADD COLUMN international_patients_per_year INTEGER;   -- 年国际患者数（不填=未知）
ALTER TABLE hospitals ADD COLUMN international_insurance TEXT;              -- 直付保险清单：BUPA, Aetna, Cigna, MSH, etc.

-- 服务能力
ALTER TABLE hospitals ADD COLUMN visa_assistance INTEGER DEFAULT 0;          -- 是否提供签证函
ALTER TABLE hospitals ADD COLUMN airport_pickup INTEGER DEFAULT 0;           -- 是否机场接送
ALTER TABLE hospitals ADD COLUMN accommodation_options TEXT;                -- 院内酒店/合作酒店
ALTER TABLE hospitals ADD COLUMN payment_methods TEXT;                      -- 现金 / 信用卡 / 国际汇款 / 支付宝国际版 / WeChat Pay 国际
ALTER TABLE hospitals ADD COLUMN cn_domestic_insurance TEXT;                -- 医保直连（如：省医保 / 市医保 / 跨省异地）

-- 联系扩展
ALTER TABLE hospitals ADD COLUMN international_hotline TEXT;                -- 国际部专用电话
ALTER TABLE hospitals ADD COLUMN email TEXT;                                -- 国际部邮箱
ALTER TABLE hospitals ADD COLUMN appointment_url TEXT;                      -- 在线预约入口
ALTER TABLE hospitals ADD COLUMN director_english_name TEXT;                -- 院长英文名

-- 数据治理（YMYL 硬要求）
ALTER TABLE hospitals ADD COLUMN data_last_verified_at TEXT;                -- ISO8601
ALTER TABLE hospitals ADD COLUMN data_verifier TEXT;                        -- 维护者 ID（与 data_provenance.maintainer 一致）
ALTER TABLE hospitals ADD COLUMN data_quality_grade TEXT                    -- A=多源核验 / B=单源官方 / C=二手信息
    DEFAULT 'C' CHECK (data_quality_grade IN ('A', 'B', 'C'));
```

### 2.2 `cities` 表扩展

```sql
ALTER TABLE cities ADD COLUMN climate TEXT;                                 -- 气候简述（影响康复）
ALTER TABLE cities ADD COLUMN airport_code TEXT;                            -- IATA 代码（如 PEK / SHA / HGH）
ALTER TABLE cities ADD COLUMN timezone TEXT DEFAULT 'GMT+8';               -- 时区
ALTER TABLE cities ADD COLUMN language_note TEXT;                           -- 当地主要方言
ALTER TABLE cities ADD COLUMN english_friendly_score INTEGER                 -- 1-5 评级（社区评估）
    CHECK (english_friendly_score BETWEEN 1 AND 5);
```

### 2.3 新表 `hospital_accreditations`（多对一）

JCI / CAP / Magnet 等可能同家医院有多个认证周期：

```sql
CREATE TABLE IF NOT EXISTS hospital_accreditations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hospital_id INTEGER NOT NULL,
  body TEXT NOT NULL,                          -- 'JCI', 'CAP', 'JCQHC', 'Magnet', 'ISO9001'
  accredited_at TEXT,                          -- 认证通过日期
  expires_at TEXT,                             -- 有效期
  status TEXT DEFAULT 'active' CHECK (status IN ('active','expired','suspended')),
  source_url TEXT,
  verified_at TEXT,
  FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE
);
CREATE INDEX idx_accred_hospital ON hospital_accreditations(hospital_id);
```

### 2.4 既有 `data_provenance` 表扩展（与 R142 兼容）

```sql
-- 当前只覆盖 3 字段（avg_cost/wait_time/growth），扩展到所有外承诺字段
-- 不破坏已有 93 条，用 INSERT OR IGNORE 增量补
INSERT OR IGNORE INTO data_provenance (city_slug, field, value_type, maintainer)
VALUES
  (?, 'jci_accredited', 'unverified', 'xieguanzhi'),
  (?, 'intl_clinic_exists', 'unverified', 'xieguanzhi'),
  (?, 'english_website_exists', 'unverified', 'xieguanzhi'),
  (?, 'visa_assistance', 'unverified', 'xieguanzhi'),
  -- ...每个新字段一条
;
```

---

## 三、数据来源指南（按字段）

| 字段 | 第一来源 | 第二来源 | 取证难度 |
|---|---|---|---|
| `jci_accredited` | [JCI 官方 Accredited Organizations 列表](https://www.jointcommissioninternational.org/) | 医院官网"Accreditations"页 | 🟡 中（中文医院 JCI 多已过期，需逐家核对当前状态）|
| `intl_clinic` | 医院官网"国际医疗部"/"International Medical Center"页 | 卫健委公开新闻 | 🟢 易 |
| `english_website` | WHOIS 子域 / sitemap 检查 | 医院官网 footer 切换按钮 | 🟢 易 |
| `languages` | 国际部介绍页 | 招聘启事（要求语言） | 🟢 易 |
| `accreditations` | JCI/CAP/ISO 官方列表 | 医院年度报告 | 🟡 中 |
| `international_patients_per_year` | 医院年度报告/财报 | 国际部介绍页文案 | 🔴 难（多数医院不公开）|
| `visa_assistance` | 国际部 FAQ / 公众号推文 | 第三方医疗中介 | 🟡 中 |
| `payment_methods` | 国际部 FAQ | 公众号"预约须知" | 🟢 易 |
| `international_insurance` | 国际部 FAQ | 第三方中介 | 🟢 易 |
| `accommodation_options` | 国际部附近酒店 | 医院公众号 | 🟢 易 |
| `data_last_verified_at` | 每次核验脚本写入 | — | 🟢 易 |

---

## 四、迁移策略（**不动** vs **动** vs **渐进**）

### 🟢 推荐：渐进（按字段增量补，不一次性 ALTER）

| 阶段 | 内容 | 触发条件 |
|---|---|---|
| Phase 0（当前） | 维持现状，R142 治理三字段溯源 | ✅ 已完成 |
| Phase 1 | 新增 `intl_clinic` / `english_website` / `languages` 三列 | 老板批准，且 `data_provenance` 有 50% 城达 observed |
| Phase 2 | 新增 `accreditations` + `hospital_accreditations` 表 | JCI 核验 SOP 建立后 |
| Phase 3 | 新增 `visa_assistance` / `payment_methods` / `international_insurance` | 国际部 FAQ 模板抽取完成 |
| Phase 4 | 数据质量评级（`data_quality_grade`）上线，前端按 A/B/C 标识 | UI 改版时同步 |

**原则**：每 Phase 写一份 `MIGRATION_YYYY-MM-DD-phaseN.md` 记录：加了什么列、回滚 SQL、影响哪些 script。

### 🔴 不推荐：一次性 ALTER 全表

- 风险：影响 124 院存量数据，snapshot.json 导出未测，可能 break Vercel 部署
- 缓解方案：必须先 `npm run db:export` → `gen-snapshot.mjs` → 完整 dry-run 才允许写入

---

## 五、与既有 R142 治理的衔接

- ✅ 所有 `data_quality_grade = 'C'`（二手信息）的医院，在 UI 上加 `?verified=false` 视觉标识
- ✅ 任何字段写入前必须先在 `data_provenance` 留痕（`value_type` 至少 `estimated`）
- ✅ `observed` 数据必须有 `source_url` + `verified_at` + `maintainer`
- ❌ 不允许在 batch JSON 中**只写医院数据不写溯源** —— 摄入脚本会拒绝入库

---

## 六、需要老板决策的点

| # | 决策 | 默认方案 |
|---|---|---|
| 1 | 是否批准 Phase 1 三列新增？ | 老板先看 batch-001 效果再定 |
| 2 | 数据质量评级（`A/B/C`）是否对海外用户展示？ | 默认 **不展示**（避免无意义焦虑），仅内部维护 |
| 3 | 第三方/AI 中介（chinamedlink / chinamedservices）数据能否采信？ | **不采信**，仅作 found source 指引 |
| 4 | 当 JCI 状态过期（医院未续证），是改 `status='expired'` 还是维持原值？ | 建议改 `expired`，并降 `data_quality_grade` 为 `C` |
| 5 | 涉及未公开数据的字段（如 `international_patients_per_year`）缺失时如何展示？ | **不显示**该字段，避免误导 |

---

**附**：本文档不对 `medtravelcn.db` 做任何 ALTER，需老板明示后方可动。