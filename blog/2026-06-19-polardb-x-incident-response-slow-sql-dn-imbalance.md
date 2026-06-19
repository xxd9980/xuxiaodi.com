---
title: "PolarDB-X 现场应急指南：慢 SQL 与 DN 水位倾斜的排查与处置"
title_en: "PolarDB-X Incident Response Guide: Troubleshooting Slow SQL and DN Resource Imbalance"
slug: "polardb-x-incident-response-slow-sql-dn-imbalance"
era: "2026"
drafted_at: "2026-06-19"
summary: "面向业务与 DBA 团队的 PolarDB-X 现场应急指南，围绕大量慢 SQL 和 DN 磁盘、CPU 水位倾斜两类常见故障，给出从业务止血和现场取证，到执行计划与数据拓扑诊断，再到索引优化、分区迁移、表重分布及恢复验证的完整处置路径。"
summary_en: "A field-ready PolarDB-X incident response guide for application and DBA teams, covering two common failures: widespread slow SQL and uneven DN disk or CPU utilization. It provides an end-to-end path from service stabilization and evidence collection to execution-plan and topology diagnosis, index optimization, partition migration, data redistribution, and recovery verification."
tags: ["PolarDB-X", "Database", "Incident Response", "SQL Performance", "Reliability"]
---

## 中文摘要

本文面向使用阿里云 PolarDB-X 的业务与 DBA 团队，聚焦大量慢 SQL 和 DN 磁盘、CPU 水位倾斜两类常见现场故障。文章按照“先止血、再定位、再修复、最后复盘”的顺序，说明如何保护核心业务、保留故障证据、分析慢日志与执行计划、识别跨分片扫描和热点分区，并结合局部索引、GSI、分区迁移、Locality 调整及表重分布完成结构性治理。文末还提供 DAS 与 AI 助手的能力边界、现场执行清单和复盘模板，便于将一次应急处置沉淀为可重复使用的运维方法。

## English Abstract

This article is a field-ready incident response guide for application and DBA teams running Alibaba Cloud PolarDB-X. It focuses on two recurring production issues: a sudden surge in slow SQL and uneven disk or CPU utilization across data nodes (DNs). Following a stabilize, diagnose, remediate, and review workflow, it explains how to protect critical services, preserve incident evidence, analyze slow-query logs and execution plans, identify scatter-gather queries and hot partitions, and apply structural fixes through local indexes, global secondary indexes (GSIs), partition migration, Locality changes, and table redistribution. It also defines appropriate boundaries for DAS and AI-assisted operations and includes execution checklists and a post-incident review template.

## 适用范围

本文面向使用阿里云 PolarDB-X 的业务和 DBA 团队，用于两类常见现场故障的应急处置：

1. 现场突然产生大量慢 SQL，实例 CPU、连接数、RT 或业务超时明显升高。
2. PolarDB-X 各存储节点（DN）的磁盘水位、CPU 水位明显倾斜，部分 DN 成为瓶颈。

本文以先止血、再定位、再修复、最后复盘为原则。涉及 DDL、分区迁移、表重建、索引新增等操作时，应优先在测试环境验证，并在业务低峰或受控窗口执行。

## 0. 通用应急原则

### 0.1 先保护业务

- 如果慢 SQL 或热点 DN 已经影响核心链路，优先采取业务侧限流、降级、熔断、暂停批任务、暂停报表任务等手段。
- 如果资源已经接近打满，优先减少新的重查询、批量写入和全表扫描，再进入 SQL 或数据分布治理。
- 如果 DN 磁盘接近满盘，优先停止高增长写入、清理可归档历史数据、确认扩容路径，再执行迁移或重建。

### 0.2 保留现场证据

记录以下信息，避免只看故障恢复后的状态：

- 故障起止时间、业务变更、发布、活动流量、定时任务。
- CN 和 DN 的 CPU、内存、连接数、IO、磁盘水位、慢 SQL 数量。
- Top SQL 模板、执行次数、平均耗时、总耗时、扫描行数、返回行数。
- SQL 的 `EXPLAIN`、`EXPLAIN LOGICALVIEW`、`EXPLAIN EXECUTE`、`EXPLAIN SHARDING` 结果。
- 涉事表的建表语句、索引、分区规则、拓扑分布和数据量。

### 0.3 变更要分层

- 小范围 SQL 改写、业务限流、临时停止批任务，通常作为第一层止血手段。
- 增加局部索引、增加全局二级索引（GSI）、迁移分区或调整 Locality，作为第二层结构性修复。
- 单表改分布式表、修改拆分键、表重建迁移，属于高影响变更，应独立制定割接和回滚方案。

## 1. 大量慢 SQL 应急方案

### 1.1 典型现象

- 控制台或 DAS 慢日志数量突然上升。
- CN 或 DN CPU 明显升高，业务请求 RT 变长。
- 活跃连接数、等待线程、锁等待或 IO 等指标异常。
- 业务侧出现接口超时、任务堆积、连接池耗尽。

