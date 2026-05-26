---
title: "阿里云多数据库稳定性保障建议"
title_en: "Reliability Assurance Recommendations for Alibaba Cloud Multi-Database Environments"
slug: "alibaba-cloud-multi-database-reliability"
era: "2026"
drafted_at: "2026-05-25"
summary: "面向 PolarDB-X、RDS MySQL、PolarDB MySQL、AnalyticDB for MySQL 和 AnalyticDB for PostgreSQL 的稳定性保障建议，聚焦日常巡检、告警响应和故障快速排查。"
summary_en: "A practical reliability guide for PolarDB-X, RDS MySQL, PolarDB MySQL, AnalyticDB for MySQL, and AnalyticDB for PostgreSQL, centered on inspection, alert response, and rapid troubleshooting."
tags: ["Database", "Reliability", "Alibaba Cloud", "DAS"]
---

## 中文摘要

本文面向 PolarDB-X、RDS MySQL、PolarDB MySQL、AnalyticDB for MySQL 和 AnalyticDB for PostgreSQL 等阿里云数据库产品，整理一套可落地的稳定性保障建议。文章围绕日常巡检与故障快速排查两个高频场景，说明如何结合云监控、DAS/DAS Agent、ADBAgent 以及各数据库产品控制台能力，完成资源水位观察、SQL 风险识别、会话与锁定位、空间增长分析、告警证据采集和恢复验证。

## English Abstract

This article provides a practical reliability assurance guide for Alibaba Cloud database environments that include PolarDB-X, RDS MySQL, PolarDB MySQL, AnalyticDB for MySQL, and AnalyticDB for PostgreSQL. It focuses on two common operational scenarios: routine inspection and rapid incident troubleshooting. The guide explains how to use CloudMonitor, DAS/DAS Agent, ADBAgent, and native database console capabilities to inspect resource utilization, identify SQL risks, analyze sessions and locks, track storage growth, collect alert evidence, and verify recovery.

适用产品：PolarDB-X、RDS MySQL、PolarDB MySQL、AnalyticDB for MySQL、AnalyticDB for PostgreSQL。

本文围绕两个高频稳定性场景：**巡检场景** 和 **故障快速排查场景**，提供基于阿里云原生可观测与数据库自治能力的操作建议。相关流程优先使用 **云监控 + DAS/DAS Agent + 数据库产品控制台原生能力**，便于在现有云产品能力范围内快速落地。

## 1. 能力范围

本文建议优先采用以下阿里云原生能力：

| 类别 | 使用能力 | 定位 |
| --- | --- | --- |
| 云监控 | 数据库实例基础指标、告警规则、告警联系人、告警历史、资源水位趋势 | 用于发现异常、统一查看资源水位、支撑告警通知与响应 |
| DAS | DAS Agent、SQL 洞察和审计、性能趋势、实时性能、会话管理、锁分析、空间分析、SQL Review、诊断报告等 | 用于已接入 DAS 实例的问题诊断和根因分析；不同数据库引擎支持的 DAS 功能不同，需按下方适用性矩阵选择 |
| 数据库产品控制台 | RDS、PolarDB、PolarDB-X、ADB MySQL、ADB PG 的实例监控、慢日志、诊断入口、参数/规格/备份/节点状态 | 用于产品侧细节确认和处置入口；ADB 两个产品优先使用各自控制台诊断能力 |

本文聚焦云监控与阿里云数据库产品线原生诊断能力，相关操作以控制台和产品内置能力为主。

文中的截图均引用自阿里云官方帮助文档。若离线阅读时图片无法加载，可通过截图下方的来源链接查看原始操作说明。

### 1.1 ADB 产品处理原则

依据 DAS Agent 官方支持范围，DAS Agent 支持 MySQL 类、PostgreSQL 类、Redis/Tair、MongoDB、SQL Server 和 PolarDB-X，未将 AnalyticDB for MySQL 和 AnalyticDB for PostgreSQL 列为直接支持对象。因此，ADB MySQL/ADB PG 不作为 DAS Agent 直连接入对象。

ADB 产品建议采用以下诊断入口：

| 产品 | 推荐诊断入口 | 适用场景 |
| --- | --- | --- |
| AnalyticDB for MySQL | ADBAgent 诊断 Skill、ADB 控制台 SQL 诊断、一键诊断、查询监控图、SQL 列表、表级分析 | 慢查询诊断、运行中 SQL 分析、查询排队、资源组争抢、表设计/分布/分区/数据倾斜问题 |
| AnalyticDB for PostgreSQL | ADB PG 控制台慢 SQL 列表、慢查询诊断、查询分析、执行计划详情 | 慢 SQL 定位、执行计划分析、MPP 查询耗时、长查询和资源消耗问题 |

