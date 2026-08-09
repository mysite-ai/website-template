import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import vercel from "@astrojs/vercel";
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  output: "server",
  adapter: vercel({
    webAnalytics: { enabled: false },
    imageService: true,
  }),
  integrations: [react()],
  image: {
    // Whitelist our Supabase Storage host so Astro/Vercel image optimization
    // (`imageService: true` + astro:assets <Image>) can resize + cache gallery
    // photos at the edge. Without this, remote src is rejected as unsafe.
    domains: ["tkltfqshwwxykxhxthem.supabase.co"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "tkltfqshwwxykxhxthem.supabase.co",
        pathname: "/storage/v1/object/public/assets/**",
      },
    ],
  },
  vite: {
    plugins: [tailwindcss()],
  },
  server: { host: true },
});
