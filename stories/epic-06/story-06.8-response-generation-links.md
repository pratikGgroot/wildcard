# Story 06.8: Response Generation with Candidate Links

## User Story
**As a** recruiter  
**I want to** receive assistant responses that include direct links to candidate profiles  
**So that** I can immediately navigate to a candidate without searching manually

## BRD Requirements Covered
- FR-CA-07: Responses include references/links to candidate profiles

## Acceptance Criteria
1. **Given** the assistant returns a list of candidates  
   **When** the response is rendered  
   **Then** each candidate name is a clickable link that opens their profile

2. **Given** the assistant references a specific candidate in text  
   **When** the response is rendered  
   **Then** the candidate name is auto-linked (e.g., "John Smith" → link to profile)

3. **Given** the assistant returns a comparison table  
   **When** the table is rendered  
   **Then** each candidate name in the table header is a clickable profile link

4. **Given** a candidate link is clicked  
   **When** the profile opens  
   **Then** it opens in the main content area (not replacing the chat panel)

5. **Given** the assistant response contains markdown  
   **When** it is rendered  
   **Then** tables, bold text, bullet lists, and code blocks are properly formatted

## Priority
**P0 — Must Have**

## Estimated Effort
**3 story points**

## NFR / Tech Notes
- **Link Format:** `[Candidate Name](/candidates/{id})` in LLM output
- **Rendering:** Custom markdown renderer with candidate link detection
- **Navigation:** Profile opens in main panel; chat panel stays open

## Technical Design

### LLM Response Format Instruction
```
System prompt addition:
"When referencing candidates, always use the format: [Candidate Name](/candidates/{candidate_id})
This ensures links are clickable in the UI."
```

### Custom Markdown Renderer
```typescript
const CandidateLinkRenderer = ({ href, children }) => {
  const isCandidateLink = href?.startsWith('/candidates/');
  if (isCandidateLink) {
    return (
      <Link href={href} onClick={(e) => { e.preventDefault(); openProfile(href); }}>
        {children}
      </Link>
    );
  }
  return <a href={href}>{children}</a>;
};
```

## Sub-Tasks
- [ ] 06.8.a — Add candidate link format instruction to system prompt
- [ ] 06.8.b — Build custom markdown renderer with candidate link support
- [ ] 06.8.c — Implement split-panel navigation (profile opens without closing chat)

## Testing Strategy
- Unit: Link detection and rendering, markdown parsing
- Integration: Full response with candidate links rendered correctly
- UI: Click link → profile opens in main panel, chat stays open

## Dependencies
- Story 06.1 (Chat UI — markdown renderer host)
- Story 06.2 (Intent routing — LLM response format)
