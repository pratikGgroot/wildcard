"""
Story 02.5: Skill Normalization.
Maps raw extracted skill strings to canonical forms using:
  1. Exact match (case-insensitive)
  2. Alias lookup (curated map)
  3. Embedding cosine similarity via Ollama (fuzzy fallback)
"""
import logging
import re
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

FUZZY_THRESHOLD = 0.85

# ── Canonical skill list ──────────────────────────────────────────────────────
# Format: canonical_name → [aliases...]
# Aliases are lowercased for lookup.
SKILL_ONTOLOGY: dict[str, list[str]] = {
    # Languages
    "Python": ["python3", "py", "python 3"],
    "JavaScript": ["js", "javascript es6", "es6", "ecmascript"],
    "TypeScript": ["ts", "typescript 4", "typescript 5"],
    "Java": ["java 8", "java 11", "java 17", "java se", "java ee"],
    "Go": ["golang"],
    "Rust": ["rust-lang"],
    "C#": ["csharp", "c sharp", "dotnet c#", ".net c#"],
    "C++": ["cpp", "c plus plus"],
    "Ruby": ["ruby on rails lang"],
    "PHP": ["php 8", "php7"],
    "Swift": ["swift 5"],
    "Kotlin": [],
    "Scala": [],
    "R": ["r language", "r programming"],
    # Frontend
    "React": ["reactjs", "react.js", "react js", "react 18", "react native web"],
    "Vue": ["vuejs", "vue.js", "vue 3", "vue js"],
    "Angular": ["angularjs", "angular.js", "angular 2+", "angular js"],
    "Next.js": ["nextjs", "next js"],
    "Nuxt.js": ["nuxtjs", "nuxt js"],
    "Svelte": ["sveltejs"],
    "Redux": ["redux toolkit", "react redux"],
    "Tailwind CSS": ["tailwind", "tailwindcss"],
    # Backend / Frameworks
    "Node.js": ["nodejs", "node js", "node"],
    "Express.js": ["express", "expressjs"],
    "FastAPI": ["fast api"],
    "Django": ["django rest framework", "drf"],
    "Flask": [],
    "Spring Boot": ["spring", "spring framework", "spring mvc", "spring boot 3"],
    "Laravel": [],
    "Rails": ["ruby on rails", "ror"],
    "NestJS": ["nest.js", "nestjs"],
    # Databases
    "PostgreSQL": ["postgres", "postgresql 14", "postgresql 15", "pg"],
    "MySQL": ["mysql 8"],
    "MongoDB": ["mongo", "mongodb atlas"],
    "Redis": ["redis cache", "redis cluster"],
    "Elasticsearch": ["elastic search", "opensearch"],
    "SQLite": [],
    "Oracle": ["oracle db", "oracle database"],
    "SQL Server": ["mssql", "microsoft sql server", "ms sql"],
    "Cassandra": ["apache cassandra"],
    "DynamoDB": ["aws dynamodb", "amazon dynamodb"],
    # Cloud
    "AWS": ["amazon web services", "amazon aws"],
    "GCP": ["google cloud", "google cloud platform"],
    "Azure": ["microsoft azure", "azure cloud"],
    # DevOps / Infrastructure
    "Docker": ["docker container", "docker compose"],
    "Kubernetes": ["k8s", "k 8s", "kube"],
    "Terraform": ["terraform iac"],
    "Ansible": [],
    "Jenkins": [],
    "GitHub Actions": ["github ci", "gh actions"],
    "GitLab CI": ["gitlab ci/cd", "gitlab pipelines"],
    "CI/CD": ["cicd", "ci cd", "continuous integration", "continuous deployment"],
    "Linux": ["ubuntu", "debian", "centos", "rhel", "unix"],
    "Nginx": [],
    "Apache": ["apache httpd"],
    # Data / ML
    "Pandas": [],
    "NumPy": ["numpy"],
    "TensorFlow": ["tensorflow 2"],
    "PyTorch": ["torch"],
    "Scikit-learn": ["sklearn", "scikit learn"],
    "Kafka": ["apache kafka"],
    "Spark": ["apache spark", "pyspark"],
    "Airflow": ["apache airflow"],
    # Tools
    "Git": ["github", "gitlab", "bitbucket", "version control", "source control", "source control (git)", "git version control"],
    "REST API": ["rest", "restful", "restful api", "rest apis", "restful apis", "restful web services", "rest web services"],
    "GraphQL": ["graph ql"],
    "gRPC": ["grpc"],
    "Celery": [],
    "RabbitMQ": ["rabbit mq"],
    "JWT": ["json web token", "json web tokens", "jwt-based authentication", "jwt authentication", "jwt based"],
    "OAuth": ["oauth2", "oauth 2.0"],
    "REST API": ["rest", "restful", "restful api", "rest apis", "restful apis", "restful web services", "rest web services"],
    "Git": ["github", "gitlab", "bitbucket", "version control", "source control", "source control (git)", "git version control"],
    "Microservices": ["micro services", "microservice architecture"],
    "Hibernate": ["jpa", "java persistence api"],
    "RBAC": ["role-based access control", "role based access control"],
}

