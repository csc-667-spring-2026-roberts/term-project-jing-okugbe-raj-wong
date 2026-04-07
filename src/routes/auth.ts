import { Router } from "express";
import crypto from "crypto";
import Users from "../db/users.js";
import bcrypt from "bcrypt";

const router = Router();

const SALT_ROUNDS = 10;

function gravatarURL(email: string): string {
    const hash = crypto
    .createHash("md5")
    .update(email.trim().toLowerCase())
    .digest("hex");

    return `https://www.gravatar.com/avatar/${hash}?d=identicon`;
}


router.post("/register", async (request, response) => {
    const {email, password} = request.body;

    if (!email || !password) {
        response.status(400).json({error: "Email and password required"});
        return;
    }

    if (password.length < 8) {
        response.status(400).json({error: "Password must be at least 8 characters"});
        return;
    }

    try {
        if (await Users.existing(email)) {
            response.status(409).json({error: "Email already registered"});
            return;
        }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const avatar = gravatarURL(email);

    const user = await Users.create(email, passwordHash, avatar);

    request.session.user = user;

    response.status(201).json({
        ...user
    });

    } catch (error) {
        console.error("Registration error: ", error);
        response.status(500).json({ error: "Resgistration failed"});
    }
})

router.post("/login", async (request, response) => {
    const { email, password } = request.body;

    if (!email || !password) {
        response.status(400).json({ error: "Email and password required" });
        return;
    }

    try {
        const user = await Users.findByEmail(email);

        if (!user) {
            response.status(401).json({ error: "Invalid email or password" });
            return;
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            response.status(401).json({ error: "Invalid email or password" });
            return;
        }

        request.session.user = user;

        response.status(200).json({
            ok: true,
            user
        });
    } catch (error) {
        console.error("Login error: ", error);
        response.status(500).json({ error: "Login failed" });
    }
});


export default router;