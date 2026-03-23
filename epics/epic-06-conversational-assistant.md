# Epic 06: Recruiter Conversational Assistant

## Overview
Build an AI-powered chat interface that allows recruiters to query candidate pipelines, compare candidates, and trigger actions using natural language.

## Business Value
- Eliminates need to learn complex filter UIs
- Enables instant answers to pipeline questions
- Reduces time spent searching for candidate information

## BRD Requirements Covered
- FR-CA-01: Chat interface for natural language queries
- FR-CA-02: Support queries like "Show top backend engineers with Kubernetes"
- FR-CA-03: Support time-based queries
- FR-CA-04: Comparative queries
- FR-CA-05: Trigger actions via chat
- FR-CA-06: Maintain conversational context
- FR-CA-07: Include references/links in responses

## Priority
**HIGH**

## NFR / Tech Notes
- **Latency:** Chat responses ≤3 seconds (NFR-P-03)
- **Architecture:** ReAct agent pattern with tool calling
- **LLM:** Claude Sonnet 4 with function calling
- **Context:** Maintain last 20 turns in conversation history
- **RAG:** Retrieve relevant candidate data before generating response

### SLA Requirements
- **Response Latency:** ≤3 seconds (P95) (NFR-P-03)
- **Availability:** 99.9% uptime
- **Concurrent Sessions:** Support 1,000 concurrent chat sessions

## Technical Design

### Agent Architecture
```
User Query
    ↓
[Intent Classification]
    ↓
[Tool Selection: search_candidates, filter_pipeline, compare_candidates, move_candidate]
    ↓
[Execute Tool(s)]
    ↓
[RAG: Retrieve Relevant Context]
    ↓
[Generate Natural Language Response]
    ↓
[Return with Profile Links]
```

### Available Tools
```python
AGENT_TOOLS = [
    {
        "name": "search_candidates",
        "description": "Semantic search over candidate profiles",
        "parameters": {
            "query": "string",
            "job_id": "string",
            "filters": "object"
        }
    },
    {
        "name": "filter_pipeline",
        "description": "Filter candidates by stage, date, score",
        "parameters": {
            "job_id": "string",
            "stage": "string",
            "date_range": "object",
            "score_range": "object"
        }
    },
    {
        "name": "compare_candidates",
        "description": "Side-by-side comparison of candidates",
        "parameters": {
            "candidate_ids": "array"
        }
    },
    {
        "name": "move_candidate",
        "description": "Move candidate to different pipeline stage",
        "parameters": {
            "candidate_id": "string",
            "stage": "string"
        }
    },
    {
        "name": "get_pipeline_summary",
        "description": "Get aggregate stats for a job pipeline",
        "parameters": {
            "job_id": "string"
        }
    }
]
```

### Database Schema
```sql
CREATE TABLE conversation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id UUID REFERENCES users(id),
  session_start TIMESTAMP DEFAULT NOW(),
  last_active TIMESTAMP DEFAULT NOW(),
  context JSONB -- Store last 20 messages
);

CREATE TABLE conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES conversation_sessions(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL, -- 'user' or 'assistant'
  content TEXT NOT NULL,
  tool_calls JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_conversation_messages_session ON conversation_messages(session_id, created_at);
```

## Stories
- Story 06.1: Chat Interface UI
- Story 06.2: Intent Classification & Tool Routing
- Story 06.3: Semantic Candidate Search Tool
- Story 06.4: Pipeline Filter Tool
- Story 06.5: Candidate Comparison Tool
- Story 06.6: Action Execution Tool
- Story 06.7: Conversation Context Management
- Story 06.8: Response Generation with Links

## Estimated Effort
**21-26 story points** (3-4 sprints)

## Success Metrics
- Chat response time ≤3 seconds (P95)
- Query success rate ≥90%
- User satisfaction ≥4.5/5
- 80% of recruiters use chat weekly