### 1.2 DAS 功能适用性矩阵

以下矩阵用于明确后续巡检和故障快速排查流程中的功能适用范围，避免将单产品能力表述为通用能力。实际落地时还需结合实例系列、版本、地域、DAS 企业版开通情况以及控制台实际展示入口确认。

| 能力 | RDS MySQL | PolarDB MySQL | PolarDB-X | ADB MySQL | ADB PG | 使用说明 |
| --- | --- | --- | --- | --- | --- | --- |
| DAS 接入 | 支持 | 支持 | 支持 PolarDB-X 2.0 | 不作为 DAS 直连对象 | 不作为 DAS 直连对象 | ADB 两个产品使用各自产品控制台能力 |
| DAS Agent | 支持 | 支持 | 支持 | 不直接使用 | 不直接使用 | RDS/PolarDB MySQL/PolarDB-X 可优先使用 DAS Agent；ADB MySQL 使用 ADBAgent，ADB PG 使用控制台诊断 |
| 性能趋势/实时性能 | 支持 | 支持 | 支持 | 使用 ADB 控制台和云监控 | 使用 ADB PG 控制台和云监控 | 可作为 RDS/PolarDB/PolarDB-X 的通用排查入口 |
| SQL 洞察和审计 | 支持，需开启相关能力 | 支持，需开启相关能力 | 支持 PolarDB-X 2.0，受地域和企业版约束 | 使用 SQL 诊断、查询监控图、SQL 列表 | 使用慢 SQL 列表、查询分析 | SQL 风险分析需按产品能力选择入口 |
| SQL Review | 基础系列不支持，高可用/三节点/集群系列支持 | 支持 | 不作为通用推荐入口 | 不支持 DAS SQL Review | 不支持 DAS SQL Review | SQL Review 适用于 RDS MySQL 支持系列和 PolarDB MySQL |
| 会话管理/实例会话 | 支持 | 支持 | 支持实例会话和 10 秒 SQL 分析 | 使用运行中查询、SQL 诊断 | 使用查询分析、慢 SQL 列表 | 会话类排查可覆盖前三类数据库，ADB 使用产品控制台入口 |
| 锁分析 | 支持 | 支持 | 不作为通用推荐入口，优先查看实例会话、慢日志和长事务日志 | 不支持 DAS 锁分析 | 不支持 DAS 锁分析 | 锁分析适用于 RDS MySQL 和 PolarDB MySQL |
| 空间分析 | 支持 | 支持 | 支持 | 使用 ADBAgent 空间诊断和控制台空间信息 | 使用控制台资源/存储信息 | 空间巡检前三类数据库可使用 DAS，ADB 使用产品原生入口 |
| 诊断报告/巡检评分 | 支持 | 支持 | 不作为通用推荐入口 | 不支持 DAS 诊断报告 | 不支持 DAS 诊断报告 | 诊断报告不作为 PolarDB-X 和 ADB 的通用入口 |
| 慢日志/慢查询 | 支持，部分系列能力有差异 | 支持 | 支持 CN/DN 慢日志，标准版能力有差异 | 使用 SQL 诊断和 ADBAgent 慢查询诊断 | 使用慢 SQL 列表和慢查询诊断 | 慢查询分析是各产品都可落地的主线，但入口不同 |

## 2. 基础准备

在执行巡检和故障排查前，建议先完成以下准备：

1. 实例纳管：确认核心 RDS MySQL、PolarDB MySQL、PolarDB-X 已接入 DAS；支持 DAS Agent 的实例优先开通 DAS Agent。ADB MySQL 和 ADB PG 不作为 DAS Agent 直连对象，使用 ADB 控制台原生诊断能力。
2. 标签规范：为实例补齐业务系统、环境、负责人、等级、地域、实例角色、告警联系人。
3. 云监控告警：按实例等级配置 CPU、内存、连接数、磁盘、IOPS、吞吐、只读/主备延迟、节点状态等告警。
4. DAS 能力确认：对 RDS MySQL 和 PolarDB MySQL，确认性能趋势、实时性能、SQL 洞察和审计、慢日志、会话管理、空间分析可用；锁分析、SQL Review、诊断报告需按实例系列和控制台入口确认。对 PolarDB-X，重点确认性能趋势、实时性能、实例会话、10 秒 SQL 分析、SQL 洞察和审计、慢日志、空间分析可用，SQL Review、诊断报告、锁分析不作为通用推荐入口。
5. ADB 能力确认：对 ADB MySQL 确认 ADBAgent 诊断 Skill、SQL 诊断、一键诊断可用；对 ADB PG 确认慢 SQL 列表、慢查询诊断、查询分析和执行计划查看入口可用。
6. 权限控制：建议 DBA/SRE 优先使用只读诊断权限；涉及终止（Kill）会话、参数调整、扩缩容、DDL 等生产处置动作时，建议按照客户侧既有变更或应急流程确认后执行。

