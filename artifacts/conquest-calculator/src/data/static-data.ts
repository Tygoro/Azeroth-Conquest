// Static data abstraction — all class/spec/talent data is computed locally
// from CLASS_FLAVORS + the layout engine. No runtime API calls required.
//
// Swap implementations here if you ever want to restore API-backed fetching.
import type { ClassMeta, ClassDetail, TalentTree } from '@workspace/api-client-react';
import {
  classMetas,
  getClassDetail as _getClassDetail,
  getSpecTree,
} from './talent-engine/class-engine';

/** Returns the full list of 21 CoA class metas (same shape as GET /api/classes). */
export function getClasses(): ClassMeta[] {
  return classMetas;
}

/** Returns class detail including its spec list (same shape as GET /api/classes/:classId). */
export function getClassDetail(classId: string): ClassDetail | undefined {
  return _getClassDetail(classId);
}

/** Returns a full talent tree (same shape as GET /api/classes/:classId/specs/:specId). */
export function getTalentTree(classId: string, specId: string): TalentTree | undefined {
  return getSpecTree(classId, specId);
}
