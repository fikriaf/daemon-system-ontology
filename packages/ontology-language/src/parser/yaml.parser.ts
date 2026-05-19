import { readFile } from 'fs/promises';
import * as yaml from 'js-yaml';

export async function parseYamlFile(filePath: string): Promise<unknown> {
  const content = await readFile(filePath, 'utf-8');
  return yaml.load(content);
}

export function parseYamlContent(content: string): unknown {
  return yaml.load(content);
}
