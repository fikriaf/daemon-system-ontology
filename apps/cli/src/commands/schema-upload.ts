import { readFile, readdir } from 'fs/promises';
import { join, extname } from 'path';

export interface SchemaUploadOptions {
  schemaDir: string;
  apiUrl: string;
  token: string;
}

export async function schemaUpload(opts: SchemaUploadOptions): Promise<void> {
  const files = await readdir(opts.schemaDir);
  const yamlFiles = files.filter(f => extname(f) === '.yaml' || extname(f) === '.yml');

  if (yamlFiles.length === 0) {
    throw new Error(`No YAML files found in ${opts.schemaDir}`);
  }

  console.log(`Found ${yamlFiles.length} schema file(s) in ${opts.schemaDir}`);

  const contents: string[] = [];
  for (const file of yamlFiles) {
    const content = await readFile(join(opts.schemaDir, file), 'utf-8');
    contents.push(content);
    console.log(`  Loaded: ${file}`);
  }

  console.log(`Uploading to ${opts.apiUrl}/schema/upload...`);

  const response = await fetch(`${opts.apiUrl}/schema/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.token}`,
    },
    body: JSON.stringify({ files: contents }),
  });

  const body = await response.json() as Record<string, unknown>;

  if (!response.ok) {
    throw new Error(`Upload failed (${response.status}): ${JSON.stringify(body)}`);
  }

  console.log(`✓ Schema uploaded successfully`);
  console.log(`  Object types : ${body.objectTypes}`);
  console.log(`  Link types   : ${body.linkTypes}`);
  console.log(`  Action types : ${body.actionTypes}`);
  console.log(`  Uploaded by  : ${body.uploadedBy}`);
}
