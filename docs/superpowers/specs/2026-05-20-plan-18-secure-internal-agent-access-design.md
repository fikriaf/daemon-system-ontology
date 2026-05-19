# Plan 18: Secure Internal Agent Access Design

## Overview
This document outlines the design for securing the `/internal-agent/invoke` endpoint in the Daemon Control Plane. Currently protected by a single shared secret, the endpoint will transition to a database-backed Operator Registry. This introduces Authentication (Auth), Role-Based Access Control (RBAC), Strict Tenant Scoping, and Audit Attribution without applying rate limits (to preserve administrative flexibility).

## Core Principles
1. **Database-Backed Identity:** Operators and Admins are managed via the database, allowing dynamic revocation and creation without server restarts.
2. **Deterministic Governance:** Leveraging the Plan 17 Governance engine, tenant scoping will be mathematically enforced at the tool execution level.
3. **Traceability:** Every action taken by the internal agent must be directly attributed to a specific human operator in the audit logs.

## Components & Architecture

### 1. Database Schema
Two new tables will be added to `apps/control-plane/src/db/schema.ts`:

*   **`operators`**: 
    *   `id` (uuid, pk)
    *   `email` (text, unique)
    *   `role` (text) - Enum-like: `'admin' | 'operator'`
    *   `apiKeyHash` (text) - SHA-256 or bcrypt hash of the bearer token provided to the operator.
    *   `status` (text) - `'active' | 'suspended'`
    *   Timestamps (`createdAt`, `updatedAt`)
*   **`operator_tenant_access`**: 
    *   `operatorId` (uuid, fk -> operators.id)
    *   `tenantId` (uuid, fk -> tenants.id)
    *   *(Composite Primary Key on operatorId + tenantId)*

### 2. Authentication Middleware
A new Fastify preHandler hook (`operatorAuth`) will be implemented:
*   Extracts `Authorization: Bearer <token>`.
*   Hashes the provided token and queries the `operators` table.
*   If valid and `status === 'active'`, retrieves the operator's details.
*   If `role === 'operator'`, joins with `operator_tenant_access` to load their allowed `tenantIds`.
*   Injects the resolved identity into `request.operator` (typed via Fastify declaration merging).

### 3. Route & Policy Integration
The `/internal-agent/invoke` route will be updated to enforce RBAC:
*   It will consume `request.operator`.
*   If `role === 'operator'`, the route forcefully overrides the `tenantIds` policy parameter with the operator's scoped tenants. 
*   If an operator attempts to query a tenant outside their scope, the Plan 17 Governance engine will automatically trap and deny the execution, logging it as a scoped violation.

### 4. Audit Log Enhancements
*   The `InternalAgentAuditEntry` interface (in `governance.ts` and `runner.ts`) will be extended to include `operatorId` (and optionally `operatorEmail`).
*   The governance constructor/context will accept the `operatorId` to tag all generated audit trails.

## Data Flow
1. **Request:** Client calls `POST /internal-agent/invoke` with a Bearer token.
2. **Auth:** Middleware hashes token, queries DB, populates `request.operator`.
3. **Route:** Route constructs `PolicyOverride`. For `'operator'` role, limits `tenantIds` strictly to allowed IDs.
4. **Execution:** Runner and Governance execute. Any tool calls outside the scoped `tenantIds` are blocked.
5. **Response:** Response is returned, with `audit` array containing the `operatorId` for traceability.

## Testing Strategy
*   **Auth Unit Tests:** Verify valid tokens pass, invalid tokens fail (401), and suspended operators are rejected (403).
*   **RBAC Integration Tests:** 
    *   Verify an `admin` can access data for all tenants.
    *   Verify an `operator` can access assigned tenants.
    *   Verify an `operator` receives a governance denial when attempting to query an unassigned tenant.
*   **Audit Tests:** Verify the `operatorId` correctly propagates to the `audit` response.

## Security Considerations
*   API keys are stored as hashes (`apiKeyHash`), never in plain text.
*   Tenant scope enforcement is placed at the deepest layer (Governance tool execution), preventing prompt injection from bypassing tenant boundaries.
