# Story 06.1: Chat Interface UI

## User Story
**As a** recruiter  
**I want to** access a chat interface from any screen in the platform  
**So that** I can query the candidate pipeline using natural language without leaving my current context

## BRD Requirements Covered
- FR-CA-01: Provide a chat interface where recruiters can query the candidate pipeline in natural language
- BRD Section 12.1: Chat Assistant — side-panel chat interface accessible from any screen

## Acceptance Criteria
1. **Given** I am on any page in the platform  
   **When** I click the chat icon or press the keyboard shortcut (Cmd/Ctrl + K)  
   **Then** a side panel opens with the chat interface

2. **Given** the chat panel is open  
   **When** I type a message and press Enter  
   **Then** my message appears in the conversation and a loading indicator shows while the assistant responds

3. **Given** the assistant responds  
   **When** the response arrives  
   **Then** it is displayed with proper formatting (markdown, tables, candidate links)

4. **Given** the chat panel is open  
   **When** I navigate to a different page  
   **Then** the chat panel remains open and the conversation is preserved

5. **Given** the assistant response includes candidate references  
   **When** the response is displayed  
   **Then** candidate names are clickable links that open the candidate profile

6. **Given** the chat panel is open  
   **When** I click "New Conversation"  
   **Then** the current conversation is saved to history and a fresh conversation starts

7. **Given** I want to see past conversations  
   **When** I click "History"  
   **Then** I see a list of past sessions with timestamps and the first message as a preview

## Priority
**P0 — Must Have**

## Estimated Effort
**5 story points**

## NFR / Tech Notes
- **Response Latency:** ≤ 3 seconds (BRD NFR-P-03)
- **Streaming:** Use SSE (Server-Sent Events) or WebSocket for streaming responses
- **Persistence:** Conversation history stored per session (last 20 turns in context — BRD 8.5)
- **Accessibility:** Chat input and responses are screen-reader accessible
- **Mobile:** Panel collapses to full-screen on mobile/tablet

### SLA Requirements
- **Chat Response:** ≤ 3 seconds (NFR-P-03)

## Technical Design

### Component Structure
```
ChatPanel (side panel, z-index overlay)
├── ConversationHeader (title, new chat, history button)
├── MessageList (scrollable)
│   ├── UserMessage
│   └── AssistantMessage (markdown renderer, candidate links)
├── TypingIndicator (streaming dots)
└── ChatInput (textarea, send button, keyboard shortcut)
```

### WebSocket / SSE Protocol
```typescript
// Client sends
{ type: "message", content: "Show top backend engineers", session_id: "uuid" }

// Server streams
{ type: "token", content: "Here" }
{ type: "token", content: " are" }
{ type: "tool_call", tool: "search_candidates", args: {...} }
{ type: "tool_result", result: [...] }
{ type: "done", message_id: "uuid" }
```

### API Endpoints
```
POST /api/chat/sessions              — Create new session
GET  /api/chat/sessions              — List past sessions
GET  /api/chat/sessions/:id          — Get session with messages
POST /api/chat/sessions/:id/messages — Send message (returns SSE stream)
DELETE /api/chat/sessions/:id        — Delete session
```

## Sub-Tasks
- [ ] 06.1.a — Build ChatPanel side panel component with open/close animation
- [ ] 06.1.b — Build MessageList with markdown rendering and candidate link support
- [ ] 06.1.c — Implement SSE streaming for assistant responses
- [ ] 06.1.d — Implement conversation persistence and history view
- [ ] 06.1.e — Implement keyboard shortcut (Cmd/Ctrl + K)
- [ ] 06.1.f — Implement mobile responsive behavior

## Testing Strategy
- Unit: Message rendering, markdown parsing, link detection
- Integration: SSE streaming end-to-end
- Accessibility: Screen reader compatibility
- Performance: Response streaming starts within 1 second

## Dependencies
- Epic 12 (Auth — session ownership)
- Story 06.2 (Intent classification — backend for message processing)
