import { createRoot, hydrateRoot } from "react-dom/client";
import { QueryClient } from "@tanstack/react-query";
import App from "./App.tsx";
import "./index.css";

const queryClient = new QueryClient();
const initialData = document.getElementById("tde-public-data");
if (initialData?.textContent) {
  try {
    const { school, updatedAt } = JSON.parse(initialData.textContent);
    queryClient.setQueryData(["public-school"], school, { updatedAt });
  } catch {
    /* A missing snapshot falls back to the same live query. */
  }
}
const root = document.getElementById("root")!;
const app = <App queryClient={queryClient} />;
if (root.dataset.ssr === "true") hydrateRoot(root, app);
else createRoot(root).render(app);