## 3. 巡检场景

### 3.1 巡检目标

巡检的目标是提前发现稳定性风险，避免问题发展成线上故障。重点回答四个问题：

1. 资源水位是否逼近瓶颈。
2. SQL 和会话是否出现劣化。
3. 空间、锁、延迟、备份、节点状态是否有风险。
4. 是否存在需要 DBA、研发或业务负责人协同处理的治理项。

### 3.2 巡检流程

| 步骤 | 操作 | 使用能力 | 输出 |
| --- | --- | --- | --- |
| 1. 筛选巡检对象 | 按业务等级、实例标签、近期告警和核心链路筛选实例 | 云监控、数据库实例标签 | 巡检实例清单 |
| 2. 查看资源水位 | 查看 CPU、内存、连接数、磁盘、IOPS、吞吐、网络、延迟等趋势 | 云监控、数据库控制台监控 | 高水位实例列表 |
| 3. 查看告警历史 | 可按近 7 天、30 天或约定周期汇总告警，关注重复告警和持续告警 | 云监控告警历史 | 高频告警清单 |
| 4. 进入诊断入口 | RDS MySQL/PolarDB MySQL 查看 DAS 性能趋势、诊断报告、SQL 洞察等入口；PolarDB-X 查看 DAS 性能趋势、实时性能、实例会话、SQL 洞察/慢日志和 PolarDB-X 控制台诊断入口；ADB MySQL/ADB PG 进入各自控制台诊断入口 | DAS、DAS Agent、数据库产品控制台 | 诊断摘要 |
| 5. 分析 SQL 风险 | RDS MySQL/PolarDB MySQL 查看 TOP SQL、慢 SQL、新增 SQL、失败 SQL、扫描行数异常 SQL，支持时使用 SQL Review；PolarDB-X 查看 SQL 洞察和审计、CN/DN 慢日志、执行计划；ADB MySQL 查看 SQL 诊断，ADB PG 查看慢 SQL 列表/查询分析 | DAS SQL 洞察、慢 SQL、SQL Review、ADB 控制台、PolarDB-X 控制台 | SQL 治理清单 |
| 6. 分析会话和锁 | RDS MySQL/PolarDB MySQL 查看活跃会话、长事务、锁等待、死锁、阻塞链路；PolarDB-X 查看实例会话、10 秒 SQL 分析、长事务日志；ADB 重点查看运行中查询、查询排队和执行计划 | DAS 会话管理、DAS 锁分析、PolarDB-X 控制台、ADB 控制台 | 会话/锁风险清单 |
| 7. 分析空间风险 | RDS MySQL/PolarDB MySQL/PolarDB-X 查看 DAS 空间分析和产品控制台空间信息；ADB MySQL 使用 ADBAgent 空间诊断和控制台空间信息；ADB PG 使用控制台资源/存储信息 | DAS 空间分析、ADBAgent、数据库产品控制台 | 空间治理建议 |
| 8. 生成巡检结论 | RDS MySQL/PolarDB MySQL 结合 DAS Agent、DAS 诊断报告和 SQL Review 输出结论；PolarDB-X 结合 DAS Agent、SQL 洞察、慢日志、实例会话和控制台诊断输出结论；ADB MySQL 使用 ADBAgent/控制台诊断结论，ADB PG 使用慢 SQL/执行计划分析结论；结合业务背景补充影响范围 | DAS Agent、DAS 诊断报告、ADBAgent、数据库产品控制台 | 巡检报告 |

### 3.3 巡检操作截图参考

为便于现场沟通和操作定位，建议按照“资源水位、巡检/诊断入口、SQL 与空间分析、ADB 产品控制台诊断”的顺序展开。以下截图用于定位入口和结果页，实际可见菜单以实例类型、版本、权限和已开通能力为准。

**RDS 标准监控：查看资源水位和指标趋势**

![RDS MySQL 标准监控趋势图](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5272515571/p995861.png)

