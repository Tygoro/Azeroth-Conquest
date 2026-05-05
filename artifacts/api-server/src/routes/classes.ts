import { Router } from "express";
import { classMetas, getClassDetail, getSpecTree } from "../data/classes";
import { GetClassParams, GetSpecTreeParams } from "@workspace/api-zod";

const router = Router();

router.get("/classes", (_req, res) => {
  res.json(classMetas);
});

router.get("/classes/:classId", (req, res) => {
  const parsed = GetClassParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid class ID" });
    return;
  }

  const detail = getClassDetail(parsed.data.classId);
  if (!detail) {
    res.status(404).json({ error: `Class '${parsed.data.classId}' not found` });
    return;
  }

  res.json(detail);
});

router.get("/classes/:classId/specs/:specId", (req, res) => {
  const parsed = GetSpecTreeParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }

  const tree = getSpecTree(parsed.data.classId, parsed.data.specId);
  if (!tree) {
    res.status(404).json({ error: `Spec '${parsed.data.specId}' not found for class '${parsed.data.classId}'` });
    return;
  }

  res.json(tree);
});

export default router;
