import { describe, it, expect } from 'vitest';
import { LlmSegmentOutputSchema, llmSegmentOutputJsonSchema } from '@shared/types/llmSegmentOutput';
import example from '../../fixtures/llm/example-S2.output.json';

type Node = Record<string, unknown>;

function walk(node: unknown, visit: (n: Node, path: string) => void, path = '$'): void {
  if (Array.isArray(node)) node.forEach((child, i) => walk(child, visit, `${path}[${i}]`));
  else if (node && typeof node === 'object') {
    visit(node as Node, path);
    for (const [key, child] of Object.entries(node)) walk(child, visit, `${path}.${key}`);
  }
}

describe('JSON Schema da saída da LLM (§8.6)', () => {
  it('o arquivo commitado é o gerado do Zod (pnpm gen:schema atualiza)', async () => {
    const generated = JSON.stringify(llmSegmentOutputJsonSchema(), null, 2) + '\n';
    await expect(generated).toMatchFileSnapshot('../../../src/shared/schemas/llm-segment-output.schema.json');
  });

  it('respeita os limites da saída estruturada (lint do schema)', () => {
    const problems: string[] = [];
    walk(llmSegmentOutputJsonSchema(), (n, path) => {
      if (n.type === 'object' && n.additionalProperties !== false) problems.push(`${path}: sem additionalProperties: false`);
      for (const key of ['minLength', 'maxLength', 'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum']) {
        if (key in n) problems.push(`${path}: usa ${key}`);
      }
      if ('minItems' in n && n.minItems !== 0 && n.minItems !== 1) problems.push(`${path}: minItems ${String(n.minItems)}`);
      if (n.type === 'object' && n.properties) {
        const required = new Set((n.required as string[]) ?? []);
        for (const key of Object.keys(n.properties as Node)) {
          if (!required.has(key)) problems.push(`${path}.${key}: opcional`);
        }
      }
    });
    expect(problems).toEqual([]);
  });

  it('a evidência vem antes do enunciado (ordem proposital)', () => {
    const item = (llmSegmentOutputJsonSchema().properties as Node).questions as Node;
    const keys = Object.keys((item.items as Node).properties as Node);
    expect(keys.indexOf('evidence')).toBeLessThan(keys.indexOf('prompt'));
  });

  it('o exemplo do §8.12 valida no Zod', () => {
    expect(LlmSegmentOutputSchema.safeParse(example).success).toBe(true);
  });
});
