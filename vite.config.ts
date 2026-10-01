import { defineConfig, loadEnv } from "vite";
import { renderPortfolio, escapeHtml } from "./src/render";

export default defineConfig(({ mode }) => {
  const origin = process.env.SITE_ORIGIN || loadEnv(mode, process.cwd(), "").SITE_ORIGIN;
  const site = origin ? new URL(origin) : null;
  if (site && !["https:", "http:"].includes(site.protocol)) throw new Error("SITE_ORIGIN must be an HTTP(S) URL");
  return {
    plugins: [{
      name: "semantic-portfolio",
      transformIndexHtml: {
        order: "pre",
        handler(html) {
          const url = site?.origin;
          const meta = `<meta property="og:title" content="Chakib Belgaid — Product engineer, Ph.D." /><meta property="og:description" content="Applied AI, developer tools, and software energy measurement. Explore Whisperbook and Wattch Core." /><meta property="og:type" content="website" /><meta name="twitter:card" content="summary_large_image" />${url ? `<link rel="canonical" href="${escapeHtml(url)}/" /><meta property="og:url" content="${escapeHtml(url)}/" /><meta property="og:image" content="${escapeHtml(url)}/assets/garden-preview.png" /><meta name="twitter:image" content="${escapeHtml(url)}/assets/garden-preview.png" />` : ""}`;
          return html.replace("<!--portfolio-->", renderPortfolio()).replace("<!--social-->", meta);
        },
      },
    }],
  };
});
