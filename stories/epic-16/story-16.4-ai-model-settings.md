# Story 16.4: AI Model Settings

## User Story
**As an** admin  
**I want to** configure which AI models are used for different tasks  
**So that** I can control costs, performance, and model preferences for my organization

## BRD Requirements Covered
- BRD Section 12.1: Admin Panel — AI settings
- BRD Section 8: AI/ML requirements — configurable model selection

## Acceptance Criteria
1. **Given** I navigate to AI Model Settings  
   **When** the page loads  
   **Then** I see the current model configuration for each AI task (parsing, scoring, summarization, interview kit, chat)

2. **Given** I want to change the LLM for summarization  
   **When** I select a different model  
   **Then** the change is saved and new summaries use the selected model

3. **Given** I configure an API key for a model provider  
   **When** I save it  
   **Then** the key is stored encrypted and a test call is made to verify it works

4. **Given** I want to see model usage  
   **When** I view the AI settings  
   **Then** I see: API calls this month, estimated cost, and average latency per model

5. **Given** a model API key is invalid  
   **When** the system tries to use it  
   **Then** an alert is sent to the admin and the system falls back to the default model

## Priority
**P0 — Must Have**

## Estimated Effort
**5 story points**

## NFR / Tech Notes
- **Configurable Models:** LLM (Claude/GPT-4o), Embedding (text-embedding-3-large/voyage-large-2), OCR (Textract/Tesseract)
- **API Key Storage:** Encrypted via AWS Secrets Manager
- **Fallback:** Default model used if configured model fails
- **Cost Tracking:** Token usage tracked per model per month

## Technical Design

### AI Configuration Schema
```sql
CREATE TABLE ai_model_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  task VARCHAR(50) NOT NULL,  -- 'parsing', 'scoring', 'summarization', 'interview_kit', 'chat', 'embedding'
  provider VARCHAR(30) NOT NULL,  -- 'anthropic', 'openai', 'voyage'
  model_name VARCHAR(100) NOT NULL,
  api_key_secret_name VARCHAR(200),  -- AWS Secrets Manager key name
  is_active BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### API Endpoints
```
GET  /api/admin/ai-settings              — Get AI model configuration
PUT  /api/admin/ai-settings/:task        — Update model for a task
POST /api/admin/ai-settings/:task/test   — Test model configuration
GET  /api/admin/ai-settings/usage        — Model usage and cost stats
```

## Sub-Tasks
- [ ] 16.4.a — Build AI model settings UI with task-to-model mapping
- [ ] 16.4.b — Implement API key configuration with encrypted storage
- [ ] 16.4.c — Implement model test call on configuration save
- [ ] 16.4.d — Implement token usage tracking and cost estimation
- [ ] 16.4.e — Implement fallback to default model on failure

## Testing Strategy
- Unit: Fallback logic, API key validation
- Integration: Model configuration change → new AI calls use new model
- Security: API keys encrypted and not exposed in API responses

## Dependencies
- Story 14.7 (Secrets management — API key storage)