来源：[查看 RDS MySQL 监控指标](https://help.aliyun.com/zh/rds/apsaradb-rds-for-mysql/view-the-metrics-of-an-apsaradb-rds-for-mysql-instance)

**RDS MySQL：查看实例巡检报告（如已开通 RDS AI 助手，可作为辅助诊断入口）**

![RDS MySQL 实例巡检报告](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1308820771/p1052672.png)

来源：[RDS 实例巡检功能](https://help.aliyun.com/zh/rds/apsaradb-rds-for-mysql/overview-for-rds-instance-health-check)

**DAS Agent：进入智能诊断入口**

![DAS Agent 入口](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3956409671/p1047461.png)

来源：[DAS Agent](https://help.aliyun.com/zh/das/user-guide/das-agent)

**SQL Review：查看 SQL 负载详情概览（适用于 RDS MySQL 支持系列和 PolarDB MySQL）**

![SQL Review 详情概览](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8507420561/p430865.png)

来源：[SQL Review](https://help.aliyun.com/zh/das/user-guide/sql-review)

**SQL Review：查看索引优化建议（适用于 RDS MySQL 支持系列和 PolarDB MySQL）**

![SQL Review 索引优化建议](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4252520561/p430866.png)

来源：[SQL Review](https://help.aliyun.com/zh/das/user-guide/sql-review)

**DAS 空间分析：查看全局空间使用排行榜（全局排行以 RDS MySQL 等官方支持对象为主）**

PolarDB MySQL/PolarDB-X 的空间分析建议从目标实例详情页进入，是否展示以控制台实际入口为准。

![DAS 空间分析全局空间使用排行榜](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3779311561/p171026.png)

来源：[DAS 空间分析](https://help.aliyun.com/zh/das/user-guide/storage-analysis-7)

**ADB MySQL：ADBAgent 诊断 Skill 入口**

![ADB MySQL ADBAgent 诊断 Skill](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2697915771/p1064930.png)

来源：[AnalyticDB for MySQL 诊断 Skill](https://help.aliyun.com/zh/analyticdb/analyticdb-for-mysql/diagnosis-skill)

**ADB MySQL：SQL 诊断查询监控图**

![ADB MySQL 查询监控图](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/7623778261/p301242.png)

来源：[ADB MySQL 查询监控图和 SQL 列表介绍](https://help.aliyun.com/zh/analyticdb-for-mysql/user-guide/use-a-slow-query-table)

**ADB PG：慢 SQL 列表**

![ADB PG 慢 SQL 列表](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8575014361/p338215.png)

来源：[ADB PostgreSQL 查看慢查询](https://help.aliyun.com/zh/analyticdb/analyticdb-for-postgresql/view-slow-sql-queries)

### 3.4 巡检重点项

| 维度 | 重点检查项 | 判断方式 | 建议处理 |
| --- | --- | --- | --- |
| 资源水位 | CPU、内存、IOPS、磁盘、连接数持续高位 | 云监控趋势 + DAS 性能趋势；ADB 使用产品控制台监控 | 判断是容量问题还是 SQL 问题；容量不足再评估扩容 |
| 慢 SQL | 慢 SQL 数量、耗时、扫描行数、执行次数上升 | RDS/PolarDB MySQL 使用 DAS SQL 洞察、慢日志、SQL Review；PolarDB-X 使用 SQL 洞察和 CN/DN 慢日志；ADB 使用 SQL 诊断/慢 SQL 列表 | 优先治理高频、高耗时、高扫描 SQL |
| 新增 SQL | 发布后出现的新 SQL 或执行计划变化 | RDS MySQL/PolarDB MySQL/PolarDB-X 使用 DAS SQL 洞察；ADB 使用 SQL 诊断、慢 SQL 列表或查询分析 | 建议由研发人员确认接口变更，必要时评估补索引或回滚 SQL |
| 会话异常 | 活跃会话突增、长事务、连接数接近上限 | RDS/PolarDB MySQL 使用 DAS 会话管理；PolarDB-X 使用实例会话、10 秒 SQL 分析和长事务日志；ADB 使用运行中查询/查询分析 | 检查连接池、批量任务、未提交事务 |
| 锁风险 | 锁等待、死锁、MDL 锁、阻塞链路 | RDS/PolarDB MySQL 使用 DAS 锁分析；PolarDB-X 优先查看实例会话、长事务日志和慢日志；ADB 优先查看运行中查询和执行计划 | 定位持锁 SQL 和来源应用，避免在影响未确认前直接终止会话 |
| 空间风险 | 磁盘使用率高、增长快、剩余天数不足 | 云监控磁盘指标 + DAS 空间分析；ADB MySQL 使用 ADBAgent 空间诊断，ADB PG 使用控制台存储信息 | 清理、归档、扩容、优化大表 |
| 主备/只读延迟 | 复制延迟、只读节点压力不均 | 云监控 + 数据库控制台 | 排查大事务、写入突增、只读流量分布 |
| PolarDB-X 风险 | 节点水位不均、热点分片、跨分片大查询 | DAS 支持能力 + PolarDB-X 控制台 | 优化拆分键、路由条件、热点业务访问 |
| ADB 风险 | 查询排队、资源消耗高、大表扫描、慢查询、数据倾斜 | ADB MySQL 使用 ADBAgent/SQL 诊断/一键诊断；ADB PG 使用慢 SQL 列表/慢查询诊断/执行计划 | 优化 SQL、资源组、分布键、分区、物化视图或表设计 |

### 3.5 巡检报告模板

```text
巡检范围：
- 业务系统：
- 实例数量：
- 巡检周期：

总体结论：
- 健康实例：
- 需关注实例：
- 高风险实例：

高风险问题：
1. 实例：
   风险类型：
   云监控证据：
   DAS/数据库控制台证据：
   AI/诊断结论：
   建议动作：
   建议责任人/协同人：
   建议跟进时间：

SQL 治理清单：
- SQL ID / SQL 模板：
- 问题表现：
- SQL Review/SQL 诊断建议：
- 业务影响：
- 处理优先级：

空间与容量：
- 当前使用率：
- 增长趋势：
- 预计剩余时间：
- 建议动作：

后续跟进：
- 是否需要研发介入：
- 是否需要变更窗口：
- 是否需要持续观察：
```

### 3.6 巡检频率建议

| 场景 | 频率 | 重点 |
| --- | --- | --- |
| 日常巡检 | 可按日或按核心系统等级执行 | 核心实例告警、高水位、慢 SQL、空间增长 |
| 周度巡检 | 可按周或按客户运维节奏执行 | 趋势劣化、TOP SQL、容量增长、锁等待、重复告警 |
| 发布前巡检 | 发布前或变更窗口前 | 资源余量、历史故障点、热点 SQL、备份状态、回滚预案 |
| 大促前巡检 | 活动准备期 | 核心链路实例、规格余量、慢 SQL、连接数、只读节点压力 |
| 故障后巡检 | 故障恢复后 | 同类实例共性风险、根因是否复发、防复发措施 |

## 4. 故障快速排查场景

### 4.1 快速排查目标

故障快速排查的目标是辅助客户尽快完成三类判断，具体处置节奏以客户应急流程和业务影响为准：

1. 判断影响范围：是单实例、单业务、单 SQL、单节点，还是全局问题。
2. 找到关键证据：云监控看资源和告警，DAS/数据库产品控制台按产品支持范围查看 SQL、会话、锁、空间和诊断结论。
3. 形成恢复处置建议：优先保障业务恢复，再进入根因治理。

### 4.2 快速排查流程

| 阶段 | 操作 | 使用能力 | 输出 |
| --- | --- | --- | --- |
| 1. 告警确认 | 查看云监控告警对象、指标、开始时间、持续时间 | 云监控告警 | 故障实例和异常指标 |
| 2. 影响定界 | 判断是否只有一个实例、一个节点、一个地域或一个业务受影响 | 云监控、数据库控制台 | 影响范围 |
| 3. 资源定位 | 查看 CPU、内存、连接数、IOPS、磁盘、网络、延迟趋势；ADB 同步查看产品控制台资源和查询水位 | 云监控、DAS 性能趋势、数据库产品控制台 | 资源瓶颈类型 |
| 4. SQL 定位 | RDS MySQL/PolarDB MySQL 查看故障时间段 TOP SQL、慢 SQL、新增 SQL、失败 SQL，支持时使用 SQL Review；PolarDB-X 查看 SQL 洞察、CN/DN 慢日志和执行计划；ADB MySQL 查看 SQL 诊断/慢查询，ADB PG 查看慢 SQL 列表/查询分析 | DAS SQL 洞察、慢 SQL、SQL Review、数据库产品控制台 | 可疑 SQL |
| 5. 会话/锁定位 | RDS MySQL/PolarDB MySQL 查看活跃会话、长事务、锁等待、死锁、阻塞链路；PolarDB-X 查看实例会话、10 秒 SQL 分析和长事务日志；ADB 重点查看运行中查询、查询排队、资源组和执行计划 | DAS 会话管理、DAS 锁分析、数据库产品控制台 | 可疑会话、阻塞源或高资源查询 |
| 6. 归因分析 | RDS MySQL/PolarDB MySQL 使用 DAS Agent、DAS 诊断报告和 SQL Review 生成疑似根因和建议动作；PolarDB-X 使用 DAS Agent、SQL 洞察、慢日志、实例会话和控制台诊断辅助归因；ADB MySQL 使用 ADBAgent/控制台诊断，ADB PG 使用慢查询诊断和执行计划分析 | DAS Agent、DAS 诊断报告、ADBAgent、数据库产品控制台 | 根因假设和恢复建议 |
| 7. 处置建议确认 | 结合客户变更和应急流程，评估限流、回滚、扩容、终止会话、SQL 调整等动作 | 数据库控制台、DAS | 经客户确认的恢复动作 |
| 8. 恢复验证 | 回看云监控指标、DAS 性能趋势或数据库产品控制台指标是否回落 | 云监控、DAS、数据库产品控制台 | 恢复结论 |

### 4.3 快速排查操作截图参考

为便于现场沟通和证据记录，建议按照“告警时间段定位、资源诊断、SQL 定位、会话/锁定位、ADB 产品控制台诊断”的顺序展开，并在完成关键证据记录后评估处置动作。

**实时性能：查看故障时段指标趋势**

![RDS MySQL 实时性能图表](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4393446761/p561972.png)

来源：[实时性能监控](https://help.aliyun.com/zh/rds/apsaradb-rds-for-mysql/use-the-real-time-monitoring-feature-for-an-apsaradb-rds-for-mysql-instance)

**RDS MySQL：一键诊断查看资源使用率和实例信息（按官方支持版本使用）**

![RDS MySQL 一键诊断](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9174224861/p671617.png)

来源：[快速诊断 RDS MySQL](https://help.aliyun.com/zh/rds/apsaradb-rds-for-mysql/use-the-diagnostics-feature-for-an-apsaradb-rds-for-mysql-instance)

**DAS Agent：通过诊断卡片发起诊断**

![DAS Agent 诊断卡片](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4500129571/p1006612.png)

来源：[DAS Agent](https://help.aliyun.com/zh/das/user-guide/das-agent)

**DAS Agent：通过自主对话发起诊断**

![DAS Agent 自主对话诊断](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3956409671/p1047508.png)

来源：[DAS Agent](https://help.aliyun.com/zh/das/user-guide/das-agent)

**DAS 性能趋势：从指标图表发起诊断**

![DAS 性能趋势诊断入口](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2675866771/p976556.png)

来源：[DAS 性能趋势](https://help.aliyun.com/zh/das/user-guide/performance-trends-4)

**DAS 性能趋势：查看诊断结果**

![DAS 性能趋势诊断结果](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2675866771/p976582.png)

来源：[DAS 性能趋势](https://help.aliyun.com/zh/das/user-guide/performance-trends-4)

**SQL Review：定位 TOP SQL（适用于 RDS MySQL 支持系列和 PolarDB MySQL）**

![SQL Review TOP SQL](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9937420561/p430874.png)

来源：[SQL Review](https://help.aliyun.com/zh/das/user-guide/sql-review)

**DAS 锁分析：创建锁分析（适用于满足官方前提条件的 RDS MySQL 和 PolarDB MySQL）**

![DAS 锁分析创建分析](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8145921371/p870237.png)

来源：[DAS 其他锁分析](https://help.aliyun.com/zh/das/user-guide/other-lock-analysis)

**DAS 锁分析：查看事务等待关系（适用于满足官方前提条件的 RDS MySQL 和 PolarDB MySQL）**

![DAS 锁分析事务等待关系](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8145921371/p870247.png)

来源：[DAS 其他锁分析](https://help.aliyun.com/zh/das/user-guide/other-lock-analysis)

**ADB MySQL：ADBAgent 慢查询诊断**

![ADB MySQL 慢查询诊断](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2697915771/p1064933.gif)

来源：[AnalyticDB for MySQL 诊断 Skill](https://help.aliyun.com/zh/analyticdb/analyticdb-for-mysql/diagnosis-skill)

**ADB MySQL：ADBAgent 空间诊断**

![ADB MySQL 空间诊断](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2697915771/p1064931.gif)

来源：[AnalyticDB for MySQL 诊断 Skill](https://help.aliyun.com/zh/analyticdb/analyticdb-for-mysql/diagnosis-skill)

**ADB PG：执行计划详情**

![ADB PG 执行计划详情](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2013114361/p338312.png)

来源：[ADB PostgreSQL 查看慢查询](https://help.aliyun.com/zh/analyticdb/analyticdb-for-postgresql/view-slow-sql-queries)

### 4.4 常见故障快速排查路径

| 故障现象 | 云监控关注项 | 数据库诊断入口 | 判断逻辑 | 可评估的恢复处置方向 |
| --- | --- | --- | --- | --- |
| CPU 使用率突增 | CPU、QPS/TPS、连接数是否同步升高 | RDS/PolarDB MySQL 查看 DAS SQL 洞察、慢日志、SQL Review；PolarDB-X 查看 SQL 洞察、慢日志、实例会话；ADB 查看 SQL 诊断/查询分析 | SQL 变慢、流量突增或执行计划变化 | 评估回滚发布、限制高耗 SQL、补索引或扩容 |
| 连接数达到上限或接近上限 | 连接数、活跃连接、错误连接趋势 | RDS/PolarDB MySQL 查看 DAS 会话管理；PolarDB-X 查看实例会话；ADB 查看运行中查询和连接/队列信息 | 连接池异常、短连接突增、应用未释放连接 | 评估调整连接池、处理异常应用或释放异常会话 |
| 慢 SQL 突增 | CPU/IOPS/磁盘/网络是否高位 | RDS/PolarDB MySQL 查看慢日志、SQL 洞察、SQL Review；PolarDB-X 查看 CN/DN 慢日志和执行计划；ADB 查看 SQL 诊断、慢 SQL 列表、查询分析 | 大表扫描、索引失效、批量任务、资源瓶颈 | 评估暂停批量任务、改写 SQL、增加索引或扩容 |
| 锁等待/死锁 | CPU 不一定高，但 RT 和连接数可能上升 | RDS/PolarDB MySQL 使用 DAS 锁分析和会话管理；PolarDB-X 查看实例会话、长事务日志；ADB 查看运行中查询和执行计划 | 长事务或 DDL 阻塞业务 SQL | 确认持锁源后，评估终止会话或回滚事务 |
| 磁盘空间告警 | 磁盘使用率、增长斜率 | RDS/PolarDB MySQL/PolarDB-X 查看 DAS 空间分析和产品控制台；ADB MySQL 查看 ADBAgent 空间诊断，ADB PG 查看控制台存储信息 | 写入突增、日志堆积、大表增长 | 评估扩容、清理、归档或调整保留策略 |
| 主备/只读延迟 | 延迟指标、写入流量、只读节点负载 | RDS/PolarDB MySQL 查看 DAS 性能趋势、慢 SQL、大事务；PolarDB-X 查看节点性能、慢日志和实例会话 | 大事务、DDL、写入突增、只读节点压力 | 评估暂停大事务、分批写入或调整读流量 |
| PolarDB-X 热点 | 节点 CPU/IO/连接是否不均 | PolarDB-X 控制台、DAS 性能趋势、SQL 洞察、CN/DN 慢日志、实例会话 | 热点分片、路由条件缺失、跨分片查询 | 评估优化路由条件、拆分热点或调整 SQL |
| ADB 查询排队 | 查询耗时、资源使用率、队列情况 | ADB MySQL：ADBAgent、SQL 诊断、运行中查询、表级分析；ADB PG：慢 SQL 列表、查询分析、执行计划 | 大查询、资源组争抢、表设计问题、数据倾斜 | 评估终止异常查询、调整资源组、优化分布/分区/执行计划 |

### 4.5 快速排查问题卡片模板

```text
故障标题：
- 实例：
- 业务：
- 告警时间：
- 当前状态：

云监控证据：
- 异常指标：
- 峰值：
- 持续时间：
- 是否同业务多实例同时异常：

DAS/数据库控制台证据：
- TOP SQL / 慢 SQL：
- 活跃会话 / 运行中查询：
- 锁等待 / 死锁 / 长事务：
- 空间 / 延迟 / 查询队列：
- 诊断报告或控制台诊断结果：

AI/诊断初步结论：
- 疑似根因：
- 置信度：
- 建议验证：
- 建议恢复动作：

ADB 场景补充：
- ADB MySQL：ADBAgent/SQL 诊断结论：
- ADB PG：慢 SQL 列表 / 执行计划结论：

人工复核：
- 是否与发布/批任务/活动流量相关：
- 是否需要研发介入：
- 是否需要变更审批：

恢复验证：
- 云监控指标是否恢复：
- DAS 性能趋势是否恢复：
- 慢 SQL / 会话 / 锁是否恢复：
```

### 4.6 处置边界

| 动作 | 建议 |
| --- | --- |
| 查看云监控指标、告警历史 | 可直接查看 |
| 查看 DAS 诊断、SQL 洞察、性能趋势、会话、锁、空间 | 可按产品支持范围直接查看；PolarDB-X 不将 SQL Review、诊断报告、锁分析作为通用推荐入口 |
| 使用 DAS Agent 生成诊断结论和建议 | 可发起诊断并作为排查依据，建议结合业务背景人工复核 |
| 使用 ADBAgent 或 ADB 控制台 SQL 诊断/慢查询诊断 | 可发起诊断并作为排查依据，建议结合业务背景人工复核 |
| 终止（Kill）会话 | 建议先确认事务类型、业务来源和影响范围，再按照客户侧应急流程确认后执行 |
| SQL 限流或暂停任务 | 建议由客户侧业务负责人确认影响范围后执行 |
| 扩容、升配、切换、参数调整 | 建议纳入客户 DBA/SRE 审批或应急流程 |
| 新增索引、DDL、SQL 改写上线 | 建议纳入客户既有变更流程 |

## 5. 建议优先启动事项

1. 梳理核心数据库实例清单，补齐业务标签和负责人。
2. 确认核心 RDS MySQL、PolarDB MySQL、PolarDB-X 已接入 DAS，并优先开通 DAS Agent。
3. 确认 ADB MySQL 可使用 ADBAgent 诊断 Skill、SQL 诊断和一键诊断；确认 ADB PG 可使用慢 SQL 列表、慢查询诊断和执行计划分析。
4. 在云监控配置数据库基础指标告警和联系人。
5. 对核心实例按产品确认能力：RDS MySQL/PolarDB MySQL 确认 DAS SQL 洞察、性能趋势、会话管理、空间分析，并按实例系列确认锁分析、SQL Review、诊断报告；PolarDB-X 确认 DAS 性能趋势、实时性能、实例会话、10 秒 SQL 分析、SQL 洞察、慢日志和空间分析。
6. 可基于本文模板形成“日常巡检报告”和“故障快速排查问题卡片”。
7. 可选取近期典型故障，按云监控 + DAS/ADB 控制台流程进行复盘，验证证据采集与排查路径是否完整。

## 6. 官方文档参考

1. [云监控 2.0](https://help.aliyun.com/zh/cms/cloudmonitor-2-0/product-overview/what-is-cloud-monitor-2-0/)
2. [数据库自治服务 DAS](https://help.aliyun.com/zh/das/)
3. [DAS 支持的数据库引擎与功能](https://help.aliyun.com/zh/das/product-overview/supported-database-engines-and-features)
4. [DAS 接入数据库实例](https://help.aliyun.com/zh/das/getting-started/access-instances)
5. [DAS Agent](https://help.aliyun.com/zh/das/user-guide/das-agent)
6. [RDS MySQL 实例巡检](https://help.aliyun.com/rds/apsaradb-rds-for-mysql/overview-for-rds-instance-health-check)
7. [RDS MySQL 快速诊断](https://help.aliyun.com/zh/rds/apsaradb-rds-for-mysql/use-the-diagnostics-feature-for-an-apsaradb-rds-for-mysql-instance)
8. [查看 RDS MySQL 监控指标](https://help.aliyun.com/zh/rds/apsaradb-rds-for-mysql/view-the-metrics-of-an-apsaradb-rds-for-mysql-instance)
9. [RDS MySQL 实时性能监控](https://help.aliyun.com/zh/rds/apsaradb-rds-for-mysql/use-the-real-time-monitoring-feature-for-an-apsaradb-rds-for-mysql-instance)
10. [RDS MySQL SQL 洞察和审计](https://help.aliyun.com/zh/rds/apsaradb-rds-for-mysql/use-the-sql-explorer-and-audit-feature-on-an-apsaradb-rds-for-mysql-instance/)
11. [DAS SQL 洞察](https://help.aliyun.com/zh/das/user-guide/sql-explorer)
12. [DAS SQL Review](https://help.aliyun.com/zh/das/user-guide/sql-review)
13. [DAS 性能趋势](https://help.aliyun.com/zh/das/user-guide/performance-trends-4)
14. [DAS 锁分析](https://help.aliyun.com/zh/das/user-guide/deadlock-analysis-1)
15. [PolarDB MySQL 一键诊断](https://help.aliyun.com/zh/polardb/polardb-for-mysql/user-guide/diagnosis)
16. [PolarDB-X SQL 洞察和审计](https://help.aliyun.com/zh/das/user-guide/sql-explorer-and-audit-9)
17. [PolarDB-X 慢日志](https://help.aliyun.com/zh/polardb/polardb-for-xscale/slow-query-logs)
18. [PolarDB-X 实例会话](https://help.aliyun.com/zh/polardb/polardb-for-xscale/session-management)
19. [PolarDB-X 长事务日志](https://help.aliyun.com/zh/polardb/polardb-for-xscale/long-transaction-log)
20. [AnalyticDB for MySQL ADBAgent](https://help.aliyun.com/zh/analyticdb/analyticdb-for-mysql/adbagent/)
21. [AnalyticDB for MySQL 诊断 Skill](https://help.aliyun.com/zh/analyticdb/analyticdb-for-mysql/diagnosis-skill)
22. [ADB MySQL 查询监控图和 SQL 列表](https://help.aliyun.com/zh/analyticdb/analyticdb-for-mysql/user-guide/use-query-monitoring-charts-and-sql-queries)
23. [AnalyticDB for PostgreSQL 查看慢查询](https://help.aliyun.com/zh/analyticdb/analyticdb-for-postgresql/view-slow-sql-queries)
24. [AnalyticDB for PostgreSQL 慢查询诊断](https://help.aliyun.com/zh/analyticdb/analyticdb-for-postgresql/user-guide/slow-query-diagnostics)
25. [AnalyticDB for PostgreSQL 查询诊断](https://help.aliyun.com/zh/analyticdb/analyticdb-for-postgresql/user-guide/query-analysis)
26. [DAS 空间分析](https://help.aliyun.com/zh/das/user-guide/storage-analysis-7)
27. [DAS 其他锁分析](https://help.aliyun.com/zh/das/user-guide/other-lock-analysis)
