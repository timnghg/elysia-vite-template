import {
    ViteDevServer,
    createServer as createViteServer,
    InlineConfig,
} from "vite";
import Elysia from "elysia";
import { nodeCompat } from "~/core/node-compat";
import path from "path";
import react from "@vitejs/plugin-react-swc";
import tsconfigPaths from "vite-tsconfig-paths";
import { render } from "~/app/entry-server";

declare global {
    var vite: ViteDevServer;
}

export async function vite<Prefix extends string = "">(
    { prefix, viteConfig }: { prefix: Prefix; viteConfig?: InlineConfig } = {
        prefix: "/app" as Prefix,
    }
) {
    const isProd = process.env.NODE_ENV === "production";
    const appRoot = path.join(import.meta.dir, "../app");
    const distDir = path.join(import.meta.dir, "../../public/dist");
    // const manifestFile = path.resolve(
    //     import.meta.dir,
    //     "../../public/dist/manifest.json"
    // );
    // const manifest = isProd ? await Bun.file(manifestFile).json() : {};
    const templateFile = isProd
        ? path.join(distDir, "index.html")
        : path.join(appRoot, "index.html");
    const template = await Bun.file(templateFile).text();

    const vite = isProd
        ? undefined
        : globalThis.vite ||
          (globalThis.vite = await createViteServer({
              appType: "custom",
              root: appRoot,
              base: prefix,
              publicDir: `${appRoot}/public`,
              plugins: [tsconfigPaths(), react()],
              ...viteConfig,
              server: {
                  middlewareMode: true,
                  hmr: isProd ? false : undefined,
                  ...viteConfig?.server,
              },
          }));

    return new Elysia({
        name: "vite",
        prefix: prefix,
    })
        .on("beforeHandle", async ({ request }) => {
            const url = new URL(request.url);
            // @todo: rewrite this to check exists & cache production assets
            if (isProd && url.pathname.match(/\.css|\.js/)) {
                const assetFile = Bun.file(
                    path.join(distDir, url.pathname.replace(`${prefix}/`, ""))
                );

                if (await assetFile.exists()) {
                    return new Response(assetFile);
                }
            }

            // this is global middleware so we need to check if it's our route
            const isMatchPrefix =
                !isProd &&
                url.pathname.startsWith(prefix) &&
                (url.pathname.includes("/@") || // @vite, @fs, @react-refresh, @id
                    url.pathname.includes(".tsx") ||
                    url.pathname.includes(".ts") ||
                    url.pathname.includes(".js") ||
                    url.pathname.includes(".mjs") ||
                    url.pathname.includes(".cjs") ||
                    url.pathname.includes(".jsx") ||
                    url.pathname.includes(".svg") ||
                    url.pathname.includes(".css"));

            if (!isMatchPrefix || !request || !vite || !vite.middlewares) {
                return;
            }

            // we need to clone the request since it's a stream
            // and whole server expected it immutable
            const clonedReq = request.clone();

            const handled = await nodeCompat(clonedReq, vite.middlewares);

            return handled;
        })
        .all("*", async function (ctx) {
            // pass the context to render function
            const pageContext = {
                prefix,
                url: ctx.request.url,
                isProd,
            };

            let clonedTemplate =
                !isProd && vite
                    ? await vite.transformIndexHtml(prefix, template)
                    : template;

            const rendered = render();

            clonedTemplate = clonedTemplate.replace(
                "<!--ssr-outlet-->",
                rendered
            );

            return new Response(clonedTemplate, {
                status: 200,
                headers: {
                    "Content-Type": "text/html;charset=UTF-8",
                },
            });
        });
}
