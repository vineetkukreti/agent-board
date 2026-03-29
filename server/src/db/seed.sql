-- ============================================================
-- Agent Board — Seed Data
-- ============================================================

-- Agent Types
INSERT OR IGNORE INTO agent_types (name, slug, category, description) VALUES
    ('Principal Engineer', 'principal-engineer', 'engineering', 'CTO-level architect and orchestrator'),
    ('Staff Architect', 'staff-architect', 'engineering', 'System design and standards'),
    ('Engineering Manager', 'engineering-manager', 'engineering', 'Planning and coordination'),
    ('Senior UI/UX Engineer', 'senior-ui-ux-engineer', 'frontend', 'Pixel-perfect design systems'),
    ('Frontend Engineer', 'frontend-engineer', 'frontend', 'Fast UI implementation'),
    ('Mobile Engineer', 'mobile-engineer', 'frontend', 'PWA, responsive, cross-platform'),
    ('Senior Backend Engineer', 'senior-backend-engineer', 'backend', 'API design and performance'),
    ('Senior Full-Stack Engineer', 'senior-full-stack-engineer', 'backend', 'End-to-end feature delivery'),
    ('Systems Programmer', 'systems-programmer', 'backend', 'Algorithms and optimization'),
    ('API Design Specialist', 'api-design-specialist', 'backend', 'REST and OpenAPI'),
    ('Junior Engineer', 'junior-engineer', 'engineering', 'Bug fixes, tests, learning'),
    ('QA Lead', 'qa-lead', 'quality', 'E2E tests and regression'),
    ('Performance Engineer', 'performance-engineer', 'quality', 'Profiling and optimization'),
    ('Data Engineer', 'data-engineer', 'data', 'ETL and pipelines'),
    ('Data Scientist', 'data-scientist', 'data', 'Stats and experiments'),
    ('DBA', 'dba', 'data', 'Schema and migrations'),
    ('AI Research Lead', 'ai-research-lead', 'ai-ml', 'SOTA research and strategy'),
    ('ML Engineer', 'ml-engineer', 'ai-ml', 'Model training and production ML'),
    ('Prompt Engineer', 'prompt-engineer', 'ai-ml', 'LLM prompts and RAG'),
    ('NLP Engineer', 'nlp-engineer', 'ai-ml', 'Search and embeddings'),
    ('Product Manager', 'product-manager', 'product', 'Roadmap and specs'),
    ('UX Researcher', 'ux-researcher', 'product', 'User interviews and usability'),
    ('DevOps Engineer', 'devops-engineer', 'infra', 'CI/CD and deployment'),
    ('SRE', 'sre', 'infra', 'Uptime and incident response'),
    ('Security Engineer', 'security-engineer', 'security', 'OWASP and pen testing'),
    ('Technical Writer', 'technical-writer', 'docs', 'API docs and guides'),
    ('Tech Lead', 'tech-lead', 'engineering', 'Cross-team leadership');

-- Teams
INSERT OR IGNORE INTO teams (name, slug, description, color) VALUES
    ('Frontend Engineering', 'frontend', 'UI/UX and client-side development', '#3B82F6'),
    ('Backend Engineering', 'backend', 'APIs, services, and data layer', '#10B981'),
    ('Quality & Performance', 'quality', 'Testing and performance optimization', '#F59E0B'),
    ('Data Team', 'data', 'ETL, analytics, and data quality', '#8B5CF6'),
    ('AI/ML Team', 'ai-ml', 'Machine learning and AI research', '#EC4899'),
    ('Product & Design', 'product', 'Product management and UX research', '#06B6D4'),
    ('Infrastructure & Platform', 'infra', 'DevOps, SRE, and cloud', '#F97316'),
    ('Security & Compliance', 'security', 'Security engineering and privacy', '#EF4444'),
    ('Documentation & Community', 'docs', 'Technical writing and advocacy', '#6B7280'),
    ('Executive', 'executive', 'Architecture and leadership', '#1F2937');

-- Sample Project
INSERT OR IGNORE INTO projects (name, slug, description) VALUES
    ('DSA Tracker', 'dsa-tracker', 'Full-stack DSA practice tracking application'),
    ('Agent Board', 'agent-board', 'AI agent fleet management platform');
