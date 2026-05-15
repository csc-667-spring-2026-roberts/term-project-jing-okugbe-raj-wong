import { Router } from "express";

const router = Router();

router.get("/", (request, response) => {
  if (request.session.user?.id) {
    response.redirect("/lobby");
  } else {
    response.redirect("/auth/login");
  }
});

router.get("/login", (_request, response) => {
  response.redirect("/auth/login");
});

router.get("/register", (_request, response) => {
  response.redirect("/auth/register");
});

router.get("/rules", (request, response) => {
  response.render("rules", { user: request.session.user ?? null });
});

export default router;