PolarDB-X 控制台慢日志能力可以查看慢 SQL 趋势、慢日志统计和慢日志明细。官方文档中将执行时间超过 1 秒的 SQL 定义为慢 SQL，慢日志功能可结合 CPU 使用率和慢日志数帮助定位影响性能的关键 SQL。

### 1.2 常见原因

- 表缺少合适的局部索引，DN 上出现全表扫描。
- 查询条件没有带拆分键或分区键，导致跨分片扫描。
- SQL 在函数、隐式类型转换、模糊查询、排序、聚合、分页等场景下无法有效使用索引。
- 业务突增、活动流量、批量任务或报表任务导致资源打满。
- 热点用户、热点订单、热点租户等导致部分分区或 DN 被集中访问。
- SQL 写法导致下推效果差，CN 需要做大量聚合、排序或 Join。
- 统计信息不准、执行计划异常，导致优化器选择了不合适的路径。

### 1.3 现场处置流程

#### 步骤 1：确认故障窗口和资源瓶颈

在控制台查看性能趋势，重点观察：

- CN、DN、GMS、CDC 节点的 CPU、内存、连接数。
- 故障窗口内慢 SQL 数量是否与 CPU 峰值同步。
- 是否只有某个 DN 或少数 DN 水位异常。
- 是否存在业务发布、定时任务、活动流量、导入导出任务。

如果 CPU 已经被打满，应先限制重 SQL 来源。例如暂停批任务、临时关闭非核心报表、对高频接口限流，避免在实例满负载时继续提交更多诊断型重查询。

#### 步骤 2：从慢日志定位 Top SQL

在 PolarDB-X 控制台进入慢日志页面，按时间范围筛选故障窗口，优先关注：

- 总耗时最高的 SQL 模板。
- 执行次数最高的 SQL 模板。
- 平均耗时最高的 SQL 模板。
- 返回行数、扫描行数异常的 SQL。
- 与 CPU 峰值高度重合的 SQL。

慢日志页面支持查看 SQL 模板、执行次数、耗时、返回行数等信息，并可对目标 SQL 查看详情、优化建议或限流操作。注意区分：

- CN 慢 SQL：业务客户端提交到 PolarDB-X 的逻辑 SQL，是主要优化对象。
- DN 慢 SQL：PolarDB-X 下发到存储层的物理 SQL，可用于确认底层是否全表扫描、是否命中索引。

官方文档提示每个 PolarDB-X 节点最多保留 30 天慢日志，因此日常应建立慢日志巡检或外部留存机制。

#### 步骤 3：分析执行计划

对 Top SQL 执行以下分析。生产环境执行诊断 SQL 时应控制频率，避免二次放大压力。

```sql
EXPLAIN SELECT ...;
EXPLAIN LOGICALVIEW SELECT ...;
EXPLAIN EXECUTE SELECT ...;
EXPLAIN SHARDING SELECT ...;
EXPLAIN COST SELECT ...;
```

重点判断：

- 是否扫描了过多分片或所有分片。
- 是否缺少拆分键、分区键过滤条件。
- DN 下推 SQL 是否使用了正确索引。
- 是否出现全表扫描、文件排序、临时表。
- Join、聚合、排序、分页是否大量在 CN 执行。
- 返回行数是否远小于扫描行数。
- SQL 是否因为函数、类型转换、表达式计算导致索引失效。

常见判定方式：

- `EXPLAIN` 查看 PolarDB-X 逻辑执行计划。
- `EXPLAIN LOGICALVIEW` 查看下推到 DN 的 SQL 形态。
- `EXPLAIN EXECUTE` 查看 DN 层 MySQL 执行计划，确认是否使用索引。
- `EXPLAIN SHARDING` 查看 SQL 实际扫描哪些物理分片。
- `EXPLAIN COST` 查看算子成本和工作负载估算。

#### 步骤 4：按原因选择修复动作

##### 场景 A：缺少局部索引

现象：

- DN 执行计划显示全表扫描。
- 过滤条件稳定，但相关字段没有索引或索引顺序不合理。
- SQL 扫描行数远大于返回行数。

处置：

```sql
ALTER TABLE user_log ADD INDEX idx_user_time (user_id, gmt_create);
```

索引设计建议：

- 优先覆盖高频等值过滤字段。
- 联合索引字段顺序遵循高选择性、等值条件、范围条件、排序字段的组合原则。
- 不要为低频 SQL 盲目增加过多索引，避免写入成本和空间成本失控。
- 新增索引后重新查看执行计划，并观察慢日志是否下降。

##### 场景 B：缺少按访问维度查询的全局索引

现象：

- 表按 `order_id` 拆分，但业务频繁按 `buyer_id` 查询。
- 查询无法定位分片，需要跨分片扫描。
- 局部索引只能优化单个 DN 内部扫描，无法减少跨分片范围。

