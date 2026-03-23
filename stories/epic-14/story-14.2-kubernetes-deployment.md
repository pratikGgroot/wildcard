# Story 14.2: Kubernetes Deployment

## User Story
**As a** DevOps engineer  
**I want to** deploy all services to Kubernetes  
**So that** the platform is scalable, self-healing, and production-ready

## BRD Requirements Covered
- BRD Section 15.4: Kubernetes (EKS/GKE)
- BRD Section 7.2: System must handle up to 1,000 concurrent users; scale to 1M+ candidate profiles
- BRD Section 7.3: Uptime SLA 99.9%

## Acceptance Criteria
1. **Given** Kubernetes manifests are applied  
   **When** deployment runs  
   **Then** all services are running with the correct replica counts

2. **Given** a pod crashes  
   **When** Kubernetes detects the failure  
   **Then** it automatically restarts the pod within 30 seconds

3. **Given** CPU usage exceeds 70%  
   **When** HPA triggers  
   **Then** additional pods are scaled up within 2 minutes

4. **Given** a deployment is updated  
   **When** the rollout runs  
   **Then** it uses a rolling update strategy with zero downtime

5. **Given** the platform is deployed  
   **When** uptime is measured  
   **Then** it achieves 99.9% availability (BRD NFR)

### SLA Requirements
- **Uptime:** 99.9% (< 8.7 hours downtime/year) — BRD Section 7.3

## Priority
**P0 — Must Have**

## Estimated Effort
**8 story points**

## NFR / Tech Notes
- **Platform:** AWS EKS (primary) or GKE
- **Replicas:** API: min 2, max 10; Workers: min 2, max 20; Frontend: min 2, max 5
- **HPA:** Scale on CPU > 70% and memory > 80%
- **PDB:** Pod Disruption Budget — minimum 1 pod always available
- **Resource Limits:** CPU and memory limits set for all containers

## Technical Design

### Key Kubernetes Resources
```yaml
# API Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 2
  strategy:
    type: RollingUpdate
    rollingUpdate: { maxSurge: 1, maxUnavailable: 0 }
  template:
    spec:
      containers:
      - name: api
        resources:
          requests: { cpu: "250m", memory: "512Mi" }
          limits: { cpu: "1000m", memory: "2Gi" }
        livenessProbe:
          httpGet: { path: /health, port: 8000 }
          initialDelaySeconds: 30
---
# HPA
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-hpa
spec:
  scaleTargetRef: { name: api }
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource: { name: cpu, target: { type: Utilization, averageUtilization: 70 } }
```

## Sub-Tasks
- [ ] 14.2.a — Write Kubernetes manifests (Deployments, Services, ConfigMaps)
- [ ] 14.2.b — Configure HPA for API and worker services
- [ ] 14.2.c — Configure Pod Disruption Budgets
- [ ] 14.2.d — Set up Ingress with TLS termination
- [ ] 14.2.e — Configure resource requests and limits
- [ ] 14.2.f — Set up namespace isolation (dev/staging/prod)

## Testing Strategy
- Deployment: Rolling update with zero downtime
- Resilience: Kill a pod; verify auto-restart within 30 seconds
- Scale: Load test to trigger HPA; verify scale-up within 2 minutes

## Dependencies
- Story 14.1 (Docker containerization — images to deploy)
- Story 14.3 (CI/CD — deploys to Kubernetes)
