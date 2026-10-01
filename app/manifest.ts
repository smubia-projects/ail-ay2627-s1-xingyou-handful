import type { MetadataRoute } from "next";

// Lets phones add SignPath to the home screen and open it full screen, like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SignPath",
    short_name: "SignPath",
    description: "Learn ASL signs in short, friendly lessons.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
