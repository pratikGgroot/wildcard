# Story 14.5: Logging Infrastructure

## User Story
**As a** developer or DevOps engineer  
**I want to** have centralized structured logging  
**So that** I can debug issues and search logs across all services

## BRD Requirements Covered
- BRD Section 7.5: Full application logging (structured JSON logs)

## Acceptance Criteria
1. **Given** any service processes a request  
   **When** the request completes  
   **Then** a structured JSON log entry is emitted with: timestamp, service, level, request_id, user_id, duration, and status

2. **Given** logs are emitted  
   **When** they are collected  
   **Then** they are centralized in a log aggregation system (CloudWatch Logs or ELK)

3. **Given** I search for a specific request_id  
   **When** I query the log system  
   **Then** I see all log entries across all services for that request

4. **Given** a log entry is at ERROR level  
   **When** it is emitted  
   **Then** it includes: error message, stack trace, and request context

5. **Given** logs are retained  
   **When** the retention policy is checked  
   **Then** application logs are retained for 90 days; security logs for 1 year

## Priority
**P0 — Must Have**

## Estimated Effort
**5 story points**

## NFR / Tech Notes
- **Format:** Structured JSON (not plaintext)
- **Aggregation:** AWS CloudWatch Logs or ELK Stack (Elasticsearch + Logstash + Kibana)
- **Correlation:** request_id propagated across all services via HTTP headers
- **Retention:** App logs 90 days; security/audit logs 1 year
- **PII:** PII fields must not appear in logs (masked or excluded)

## Technical Design

### Log Schema
```json
{
  "timestamp": "2026-03-18T10:30:00Z",
  "level": "INFO",
  "service": "api",
  "request_id": "uuid",
  "user_id": "uuid",
  "method": "POST",
  "path": "/api/jobs",
  "status_code": 201,
  "duration_ms": 145,
  "message": "Job created successfully"
}
```

### Logging Middleware
```python
@app.middleware("http")
async def logging_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid4()))
    start = time.time()
    response = await call_next(request)
    duration = (time.time() - start) * 1000
    
    logger.info({
        "request_id": request_id,
        "method": request.method,
        "path": request.url.path,
        "status_code": response.status_code,
        "duration_ms": round(duration, 2)
    })
    return response
```

## Sub-Tasks
- [ ] 14.5.a — Implement structured JSON logging in all services
- [ ] 14.5.b — Implement request_id propagation across services
- [ ] 14.5.c — Set up log aggregation (CloudWatch or ELK)
- [ ] 14.5.d — Implement PII masking in logs
- [ ] 14.5.e — Configure log retention policies

## Testing Strategy
- Unit: PII masking, log format validation
- Integration: Logs appear in aggregation system within 30 seconds
- Search: request_id search returns all related log entries

## Dependencies
- Story 14.2 (Kubernetes — log collection from pods)
- Story 14.6 (Distributed tracing — trace_id in logs)