处置：

```sql
ALTER TABLE t_order
  ADD GLOBAL INDEX g_i_buyer (buyer_id)
  COVERING (order_snapshot)
  PARTITION BY KEY(buyer_id)
  PARTITIONS 16;
```

建议：

- 对稳定、高频、核心链路的跨分片查询维度，评估 GSI。
- GSI 会带来写入维护成本和额外空间，需结合写入量、查询收益和一致性要求评估。
- 创建后验证 SQL 是否走 GSI，并观察写入 RT 是否可接受。

##### 场景 C：SQL 没有带拆分键或分区键

现象：

- `EXPLAIN SHARDING` 显示扫描大量分片。
- SQL 过滤条件不包含拆分键。
- 业务实际可以提供租户 ID、用户 ID、订单 ID 等定位条件，但 SQL 未携带。

处置：

- 优先改业务 SQL，补充拆分键或分区键过滤条件。
- 对无法补充原拆分键但访问频繁的查询，评估 GSI 或表结构调整。
- 对报表类、离线类查询，迁移到只读、离线或数仓链路，避免冲击在线实例。

##### 场景 D：业务突增导致资源打满

现象：

- SQL 本身可能不是新 SQL，但调用量突然放大。
- 慢日志数量、QPS、CPU 同时上升。
- 发布、活动、批任务或外部调用量与故障时间重合。

处置：

- 业务侧限流或降级，优先保护核心交易链路。
- 暂停批处理、报表、补偿、导出等后台任务。
- 对非核心高频 SQL 做临时限流。
- 评估临时扩容或规格调整。
- 故障后针对高频 SQL 做索引、缓存、分页、批量化和异步化治理。

##### 场景 E：排序、分页、聚合导致大量扫描

处置建议：

- 避免深分页，例如将 `LIMIT 100000, 20` 改为基于游标或业务主键翻页。
- 排序字段与过滤字段尽量进入同一个联合索引。
- 控制返回列，避免不必要的大字段。
- 尽量让过滤和聚合在 DN 层下推。
- 报表聚合从在线链路迁移到离线链路。

### 1.4 恢复验证

修复后至少确认：

- Top SQL 的平均耗时、总耗时、执行次数下降。
- CN 和 DN CPU 回落，连接数恢复。
- `EXPLAIN` 结果符合预期，DN 层命中索引。
- 业务核心接口 RT 恢复。
- 新增索引或 GSI 未明显拖慢写入。

### 1.5 日常预防

- 每日或每周巡检慢日志 Top SQL。
- 对慢日志数量、CPU、活跃连接数、磁盘水位设置告警。
- 使用 SQL 洞察和审计能力分析 SQL 来源账号、客户端 IP 和执行特征。
- 对活动、促销、批任务上线前做压测和 SQL 审查。
- 建表和上线 SQL 前确认索引、拆分键、访问模式是否匹配。
- 对核心 SQL 保存基线执行计划，变更后重新验证。

## 2. DN 磁盘或 CPU 水位倾斜应急方案

### 2.1 典型现象

- 某个 DN 的磁盘水位明显高于其他 DN。
- 某个 DN 的 CPU 长期高于其他 DN。
- 实例总体资源仍有余量，但业务被单个 DN 拖慢。
- 热力图显示部分分区或部分 DN 访问明显过热。
- 空间分析显示个别物理表、单表或 GSI 占用空间异常。

### 2.2 常见原因

- 大表被创建成单表，所有数据集中在一个 DN。
- 拆分键选择不合理，例如低基数字段、时间单调字段、热点租户字段。
- 分区规则不匹配业务访问模式，导致某些分区持续热点。
- 单表没有指定合适的 Locality，多个单表集中到同一 DN。
- 表组、分区组或 Locality 设置不合理。
- GSI 分区规则与主表访问模式不匹配。
- 批量写入、归档、补偿任务集中写入某个热点分区。

### 2.3 排查流程

#### 步骤 1：确认倾斜节点

在控制台查看：

- 性能趋势：按 CN、DN、GMS、CDC 查看 CPU、内存、连接数等指标。
- 空间分析：查看实例空间、表空间、索引空间、GSI 空间、碎片率。
- 热力图：查看分区访问和数据分布，识别热点分区和热点 DN。

官方热力图文档说明，DN 视图可从存储节点视角展示分区热点信息，便于判断物理存储节点之间的数据是否均衡、是否存在过热节点。

#### 步骤 2：定位异常表和分区

使用以下语句确认表类型、分区规则和拓扑位置：

```sql
SHOW CREATE TABLE t_order;
SHOW FULL CREATE TABLE t_order;
SHOW RULE FROM t_order;
SHOW FULL RULE FROM t_order;
SHOW TOPOLOGY FROM t_order;
SHOW PARTITIONS FROM t_order;
SHOW STORAGE;
SHOW DS;
SHOW NODE;
```

关注点：

