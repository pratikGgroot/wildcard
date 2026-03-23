# Epic 11: Reporting & Analytics Dashboard

## Overview
Build comprehensive analytics dashboards showing pipeline metrics, AI performance, bias analytics, and recruiter activity with export capabilities.

## Business Value
- Provides data-driven insights into hiring effectiveness
- Enables identification of bottlenecks and optimization opportunities
- Supports compliance reporting and audits

## BRD Requirements Covered
- FR-DA-01: Dashboard with key metrics (open roles, applicants, shortlisted, etc.)
- FR-DA-02: Time-in-stage funnel chart
- FR-DA-03: AI scoring distribution chart
- FR-DA-04: Source-of-hire tracking
- FR-DA-05: Bias analytics overview
- FR-DA-06: Recruiter activity report
- FR-DA-07: Export reports as CSV/PDF

## Priority
**HIGH**

## NFR / Tech Notes
- **Performance:** Dashboard loads ≤2 seconds (NFR-P-04)
- **Real-time:** Metrics update every 5 minutes
- **Data Warehouse:** Consider separate analytics DB for complex queries
- **Visualization:** Recharts or Nivo for charts
- **Export:** Generate reports asynchronously for large datasets

### SLA Requirements
- **Dashboard Load Time:** ≤2 seconds (P95) (NFR-P-04)
- **Report Generation:** ≤30 seconds for standard reports
- **Data Freshness:** Metrics updated every 5 minutes

## Technical Design

### Analytics Architecture
```
┌──────────────────────────────────────┐
│     Analytics Dashboard (React)      │
└────────────┬─────────────────────────┘
             │
┌────────────▼─────────────────────────┐
│     Analytics API Service            │
│  (Cached queries, aggregations)      │
└────────────┬─────────────────────────┘
             │
┌────────────▼─────────────────────────┐
│   PostgreSQL + Materialized Views    │
│   (Pre-aggregated metrics)           │
└──────────────────────────────────────┘
```

### Key Metrics
```typescript
interface DashboardMetrics {
  overview: {
    openRoles: number;
    totalApplicants: number;
    shortlisted: number;
    inInterview: number;
    offersMade: number;
    hired: number;
  };
  
  pipelineHealth: {
    avgTimeToShortlist: number; // days
    avgTimeToHire: number; // days
    conversionRates: {
      appliedToScreened: number;
      screenedToInterview: number;
      interviewToOffer: number;
      offerToHired: number;
    };
  };
  
  aiPerformance: {
    avgFitScore: number;
    scoreDistribution: { range: string; count: number }[];
    shortlistAccuracy: number; // % match with recruiter picks
  };
  
  biasMetrics: {
    overallRiskScore: 'low' | 'medium' | 'high';
    flaggedCandidates: number;
    demographicParity: number;
    equalizedOdds: number;
  };
  
  sourceOfHire: {
    source: string;
    applicants: number;
    hired: number;
    conversionRate: number;
  }[];
}
```

### Materialized Views
```sql
-- Pre-aggregate metrics for fast dashboard loading
CREATE MATERIALIZED VIEW mv_pipeline_metrics AS
SELECT 
  j.id as job_id,
  j.title,
  COUNT(DISTINCT a.id) as total_applicants,
  COUNT(DISTINCT CASE WHEN a.pipeline_stage = 'Screened' THEN a.id END) as screened_count,
  COUNT(DISTINCT CASE WHEN a.pipeline_stage LIKE '%Interview%' THEN a.id END) as interview_count,
  COUNT(DISTINCT CASE WHEN a.pipeline_stage = 'Offer' THEN a.id END) as offer_count,
  COUNT(DISTINCT CASE WHEN a.pipeline_stage = 'Hired' THEN a.id END) as hired_count,
  AVG(cs.fit_score) as avg_fit_score,
  MAX(a.updated_at) as last_activity
FROM jobs j
LEFT JOIN applications a ON j.id = a.job_id
LEFT JOIN candidate_scores cs ON a.id = cs.application_id
GROUP BY j.id, j.title;

-- Refresh every 5 minutes
CREATE INDEX idx_mv_pipeline_metrics_job_id ON mv_pipeline_metrics(job_id);

-- Time-in-stage analysis
CREATE MATERIALIZED VIEW mv_time_in_stage AS
SELECT 
  job_id,
  pipeline_stage,
  AVG(EXTRACT(EPOCH FROM (next_stage_at - entered_stage_at)) / 86400) as avg_days_in_stage,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (next_stage_at - entered_stage_at)) / 86400) as median_days_in_stage
FROM (
  SELECT 
    a.job_id,
    st.to_stage as pipeline_stage,
    st.moved_at as entered_stage_at,
    LEAD(st.moved_at) OVER (PARTITION BY st.application_id ORDER BY st.moved_at) as next_stage_at
  FROM stage_transitions st
  JOIN applications a ON st.application_id = a.id
) stage_durations
WHERE next_stage_at IS NOT NULL
GROUP BY job_id, pipeline_stage;
```

### API Endpoints
```python
@router.get("/api/analytics/dashboard")
async def get_dashboard_metrics(
    job_id: Optional[str] = None,
    date_range: Optional[str] = None
):
    """Get aggregated dashboard metrics."""
    # Query materialized views for fast response
    pass

@router.get("/api/analytics/funnel")
async def get_funnel_data(job_id: str):
    """Get stage-by-stage funnel data."""
    pass

@router.get("/api/analytics/bias-report")
async def get_bias_report(job_id: Optional[str] = None):
    """Get bias analytics and fairness metrics."""
    pass

@router.post("/api/analytics/export")
async def export_report(
    report_type: str,
    filters: dict,
    format: str  # csv or pdf
):
    """Generate and export analytics report."""
    # Queue async report generation
    task_id = generate_report_task.delay(report_type, filters, format)
    return {'taskId': task_id, 'status': 'generating'}
```

## Stories
- Story 11.1: Overview Dashboard
- Story 11.2: Time-in-Stage Funnel Chart
- Story 11.3: AI Scoring Distribution Chart
- Story 11.4: Source-of-Hire Tracking
- Story 11.5: Bias Analytics Dashboard
- Story 11.6: Recruiter Activity Report
- Story 11.7: CSV/PDF Export

## Estimated Effort
**18-21 story points** (3 sprints)

## Success Metrics
- Dashboard load time ≤2 seconds (P95)
- Report generation ≤30 seconds
- 90% of recruiters view dashboard weekly
- Export success rate ≥99%
