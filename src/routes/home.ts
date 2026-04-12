import { Router } from "express";

const router = Router();

router.get("/", (request, response) => {
  if(request.session.user?.id) {
  response.redirect("/lobby");
  } else {
    response.redirect("/auth/login");
  }
});

router.get("/login", (_request, response) => {
  response.render("login", { error: null });
});

router.get("/register", (_request, response) => {
  response.render("register", { error: null });
});

export default router;
