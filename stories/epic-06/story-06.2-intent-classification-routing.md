# Story 06.2: Intent Classification & Tool Routing

## User Story
**As a** system  
**I want to** classify recruiter messages and route them to the appropriate tools  
**So that** the assistant can answer queries accurately using the right data sources

## BRD Requirements Covered
- BRD Section 8.5: LLM with tool-calling capabilities (function calling / ReAct agent pattern)
- FR-CA-02: Support queries like "Show top backend engineers with Kubernetes experience"
- FR-CA-03: Support queries like "Which candidates applied in the last 7 days for the ML Engineer role?"

## Acceptance Criteria
1. **Given** a recruiter sends a candidate search query  
   **When** the agent processes it  
   **Then** the `search_candidates` tool is called with the correct parameters

2. **Given** a recruiter sends a pipeline filter query  
   **When** the agent processes it  
   **Then** the `filter_pipeline` tool is called with stage, date range, and score range parameters

3. **Given** a recruiter sends a comparison query  
   **When** the agent processes it  
   **Then** the `compare_candidates` tool is called with the relevant candidate IDs

4. **Given** a recruiter sends an action request (e.g., "Move candidate X to interview")  
   **When** the agent processes it  
   **Then** the `move_candidate` tool is called and the action is confirmed before execution

5. **Given** the agent cannot determine intent  
   **When** the message is ambiguous  
   **Then** the assistant asks a clarifying question rather than guessing

6. **Given** a tool call fails  
   **When** the failure occurs  
   **Then** the assistant responds with a user-friendly error message and suggests alternatives

## Priority
**P0 — Must Have**

## Estimated Effort
**8 story points**

## NFR / Tech Notes
- **Agent Framework:** LangGraph (ReAct pattern) or LangChain with tool-calling
- **LLM:** Claude claude-sonnet-4 or GPT-4o (function calling support required)
- **Context Window:** Last 20 turns maintained in context (BRD 8.5)
- **Guardrails:** Write actions (move, reject) require confirmation step
- **Latency:** Tool routing decision ≤ 1 second; full response ≤ 3 seconds (NFR-P-03)

## Technical Design

### Available Tools
```python
TOOLS = [
    {
        "name": "search_candidates",
        "description": "Semantic search over candidate profiles for a job",
        "parameters": {
            "query": "string",
            "job_id": "uuid | null",
            "filters": {
                "skills": ["string"],
                "min_score": "float",
                "stage": "string"
            },
            "limit": "int"
        }
    },
    {
        "name": "filter_pipeline",
        "description": "Filter candidates by pipeline stage, date range, or score range",
        "parameters": {
            "job_id": "uuid",
            "stage": "string | null",
            "date_range": {"from": "date", "to": "date"},
            "score_range": {"min": "float", "max": "float"}
        }
    },
    {
        "name": "compare_candidates",
        "description": "Generate a side-by-side comparison of candidates",
        "parameters": { "candidate_ids": ["uuid"], "job_id": "uuid" }
    },
    {
        "name": "move_candidate",
        "description": "Move a candidate to a different pipeline stage",
        "parameters": {
            "candidate_id": "uuid",
            "job_id": "uuid",
            "target_stage": "string"
        }
    },
    {
        "name": "get_pipeline_summary",
        "description": "Get aggregate stats for a job pipeline",
        "parameters": { "job_id": "uuid" }
    }
]
```

### ReAct Agent Loop
```python
async def agent_loop(message: str, session: Session) -> AsyncGenerator:
    messages = session.get_context(last_n=20)
    messages.append({"role": "user", "content": message})
    
    while True:
        response = await llm.complete(messages, tools=TOOLS)
        
        if response.tool_calls:
            for tool_call in response.tool_calls:
                # Confirm write actions
                if tool_call.name in WRITE_TOOLS:
                    yield ConfirmationRequest(tool_call)
                    confirmed = await wait_for_confirmation()
                    if not confirmed:
                        continue
                
                result = await execute_tool(tool_call)
                messages.append(tool_result_message(tool_call, result))
        else:
            yield response.content
            break
```

### API Endpoints
```
POST /api/chat/sessions/:id/messages   — Process message through agent
```

## Sub-Tasks
- [ ] 06.2.a — Set up LangGraph/LangChain agent with tool definitions
- [ ] 06.2.b — Implement all 5 tool handlers
- [ ] 06.2.c — Implement confirmation flow for write actions
- [ ] 06.2.d — Implement conversation context management (last 20 turns)
- [ ] 06.2.e — Implement guardrails (no final hiring decisions)
- [ ] 06.2.f — Write unit tests for tool routing with sample queries

## Testing Strategy
- Unit: Tool selection for 20+ sample queries, guardrail enforcement
- Integration: Full agent loop with real LLM and tool execution
- Performance: Response latency ≤ 3 seconds for common queries

## Dependencies
- Story 06.1 (Chat UI — frontend)
- Story 06.3 (Semantic candidate search tool)
- Story 06.4 (Pipeline filter tool)
- Story 06.5 (Candidate comparison tool)
- Story 06.6 (Action execution tool)
