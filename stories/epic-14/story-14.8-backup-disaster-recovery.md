# Story 14.8: Backup & Disaster Recovery

## User Story
**As a** DevOps engineer  
**I want to** have automated backups and a tested disaster recovery plan  
**So that** data can be recovered in the event of a failure or data loss incident

## BRD Requirements Covered
- BRD Section 7.3: Availability & Reliability — 99.9% uptime SLA; resilience to partial failures

## Acceptance Criteria
1. **Given** the PostgreSQL database is running  
   **When** the daily backup job runs  
   **Then** a full database snapshot is taken and stored in S3 with 30-day retention

2. **Given** a backup exists  
   **When** a restore is needed  
   **Then** the database can be restored to any point within the last 7 days (PITR)

3. **Given** a disaster recovery drill is run  
   **When** the drill completes  
   **Then** the platform is restored to a functional state within the RTO (4 hours)

4. **Given** the primary region fails  
   **When** failover is triggered  
   **Then** the platform switches to the secondary region within 30 minutes

5. **Given** backups are taken  
   **When** they are verified  
   **Then** a weekly automated restore test confirms backup integrity

## Priority
**P0 — Must Have**

## Estimated Effort
**8 story points**

## NFR / Tech Notes
- **RPO (Recovery Point Objective):** ≤ 1 hour (PITR enabled)
- **RTO (Recovery Time Objective):** ≤ 4 hours
- **Backup Retention:** 30 days for daily snapshots; 1 year for monthly
- **PITR:** PostgreSQL WAL archiving to S3 for point-in-time recovery
- **Multi-Region:** Read replica in secondary region for failover

## Technical Design

### Backup Strategy
```
PostgreSQL:
  - Continuous WAL archiving to S3 (PITR)
  - Daily pg_dump snapshot to S3 (30-day retention)
  - Weekly automated restore test

Redis:
  - RDB snapshots every 6 hours to S3

S3 (Resume files):
  - Cross-region replication enabled
  - Versioning enabled (30-day version retention)

Vector DB (pgvector):
  - Covered by PostgreSQL backup
```

### DR Runbook (Key Steps)
```
1. Detect failure (monitoring alert)
2. Assess scope (partial vs full region failure)
3. Initiate failover to secondary region
4. Update DNS to point to secondary
5. Verify data integrity from latest backup
6. Notify stakeholders
7. Post-incident review
```

### API Endpoints
```
POST /api/admin/backup/trigger          — Manually trigger backup (admin)
GET  /api/admin/backup/status           — Last backup status and timestamp
POST /api/admin/backup/restore-test     — Trigger automated restore test
```

## Sub-Tasks
- [ ] 14.8.a — Set up PostgreSQL PITR with WAL archiving to S3
- [ ] 14.8.b — Set up daily snapshot backups with 30-day retention
- [ ] 14.8.c — Set up S3 cross-region replication for resume files
- [ ] 14.8.d — Implement weekly automated restore test
- [ ] 14.8.e — Document and test DR runbook (RTO ≤ 4 hours)

## Testing Strategy
- Backup: Verify daily backup completes and is stored in S3
- Restore: Weekly automated restore test passes
- DR Drill: Quarterly full DR drill; verify RTO ≤ 4 hours

## Dependencies
- Story 14.2 (Kubernetes — infrastructure to recover)
- Epic 15 (AWS S3 — backup storage)
