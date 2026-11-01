import type { PanelIconName } from "./PanelIcon";

// One semantic mapping for the demo, owner, and admin workspaces.
export const panelIconBySection: Record<string, PanelIconName> = {
  overview: "home", content: "pages", articles: "file", pages: "pages",
  categories: "grid", authors: "users", team: "users", customers: "users",
  clients: "users", users: "users", media: "image", seo: "seo", analytics: "chart",
  design: "design", concepts: "design", extensions: "modules", modules: "modules",
  settings: "settings", orders: "orders", licenses: "orders", products: "products",
  builder: "products", brands: "briefcase", services: "briefcase", projects: "briefcase",
  portfolio: "briefcase", forms: "forms", tasks: "forms", leads: "leads",
  license: "orders", task: "forms", client: "users", module: "modules",
  payments: "payments", promos: "promo", notifications: "bell",
};
