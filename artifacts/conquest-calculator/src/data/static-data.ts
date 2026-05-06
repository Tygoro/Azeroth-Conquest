// Static data abstraction — all class/spec/talent data is computed locally
// from CLASS_FLAVORS + the layout engine. No runtime API calls required.
//
// Swap implementations here if you ever want to restore API-backed fetching.
import type { ClassMeta, ClassDetail, TalentTree } from '@workspace/api-client-react';
import sunclericManifest from './talents/classes/suncleric/class.json';
import sunclericValkyrieTree from './talents/classes/suncleric/specs/valkyrie.json';
import extractedTinkerTree from './talents/tinker.json';
import {
  classMetas,
  getClassDetail as _getClassDetail,
  getSpecTree,
} from './talent-engine/class-engine';
import {
  normalizeClassManifestData,
  normalizeClassMetaData,
  normalizeExtractedTalentTreeData,
  normalizeTalentTreeData,
} from './talent-engine/normalize-tree';

const JSON_CLASS_MANIFESTS: Record<string, unknown> = {
  suncleric: sunclericManifest,
};

const JSON_SPEC_TREES: Record<string, unknown> = {
  suncleric_valkyrie: sunclericValkyrieTree,
};

const EXTRACTED_CLASS_TREES: Record<string, unknown> = {
  tinker: extractedTinkerTree,
};

/** Returns the full list of 21 CoA class metas (same shape as GET /api/classes). */
export function getClasses(): ClassMeta[] {
  const jsonMetas = new Map(
    Object.entries(JSON_CLASS_MANIFESTS)
      .map(([classId, manifest]) => [classId, normalizeClassMetaData(manifest)] as const)
      .filter((entry): entry is readonly [string, ClassMeta] => Boolean(entry[1])),
  );

  return classMetas.map((meta) => jsonMetas.get(meta.id) ?? meta);
}

/** Returns class detail including its spec list (same shape as GET /api/classes/:classId). */
export function getClassDetail(classId: string): ClassDetail | undefined {
  const jsonDetail = normalizeClassManifestData(JSON_CLASS_MANIFESTS[classId]);
  if (jsonDetail) return jsonDetail;
  return _getClassDetail(classId);
}

/** Returns a full talent tree (same shape as GET /api/classes/:classId/specs/:specId). */
export function getTalentTree(classId: string, specId: string): TalentTree | undefined {
  const jsonTree = normalizeTalentTreeData(JSON_SPEC_TREES[`${classId}_${specId}`]);
  if (jsonTree) return jsonTree;

  const generatedTree = getSpecTree(classId, specId);
  const meta = classMetas.find((c) => c.id === classId);
  if (classId === 'tinker' && meta && generatedTree) {
    const extractedTree = normalizeExtractedTalentTreeData(
      EXTRACTED_CLASS_TREES[classId],
      meta,
      specId,
      generatedTree.specName ?? specId,
    );
    if (extractedTree) return extractedTree;
  }

  return generatedTree;
}
