# Plan 1: Monorepo Setup + `ontology-language` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap monorepo Turborepo dan implementasi package `ontology-language` yang mampu mem-parse, memvalidasi, dan mengekspos TypeScript types dari YAML schema per client.

**Architecture:** Turborepo monorepo dengan `packages/ontology-language` sebagai package pertama. Package ini mem-parse YAML files (object types, link types, action types) menggunakan `js-yaml` + validasi `zod`, kemudian mengekspos typed interfaces ke package lain.

**Tech Stack:** Node.js 20+, TypeScript 5+, Turborepo, pnpm workspaces, `js-yaml`, `zod`, `vitest`

---

## File Map

```
daemon-system-ontology/          ← root monorepo (existing repo)
├── package.json                 ← root workspace config
├── pnpm-workspace.yaml          ← workspace definition
├── turbo.json                   ← Turborepo pipeline config
├── tsconfig.base.json           ← shared TS config
├── .gitignore                   ← update dengan node_modules, dist
└── packages/
    └── ontology-language/
        ├── package.json
        ├── tsconfig.json
        ├── src/
        │   ├── index.ts                         ← public API exports
        │   ├── types/
        │   │   ├── object-type.ts               ← ObjectTypeSchema (zod) + ObjectType (TS type)
        │   │   ├── link-type.ts                 ← LinkTypeSchema + LinkType
        │   │   ├── action-type.ts               ← ActionTypeSchema + ActionType
        │   │   └── ontology-schema.ts           ← OntologySchema = semua types gabungan
        │   ├── parser/
        │   │   ├── yaml.parser.ts               ← baca YAML file → raw object
        │   │   └── ontology.parser.ts           ← parse + validate raw → OntologySchema
        │   └── validator/
        │       └── schema.validator.ts          ← validate OntologySchema, return errors
        └── src/__tests__/
            ├── parser.test.ts
            └── validator.test.ts
```

---

## Task 1: Inisialisasi Monorepo

**Files:**
- Create: `package.json` (root)
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `tsconfig.base.json`
- Modify: `.gitignore`

- [ ] **Step 1: Install pnpm secara global jika belum ada**

```bash
npm install -g pnpm
pnpm --version
# Expected: 9.x.x
```

- [ ] **Step 2: Init root package.json**

Buat file `package.json` di root repo:

```json
{
  "name": "daemon-system-ontology",
  "private": true,
  "scripts": {
    "build": "turbo build",
    "test": "turbo test",
    "lint": "turbo lint",
    "dev": "turbo dev"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.4.0",
    "@types/node": "^20.0.0"
  },
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=9.0.0"
  }
}
```

- [ ] **Step 3: Buat pnpm-workspace.yaml**

```yaml
packages:
  - "packages/*"
  - "apps/*"
  - "tools/*"
```

- [ ] **Step 4: Buat turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "lint": {
      "outputs": []
    },
    "dev": {
      "persistent": true,
      "cache": false
    }
  }
}
```

- [ ] **Step 5: Buat tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist"
  }
}
```

- [ ] **Step 6: Update .gitignore**

Tambahkan baris berikut ke `.gitignore` yang sudah ada:

```
node_modules/
dist/
.turbo/
*.tsbuildinfo
```

- [ ] **Step 7: Install dependencies root**

```bash
pnpm install
```

Expected: `node_modules/` terbuat di root, lockfile `pnpm-lock.yaml` terbuat.

- [ ] **Step 8: Commit**

```bash
git add package.json pnpm-workspace.yaml turbo.json tsconfig.base.json .gitignore pnpm-lock.yaml
git commit -m "chore: init turborepo monorepo with pnpm workspaces"
```

---

## Task 2: Scaffold Package `ontology-language`

**Files:**
- Create: `packages/ontology-language/package.json`
- Create: `packages/ontology-language/tsconfig.json`
- Create: `packages/ontology-language/src/index.ts`

- [ ] **Step 1: Buat direktori**

