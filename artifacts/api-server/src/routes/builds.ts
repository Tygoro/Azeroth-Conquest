import { Router } from "express";
import { randomUUID } from "crypto";
import { SaveBuildBody, GetBuildParams } from "@workspace/api-zod";

const router = Router();

interface StoredBuild {
  id: string;
  classId: string;
  buildData: string;
  name?: string;
  createdAt: string;
}

const buildsStore = new Map<string, StoredBuild>();

router.post("/builds", (req, res) => {
  const parsed = SaveBuildBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid build data" });
    return;
  }

  const build: StoredBuild = {
    id: randomUUID(),
    classId: parsed.data.classId,
    buildData: parsed.data.buildData,
    name: parsed.data.name,
    createdAt: new Date().toISOString(),
  };

  buildsStore.set(build.id, build);
  res.status(201).json(build);
});

router.get("/builds/:buildId", (req, res) => {
  const parsed = GetBuildParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid build ID" });
    return;
  }

  const build = buildsStore.get(parsed.data.buildId);
  if (!build) {
    res.status(404).json({ error: `Build '${parsed.data.buildId}' not found` });
    return;
  }

  res.json(build);
});

export default router;
