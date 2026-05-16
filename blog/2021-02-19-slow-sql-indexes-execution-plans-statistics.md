---
title: "A Slow SQL Investigation: Indexes, Execution Plans, and Statistics"
slug: "slow-sql-indexes-execution-plans-statistics"
era: "2021"
drafted_at: "2026-05-16"
summary: "A 2021-era troubleshooting note on approaching slow SQL through execution plans, index design, cardinality, statistics, and workload context."
tags: ["Database", "SQL", "MySQL", "Performance"]
---

Slow SQL is one of the most familiar database problems, but it is also one of the easiest to oversimplify.

The common reaction is immediate: add an index.

Sometimes that is correct. Sometimes it is only temporarily correct. Sometimes it makes write performance worse, increases storage, changes optimizer choices in unexpected ways, or hides a deeper workload problem.

By 2021, I had seen enough slow query cases to become more cautious. A slow SQL investigation should not begin with a solution. It should begin with a model of how the database is doing work.

## The 2021 context

In 2021, many production MySQL systems were still running MySQL 5.7, while MySQL 8.0 adoption was increasing in new systems and selected migrations. Cloud database products made it easier to view slow query logs, performance metrics, and instance health, but the core troubleshooting work still required understanding SQL behavior.

Many applications were also generating more data than their original schema design expected. Tables that once held millions of rows grew to tens or hundreds of millions. Query patterns that were fine during early product stages became expensive as user activity, reporting needs, and retention periods increased.

This was a typical environment for slow SQL: the query did not change, but the data did.

## Start with the symptom, not the query text

When someone reports a slow SQL problem, the first question is not only "Which SQL is slow?"

It is also:

- When did it become slow?
- Is it always slow or only during peaks?
- Did data volume change?
- Did the execution plan change?
- Is it slow for all parameter values or only some?
- Does it block other queries?
- Is the instance itself under CPU, IO, or memory pressure?
- Is the query part of an online request, batch job, or report?

The same SQL text can behave differently depending on parameters, data distribution, cache state, and concurrent workload. A query that returns one user's records may be fast for most users but slow for a few large tenants. A query that uses an index today may stop using it after statistics change. A report query may be acceptable at midnight but harmful during business hours.

Context decides severity.

## Explain is a map, not the territory

`EXPLAIN` is often the first tool used for slow SQL, and it is essential. It shows table access order, index usage, estimated rows, join type, filtering, and extra operations such as temporary tables or filesort.

But `EXPLAIN` is not the actual execution. It is the optimizer's plan. It can be inaccurate if statistics are stale or if data distribution is skewed. It may not show runtime waits clearly. It also does not answer whether the SQL is appropriate for the business use case.

I use execution plans to ask better questions:

- Is the database scanning far more rows than expected?
- Is the chosen index selective enough?
- Is a composite index matching the leftmost prefix rule?
- Are functions or implicit conversions preventing index use?
- Is sorting or grouping forcing temporary work?
- Is join order reasonable?
- Are estimated rows very different from real behavior?

The goal is not to memorize plan output. The goal is to understand why the optimizer thinks this path is cheaper than alternatives.

## Indexes are about selectivity and order

A useful index reduces work. That usually means it helps the database find fewer rows, avoid sorting, or satisfy a query from a predictable access path.

Bad index design often comes from looking at columns one by one. For example, if a query filters by `tenant_id`, `status`, and `created_at`, adding separate indexes on each column may not solve the problem. A composite index aligned with the query pattern may be more useful.

But the order matters.

High-cardinality equality filters often belong earlier. Range filters may limit how later columns can be used. Ordering requirements may influence index design. The best index for one query may not be the best for another. In multi-tenant systems, `tenant_id` may be essential even if it is not highly selective globally, because it constrains business scope and helps avoid noisy-neighbor patterns.

Indexes are not decorations. They are workload-specific structures.

## Statistics can quietly change everything

One lesson from real systems is that performance can change without code deployment.

Data distribution changes. A table grows. A status value becomes dominant. Recently inserted rows concentrate in a time range. The optimizer's statistics no longer reflect reality. Suddenly, a plan that was acceptable becomes inefficient.

In MySQL, statistics influence cost estimation. If estimates are wrong, the optimizer may choose an index that looks cheap but is expensive in practice. This is especially noticeable in skewed data, low-cardinality columns, and queries with parameter patterns that vary widely.

When a slow query appears "suddenly," I pay attention to:

- table row count growth;
- cardinality changes;
- recently added or removed indexes;
- statistics refresh behavior;
- parameter skew;
- plan changes before and after the incident.

Sometimes the fix is index design. Sometimes it is query rewrite. Sometimes it is updating statistics. Sometimes the real answer is separating workloads so that reporting queries do not compete with online transactions.

## The hidden cost of returning too much

Another common issue is that the database does more work because the application asks for too much.

Examples include:

- `SELECT *` on wide tables;
- pagination with large offsets;
- sorting large result sets;
- joining tables only to discard most columns;
- querying historical data without time boundaries;
- returning data for application-side filtering.

These patterns may be acceptable early in a product's life. As data grows, they become expensive. Large offset pagination is a classic example: the user may only see twenty rows, but the database may have to scan and discard a large number of rows before returning them.

In these cases, optimization is not only a database task. It may require changing API design, UI behavior, data retention, or reporting architecture.

## A practical investigation flow

When I investigate slow SQL, I usually follow a flow like this:

1. Identify the exact SQL pattern and parameters.
2. Confirm whether slowness is consistent or workload-dependent.
3. Check instance-level CPU, IO, memory, connections, and locks.
4. Review slow query frequency, average time, and max time.
5. Use `EXPLAIN` to inspect access paths and row estimates.
6. Compare index design with filter, join, sort, and grouping patterns.
7. Check data distribution and whether certain tenants or parameter values dominate.
8. Test candidate rewrites or indexes in a safe environment.
9. Consider write overhead and plan stability before applying changes.
10. Monitor after the change instead of assuming success.

This flow keeps the investigation grounded. It avoids both extremes: blindly adding indexes and endlessly analyzing without action.

## The lesson

Slow SQL is not just a query problem. It is a conversation between schema, data distribution, optimizer estimation, application behavior, and business growth.

In 2021, I learned to treat slow SQL as a signal. Sometimes it says an index is missing. Sometimes it says a table has outgrown its original design. Sometimes it says a report should not run on the primary database. Sometimes it says the product is now successful enough that yesterday's shortcuts have become today's bottlenecks.

The most useful performance work begins when we stop asking, "Which index should I add?" and start asking, "Why is the database doing this much work for this business request?"