```bash
New-Item -ItemType Directory -Path "packages\ontology-language\src\types" -Force
New-Item -ItemType Directory -Path "packages\ontology-language\src\parser" -Force
New-Item -ItemType Directory -Path "packages\ontology-language\src\validator" -Force
New-Item -ItemType Directory -Path "packages\ontology-language\src\__tests__" -Force
```

- [ ] **Step 2: Buat package.json**

Buat file `packages/ontology-language/package.json`:

```json
{
  "name": "@daemon/ontology-language",
  "version": "0.1.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "js-yaml": "^4.1.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/js-yaml": "^4.0.9",
    "@types/node": "^20.0.0",
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 3: Buat tsconfig.json**

Buat file `packages/ontology-language/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"],
  "exclude": ["src/__tests__", "dist", "node_modules"]
}
```

- [ ] **Step 4: Buat src/index.ts placeholder**

```typescript
// src/index.ts
// Public API — exports ditambah seiring implementasi
export * from './types/object-type.js';
export * from './types/link-type.js';
export * from './types/action-type.js';
export * from './types/ontology-schema.js';
export * from './parser/ontology.parser.js';
export * from './validator/schema.validator.js';
```

- [ ] **Step 5: Install dependencies package**

```bash
pnpm install --filter @daemon/ontology-language
```

- [ ] **Step 6: Commit**

```bash
git add packages/ontology-language/
git commit -m "chore: scaffold ontology-language package"
```

---

## Task 3: Definisi TypeScript Types (Zod Schemas)

**Files:**
- Create: `packages/ontology-language/src/types/object-type.ts`
- Create: `packages/ontology-language/src/types/link-type.ts`
- Create: `packages/ontology-language/src/types/action-type.ts`
- Create: `packages/ontology-language/src/types/ontology-schema.ts`

- [ ] **Step 1: Tulis failing test untuk object type**

Buat `packages/ontology-language/src/__tests__/parser.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { ObjectTypeSchema } from '../types/object-type.js';

