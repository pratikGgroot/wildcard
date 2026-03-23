# Story 14.4: Monitoring & Alerting

## User Story
**As a** DevOps engineer  
**I want to** monitor system health and receive alerts on anomalies  
**So that** I can detect and resolve issues before they impact users

## BRD Requirements Covered
- BRD Section 7.5: Real-time alerting on error spikes and latency regressions
- BRD Section 7.3: Uptime SLA 99.9%

## Acceptance Criteria
1. **Given** the platform is running  
   **When** I open the monitoring dashboard  
   **Then** I see real-time metrics: request rate, error rate, latency (P50/P95/P99), and pod health

2. **Given** error rate exceeds 1% for 5 minutes  
   **When** the alert fires  
   **Then** an alert is sent to the on-call engineer via PagerDuty/Slack

3. **Given** API P95 latency exceeds 2 seconds  
   **When** the alert fires  
   **Then** an alert is sent with the affected endpoint and latency value

4. **Given** a pod is in CrashLoopBackOff  
   **When** detected  
   **Then** an alert fires within 2 minutes

5. **Given** AI model score distribution drifts significantly  
   **When** drift is detected  
   **Then** an alert is sent to the ML team (BRD Section 7.5)

## Priority
**P0 — Must Have**

## Estimated Effort
**8 story points**

## NFR / Tech Notes
- **Monitoring Stack:** Datadog or OpenTelemetry + Grafana + Prometheus
- **Alert Channels:** Slack (warning), PagerDuty (critical)
- **SLA Monitoring:** Uptime check every 1 minute; alert if downtime > 5 minutes
- **AI Monitoring:** Score distribution drift detection (BRD Section 7.5)

## Technical Design

### Key Metrics to Monitor
```
Infrastructure:
- CPU/Memory utilization per pod
- Pod restart count
- Node health

Application:
- HTTP request rate (req/s)
- HTTP error rate (4xx, 5xx)
- API latency (P50, P95, P99) per endpoint
- Queue depth (SQS/BullMQ)
- Background job success/failure rate

AI Pipeline:
- Resume parsing throughput (resumes/min)
- Scoring latency (P95)
- LLM API error rate
- Score distribution (mean, std dev) — drift detection
```

### Alert Rules
```yaml
- alert: HighErrorRate
  expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.01
  for: 5m
  severity: critical

- alert: HighLatency
  expr: histogram_quantile(0.95, http_request_duration_seconds_bucket) > 2
  for: 5m
  severity: warning
```

## Sub-Tasks
- [ ] 14.4.a — Set up Prometheus + Grafana (or Datadog) stack
- [ ] 14.4.b — Instrument API with metrics (request rate, latency, errors)
- [ ] 14.4.c — Configure alert rules for error rate, latency, pod health
- [ ] 14.4.d — Set up PagerDuty/Slack alert routing
- [ ] 14.4.e — Implement AI score distribution drift detection

## Testing Strategy
- Alerting: Simulate high error rate; verify alert fires within 5 minutes
- Dashboard: Verify all key metrics visible in Grafana
- Drift: Simulate score distribution shift; verify ML alert fires

## Dependencies
- Story 14.2 (Kubernetes — pod metrics source)
- Story 14.5 (Logging — correlated with metrics)
