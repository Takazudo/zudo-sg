import { cloneSubtreeWithNewIds } from "../model/commands";
import type { IdFactory } from "../model/id-factory";
import { cloneJson } from "../model/json";
import type { CompositionDocument, CompositionNode } from "../model/types";
import type {
  CompositionRecord,
  CompositionRecordRef,
  CompositionSummary,
} from "./types";

export interface CompositionRecordFactoryOptions {
  idFactory: IdFactory;
  now: () => string;
}

/** Wrap a document template in a fresh record without retaining references. */
export function createCompositionRecord(
  template: CompositionDocument,
  options: CompositionRecordFactoryOptions,
): CompositionRecord {
  const id = options.idFactory("composition");
  const timestamp = options.now();
  const document = cloneJson(template);
  document.id = id;
  return { id, createdAt: timestamp, updatedAt: timestamp, document };
}

export interface DuplicateCompositionRecordOptions extends CompositionRecordFactoryOptions {
  nodeIdFactory: IdFactory;
  name?: string;
}

/** Duplicate a record with no shared identity or mutable document references. */
export function duplicateCompositionRecord(
  source: CompositionRecord,
  options: DuplicateCompositionRecordOptions,
): CompositionRecord {
  const id = options.idFactory("composition");
  const timestamp = options.now();
  const root = source.document.root.map((node) =>
    cloneSubtreeWithNewIds(node, options.nodeIdFactory),
  );
  return {
    id,
    createdAt: timestamp,
    updatedAt: timestamp,
    document: {
      ...cloneJson(source.document),
      id,
      name: options.name ?? `${source.document.name} copy`,
      root,
    },
  };
}

/**
 * Reset an existing supported record to a template body while preserving the
 * record/document id and original creation time.
 */
export function resetCompositionRecord(
  source: CompositionRecord,
  template: CompositionDocument,
  now: () => string,
): CompositionRecord {
  const document = cloneJson(template);
  document.id = source.id;
  return {
    id: source.id,
    createdAt: source.createdAt,
    updatedAt: now(),
    document,
  };
}

function countNodes(nodes: readonly CompositionNode[]): number {
  let count = 0;
  for (const node of nodes) {
    count += 1;
    for (const children of Object.values(node.slots)) count += countNodes(children);
  }
  return count;
}

export function countCompositionNodes(document: CompositionDocument): number {
  return countNodes(document.root);
}

export function summarizeComposition(record: CompositionRecord): CompositionSummary {
  return {
    id: record.id,
    name: record.document.name,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    nodeCount: countCompositionNodes(record.document),
  };
}

/** Newest updated record first; equal timestamps use ascending id order. */
export function compareCompositionSummariesNewestFirst(
  a: Pick<CompositionSummary, "id" | "updatedAt">,
  b: Pick<CompositionSummary, "id" | "updatedAt">,
): number {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? -1 : 1;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

/** Collision-free provider-qualified key for maps and route state. */
export function compositionRecordRefKey(ref: CompositionRecordRef): string {
  return JSON.stringify([ref.providerId, ref.recordId]);
}
