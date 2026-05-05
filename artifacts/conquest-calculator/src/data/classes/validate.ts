// Tree validation — called before rendering any talent tree.
// Returns a detailed result so the UI can show meaningful errors.

import type { TalentTree, TalentNode } from '@workspace/api-client-react';

export type ValidationResult =
  | { valid: true }
  | { valid: false; reason: string };

function isValidNode(node: unknown): node is TalentNode {
  if (!node || typeof node !== 'object') return false;
  const n = node as Record<string, unknown>;
  return (
    typeof n.id === 'string' &&
    typeof n.name === 'string' &&
    typeof n.maxPoints === 'number' &&
    n.maxPoints > 0 &&
    typeof n.position === 'object' &&
    n.position !== null &&
    typeof (n.position as Record<string, unknown>).x === 'number' &&
    typeof (n.position as Record<string, unknown>).y === 'number' &&
    Array.isArray(n.prerequisites) &&
    ['passive', 'active', 'choice', 'capstone'].includes(n.type as string)
  );
}

export function validateTree(tree: unknown): ValidationResult {
  if (!tree || typeof tree !== 'object') {
    return { valid: false, reason: 'Tree data is missing or not an object.' };
  }

  const t = tree as Record<string, unknown>;

  if (typeof t.classId !== 'string' || !t.classId) {
    return { valid: false, reason: 'Tree is missing a classId.' };
  }

  if (!Array.isArray(t.leftTree)) {
    return { valid: false, reason: `Class "${t.classId}" is missing leftTree array.` };
  }

  if (!Array.isArray(t.rightTree)) {
    return { valid: false, reason: `Class "${t.classId}" is missing rightTree array.` };
  }

  if (t.leftTree.length === 0 && t.rightTree.length === 0) {
    return { valid: false, reason: `Class "${t.classId}" has no talent nodes in either tree.` };
  }

  const allNodes = [...(t.leftTree as unknown[]), ...(t.rightTree as unknown[])];
  const nodeIds = new Set<string>();

  for (const node of allNodes) {
    if (!isValidNode(node)) {
      return {
        valid: false,
        reason: `Class "${t.classId}" has a malformed node — missing id, name, maxPoints, or position.`,
      };
    }
    if (nodeIds.has(node.id)) {
      return {
        valid: false,
        reason: `Class "${t.classId}" has duplicate node id: "${node.id}".`,
      };
    }
    nodeIds.add(node.id);
  }

  // Check that all prerequisites reference existing nodes
  for (const node of allNodes) {
    if (!isValidNode(node)) continue;
    for (const prereqId of node.prerequisites) {
      if (!nodeIds.has(prereqId)) {
        return {
          valid: false,
          reason: `Node "${node.id}" in class "${t.classId}" references unknown prerequisite "${prereqId}".`,
        };
      }
    }
  }

  return { valid: true };
}

// Type-safe wrapper that also validates and narrows the type
export function validateAndNarrow(tree: unknown): { tree: TalentTree; error: null } | { tree: null; error: string } {
  const result = validateTree(tree);
  if (!result.valid) {
    return { tree: null, error: result.reason };
  }
  return { tree: tree as TalentTree, error: null };
}
