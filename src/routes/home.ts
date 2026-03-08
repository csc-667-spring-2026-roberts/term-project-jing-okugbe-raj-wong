import { Router } from 'express';

const router = Router();

router.get("/", (_request, response) => {
    response.send('Hello world from within a route!');
});

export default router;