# Story 14.3: CI/CD Pipeline

## User Story
**As a** developer  
**I want to** have an automated CI/CD pipeline  
**So that** code changes are tested and deployed reliably without manual steps

## BRD Requirements Covered
- BRD Section 15.4: CI/CD — GitHub Actions + ArgoCD

## Acceptance Criteria
1. **Given** a pull request is opened  
   **When** CI runs  
   **Then** it executes: lint, type check, unit tests, integration tests, and security scan

2. **Given** all CI checks pass  
   **When** the PR is merged to main  
   **Then** a Docker image is built, tagged, and pushed to ECR automatically

3. **Given** an image is pushed to ECR  
   **When** ArgoCD detects the change  
   **Then** it deploys to the staging environment automatically

4. **Given** staging deployment succeeds  
   **When** a release is tagged  
   **Then** production deployment requires manual approval in GitHub Actions

5. **Given** a deployment fails  
   **When** the failure is detected  
   **Then** ArgoCD automatically rolls back to the previous version

## Priority
**P0 — Must Have**

## Estimated Effort
**8 story points**

## NFR / Tech Notes
- **CI Platform:** GitHub Actions
- **CD Platform:** ArgoCD (GitOps)
- **Registry:** AWS ECR
- **CI Duration:** ≤ 10 minutes for full CI pipeline
- **Environments:** dev → staging (auto) → production (manual approval)

## Technical Design

### GitHub Actions Workflow
```yaml
name: CI/CD
on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - name: Run tests
      run: |
        pip install -r requirements.txt
        pytest --cov=app tests/
    - name: Security scan
      uses: aquasecurity/trivy-action@master

  build-push:
    needs: test
    if: github.ref == 'refs/heads/main'
    steps:
    - name: Build and push to ECR
      run: |
        docker build -t $ECR_REGISTRY/api:$GITHUB_SHA .
        docker push $ECR_REGISTRY/api:$GITHUB_SHA
    - name: Update ArgoCD manifest
      run: |
        sed -i "s|image:.*|image: $ECR_REGISTRY/api:$GITHUB_SHA|" k8s/api/deployment.yaml
        git commit -am "Deploy $GITHUB_SHA" && git push
```

## Sub-Tasks
- [ ] 14.3.a — Set up GitHub Actions CI workflow (lint, test, scan)
- [ ] 14.3.b — Set up Docker build and ECR push workflow
- [ ] 14.3.c — Set up ArgoCD for GitOps deployment
- [ ] 14.3.d — Configure staging auto-deploy and production manual approval
- [ ] 14.3.e — Implement automatic rollback on deployment failure

## Testing Strategy
- CI: Verify all checks run on PR
- CD: Verify staging auto-deploys on merge to main
- Rollback: Simulate failed deployment; verify auto-rollback

## Dependencies
- Story 14.1 (Docker — images built in CI)
- Story 14.2 (Kubernetes — deployment target)
