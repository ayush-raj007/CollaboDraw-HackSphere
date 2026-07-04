import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import boardsRouter from "./boards";
import collaboratorsRouter from "./collaborators";
import chatRouter from "./chat";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(boardsRouter);
router.use(collaboratorsRouter);
router.use(chatRouter);

export default router;
