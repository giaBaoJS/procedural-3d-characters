import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        hunter: resolve(__dirname, "hunter.html"),
        mechGirl: resolve(__dirname, "mech-girl.html"),
      },
    },
  },
});