- 表是否为单表、广播表或分区表。
- 分区键是否为高基数、分布均匀的字段。
- 数据是否集中在少数物理表或少数 DN。
- GSI 是否也存在热点或空间倾斜。
- 表组内多个表是否被同一分区策略绑定，迁移时是否会联动。

#### 步骤 3：判断是数据倾斜还是访问热点

- 磁盘水位倾斜，优先看表空间、索引空间、GSI 空间和物理拓扑。
- CPU 水位倾斜，优先看热力图、慢 SQL、DN 慢 SQL 和热点分区。
- 数据量均匀但 CPU 倾斜，通常是访问热点或 SQL 模式问题。
- CPU 均匀但磁盘倾斜，通常是表类型、分区规则、单表或历史数据问题。

### 2.4 应急处置：把数据从高水位 DN 迁走

#### 场景 A：分区表或可识别分区的数据倾斜

如果表是 AUTO 模式分区表，或者能通过 `SHOW PARTITIONS` / `SHOW TOPOLOGY` 明确要迁移的分区，可使用分区迁移语法将分区移动到低水位 DN。

```sql
ALTER TABLE t_order
  MOVE PARTITIONS p1,p3 TO 'polardbx-ng28-dn-2';
```

如果多个表属于同一个表组，建议按表组迁移，保证同组表分区位置一致：

```sql
ALTER TABLEGROUP BY TABLE t_order
  MOVE PARTITIONS p1,p3 TO 'polardbx-ng28-dn-2';
```

如果使用二级分区，可迁移子分区：

```sql
ALTER TABLE t_order
  MOVE SUBPARTITIONS p1sp1,p2sp1 TO 'polardbx-ng28-dn-2';
```

执行前确认：

- 目标 DN 磁盘和 CPU 水位较低。
- PolarDB-X 内核版本满足分区迁移要求。
- 表组内是否存在多个关联表，避免只迁移单表造成关联访问退化。
- 迁移期间监控 DDL 进度、复制延迟、业务 RT 和目标 DN 水位。

执行后验证：

```sql
SHOW TOPOLOGY FROM t_order;
SHOW PARTITIONS FROM t_order;
```

#### 场景 B：通过 Locality 调整表组或热点分区位置

AUTO 模式下可使用 Locality 指定数据存储节点。Locality 可配置在数据库、表、表组或分区级别，并可触发异步数据迁移。

查看可用存储节点：

```sql
SHOW STORAGE;
```

调整表组 Locality：

```sql
ALTER TABLEGROUP tg_order
  SET LOCALITY = 'dn=polardbx-ng28-dn-0,polardbx-ng28-dn-2';
```

调整热点分区 Locality：

```sql
ALTER TABLEGROUP tg_order
  SET PARTITIONS p_hot LOCALITY = 'dn=polardbx-ng28-dn-2';
```

查看异步迁移进度：

```sql
SELECT *
FROM information_schema.ddl_plan
WHERE table_schema = 'db1';
```

建议：

- CPU 热点分区可通过 Locality 隔离到相对空闲 DN。
- 磁盘高水位分区可迁移到低水位 DN。
- 表 Locality 必须是数据库 Locality 的子集。
- 单表声明 Locality 时通常只能指定一个 DN。

#### 场景 C：大表被建成单表

单表适合小型配置表、字典表等数据量小且不需要分布式扩展的场景。如果业务大表被误建为单表，应尽快改为分布式表。

先确认表是否为单表：

```sql
SHOW CREATE TABLE t_order;
SHOW RULE FROM t_order;
SHOW TOPOLOGY FROM t_order;
```

如果是 AUTO 模式，且版本、表结构和容量条件满足官方“变更表类型及分区策略”要求，应优先评估在线变更表类型功能。该能力支持在不锁表、不阻塞 DML 的情况下，将单表变更为分区表，本质是在后台进行全量数据迁移和重分布。

AUTO 模式单表转分区表示例：

```sql
ALTER TABLE t_order PARTITION BY KEY(order_id);

ALTER TABLE t_order PARTITION BY KEY(order_id) PARTITIONS 8;
```

如果分区表拆分键不合理，也可在线调整分区键或分区数量：

```sql
ALTER TABLE t_order PARTITION BY KEY(buyer_id) PARTITIONS 16;
```

执行前确认：

- 数据库必须是 AUTO 模式。
- PolarDB-X 2.0 内核小版本需满足官方要求；文档要求在线变更表类型的内核小版本为 5.4.13 及以上。
- 带 GSI 的分区表变更需确认 GSI 相关版本要求；官方文档要求带 GSI 的分区表进行分区变更时内核小版本为 5.4.14 及以上。
- 该操作是重型 DDL，会消耗 CPU、IO 和网络资源，耗时与数据量正相关。
- 执行前评估目标 DN 的磁盘空间、CPU 和 IOPS，避免数据重分布过程中目标节点资源不足。
- 执行前完成备份，并在业务低峰期执行。

任务管理：