# Build reverse alias map: lowercase alias → canonical
_ALIAS_MAP: dict[str, str] = {}
_CANONICAL_LOWER: dict[str, str] = {}  # lowercase canonical → canonical

for canonical, aliases in SKILL_ONTOLOGY.items():
    _CANONICAL_LOWER[canonical.lower()] = canonical
    for alias in aliases:
        _ALIAS_MAP[alias.lower()] = canonical


@dataclass
class NormalizedSkill:
    raw: str
    canonical: str
    confidence: float
    method: str  # "exact" | "alias" | "fuzzy" | "passthrough"
    needs_review: bool = False


@dataclass
class NormalizationResult:
    normalized: list[NormalizedSkill] = field(default_factory=list)
    needs_review: list[str] = field(default_factory=list)  # raw skills that didn't match well


class SkillNormalizerService:
    """
    Normalizes raw skill strings to canonical forms.
    Embedding-based fuzzy matching is optional and only used when Ollama is available.
    """

    def normalize_list(self, raw_skills: list[str]) -> NormalizationResult:
        """
        Normalize a list of raw skill strings.
        Returns NormalizationResult with per-skill details.
        """
        result = NormalizationResult()
        for raw in raw_skills:
            ns = self._normalize_one(raw)
            result.normalized.append(ns)
            if ns.needs_review:
                result.needs_review.append(raw)
        return result

    def _normalize_one(self, raw: str) -> NormalizedSkill:
        key = raw.strip()
        key_lower = key.lower()
        # Remove common noise
        key_lower = re.sub(r"\s*(development|programming|language|framework|library)\s*$", "", key_lower).strip()

        # 1. Exact canonical match
        if key_lower in _CANONICAL_LOWER:
            return NormalizedSkill(raw=raw, canonical=_CANONICAL_LOWER[key_lower], confidence=1.0, method="exact")

        # 2. Alias lookup
        if key_lower in _ALIAS_MAP:
            return NormalizedSkill(raw=raw, canonical=_ALIAS_MAP[key_lower], confidence=0.99, method="alias")

        # 3. Partial / substring match against canonical names
        for canon_lower, canon in _CANONICAL_LOWER.items():
            if canon_lower in key_lower or key_lower in canon_lower:
                # Only accept if the overlap is substantial (>= 4 chars)
                if len(canon_lower) >= 4 and len(key_lower) >= 4:
                    return NormalizedSkill(raw=raw, canonical=canon, confidence=0.90, method="partial")

        # 4. Passthrough — store as-is, flag for review if it looks like a real skill
        needs_review = len(key) >= 3  # single chars / noise don't need review
        return NormalizedSkill(
            raw=raw,
            canonical=key,  # keep original casing
            confidence=0.5,
            method="passthrough",
            needs_review=needs_review,
        )

    def get_canonical_names(self, normalized: list[NormalizedSkill]) -> list[str]:
        """Return deduplicated list of canonical skill names."""
        seen: set[str] = set()
        result: list[str] = []
        for ns in normalized:
            if ns.canonical not in seen:
                seen.add(ns.canonical)
                result.append(ns.canonical)
        return result
