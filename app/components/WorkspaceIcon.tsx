import PanelIcon, { type PanelIconName } from "./PanelIcon";
import { panelIconBySection } from "./panel-icons";

const icons: Record<string, PanelIconName> = {
  "→": "arrow",
  "←": "arrow",
  "↗": "external",
  "＋": "plus",
  "×": "close",
  "✓": "check",
};

/** Use the demo panel's SVG icons in the owner and admin workspaces. */
export default function WorkspaceIcon({ symbol }: { symbol: string }) {
  return <PanelIcon name={panelIconBySection[symbol] ?? icons[symbol] ?? "file"} className={`workspaceIcon${symbol === "←" ? " workspaceIconBack" : ""}`} />;
}
