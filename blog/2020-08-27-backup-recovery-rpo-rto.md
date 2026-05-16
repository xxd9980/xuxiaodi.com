---
title: "Backup and Recovery Are Not Buttons: RPO, RTO, and Real Business Risk"
slug: "backup-recovery-rpo-rto-business-risk"
era: "2020"
drafted_at: "2026-05-16"
summary: "A 2020-era database reliability note on backup strategy, recovery objectives, binlog retention, restore drills, and the gap between having backups and being able to recover."
tags: ["Database", "Backup", "Recovery", "Reliability"]
---

Backup is easy to enable and hard to trust.

In many systems, backup appears as a checkbox or policy setting. Daily backup. Seven-day retention. Log backup. Automatic snapshot. Point-in-time recovery. These phrases sound reassuring, especially in a cloud console.

But a backup policy is not the same as recovery capability.

This became very clear to me around 2020. Many teams already understood that production databases needed backups, but fewer teams regularly asked the harder questions:

- What data can we afford to lose?
- How long can the business wait?
- Have we tested restoration recently?
- Can we restore to a different environment?
- Do we know which application version matches the restored data?
- Will dependent systems accept the recovered state?
- Who has permission to trigger emergency recovery?

These questions turn backup from a product feature into a business continuity discipline.

## RPO and RTO in plain language

Two terms matter most: RPO and RTO.

RPO, recovery point objective, is about data loss. If the database fails at 10:00, can we restore to 09:59, 09:30, yesterday, or last week? The larger the gap, the more data the business may lose.

RTO, recovery time objective, is about time to resume service. If the database fails at 10:00, can the service return in five minutes, one hour, half a day, or tomorrow?

The two are related but different. A system may have excellent RPO but poor RTO: data is safe, but restoration is slow. Another system may restart quickly but lose recent writes. Business teams often care about both, but they may not express them in technical language. Engineers must translate.

For example, an internal reporting database may tolerate several hours of recovery time. An order database during a sales event may not. A user profile system may tolerate short read-only degradation but not permanent data loss. These differences should influence backup and recovery design.

## The 2020 cloud database context

By 2020, managed database services had made backup more accessible. Users expected automated full backups, log backups, snapshots, and point-in-time recovery for common engines such as MySQL. Cloud providers were also improving cross-zone and cross-region reliability options, but cost and complexity still shaped adoption.

Many production workloads were still designed around a primary relational database. Some had read replicas. Some had cache layers. Some used message queues. But the database remained the source of truth for important business state.

This meant that backup and recovery were not optional platform features. They were part of the trust model.

## Full backup is only the beginning

A full backup gives a baseline recovery point. For MySQL, this might be a physical backup or logical backup depending on product design and user needs. Physical backup is usually faster for large instances, while logical backup can be useful for portability and object-level recovery, but may be slower and more sensitive to schema and data volume.

Full backup alone is often not enough.

If a full backup runs once per day and no log backup exists, the business may lose many hours of data. That may be acceptable for a test environment, but dangerous for transactional systems. This is why binary log retention and point-in-time recovery matter.

Point-in-time recovery is powerful because it can restore the database to a moment before a failure or mistaken operation. But it depends on a complete chain: base backup, log retention, correct log application, time selection, and a restoration process that users understand.

If any link is weak, the phrase "point-in-time recovery" becomes less reliable than it sounds.

## The most common recovery scenarios

Not every recovery is caused by hardware failure.

In practice, recovery scenarios often include:

- accidental data deletion;
- incorrect update without a proper `WHERE` clause;
- failed schema migration;
- application bug writing bad data;
- ransomware or security incident;
- storage or instance failure;
- region or zone-level disaster;
- human misunderstanding during operations.

The recovery strategy should match the scenario. Restoring a whole instance may be appropriate for severe failure, but too disruptive for a single table mistake. Flashback-like tools, binlog parsing, logical export from a restored instance, or application-level compensation may be better for partial corruption.

The important point is that recovery is not one operation. It is a decision tree.

## Backup must be observable

A backup system should not only run. It should explain itself.

Useful questions include:

- When did the last successful backup finish?
- How long did it take?
- How large was it?
- Did backup duration grow recently?
- Are binary logs being retained as expected?
- Are failed backup tasks visible?
- Will backup load affect business traffic?
- Can support engineers inspect backup status without guessing?

In 2020, observability around backup was becoming more important because data volumes were increasing. A backup policy that worked for a 100 GB instance might not behave the same for a multi-terabyte database. Duration, storage cost, network transfer, and restore time all changed with scale.

A mature backup system should show these changes before they become an emergency.

## Restore drills are the real test

The only backup that matters is one that can be restored.

This sounds obvious, but many teams enable backup without practicing restoration. They assume the product works. Most of the time it does. But in an incident, the hard part is not only the technical restore. It is the operational coordination:

- choosing the restore point;
- deciding whether to overwrite or create a new instance;
- validating data after restore;
- reconnecting applications;
- handling writes that happened after the restore point;
- communicating impact to stakeholders.

A restore drill exposes gaps while the business is calm. It also helps teams estimate actual RTO instead of guessing.

For critical systems, I prefer periodic recovery exercises. They do not need to be dramatic. Restoring to a temporary instance, checking key tables, confirming account access, and measuring duration already provides valuable confidence.

## The human side of recovery

Backup and recovery are technical topics, but incidents are human events.

During a database incident, people are anxious. Product managers ask for time estimates. Business teams ask about data loss. Engineers inspect logs. Support teams communicate with customers. Leaders decide whether to fail over, restore, wait, or roll back.

Clear RPO and RTO thinking reduces panic. It gives teams a language for trade-offs. Instead of saying "the database is broken," we can say, "We can restore to 09:58 with an estimated recovery time of 40 minutes, but writes after that point need separate reconciliation."

That kind of sentence is valuable because it connects technical reality to business decision-making.

## My takeaway

Backup is not a checkbox. Recovery is not a button.

They are a promise that data can survive failure, human error, and time pressure. In a cloud database product, the platform should make backup easy to configure, but it should also help users understand whether their recovery expectations are realistic.

In 2020, I learned to judge backup systems less by whether they existed and more by whether they could answer one question:

When the business is in trouble, can we recover the right data, to the right point, in the right amount of time, with enough confidence to act?

That is the real purpose of backup.

