import { Elysia } from "elysia";
import { vite } from "./core/vite";

const app = new Elysia()
    .use(
        await vite({
            prefix: "/app",
            // viteConfig: {}, // your vite config
        })
    )
    .get("/", () => "Hello Elysia")
    .listen(3000);

console.log(
    `🦊 Elysia + Vite is running at ${app.server?.hostname}:${app.server?.port}`
);