```sql
SHOW DDL;
PAUSE DDL <JobId>;
CONTINUE DDL <JobId>;
CANCEL DDL <JobId>;
```

如果任务失败，官方文档说明原表数据不会损坏，也不会阻塞正常 DML 和查询；可通过 `SHOW DDL` 查看失败原因，处理后使用 `CANCEL DDL` 回滚任务，再重新尝试。

如果是 DRDS 模式，且版本满足官方“变更表类型及拆分规则”要求，可将单表变更为拆分表：

```sql
ALTER TABLE t_order
  DBPARTITION BY HASH(order_id);
```

或同时指定分库分表规则：

```sql
ALTER TABLE t_order
  DBPARTITION BY HASH(order_id)
  TBPARTITION BY HASH(buyer_id)
  TBPARTITIONS 3;
```

注意：

- 单表存在自增列时，官方文档要求在变更为广播表或拆分表前先创建 Sequence。
- 如果涉及 GSI、唯一约束、拆分键变更，应确认内核版本和官方限制。
- 此类 DDL 对业务影响较大，应先在测试环境验证。

只有在当前版本不满足在线变更要求、表结构或约束不适合在线变更、资源风险不可接受、或需要更强割接控制时，才推荐采用“新建分布式表 + 数据迁移 + 割接”的方式：

```sql
CREATE TABLE t_order_new (
  id BIGINT PRIMARY KEY,
  buyer_id BIGINT,
  order_snapshot TEXT,
  gmt_create DATETIME
)
PARTITION BY KEY(id)
PARTITIONS 16;
```

割接步骤建议：

1. 新建分布式表，选择合适分区键。
2. 全量回填历史数据。
3. 通过 DTS、双写或应用补偿同步增量数据。
4. 校验行数、校验和、关键业务查询结果。
5. 短暂停写或进入维护窗口。
6. 执行表名切换。
7. 保留旧表一段时间，确认无问题后下线。

示例表名切换：

```sql
RENAME TABLE t_order TO t_order_old,
             t_order_new TO t_order;
```

#### 场景 D：小单表集中在同一 DN

如果多个小单表集中在同一 DN，导致该 DN 磁盘或 CPU 偏高，应先确认数据库模式：

- AUTO 模式：可在创建单表时使用 `LOCALITY='dn=...'` 指定目标 DN。
- DRDS 模式：官方文档支持建表时通过 `LOCALITY` 指定单表存储位置；如果已经指定 Locality，后续是否能修改需按当前模式和版本文档确认。

示例：

```sql
CREATE TABLE config_table (
  id BIGINT PRIMARY KEY,
  config_key VARCHAR(128),
  config_value TEXT
)
SINGLE
LOCALITY = 'dn=polardbx-ng28-dn-2';
```

如果当前单表无法直接移动，采用重建迁移：

1. 在低水位 DN 上创建带 Locality 的新单表。
2. 回填数据并校验。
3. 短暂停写后切换表名或切换业务访问。
4. 观察低水位 DN 和原高水位 DN 的变化。

### 2.5 应急处置：修复热点拆分键

如果 DN 倾斜来自拆分键不合理，而不是单纯分区放置问题，应从根因上调整拆分策略。

不建议的拆分键：

- 低基数字段，例如状态、类型、布尔值。
- 单调递增时间字段，容易形成最新分区热点。
- 少数大客户、少数租户高度集中的字段。
- 与核心查询条件无关的字段。

建议的拆分键：

- 高基数，数据分布均匀。
- 高频查询能够携带该字段。
- 写入不会集中到少数值。
- 与业务生命周期匹配，便于扩容、归档和清理。

DRDS 模式修改拆分规则示例：

```sql
ALTER TABLE t_order
  DBPARTITION BY HASH(order_id)
  TBPARTITION BY HASH(buyer_id)
  TBPARTITIONS 3;
```

对于拆分键变更，应制定完整迁移方案：

- 评估唯一约束、GSI、外键式业务依赖和 Join 访问。
- 全量回填和增量同步。
- 双写或灰度验证。
- 校验数据一致性。
- 业务低峰割接。
- 保留回滚窗口。

### 2.6 日常预防

#### 建表时默认使用分布式表

除小型配置表、字典表、低频管理表外，业务增长型表应优先创建为分布式表。建表前必须确认：

- 预估数据量和增长速度。
- 主要查询维度。
- 写入模式和热点风险。
- 是否需要 GSI。
- 是否存在归档和清理策略。

#### 合理选择拆分键

拆分键评审至少回答：

- 这个字段是否高基数。
- 数据是否会均匀分布到多个 DN。
- 核心查询是否能带上该字段。
- 是否存在明显热点值。
- 未来业务增长后是否仍然均衡。

#### 开启自动 Sharding 或自动分区

AUTO 模式数据库默认不启用自动分区。评估通过后，可开启自动分区，使未显式指定分区键的建表语句默认按主键或隐藏主键进行 KEY 分区：

