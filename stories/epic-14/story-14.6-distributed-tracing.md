# Story 14.6: Distributed Tracing

## User Story
**As a** developer  
**I want to** trace requests across all services  
**So that** I can identify performance bottlenecks in the AI pipeline

## BRD Requirements Covered
- BRD Section 7.5: Distributed tracing for AI pipeline steps

## Acceptance Criteria
1. **Given** a resume is uploaded and processed  
   **When** I search for the trace  
   **Then** I see the full trace: upload → text extraction → OCR → LLM extraction → embedding → scoring

2. **Given** a trace is viewed  
   **When** I open a span  
   **Then** I see: service name, operation, duration, and any errors

3. **Given** a slow request is detected  
   **When** I view its trace  
   **Then** I can identify which service/operation caused the slowdown

4. **Given** traces are collected  
   **When** they are sampled  
   **Then** 100% of error traces are captured; 10% of successful traces are sampled

## Priority
**P0 — Must Have**

## Estimated Effort
**5 story points**

## NFR / Tech Notes
- **Standard:** OpenTelemetry (vendor-neutral)
- **Backend:** Datadog APM or Jaeger
- **Sampling:** 100% error traces, 10% success traces
- **Propagation:** W3C Trace Context headers across services

## Technical Design

### OpenTelemetry Setup
```python
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter

tracer = trace.get_tracer("ai-hiring-platform")

# Instrument AI pipeline
with tracer.start_as_current_span("llm_extraction") as span:
    span.set_attribute("candidate_id", str(candidate_id))
    span.set_attribute("model", "claude-sonnet-4")
    result = await llm_service.extract(resume_text)
    span.set_attribute("confidence", result.confidence)
```

## Sub-Tasks
- [ ] 14.6.a — Set up OpenTelemetry SDK in all services
- [ ] 14.6.b — Instrument AI pipeline steps with custom spans
- [ ] 14.6.c — Configure trace export to Datadog/Jaeger
- [ ] 14.6.d — Implement sampling strategy (100% errors, 10% success)

## Testing Strategy
- Integration: Full resume processing trace visible end-to-end
- Performance: Tracing overhead ≤ 5ms per request

## Dependencies
- Story 14.5 (Logging — trace_id in logs for correlation)
