# Story 06.7: Conversation Context Management

## User Story
**As a** recruiter  
**I want to** have multi-turn conversations with the assistant that remember context  
**So that** I can ask follow-up questions without repeating myself

## BRD Requirements Covered
- FR-CA-06: Assistant maintains conversational context across multi-turn interactions
- BRD Section 8.5: Conversation history maintained per session (last 20 turns in context)

## Acceptance Criteria
1. **Given** I ask "Show top 5 backend engineers"  
   **When** I follow up with "Compare the top 2"  
   **Then** the assistant understands "top 2" refers to the previous results without me re-specifying

2. **Given** a conversation has more than 20 turns  
   **When** the 21st message is sent  
   **Then** the oldest turn is dropped from context (sliding window) and the conversation continues

3. **Given** I start a new conversation  
   **When** the new session begins  
   **Then** context from the previous session is not carried over

4. **Given** I close and reopen the chat panel  
   **When** the panel reopens  
   **Then** the current session's conversation is restored

5. **Given** a session has been inactive for 24 hours  
   **When** I send a new message  
   **Then** the system starts a new session automatically with a notice: "Starting a new conversation (previous session expired)"

## Priority
**P0 — Must Have**

## Estimated Effort
**3 story points**

## NFR / Tech Notes
- **Context Window:** Last 20 turns (BRD 8.5)
- **Session Expiry:** 24 hours of inactivity
- **Storage:** Conversation history stored in PostgreSQL (ConversationSession entity)
- **Context Size:** Monitor token count; summarize older turns if approaching LLM context limit

## Technical Design

### Session Management
```python
class ConversationContextManager:
    MAX_TURNS = 20
    SESSION_EXPIRY_HOURS = 24
    
    async def get_context(self, session_id: UUID) -> list[Message]:
        session = await db.get_session(session_id)
        if self._is_expired(session):
            await self._expire_session(session_id)
            return []
        return session.messages[-self.MAX_TURNS * 2:]  # last N turns (user + assistant)
    
    async def append(self, session_id: UUID, role: str, content: str):
        await db.append_message(session_id, role, content)
        await db.update_last_active(session_id)
```

### Database Schema
```sql
CREATE TABLE conversation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id UUID REFERENCES users(id),
  messages JSONB DEFAULT '[]',
  session_start TIMESTAMP DEFAULT NOW(),
  last_active TIMESTAMP DEFAULT NOW(),
  is_expired BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_sessions_recruiter ON conversation_sessions(recruiter_id, last_active DESC);
```

### API Endpoints
```
GET  /api/chat/sessions/:id/context   — Get current context window
POST /api/chat/sessions/:id/expire    — Manually expire session
```

## Sub-Tasks
- [ ] 06.7.a — Implement sliding window context management (20 turns)
- [ ] 06.7.b — Implement session expiry (24h inactivity)
- [ ] 06.7.c — Implement session restore on panel reopen
- [ ] 06.7.d — Implement token count monitoring with summarization fallback

## Testing Strategy
- Unit: Sliding window logic, expiry detection
- Integration: Multi-turn conversation with context references

## Dependencies
- Story 06.1 (Chat UI — session display)
- Story 06.2 (Intent routing — uses context)