describe('ObjectTypeSchema', () => {
  it('validates a valid object type definition', () => {
    const input = {
      objectType: {
        apiName: 'Shipment',
        displayName: 'Shipment',
        primaryKey: 'shipmentId',
        titleProperty: 'shipmentId',
        properties: [
          { name: 'shipmentId', type: 'string', required: true },
          {
            name: 'status',
            type: 'enum',
            values: ['Draft', 'InTransit', 'Delivered', 'Cancelled'],
            required: true,
          },
          { name: 'legalEntityId', type: 'string', required: true },
        ],
      },
    };

    const result = ObjectTypeSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('rejects object type without apiName', () => {
    const input = {
      objectType: {
        displayName: 'Shipment',
        primaryKey: 'shipmentId',
        titleProperty: 'shipmentId',
        properties: [],
      },
    };

    const result = ObjectTypeSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects enum property without values array', () => {
    const input = {
      objectType: {
        apiName: 'Shipment',
        displayName: 'Shipment',
        primaryKey: 'shipmentId',
        titleProperty: 'shipmentId',
        properties: [
          { name: 'status', type: 'enum', required: true },
          // missing values array
        ],
      },
    };

    const result = ObjectTypeSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Jalankan test — pastikan FAIL**

```bash
pnpm --filter @daemon/ontology-language test
```

Expected: FAIL — `Cannot find module '../types/object-type.js'`

- [ ] **Step 3: Implementasi `src/types/object-type.ts`**

```typescript
import { z } from 'zod';

const PropertyBaseSchema = z.object({
  name: z.string().min(1),
  required: z.boolean().default(false),
});

const StringPropertySchema = PropertyBaseSchema.extend({
  type: z.literal('string'),
});

const NumberPropertySchema = PropertyBaseSchema.extend({
  type: z.literal('number'),
});

const BooleanPropertySchema = PropertyBaseSchema.extend({
  type: z.literal('boolean'),
});

const DatePropertySchema = PropertyBaseSchema.extend({
  type: z.literal('date'),
});

const TimestampPropertySchema = PropertyBaseSchema.extend({
  type: z.literal('timestamp'),
});

const EnumPropertySchema = PropertyBaseSchema.extend({
  type: z.literal('enum'),
  values: z.array(z.string()).min(1),
});

const PropertySchema = z.discriminatedUnion('type', [
  StringPropertySchema,
  NumberPropertySchema,
  BooleanPropertySchema,
  DatePropertySchema,
  TimestampPropertySchema,
  EnumPropertySchema,
]);

export type Property = z.infer<typeof PropertySchema>;

const ObjectTypeDefinitionSchema = z.object({
  apiName: z.string().min(1),
  displayName: z.string().min(1),
  primaryKey: z.string().min(1),
  titleProperty: z.string().min(1),
  properties: z.array(PropertySchema).min(1),
  description: z.string().optional(),
});

export const ObjectTypeSchema = z.object({
  objectType: ObjectTypeDefinitionSchema,
});

export type ObjectTypeDefinition = z.infer<typeof ObjectTypeDefinitionSchema>;
export type ObjectType = z.infer<typeof ObjectTypeSchema>;
```

- [ ] **Step 4: Jalankan test — pastikan PASS**

```bash
pnpm --filter @daemon/ontology-language test
```

Expected: PASS — 3 tests passed

- [ ] **Step 5: Implementasi `src/types/link-type.ts`**

```typescript
import { z } from 'zod';

const CardinalitySchema = z.enum(['ONE_TO_ONE', 'ONE_TO_MANY', 'MANY_TO_MANY']);

const LinkTypeDefinitionSchema = z.object({
  apiName: z.string().min(1),
  displayName: z.string().min(1),
  fromObjectType: z.string().min(1),
  toObjectType: z.string().min(1),
  cardinality: CardinalitySchema,
  description: z.string().optional(),
});

export const LinkTypeSchema = z.object({
  linkType: LinkTypeDefinitionSchema,
});

export type LinkTypeDefinition = z.infer<typeof LinkTypeDefinitionSchema>;
export type LinkType = z.infer<typeof LinkTypeSchema>;
```

- [ ] **Step 6: Implementasi `src/types/action-type.ts`**

```typescript
import { z } from 'zod';

const ActionParameterSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['string', 'number', 'boolean', 'date', 'enum']),
  required: z.boolean().default(false),
  values: z.array(z.string()).optional(), // untuk type: enum
});

const ActionTypeDefinitionSchema = z.object({
  apiName: z.string().min(1),
  displayName: z.string().min(1),
  targetObjectType: z.string().min(1),
  parameters: z.array(ActionParameterSchema),
  requiresApproval: z.boolean().default(true),
  description: z.string().optional(),
});

export const ActionTypeSchema = z.object({
  actionType: ActionTypeDefinitionSchema,
});

export type ActionTypeDefinition = z.infer<typeof ActionTypeDefinitionSchema>;
export type ActionType = z.infer<typeof ActionTypeSchema>;
```

- [ ] **Step 7: Implementasi `src/types/ontology-schema.ts`**

```typescript
import { z } from 'zod';
import { ObjectTypeDefinitionSchema } from './object-type.js';
import { LinkTypeDefinitionSchema } from './link-type.js';
import { ActionTypeDefinitionSchema } from './action-type.js';

export const OntologySchemaSchema = z.object({
  objectTypes: z.array(ObjectTypeDefinitionSchema),
  linkTypes: z.array(LinkTypeDefinitionSchema),
  actionTypes: z.array(ActionTypeDefinitionSchema),
});

export type OntologySchema = z.infer<typeof OntologySchemaSchema>;
```

Perhatikan: `ObjectTypeDefinitionSchema`, `LinkTypeDefinitionSchema`, `ActionTypeDefinitionSchema` perlu di-export dari masing-masing file type. Tambahkan `export` pada schema tersebut di Task 3 Step 3, 5, dan 6.

- [ ] **Step 8: Build untuk cek tidak ada error TypeScript**

```bash
pnpm --filter @daemon/ontology-language build
```

Expected: sukses, folder `dist/` terbuat.

- [ ] **Step 9: Commit**

```bash
git add packages/ontology-language/src/types/
git commit -m "feat(ontology-language): add zod schemas for object, link, action types"
```

---

## Task 4: YAML Parser

**Files:**
- Create: `packages/ontology-language/src/parser/yaml.parser.ts`
- Create: `packages/ontology-language/src/parser/ontology.parser.ts`
- Create: `packages/ontology-language/src/__tests__/fixtures/shipment.object-type.yaml`
- Create: `packages/ontology-language/src/__tests__/fixtures/shipment-customer.link-type.yaml`
- Create: `packages/ontology-language/src/__tests__/fixtures/transition-shipment-state.action-type.yaml`

- [ ] **Step 1: Buat fixture YAML files**

Buat direktori dan files:

```bash
New-Item -ItemType Directory -Path "packages\ontology-language\src\__tests__\fixtures" -Force
```

Buat `packages/ontology-language/src/__tests__/fixtures/shipment.object-type.yaml`:

```yaml
objectType:
  apiName: Shipment
  displayName: Shipment
  primaryKey: shipmentId
  titleProperty: shipmentId
  description: Represents a logistics shipment
  properties:
    - name: shipmentId
      type: string
      required: true
    - name: status
      type: enum
      values: [Draft, InTransit, Delivered, Cancelled]
      required: true
    - name: legalEntityId
      type: string
      required: true
    - name: originCity
      type: string
      required: false
    - name: destinationCity
      type: string
      required: false
```

Buat `packages/ontology-language/src/__tests__/fixtures/shipment-customer.link-type.yaml`:

```yaml
linkType:
  apiName: shipment_customer
  displayName: Shipment → Customer
  fromObjectType: Shipment
  toObjectType: Customer
  cardinality: MANY_TO_ONE
  description: Links a shipment to its customer
```

Tunggu — `MANY_TO_ONE` tidak ada di `CardinalitySchema`. Update `CardinalitySchema` di `link-type.ts`:

```typescript
const CardinalitySchema = z.enum([
  'ONE_TO_ONE',
  'ONE_TO_MANY',
  'MANY_TO_ONE',
  'MANY_TO_MANY',
]);
```

Buat `packages/ontology-language/src/__tests__/fixtures/transition-shipment-state.action-type.yaml`:

```yaml
actionType:
  apiName: transitionShipmentState
  displayName: Transition Shipment State
  targetObjectType: Shipment
  requiresApproval: true
  description: Transitions a shipment to a new lifecycle state
  parameters:
    - name: shipmentId
      type: string
      required: true
    - name: newStatus
      type: enum
      values: [InTransit, Delivered, Cancelled]
      required: true
    - name: reason
      type: string
      required: false
```

- [ ] **Step 2: Tulis failing test untuk YAML parser**

Tambahkan ke `packages/ontology-language/src/__tests__/parser.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { join } from 'path';
import { parseYamlFile, parseObjectTypeFile, parseLinkTypeFile, parseActionTypeFile } from '../parser/ontology.parser.js';

const fixturesDir = join(__dirname, 'fixtures');

describe('parseObjectTypeFile', () => {
  it('parses a valid object type YAML file', async () => {
    const result = await parseObjectTypeFile(
      join(fixturesDir, 'shipment.object-type.yaml')
    );
    expect(result.apiName).toBe('Shipment');
    expect(result.primaryKey).toBe('shipmentId');
    expect(result.properties).toHaveLength(5);
    const statusProp = result.properties.find(p => p.name === 'status');
    expect(statusProp?.type).toBe('enum');
  });

  it('throws on missing required field', async () => {
    await expect(
      parseObjectTypeFile(join(fixturesDir, 'nonexistent.yaml'))
    ).rejects.toThrow();
  });
});

describe('parseLinkTypeFile', () => {
  it('parses a valid link type YAML file', async () => {
    const result = await parseLinkTypeFile(
      join(fixturesDir, 'shipment-customer.link-type.yaml')
    );
    expect(result.apiName).toBe('shipment_customer');
    expect(result.fromObjectType).toBe('Shipment');
    expect(result.toObjectType).toBe('Customer');
    expect(result.cardinality).toBe('MANY_TO_ONE');
  });
});

describe('parseActionTypeFile', () => {
  it('parses a valid action type YAML file', async () => {
    const result = await parseActionTypeFile(
      join(fixturesDir, 'transition-shipment-state.action-type.yaml')
    );
    expect(result.apiName).toBe('transitionShipmentState');
    expect(result.targetObjectType).toBe('Shipment');
    expect(result.requiresApproval).toBe(true);
    expect(result.parameters).toHaveLength(3);
  });
});
```

- [ ] **Step 3: Jalankan test — pastikan FAIL**

```bash
pnpm --filter @daemon/ontology-language test
```

Expected: FAIL — `Cannot find module '../parser/ontology.parser.js'`

- [ ] **Step 4: Implementasi `src/parser/yaml.parser.ts`**

```typescript
import { readFile } from 'fs/promises';
import * as yaml from 'js-yaml';

export async function parseYamlFile(filePath: string): Promise<unknown> {
  const content = await readFile(filePath, 'utf-8');
  return yaml.load(content);
}
```

- [ ] **Step 5: Implementasi `src/parser/ontology.parser.ts`**

```typescript
import { parseYamlFile } from './yaml.parser.js';
import { ObjectTypeSchema, ObjectTypeDefinition } from '../types/object-type.js';
import { LinkTypeSchema, LinkTypeDefinition } from '../types/link-type.js';
import { ActionTypeSchema, ActionTypeDefinition } from '../types/action-type.js';

export async function parseObjectTypeFile(filePath: string): Promise<ObjectTypeDefinition> {
  const raw = await parseYamlFile(filePath);
  const result = ObjectTypeSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Invalid object type schema in ${filePath}:\n${result.error.toString()}`
    );
  }
  return result.data.objectType;
}

export async function parseLinkTypeFile(filePath: string): Promise<LinkTypeDefinition> {
  const raw = await parseYamlFile(filePath);
  const result = LinkTypeSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Invalid link type schema in ${filePath}:\n${result.error.toString()}`
    );
  }
  return result.data.linkType;
}

export async function parseActionTypeFile(filePath: string): Promise<ActionTypeDefinition> {
  const raw = await parseYamlFile(filePath);
  const result = ActionTypeSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Invalid action type schema in ${filePath}:\n${result.error.toString()}`
    );
  }
  return result.data.actionType;
}
```

- [ ] **Step 6: Jalankan test — pastikan PASS**

```bash
pnpm --filter @daemon/ontology-language test
```

Expected: PASS — semua tests passed

- [ ] **Step 7: Commit**

```bash
git add packages/ontology-language/src/parser/ packages/ontology-language/src/__tests__/
git commit -m "feat(ontology-language): add YAML parser for object, link, action types"
```

---

## Task 5: Schema Validator + `loadOntologyFromDirectory`

**Files:**
- Create: `packages/ontology-language/src/validator/schema.validator.ts`
- Modify: `packages/ontology-language/src/parser/ontology.parser.ts`

- [ ] **Step 1: Tulis failing test untuk validator**

Buat `packages/ontology-language/src/__tests__/validator.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { join } from 'path';
import { loadOntologyFromDirectory } from '../parser/ontology.parser.js';
import { validateOntologySchema } from '../validator/schema.validator.js';

const fixturesDir = join(__dirname, 'fixtures');

describe('loadOntologyFromDirectory', () => {
  it('loads all schema files from a directory', async () => {
    const schema = await loadOntologyFromDirectory(fixturesDir);
    expect(schema.objectTypes.length).toBeGreaterThanOrEqual(1);
    expect(schema.linkTypes.length).toBeGreaterThanOrEqual(1);
    expect(schema.actionTypes.length).toBeGreaterThanOrEqual(1);
  });
});

describe('validateOntologySchema', () => {
  it('passes for valid schema', async () => {
    const schema = await loadOntologyFromDirectory(fixturesDir);
    const errors = validateOntologySchema(schema);
    expect(errors).toHaveLength(0);
  });

  it('catches duplicate apiName within object types', () => {
    const { validateOntologySchema } = require('../validator/schema.validator.js');
    const schema = {
      objectTypes: [
        {
          apiName: 'Shipment',
          displayName: 'Shipment',
          primaryKey: 'id',
          titleProperty: 'id',
          properties: [{ name: 'id', type: 'string' as const, required: true }],
        },
        {
          apiName: 'Shipment', // duplicate!
          displayName: 'Shipment 2',
          primaryKey: 'id',
          titleProperty: 'id',
          properties: [{ name: 'id', type: 'string' as const, required: true }],
        },
      ],
      linkTypes: [],
      actionTypes: [],
    };
    const errors = validateOntologySchema(schema);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('Duplicate apiName');
  });
});
```

- [ ] **Step 2: Jalankan test — pastikan FAIL**

```bash
pnpm --filter @daemon/ontology-language test
```

Expected: FAIL — `loadOntologyFromDirectory` not found, `validateOntologySchema` not found

- [ ] **Step 3: Tambah `loadOntologyFromDirectory` ke `ontology.parser.ts`**

Tambahkan import dan fungsi berikut ke `packages/ontology-language/src/parser/ontology.parser.ts`:

```typescript
import { readdir } from 'fs/promises';
import { join, extname } from 'path';
import { OntologySchema } from '../types/ontology-schema.js';

export async function loadOntologyFromDirectory(dirPath: string): Promise<OntologySchema> {
  const files = await readdir(dirPath);
  const yamlFiles = files.filter(f => extname(f) === '.yaml' || extname(f) === '.yml');

  const objectTypes: OntologySchema['objectTypes'] = [];
  const linkTypes: OntologySchema['linkTypes'] = [];
  const actionTypes: OntologySchema['actionTypes'] = [];

  for (const file of yamlFiles) {
    const filePath = join(dirPath, file);
    if (file.endsWith('.object-type.yaml') || file.endsWith('.object-type.yml')) {
      objectTypes.push(await parseObjectTypeFile(filePath));
    } else if (file.endsWith('.link-type.yaml') || file.endsWith('.link-type.yml')) {
      linkTypes.push(await parseLinkTypeFile(filePath));
    } else if (file.endsWith('.action-type.yaml') || file.endsWith('.action-type.yml')) {
      actionTypes.push(await parseActionTypeFile(filePath));
    }
  }

  return { objectTypes, linkTypes, actionTypes };
}
```

- [ ] **Step 4: Implementasi `src/validator/schema.validator.ts`**

```typescript
import { OntologySchema } from '../types/ontology-schema.js';

export function validateOntologySchema(schema: OntologySchema): string[] {
  const errors: string[] = [];

  // Cek duplicate apiName pada object types
  const objectTypeNames = schema.objectTypes.map(o => o.apiName);
  const duplicateObjects = objectTypeNames.filter(
    (name, idx) => objectTypeNames.indexOf(name) !== idx
  );
  for (const dup of duplicateObjects) {
    errors.push(`Duplicate apiName in objectTypes: "${dup}"`);
  }

  // Cek duplicate apiName pada link types
  const linkTypeNames = schema.linkTypes.map(l => l.apiName);
  const duplicateLinks = linkTypeNames.filter(
    (name, idx) => linkTypeNames.indexOf(name) !== idx
  );
  for (const dup of duplicateLinks) {
    errors.push(`Duplicate apiName in linkTypes: "${dup}"`);
  }

  // Cek duplicate apiName pada action types
  const actionTypeNames = schema.actionTypes.map(a => a.apiName);
  const duplicateActions = actionTypeNames.filter(
    (name, idx) => actionTypeNames.indexOf(name) !== idx
  );
  for (const dup of duplicateActions) {
    errors.push(`Duplicate apiName in actionTypes: "${dup}"`);
  }

  // Cek link types reference object types yang ada
  const knownObjectTypes = new Set(objectTypeNames);
  for (const link of schema.linkTypes) {
    if (!knownObjectTypes.has(link.fromObjectType)) {
      errors.push(
        `LinkType "${link.apiName}" references unknown fromObjectType: "${link.fromObjectType}"`
      );
    }
    if (!knownObjectTypes.has(link.toObjectType)) {
      errors.push(
        `LinkType "${link.apiName}" references unknown toObjectType: "${link.toObjectType}"`
      );
    }
  }

  // Cek action types reference object types yang ada
  for (const action of schema.actionTypes) {
    if (!knownObjectTypes.has(action.targetObjectType)) {
      errors.push(
        `ActionType "${action.apiName}" references unknown targetObjectType: "${action.targetObjectType}"`
      );
    }
  }

  return errors;
}
```

- [ ] **Step 5: Tambah `Customer` object type fixture agar link validation tidak fail**

Buat `packages/ontology-language/src/__tests__/fixtures/customer.object-type.yaml`:

```yaml
objectType:
  apiName: Customer
  displayName: Customer
  primaryKey: customerId
  titleProperty: customerId
  properties:
    - name: customerId
      type: string
      required: true
    - name: name
      type: string
      required: true
    - name: legalEntityId
      type: string
      required: true
```

- [ ] **Step 6: Jalankan test — pastikan PASS**

```bash
pnpm --filter @daemon/ontology-language test
```

Expected: PASS — semua tests passed

- [ ] **Step 7: Build final dan verify**

```bash
pnpm --filter @daemon/ontology-language build
```

Expected: sukses, `dist/` berisi `.js` dan `.d.ts` files

- [ ] **Step 8: Commit**

```bash
git add packages/ontology-language/
git commit -m "feat(ontology-language): add schema validator and loadOntologyFromDirectory"
```

---

## Task 6: Update `src/index.ts` Public API

**Files:**
- Modify: `packages/ontology-language/src/index.ts`

- [ ] **Step 1: Update exports**

Ganti isi `packages/ontology-language/src/index.ts` dengan:

```typescript
// Types
export type { ObjectType, ObjectTypeDefinition, Property } from './types/object-type.js';
export type { LinkType, LinkTypeDefinition } from './types/link-type.js';
export type { ActionType, ActionTypeDefinition } from './types/action-type.js';
export type { OntologySchema } from './types/ontology-schema.js';

// Schemas (Zod — untuk re-use di package lain)
export { ObjectTypeSchema } from './types/object-type.js';
export { LinkTypeSchema } from './types/link-type.js';
export { ActionTypeSchema } from './types/action-type.js';
export { OntologySchemaSchema } from './types/ontology-schema.js';

// Parser
export {
  parseObjectTypeFile,
  parseLinkTypeFile,
  parseActionTypeFile,
  loadOntologyFromDirectory,
} from './parser/ontology.parser.js';

// Validator
export { validateOntologySchema } from './validator/schema.validator.js';
```

- [ ] **Step 2: Build dan test sekali lagi**

```bash
pnpm --filter @daemon/ontology-language build
pnpm --filter @daemon/ontology-language test
```

Expected: build sukses, semua tests pass

- [ ] **Step 3: Commit final**

```bash
git add packages/ontology-language/src/index.ts
git commit -m "feat(ontology-language): finalize public API exports"
```

---

## Verification Checklist

Sebelum Plan 1 dianggap selesai, pastikan semua ini benar:

- [ ] `pnpm install` dari root berjalan tanpa error
- [ ] `pnpm build` dari root berhasil build `ontology-language`
- [ ] `pnpm test` dari root menjalankan semua tests dan PASS
- [ ] `packages/ontology-language/dist/` berisi `.js` dan `.d.ts` files
- [ ] Fixture YAML files terbaca dan tervalidasi dengan benar
- [ ] Duplicate apiName detection bekerja
- [ ] Link type yang reference object type tidak dikenal menghasilkan error

---

## Catatan untuk Plan 2

Plan 2 (`ontology-engine`) akan:
- Import `@daemon/ontology-language` sebagai dependency
- Menggunakan `OntologySchema` type dan `loadOntologyFromDirectory` sebagai input startup
- Membangun registry in-memory di atas parsed schema ini