```sql
SET GLOBAL AUTO_PARTITION = true;
```

DRDS 模式可在会话中开启自动主键拆分：

```sql
SET @auto_partition = 1;

CREATE TABLE t_order (
  id BIGINT PRIMARY KEY,
  buyer_id BIGINT,
  gmt_create DATETIME
);

SET @auto_partition = 0;
```

建议：

- 自动分区可降低误建单表概率，但不能替代拆分键设计评审。
- 对核心大表，仍应显式设计分区规则。
- 开启前确认数据库模式、版本行为和团队建表规范。

#### 建立 DN 倾斜巡检

建议定期巡检：

- DN CPU 最大值与最小值差异。
- DN 磁盘水位最大值与最小值差异。
- 表空间 Top N。
- GSI 空间 Top N。
- 热力图中的热点分区。
- 单表清单和大单表清单。
- `SHOW RULE` / `SHOW TOPOLOGY` 中不符合规范的表。

告警建议：

- 任一 DN 磁盘水位超过 80% 预警，超过 90% 紧急处理。
- 任一 DN CPU 长时间显著高于其他 DN，触发热点分析。
- 单表空间超过阈值，触发表类型复核。
- 慢 SQL 数量、总耗时或 Top SQL 模板突增，触发 SQL 复核。

## 3. DAS Agent 与 PolarDB-X AI 助手使用建议

### 3.1 覆盖结论

按本文巡检和应急动作拆分，DAS Agent、DAS 控制台能力和 PolarDB-X AI 助手可以覆盖较多“发现、分析、建议、复盘”类工作，但不建议无人值守执行重型 DDL 或业务割接。

建议按三类使用：

- 可自动化采集或平台直接完成：慢日志趋势、Top SQL、SQL 洞察、性能趋势、空间分析、热力图、DN 水位、表空间、DDL 状态等巡检数据。
- 可由 AI 助手强辅助：慢 SQL 根因归纳、执行计划解读、索引和 GSI 建议复核、拆分键评估、DN 倾斜归因、迁移方案生成、复盘报告生成。
- 必须人工审批后执行：新增索引或 GSI、SQL 限流规则生效、`ALTER MOVE PARTITIONS`、Locality 调整、在线变更表类型和分区策略、表重建迁移、暂停或回滚 DDL、业务限流和割接。

### 3.2 能力矩阵

| 场景 | DAS Agent / DAS 控制台可做 | PolarDB-X AI 助手可做 | 建议自动化级别 |
| --- | --- | --- | --- |
| 慢 SQL 日常巡检 | 自动采集慢日志趋势、慢日志统计、慢日志明细、Top SQL 模板 | 总结异常 SQL、生成日报、标出突增 SQL 和疑似业务来源 | 可自动化 |
| 慢 SQL 现场定位 | 关联 CPU 使用率、慢日志数量、执行次数、平均耗时、返回行数等信息 | 根据时间窗归纳 Top SQL、区分索引缺失、跨分片扫描、流量突增等原因 | 可自动化分析，人工确认结论 |
| SQL 洞察和审计 | 记录账号、客户端 IP、SQL 执行信息，支持 SQL 日志分析、流量回放和压测能力 | 归纳 SQL 来源、调用模式、异常时间段，辅助判断是否需要扩容或限流 | 可自动化分析 |
| SQL 优化建议 | 慢日志页面可对 SQL 进行诊断和优化建议，输出索引或 GSI 等建议 | 解释建议原因，检查索引列顺序、覆盖列、写入成本和风险 | 工具建议，人工审核 |
| 执行计划分析 | 提供慢 SQL 样本和优化入口；执行计划需要通过 SQL 客户端或授权工具执行 `EXPLAIN` | 解读 `EXPLAIN`、`LOGICALVIEW`、`EXECUTE`、`SHARDING`、`COST`，指出全表扫描、未命中索引、跨分片扫描 | AI 辅助，人工确认 |
| SQL 限流 | 慢日志页面提供 SQL 限流入口或相关跳转能力 | 生成限流对象、阈值和回滚建议 | 必须人工审批后执行 |
| 新增本地索引或 GSI | 可提供优化建议和效果预估 | 生成 DDL、说明收益、写入成本和回滚方案 | 必须人工审批后执行 |
| 性能趋势巡检 | 采集 CN、DN、GMS、CDC 节点 CPU、内存、连接数等指标 | 总结资源瓶颈，判断是否与慢 SQL 或业务突增相关 | 可自动化 |
| 空间分析巡检 | 查看空间概况、剩余可用天数、表空间、索引空间、GSI 空间、异常列表 | 识别大表、大 GSI、碎片和增长异常，生成清理或归档建议 | 可自动化分析 |
| 热力图巡检 | 展示分区访问和数据分布，DN 视图可发现热点 DN 或热点分区 | 归因数据倾斜、访问热点、拆分键不合理、单表集中等问题 | 可自动化分析 |
| 表规则和拓扑检查 | 若 Agent 已获授权，可执行 `SHOW RULE`、`SHOW TOPOLOGY`、`SHOW PARTITIONS` 等只读 SQL | 对照 DN 水位和热力图，判断是否单表、大分区或拆分键不合理 | 可自动化只读巡检 |
| 分区迁移和 Locality 调整 | 可辅助查看拓扑和迁移后状态 | 生成 `ALTER TABLE ... MOVE PARTITIONS`、`ALTER TABLEGROUP ... SET LOCALITY` 方案和验证清单 | 必须人工审批后执行 |
| AUTO 模式在线变更表类型 | 可辅助查看 DDL 状态、资源趋势和执行结果 | 生成 `ALTER TABLE ... PARTITION BY ...` 方案、风险提示、验证和回滚步骤 | 必须人工审批后执行 |
| DDL 任务管理 | 可通过 `SHOW DDL` 查看任务状态；可按流程暂停、恢复、取消任务 | 判断是否需要 `PAUSE DDL`、`CONTINUE DDL`、`CANCEL DDL`，整理操作影响 | 暂停、恢复、取消必须人工确认 |
| 表重建迁移和割接 | 可辅助监控资源和 SQL 影响 | 生成全量回填、增量同步、校验、切换和回滚 Runbook | 必须人工执行 |
| 复盘报告 | 可提供慢日志、性能趋势、空间趋势、热力图等证据 | 自动生成故障时间线、根因、处置动作、预防项和待办 | 可自动化草稿，人工确认 |

