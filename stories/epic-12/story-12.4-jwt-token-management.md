# Story 12.4: JWT Token Management

## User Story
**As a** system  
**I want to** manage JWT access and refresh tokens securely  
**So that** API access is authenticated and tokens can be revoked when needed

## BRD Requirements Covered
- BRD Section 11.1: JWT-based API authentication with short expiry (15 min access token)

## Acceptance Criteria
1. **Given** a user logs in  
   **When** authentication succeeds  
   **Then** they receive an access token (15 min) and a refresh token (7 days, httpOnly cookie)

2. **Given** an access token expires  
   **When** the client sends a request with an expired token  
   **Then** the API returns 401; the client uses the refresh token to get a new access token silently

3. **Given** a refresh token is used  
   **When** a new access token is issued  
   **Then** the old refresh token is rotated (invalidated and replaced)

4. **Given** a security incident is detected  
   **When** an admin revokes all tokens for a user  
   **Then** all active sessions are terminated immediately

5. **Given** a JWT is tampered with  
   **When** it is verified  
   **Then** the signature check fails and a 401 is returned

## Priority
**P0 — Must Have**

## Estimated Effort
**5 story points**

## NFR / Tech Notes
- **Access Token:** 15 min expiry, RS256 signed (asymmetric keys)
- **Refresh Token:** 7 days, stored as httpOnly Secure cookie
- **Key Rotation:** JWT signing keys rotated quarterly; old keys retained for validation during transition
- **Revocation:** Refresh token revocation via database; access tokens are short-lived (no revocation needed)

## Technical Design

### Token Validation Middleware
```python
async def verify_jwt(token: str) -> TokenClaims:
    try:
        payload = jwt.decode(token, PUBLIC_KEY, algorithms=["RS256"])
        return TokenClaims(**payload)
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")
```

### API Endpoints
```
POST /api/auth/refresh          — Exchange refresh token for new access token
POST /api/auth/revoke           — Revoke specific refresh token
POST /api/admin/users/:id/revoke-all — Revoke all tokens for a user (admin)
```

## Sub-Tasks
- [ ] 12.4.a — Implement RS256 JWT signing with key pair management
- [ ] 12.4.b — Implement refresh token rotation
- [ ] 12.4.c — Implement admin token revocation for all user sessions
- [ ] 12.4.d — Implement JWT validation middleware for all protected routes
- [ ] 12.4.e — Implement key rotation procedure

## Testing Strategy
- Unit: Token expiry, signature validation, rotation
- Security: Tampered token rejected, expired token rejected
- Integration: Full token lifecycle (issue → refresh → revoke)

## Dependencies
- Story 12.1 (Email/password auth — token issuance)
- Story 12.2 (SSO — token issuance after SSO)
