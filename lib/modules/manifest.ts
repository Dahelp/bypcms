/**
 * Публичный контракт расширений BYPCMS.
 *
 * Каждый ZIP-пакет модуля содержит `bypcms.module.json`, соответствующий
 * этому интерфейсу. Ядро не импортирует код модуля напрямую: сначала оно
 * проверяет манифест, совместимость, разрешения и только потом регистрирует
 * объявленные точки встраивания.
 */
export type ModuleSlot =
  | "menu.main"
  | "menu.marketing"
  | "dashboard.widget"
  | "editor.tab"
  | "editor.sidebar"
  | "settings.section";

export type ModulePlacement = {
  slot: ModuleSlot;
  component: string;
  order?: number;
  entityKinds?: string[];
  menu?: {
    id: string;
    label: string;
    icon: string;
    group: string;
  };
};

export type ModuleManifest = {
  schema: "bypcms.module/v1";
  key: string;
  name: string;
  version: string;
  core: string;
  editions: Array<"content" | "business" | "commerce">;
  description: string;
  placements: ModulePlacement[];
  permissions: string[];
  settings?: Array<{
    key: string;
    type: "boolean" | "string" | "number" | "select";
    label: string;
    default?: string | number | boolean;
    options?: string[];
  }>;
  lifecycle?: {
    install?: string;
    update?: string;
    uninstall?: string;
  };
};

export function validateModuleManifest(value: unknown): value is ModuleManifest {
  if (!value || typeof value !== "object") return false;
  const manifest = value as Partial<ModuleManifest>;
  return manifest.schema === "bypcms.module/v1"
    && typeof manifest.key === "string"
    && typeof manifest.name === "string"
    && typeof manifest.version === "string"
    && typeof manifest.core === "string"
    && Array.isArray(manifest.editions)
    && Array.isArray(manifest.placements)
    && manifest.placements.every(placement =>
      typeof placement?.component === "string"
      && ["menu.main", "menu.marketing", "dashboard.widget", "editor.tab", "editor.sidebar", "settings.section"].includes(placement.slot),
    );
}

export function placementsFor(manifests: ModuleManifest[], slot: ModuleSlot, entityKind?: string) {
  return manifests.flatMap(manifest =>
    manifest.placements
      .filter(placement => placement.slot === slot)
      .filter(placement => !entityKind || !placement.entityKinds?.length || placement.entityKinds.includes(entityKind))
      .map(placement => ({ manifest, placement })),
  ).sort((a, b) => (a.placement.order || 100) - (b.placement.order || 100));
}
