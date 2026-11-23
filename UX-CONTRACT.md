# Client workspace behavior

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Table Selection | PanelTable | app/components/PanelTable.tsx | Current-page explicit selection; failed rows remain selected | HTTP and browser acceptance |
| Select/Listbox | Native select | ClientFields and PanelTable | Visible labels and native keyboard popup | Narrow viewport and keyboard acceptance |
| Date | Native date and typed publication date | Existing demo; ClientRecords | Explicit UTC typed value in client; native date retained elsewhere | Content runtime tests |
| Form | ClientFields and PanelSession | app/client and shared session | Pessimistic save; input survives errors; revision on updates | HTTP and browser acceptance |
| Scrollbar | workspace-common.css and workspace-menu.css | Shared panel styles | Document scroll for forms; table overflow only | Responsive acceptance |
| Toast | Workspace inline live region | ClientWorkspace and PanelTable | Confirmed outcomes; inline error recovery | Browser acceptance |
| CRUD | ClientWorkspace API and project adapter | server/_core/ClientWorkspace.php | URL filters; save/cancel to owning list; stale revision rejected | HTTP tests |
| Session | PanelSession | Same session across content/license/update; expiry triggers reauthentication and preserves mounted safe input | existing session contract |
| Navigation | ClientRouter | Native /manage/ links and History API | One authenticated document; modifier/new-tab links remain native; Back/Forward restore URL state; dirty forms require app-owned confirmation | Browser acceptance |
| Upload | ClientUpload | Official media.upload API, 10 MB, server MIME validation | Same file control in media and image fields; explicit busy/success/error/retry, duplicate lock, file input reset | HTTP and browser acceptance |
| Pending | PanelPending | Shared inline asynchronous state | Reserved space; status appears only after 350 ms; no start-screen flash on section navigation; reduced motion | Browser acceptance |

Routes /manage/ and client /admin/ share one workspace. Existing client license/update URLs redirect to matching workspace sections. Platform /admin/ remains separate. Server policy gates every action independently of visible navigation. Only owners may activate/release licenses or start updates. Editors cannot change mail, users or theme settings; managers only see permitted CRM records. No client workspace action exposes platform concepts, builds, sales or owner functions.

The core recognizes project/workspace.php as a developer-owned adapter. Its capabilities, language fields, validation and public URLs are authoritative. ThreeV hides projects and demo material, preserves fixed template block order, stores team translations in existing Content records and applies theme appearance/menu/branding/contact changes through its public renderer. Core updates preserve project files, theme assets, runtime configuration, data and uploads.

Native Atelier, Corporate and Mono settings use Business defaults and the active renderer's typography, appearance and menus. A plain custom HTML template exposes only supported common data and theme selection; project controls come from its own ClientProject adapter. Locale fields use the project's declared locales, without ThreeV-specific labels or languages in the shared shell.
