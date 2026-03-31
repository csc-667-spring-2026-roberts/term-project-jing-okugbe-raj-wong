import { Router } from "express";

const router = Router();

router.get("/", (_request, response) => {
  response.render("home");
});

router.get("/login", (_request, response) => {
  response.render("login", { error: null });
});

router.get("/register", (_request, response) => {
  response.render("register", { error: null });
});

export default router;