### 3.3 慢 SQL 场景的推荐落地

日常巡检：

- DAS Agent 或控制台定时采集慢日志 Top SQL、执行次数、平均耗时、最大耗时、返回行数。
- AI 助手每天生成慢 SQL 摘要，标出新增 SQL 模板、耗时突增 SQL、调用量突增 SQL。
- 对连续出现的 Top SQL 自动生成待办：补索引评估、GSI 评估、SQL 改写评估或业务限流评估。

现场应急：

- Agent 先拉取故障窗口内的慢日志、性能趋势和 SQL 洞察信息。
- AI 助手按“总耗时、执行次数、平均耗时、资源峰值重合度”排序候选 SQL。
- AI 助手生成 `EXPLAIN` 分析清单和索引建议，但执行 `ALTER TABLE ADD INDEX` 或 `ADD GLOBAL INDEX` 前必须由 DBA 审核。
- 如果需要 SQL 限流，AI 助手只生成限流建议和回滚条件，实际生效必须走应急审批。

### 3.4 DN 倾斜场景的推荐落地

日常巡检：

- Agent 定时采集各 DN 的 CPU、磁盘水位、表空间 Top N、GSI 空间 Top N、热点分区和热力图信息。
- AI 助手对比 DN 最大值、最小值和增长趋势，自动识别“磁盘倾斜”“CPU 倾斜”“数据量均匀但访问热点”“数据集中但访问均匀”等类型。
- 对疑似单表或拆分键异常的表，Agent 在只读权限下执行 `SHOW RULE`、`SHOW TOPOLOGY`、`SHOW PARTITIONS` 进行佐证。

现场应急：

- AI 助手先给出止血优先级：业务限流、暂停批任务、扩容、分区迁移、Locality 调整、在线变更分区策略。
- 对分区迁移，只生成候选命令和验证 SQL，例如 `ALTER TABLE ... MOVE PARTITIONS ... TO ...`，不得无人值守执行。
- 对大单表，优先评估 AUTO 模式在线变更表类型；若条件不满足，再生成“新建分布式表 + 数据迁移 + 割接”方案。

### 3.5 授权和安全边界

建议把 Agent 权限拆成三层：

- 只读巡检权限：允许查看慢日志、性能指标、空间分析、热力图、表结构、拓扑和 DDL 状态。
- 受控诊断权限：允许执行 `EXPLAIN`、`SHOW RULE`、`SHOW TOPOLOGY`、`SHOW PARTITIONS`、`SHOW DDL` 等诊断语句。
- 变更执行权限：涉及索引、GSI、分区迁移、Locality、在线变更表类型、DDL 暂停或取消等操作，必须接入审批、窗口期、回滚预案和审计记录。

不建议自动执行的动作：

- 新增或删除索引、GSI。
- SQL 限流规则生效。
- `ALTER TABLE ... MOVE PARTITIONS`。
- `ALTER TABLEGROUP ... SET LOCALITY`。
- `ALTER TABLE ... PARTITION BY ...`。
- `PAUSE DDL`、`CONTINUE DDL`、`CANCEL DDL`。
- 表重建、表名切换、数据回填、双写切换。
- 业务降级、业务限流、实例规格变更。

## 4. 现场执行清单

### 4.1 慢 SQL 清单

