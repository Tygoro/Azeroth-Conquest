import { Router } from "express";
import { classMetas, getClassTree } from "../data/classes";
import { GetClassParams } from "@workspace/api-zod";

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

  const tree = getClassTree(parsed.data.classId);
  if (!tree) {
    res.status(404).json({ error: `Class '${parsed.data.classId}' not found` });
    return;
  }

  res.json(tree);
});

export default router;
