import PanelIcon, { type PanelIconName } from "./PanelIcon";

const icons: Record<string, PanelIconName> = {
  overview: "home",
  clients: "users",
  licenses: "orders",
  builder: "products",
  modules: "modules",
  services: "briefcase",
  portfolio: "image",
  notifications: "bell",
  content: "pages",
  concepts: "design",
  settings: "settings",
  payments: "payments",
  tasks: "forms",
  leads: "leads",
  users: "users",
  "→": "arrow",
  "←": "arrow",
  "↗": "external",
  "＋": "plus",
  "×": "close",
  "✓": "check",
};

/** Use the demo panel's SVG icons in the owner and admin workspaces. */
export default function WorkspaceIcon({ symbol }: { symbol: string }) {
  return <PanelIcon name={icons[symbol] ?? "file"} className={`workspaceIcon${symbol === "←" ? " workspaceIconBack" : ""}`} />;
}
