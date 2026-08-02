import { resolve } from "path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        "@shared": resolve("shared"),
      },
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, "main/index.ts"),
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        "@shared": resolve("shared"),
      },
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, "preload/index.ts"),
        },
      },
    },
  },
  renderer: {
    root: "renderer",
    resolve: {
      alias: {
        "@": resolve("renderer/src"),
        "@shared": resolve("shared"),
        "@components": resolve("renderer/src/components"),
        "@stores": resolve("renderer/src/stores"),
        "@hooks": resolve("renderer/src/hooks"),
        "@i18n": resolve("renderer/src/i18n"),
        "@types": resolve("renderer/src/types"),
        "@utils": resolve("renderer/src/utils"),
      },
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, "renderer/index.html"),
        },
      },
    },
    plugins: [react()],
  },
});
