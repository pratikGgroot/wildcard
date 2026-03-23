# Story 14.7: Secrets Management

## User Story
**As a** DevOps engineer  
**I want to** manage all secrets centrally and securely  
**So that** API keys, database passwords, and encryption keys are never stored in code or environment files

## BRD Requirements Covered
- BRD Section 15.4: Secret Management — AWS Secrets Manager / HashiCorp Vault
- BRD Section 7.4: Zero-trust architecture for internal service communication

## Acceptance Criteria
1. **Given** a service needs a database password  
   **When** it starts  
   **Then** it fetches the secret from AWS Secrets Manager (not from environment variables or config files)

2. **Given** a secret is rotated  
   **When** rotation occurs  
   **Then** services automatically pick up the new secret without restart

3. **Given** a developer needs to add a new secret  
   **When** they add it  
   **Then** it is stored in Secrets Manager; the secret value is never committed to git

4. **Given** a service is compromised  
   **When** its IAM role is revoked  
   **Then** it can no longer access any secrets

5. **Given** secrets are accessed  
   **When** access occurs  
   **Then** it is logged in CloudTrail for audit purposes

## Priority
**P0 — Must Have**

## Estimated Effort
**5 story points**

## NFR / Tech Notes
- **Primary:** AWS Secrets Manager (auto-rotation support)
- **Alternative:** HashiCorp Vault for multi-cloud
- **Access Control:** IAM roles per service (least privilege)
- **Rotation:** Database passwords rotated every 90 days automatically
- **Audit:** All secret access logged in CloudTrail

## Technical Design

### Secret Categories
```
Database:
  - /prod/db/postgres/password
  - /prod/db/redis/password

AI APIs:
  - /prod/ai/openai/api_key
  - /prod/ai/anthropic/api_key

Encryption:
  - /prod/encryption/pii_key (managed by KMS)
  - /prod/encryption/hmac_key

Integrations:
  - /prod/integrations/aws_ses/credentials
  - /prod/integrations/linkedin/client_secret
```

### Secret Fetching
```python
import boto3

class SecretsManager:
    def __init__(self):
        self.client = boto3.client('secretsmanager')
        self._cache = {}
    
    def get_secret(self, secret_name: str) -> str:
        if secret_name not in self._cache:
            response = self.client.get_secret_value(SecretId=secret_name)
            self._cache[secret_name] = response['SecretString']
        return self._cache[secret_name]
```

## Sub-Tasks
- [ ] 14.7.a — Set up AWS Secrets Manager with all required secrets
- [ ] 14.7.b — Implement secrets fetching service with caching
- [ ] 14.7.c — Configure IAM roles per service (least privilege)
- [ ] 14.7.d — Set up automatic rotation for database passwords
- [ ] 14.7.e — Implement git-secrets pre-commit hook to prevent secret commits

## Testing Strategy
- Security: Verify no secrets in code or environment files
- Rotation: Simulate secret rotation; verify service picks up new value
- Access Control: Verify service A cannot access service B's secrets

## Dependencies
- Story 14.2 (Kubernetes — IAM roles for pods via IRSA)
