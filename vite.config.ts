import { defineConfig, loadEnv } from "vite";
import { renderPortfolio, escapeHtml } from "./src/render";
import { site } from "./src/narrative/content";

export default defineConfig(({ mode }) => {
  const origin = process.env.SITE_ORIGIN || loadEnv(mode, process.cwd(), "").SITE_ORIGIN;
  const url = origin ? new URL(origin) : null;
  if (url && !["https:", "http:"].includes(url.protocol)) throw new Error("SITE_ORIGIN must be an HTTP(S) URL");
  return {
    plugins: [{
      name: "semantic-portfolio",
      transformIndexHtml: {
        order: "pre",
        handler(html) {
          const base = url?.origin;
          const e = escapeHtml;
          // og:image stays the garden preview until P7 re-captures it.
          const meta = `<meta property="og:title" content="${e(site.title)}" /><meta property="og:description" content="${e(site.ogDescription)}" /><meta property="og:type" content="website" /><meta name="twitter:card" content="summary_large_image" />${base ? `<link rel="canonical" href="${e(base)}/" /><meta property="og:url" content="${e(base)}/" /><meta property="og:image" content="${e(base)}/assets/garden-preview.png" /><meta name="twitter:image" content="${e(base)}/assets/garden-preview.png" />` : ""}`;
          return html.replace("<!--portfolio-->", renderPortfolio()).replace("<!--social-->", meta);
        },
      },
    }],
  };
});
