import { pgTable, uuid, text, jsonb, timestamp } from 'drizzle-orm/pg-core';

export const objects = pgTable('objects', {
  id: uuid('id').primaryKey().defaultRandom(),
  typeApiName: text('type_api_name').notNull(),
  properties: jsonb('properties').notNull(),
  legalEntityId: text('legal_entity_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const actionAuditLog = pgTable('action_audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  actionTypeId: text('action_type_id').notNull(),
  objectId: uuid('object_id').references(() => objects.id),
  payload: jsonb('payload').notNull(),
  performedBy: text('performed_by').notNull(),
  legalEntityId: text('legal_entity_id').notNull(),
  status: text('status').notNull(),
  proposedAt: timestamp('proposed_at', { withTimezone: true }),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  decidedBy: text('decided_by'),
  executedAt: timestamp('executed_at', { withTimezone: true }),
});

export const schemaOverrides = pgTable('schema_overrides', {
  id: uuid('id').primaryKey().defaultRandom(),
  objectType: text('object_type').notNull(),
  overrideType: text('override_type').notNull(),
  payload: jsonb('payload').notNull(),
  appliedAt: timestamp('applied_at', { withTimezone: true }).defaultNow().notNull(),
});

// Stores the active schema per tenant — enables hot reload without restart
export const tenantSchemas = pgTable('tenant_schemas', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: text('tenant_id').notNull().unique(),
  schema: jsonb('schema').notNull(),
  version: text('version').notNull().default('1'),
  uploadedBy: text('uploaded_by').notNull(),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).defaultNow().notNull(),
});
