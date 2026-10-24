import { build } from "esbuild";

await build({
  entryPoints: ["client/auth.jsx"],
  outfile: "generated-artifacts/auth/auth.bundle.js",
  bundle: true,
  minify: true,
  format: "esm",
  platform: "browser",
  jsx: "automatic",
  define: {
    "import.meta.env.VITE_CLERK_PUBLISHABLE_KEY": JSON.stringify(process.env.VITE_CLERK_PUBLISHABLE_KEY || process.env.CLERK_PUBLISHABLE_KEY || ""),
    "import.meta.env.VITE_CLERK_PROXY_URL": JSON.stringify(process.env.VITE_CLERK_PROXY_URL || ""),
    "import.meta.env.BASE_URL": '"/"',
    "process.env.NODE_ENV": '"production"',
  },
});
