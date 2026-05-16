---
title: "Observability for Databases: Metrics, Logs, Traces, and the Questions Behind Them"
slug: "observability-for-databases"
era: "2024"
drafted_at: "2026-05-16"
summary: "A 2024-era article on building practical database observability by connecting metrics, logs, traces, SQL behavior, and business questions."
tags: ["Observability", "Database", "Cloud", "Analytics"]
---

Database observability is not the same as having many charts.

A dashboard can show CPU, memory, IOPS, connections, QPS, TPS, slow queries, replication delay, storage usage, lock waits, and backup status. All of these are useful. But when a production issue happens, the question is not "How many charts do we have?"

The question is, "Can we explain what is happening quickly enough to make a good decision?"

That is the practical purpose of observability.

## The 2024 context

By 2024, observability had become a standard part of modern infrastructure conversations. Metrics, logs, traces, dashboards, SLOs, and alerting were familiar terms. OpenTelemetry had become an important part of the ecosystem, and many teams were trying to connect application traces with infrastructure behavior.

For databases, this was both helpful and challenging.

Applications were becoming easier to trace, but databases remained shared, stateful, and workload-sensitive. A single database instance might serve many services, background jobs, BI tools, and migration tasks. A trace could show one slow request, but the database might be slow because of another workload entirely.

Database observability therefore needs both application context and engine context.

## Begin with questions

The best observability design begins with questions, not metrics.

For databases, important questions include:

- Is the database reachable?
- Is latency normal?
- Is the workload higher than usual?
- Are errors increasing?
- Is the bottleneck CPU, IO, memory, lock contention, or network?
- Which SQL patterns consume the most time?
- Are long transactions holding resources?
- Is replication delay affecting read consistency?
- Are backups healthy?
- Is storage growth normal?
- Which business service is affected?

Each question maps to signals. If we collect signals without questions, we get dashboards that look impressive but do not guide action.

## Metrics show shape

Metrics are the first layer because they show trends and magnitude.

Core database metrics usually include:

- CPU utilization;
- memory usage;
- active and total connections;
- QPS and TPS;
- read and write IOPS;
- storage latency;
- buffer pool hit ratio or cache-related indicators;
- slow query count;
- lock wait count or duration;
- replication delay;
- disk usage and growth rate;
- backup success and duration.

Metrics help answer whether something is abnormal and when it started. They are especially useful for correlation. If CPU rose at the same time slow queries increased, that is a clue. If lock waits rose before connection exhaustion, that suggests a causal path. If IO latency increased during backup, operational workload may be involved.

But metrics are aggregated. They show shape, not full explanation.

## Logs provide events

Logs show discrete events:

- errors;
- connection failures;
- restart messages;
- backup task results;
- replication errors;
- deadlocks;
- slow query records;
- operational task status.

For database troubleshooting, slow query logs and error logs remain extremely valuable. They help identify specific SQL, time ranges, and engine-level warnings. However, logs can be too verbose or too sparse depending on configuration. If slow query thresholds are too high, important patterns may be missed. If thresholds are too low, noise can overwhelm analysis.

The goal is not to log everything. The goal is to log events that help explain behavior.

## Traces connect user experience to database work

Distributed tracing is powerful because it connects a user request to service calls, cache access, queue operations, and database queries. For application teams, this is often the fastest way to see that a request spent most of its time waiting for a SQL query.

But traces must be interpreted carefully.

A trace can tell us that one SQL call took two seconds. It may not tell us whether the SQL was intrinsically expensive, blocked by a lock, waiting for IO, affected by a cold cache, or queued behind connection pool contention. To answer that, we need database-side signals.

The ideal workflow connects trace data with database metrics and query analysis:

1. Identify the user-visible slow request.
2. Find the database call inside the trace.
3. Match the time window with database metrics.
4. Check slow SQL and active sessions.
5. Determine whether the query is the cause or a victim.

This prevents a common mistake: blaming the SQL in the trace when the real issue is system-wide contention.

## SQL-level observability matters

For databases, SQL patterns are often the most actionable unit.

Useful SQL-level views include:

- top SQL by total execution time;
- top SQL by average latency;
- top SQL by frequency;
- queries with full table scans;
- queries creating temporary tables;
- queries with large rows examined versus rows returned;
- queries involved in lock waits;
- plan changes over time.

This level of observability helps teams move from "the database is slow" to "this class of query became expensive after data distribution changed."

In cloud database products, SQL insight features can be very helpful when they summarize workload patterns without requiring every user to become a database expert. The challenge is presenting enough detail to guide action without drowning users in engine internals.

## Alerts should be tied to action

An alert is useful only if someone knows what to do with it.

Bad alerts say:

"CPU is high."

Better alerts say:

"CPU has been above threshold for ten minutes, QPS is normal, slow query count increased, top SQL changed, check recent report jobs and execution plans."

Not every alert can include that much intelligence, but the runbook can. Each important database alert should have an associated response path:

- what to check first;
- how to confirm impact;
- common causes;
- safe mitigations;
- escalation owner;
- customer communication guidance if needed.

Alerting without runbooks creates noise. Alerting with runbooks creates operational muscle.

## Observability for cost and capacity

Observability is not only for incidents.

It also helps with capacity planning and cost optimization. Database specifications are often upgraded during emergencies and then forgotten. Storage grows quietly. Read replicas remain underused. Backup retention grows cost. SQL inefficiency consumes CPU that looks like a need for larger instances.

By analyzing long-term trends, teams can answer:

- Is the instance over-provisioned?
- Is peak usage predictable?
- Which workload drives cost?
- Can reporting be moved to a replica or analytics system?
- Is storage growth caused by business data, logs, or obsolete records?
- Will the current specification handle the next quarter?

This is where database observability overlaps with data analysis. Metrics become operational data for engineering decisions.

## The lesson

Database observability should help people reason under uncertainty.

Metrics show shape. Logs show events. Traces show request paths. SQL analysis shows workload behavior. Business context shows impact. None of these is enough alone.

In 2024, my view became simple: an observable database system is one where engineers can move from symptom to explanation to action without relying on guesswork or personal memory.

The goal is not to build the most beautiful dashboard. The goal is to make the database less mysterious when it matters most.

