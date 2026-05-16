---
title: "Database Performance Troubleshooting: From CPU and IO to Lock Waits"
slug: "database-performance-cpu-io-locks"
era: "2021"
drafted_at: "2026-05-16"
summary: "A practical 2021-era framework for separating CPU saturation, storage latency, memory pressure, transaction contention, and lock waits during database performance incidents."
tags: ["Database", "Performance", "Troubleshooting", "Reliability"]
---

When a database becomes slow, people often want one reason.

The CPU is high.

The disk is slow.

The SQL is bad.

There is a lock.

Any of these may be true, but database performance problems rarely respect single-cause explanations. A slow query can increase CPU. High concurrency can create lock waits. Lock waits can keep connections occupied. Occupied connections can cause application pool exhaustion. Pool exhaustion can make the business think the database is down.

The visible symptom is often several steps away from the root cause.

By 2021, I had learned to approach performance troubleshooting as separation work. The first goal is to separate resource saturation, execution inefficiency, and concurrency contention.

## The 2021 operating reality

Cloud databases made metrics easier to access. CPU, memory, IOPS, connection count, slow SQL, replication delay, and storage usage were usually visible in a console. Monitoring dashboards were improving, and more teams were becoming familiar with Prometheus-style metric thinking.

But more metrics did not automatically mean better diagnosis.

Engineers still needed to connect a metric to database behavior. A CPU chart tells us that CPU is busy. It does not tell us whether the CPU is busy because of many small queries, one bad query, background tasks, excessive parsing, poor indexes, or lock spin. An IO chart tells us storage is under pressure. It does not tell us whether reads, writes, flushing, temporary tables, or backup activity are responsible.

Metrics are clues. Diagnosis requires a model.

## CPU saturation

High CPU is often the easiest symptom to notice because dashboards make it obvious. It is also easy to misread.

High CPU can be caused by:

- inefficient SQL scanning too many rows;
- high QPS with many small queries;
- expensive sorting or grouping;
- excessive connection concurrency;
- missing or unsuitable indexes;
- execution plan changes;
- background database tasks;
- application retries after timeout.

The first question is whether high CPU correlates with business traffic. If traffic doubled and CPU doubled, the system may simply be reaching capacity. If CPU jumped without traffic growth, I look for query pattern changes, plan changes, batch jobs, or abnormal retries.

Slow query logs help, but they may miss the full picture. Many fast queries can create high CPU together. A single SQL taking 200 milliseconds may not look dramatic, but if it runs thousands of times per second, it becomes important.

This is why both top SQL by total time and top SQL by frequency matter.

## IO pressure

IO problems can be more subtle.

In database systems, IO pressure may show up as higher query latency, slower checkpoints, longer backup time, replication delay, or general instance sluggishness. The root cause might be insufficient buffer pool hit ratio, large scans, temporary tables spilling to disk, write bursts, redo log pressure, or storage throughput limits.

The key is to distinguish read pressure from write pressure.

Read pressure often points to inefficient queries, poor indexing, low cache hit rate, or working set growth beyond memory. Write pressure may come from heavy insert/update/delete workload, secondary index maintenance, large transactions, or background flushing.

Cloud database users sometimes assume storage is infinitely elastic. It is not. Storage systems have throughput, latency, and IOPS characteristics. A database can be limited by storage even when CPU is not fully saturated.

When IO latency rises, I ask:

- Did the working set grow?
- Did a batch job start scanning large tables?
- Did backup or migration tasks overlap with peak traffic?
- Are temporary tables being written to disk?
- Did write volume increase?
- Is the storage specification appropriate for the workload?

## Memory pressure

Memory pressure is often indirect. In MySQL, buffer pool sizing, connection memory, temporary table usage, and workload patterns all matter. When memory is insufficient, the database may perform more physical IO. When too many connections are active, per-connection memory can become significant.

Memory problems can therefore look like IO problems.

This is one reason I avoid diagnosing from one chart. A rising IO pattern may be caused by poorer cache efficiency. Poor cache efficiency may be caused by data growth. Data growth may be caused by business retention changes. The technical symptom is connected to product behavior.

For managed databases, users may not control every memory parameter directly, but they still need to understand whether the current specification matches the data and concurrency profile.

## Lock waits and transaction contention

Lock problems feel different from pure resource saturation.

CPU may not be high. IO may not be high. But requests hang. Transactions wait. Connection count rises. Application threads pile up. Eventually the system looks overloaded even though hardware metrics appear moderate.

In transactional databases, lock waits usually require careful timeline reconstruction.

Important questions include:

- Which transaction is waiting?
- Which transaction is blocking?
- How long has the blocking transaction been open?
- What SQL did it execute?
- Is it an application transaction, batch job, DDL, or manual operation?
- Are there missing indexes causing wider lock ranges?
- Did application code hold a transaction while calling external services?

Long transactions are especially dangerous. They may hold locks, delay purge, increase undo pressure, and create confusing secondary effects. Sometimes the SQL inside the transaction is fast, but the application keeps the transaction open too long.

That is an application architecture problem expressed as a database symptom.

## DDL and operational tasks

In 2021, online DDL capabilities were better than in earlier years, but schema changes still required caution. A table alteration on a large production table could affect metadata locks, replication, IO, and business traffic depending on engine version, operation type, and execution method.

Operational tasks also mattered:

- backup;
- data migration;
- batch correction scripts;
- report generation;
- index creation;
- archive jobs.

These tasks often run outside the main request path, which makes them easy to miss during troubleshooting. When an incident begins suddenly, I always ask what changed operationally. Not only deployments, but jobs.

## A separation framework

My practical framework is simple:

1. Check whether the symptom is latency, errors, connection exhaustion, replication delay, or all of them.
2. Look at CPU, IO, memory, and connection trends together.
3. Identify top SQL by total cost and frequency.
4. Check active sessions and transaction state.
5. Look for lock waits and blocking transactions.
6. Review recent changes: deployment, schema change, data growth, batch job, backup, migration.
7. Separate online traffic from background workload.
8. Apply the smallest safe mitigation first.

Mitigation may mean killing a blocking session, pausing a batch job, adding an index, scaling an instance, limiting application concurrency, changing a query, or moving analytics traffic elsewhere. The correct action depends on the failure mode.

## The lesson

Database performance troubleshooting is not about staring at charts until one looks suspicious. It is about building a causal chain.

CPU, IO, memory, locks, connections, SQL, and application behavior are different windows into the same system. The engineer's job is to connect them without jumping too quickly.

In 2021, this became one of my most important habits: separate the symptoms, identify the dominant bottleneck, act conservatively, and verify with metrics after the change.

A good diagnosis does not only fix the incident. It teaches the team how the system actually behaves under pressure.

