import { Router, type IRouter } from "express";
import healthRouter from "./health";
import classesRouter from "./classes";
import buildsRouter from "./builds";

const router: IRouter = Router();

router.use(healthRouter);
router.use(classesRouter);
router.use(buildsRouter);

export default router;