- [ ] 确认故障时间窗口。
- [ ] 查看 CN/DN CPU、连接数、慢日志趋势。
- [ ] 导出 Top SQL 模板。
- [ ] 区分 CN 慢 SQL 和 DN 慢 SQL。
- [ ] 对 Top SQL 执行 `EXPLAIN` 系列分析。
- [ ] 判断是否缺索引、缺分区键、跨分片扫描或业务突增。
- [ ] 执行限流、暂停批任务、SQL 改写或新增索引。
- [ ] 验证慢日志、CPU、业务 RT 是否恢复。
- [ ] 复盘并沉淀索引和 SQL 规范。

### 4.2 DN 倾斜清单

- [ ] 确认倾斜 DN 和倾斜类型：磁盘、CPU 或两者都有。
- [ ] 查看空间分析、性能趋势和热力图。
- [ ] 定位异常表、分区、GSI 或单表。
- [ ] 查看 `SHOW CREATE TABLE`、`SHOW RULE`、`SHOW TOPOLOGY`。
- [ ] 判断是否误建单表、拆分键不合理或热点分区。
- [ ] 对分区表执行分区迁移或 Locality 调整。
- [ ] 对大单表制定改分布式表方案。
- [ ] 对拆分键不合理的大表制定重建迁移方案。
- [ ] 验证迁移后 DN 水位、业务 RT 和慢日志。
- [ ] 更新建表规范和自动分区策略。

## 5. 复盘模板

故障基本信息：

- 故障时间：
- 影响业务：
- 影响范围：
- 发现方式：
- 恢复时间：

根因分类：

- [ ] 缺少索引。
- [ ] SQL 未带拆分键或分区键。
- [ ] 业务突增导致资源打满。
- [ ] 大表误建为单表。
- [ ] 拆分键不合理。
- [ ] 热点分区或热点 DN。
- [ ] 其他：

处置动作：

- 临时止血动作：
- 结构性修复动作：
- 执行人：
- 执行时间：
- 验证结果：

预防动作：

- 慢 SQL 告警：
- 索引或 GSI 优化：
- 建表规范更新：
- 自动分区或自动 Sharding：
- DN 倾斜巡检：
- 压测或容量评估：

## 6. 参考官方文档

- [PolarDB-X 慢日志](https://help.aliyun.com/zh/polardb/polardb-for-xscale/slow-query-logs)
- [PolarDB-X SQL Explorer 和审计](https://help.aliyun.com/zh/polardb/polardb-for-xscale/sql-explorer-and-audit-5/)
- [PolarDB-X SQL 日志分析](https://help.aliyun.com/zh/polardb/polardb-for-xscale/log-analysis-1)
- [PolarDB-X SQL 调优指南](https://help.aliyun.com/zh/polardb/polardb-for-xscale/sql-tuning-guide-2/)
- [PolarDB-X EXPLAIN 执行计划](https://help.aliyun.com/zh/polardb/polardb-for-xscale/explain)
- [PolarDB-X 执行计划管理](https://help.aliyun.com/zh/polardb/polardb-for-xscale/execution-plan-management)
- [PolarDB-X 性能趋势](https://help.aliyun.com/zh/polardb/polardb-for-xscale/performance-trend)
- [PolarDB-X 空间分析](https://help.aliyun.com/zh/polardb/polardb-for-xscale/storage-analysis)
- [PolarDB-X 热力图](https://help.aliyun.com/zh/polardb/polardb-for-xscale/heatmap)
- [PolarDB-X 表规则和拓扑查询语句](https://help.aliyun.com/zh/polardb/polardb-for-xscale/rule-and-topology-query-statements-1)
- [PolarDB-X 分区迁移](https://help.aliyun.com/zh/polardb/polardb-for-xscale/partition-migration)
- [PolarDB-X AUTO 模式 Locality](https://help.aliyun.com/zh/polardb/polardb-for-xscale/use-the-locality-attribute-to-specify-data-nodes-auto-mode)
- [PolarDB-X AUTO 模式 CREATE TABLE](https://help.aliyun.com/zh/polardb/polardb-for-xscale/create-table-auto-mode)
- [PolarDB-X AUTO 模式 ALTER TABLE](https://help.aliyun.com/zh/polardb/polardb-for-xscale/alter-table-auto-mode)
- [PolarDB-X AUTO 模式变更表类型及分区策略](https://help.aliyun.com/zh/polardb/polardb-for-xscale/change-the-type-and-partitioning-rule-of-a-table)
- [PolarDB-X DRDS 模式 CREATE TABLE](https://help.aliyun.com/zh/polardb/polardb-for-xscale/create-table-drds-mode)
- [PolarDB-X DRDS 模式自动 Sharding](https://help.aliyun.com/zh/polardb/polardb-for-xscale/automatic-sharding)
- [PolarDB-X DRDS 模式变更表类型及拆分规则](https://help.aliyun.com/zh/polardb/polardb-for-xscale/change-the-type-and-modify-the-sharding-rule-of-a-table)
