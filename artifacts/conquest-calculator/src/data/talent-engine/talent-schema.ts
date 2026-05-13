import { z } from 'zod';

export const ChoiceOptionDataSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  icon: z.string().min(1).optional(),
});

export const TalentNodePositionDataSchema = z.object({
  x: z.number(),
  y: z.number(),
  gridRow: z.number().int().min(1).max(12).optional(),
  gridColumn: z.number().int().min(1).max(12).optional(),
});

export const TalentNodeDataSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  maxPoints: z.number().int().positive(),
  currentPoints: z.number().int().min(0).optional(),
  prerequisites: z.array(z.string().min(1)).default([]),
  position: TalentNodePositionDataSchema,
  icon: z.string().min(1).optional(),
  type: z.enum(['passive', 'active', 'choice', 'capstone']),
  options: z.array(ChoiceOptionDataSchema).length(2).optional(),
  /** Minimum character level required to allocate this specific node (from official manifest). */
  requiredLevel: z.number().int().min(0).optional(),
  /** Minimum points spent in this tree's tab required to access this node's row (reqTabAE or reqTabTE). */
  reqTabPoints: z.number().int().min(0).optional(),
});

export const SidebarNodeDataSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  icon: z.string().min(1).optional(),
  unlockPointsRequired: z.number().int().min(0),
});

export const TalentTreeRuntimeDataSchema = z.object({
  class: z.string().min(1),
  classId: z.string().min(1),
  specId: z.string().min(1).optional(),
  specName: z.string().min(1).optional(),
  leftTreeName: z.string().min(1).optional(),
  rightTreeName: z.string().min(1).optional(),
  maxPoints: z.number().int().positive(),
  color: z.string().min(1),
  leftTree: z.array(TalentNodeDataSchema),
  rightTree: z.array(TalentNodeDataSchema),
  sidebarTrack: z.array(SidebarNodeDataSchema).optional(),
});

export const TalentTreeDataSchema = z.object({
  schemaVersion: z.number().int().positive(),
  gameVersion: z.string().min(1).optional(),
  classId: z.string().min(1),
  specId: z.string().min(1),
  specName: z.string().min(1).optional(),
  tree: TalentTreeRuntimeDataSchema,
});

export const SpecManifestDataSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: z.enum(['damage', 'tank', 'healer', 'support']),
  attribute: z.enum(['strength', 'agility', 'intellect', 'stamina', 'spirit']),
  complexity: z.enum(['easy', 'normal', 'intermediate', 'advanced']),
  description: z.string().min(1),
  sampleSpells: z.array(z.string()),
});

export const ClassManifestDataSchema = z.object({
  schemaVersion: z.number().int().positive(),
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  icon: z.string().min(1),
  color: z.string().min(1),
  specs: z.array(SpecManifestDataSchema),
});

export type ChoiceOptionData = z.infer<typeof ChoiceOptionDataSchema>;
export type TalentNodeData = z.infer<typeof TalentNodeDataSchema>;
export type TalentTreeData = z.infer<typeof TalentTreeDataSchema>;
export type ClassManifestData = z.infer<typeof ClassManifestDataSchema>;
