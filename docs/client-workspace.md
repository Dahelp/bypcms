# Business client workspace, 2.8.1

2.8.1 keeps section navigation inside one authenticated document, including search/row-menu links and GET filters. URL query routing remains bookmarkable; Back/Forward and direct links work. Dirty forms show an app-owned leave dialog, and active writes block navigation. Shared inline pending states are delayed by350ms to avoid flashing startup copy. Media and image fields use one upload surface with server-backed results, validation, retry and duplicate prevention.

All Business delivery paths call ClientPackage with the edition: owner ZIP generation, purchase fulfillment, and refresh of previously issued customer archives. A cached Business archive from an older core is refreshed on download while its project, manifest and licence trust are retained. A missing compiled client shell fails delivery rather than falling back to platform Admin.

Native Atelier/Corporate/Mono design controls read Business settings, identify the active theme and apply its actual color, fonts and menus. The fallback custom HTML template exposes its supported common settings; a developer-owned ClientProject supplies site-specific controls. The shared client has no ThreeV-specific labels or fixed menu locales. A separate example project withEN/FR is included in the installation acceptance matrix alongside the three native renderers.

Business customer builds serve the same WorkspaceFrame, navigation, PanelTable and PanelSearch owners as the public demo. The demo keeps its isolated data and edition switcher; installations use authenticated server APIs and actual capabilities. The platform Admin is not a customer menu. Content and Commerce retain their existing panels in this release.

`/client/` is a build input. ClientPackage replaces the Business ZIP's `site/admin/index.html` with that compiled export; `/manage/` serves it and fresh `/admin/` redirects into it. This uses the existing signed `admin/index.html` update path and existing versioned JS/CSS transport. Missing exports fail the build instead of silently shipping the platform panel.

Navigation comes from `ClientWorkspace::manifest`: edition, installed/active modules, user role, and project capabilities. Every server action independently validates the section and record. Owner-only licensing and updates reuse the existing LicenseSettings, UpdateSettings and stable update engine. No new licence, receipt store or activation protocol exists.

## Project integration

The developer-owned, non-public `project/workspace.php` returns ClientProject. It declares sections, locales, hidden/fixed content sections, record fields, public URLs and validated settings. It must not load executable files supplied by a request. Settings and custom text render through the project's own public renderer; the theme cannot replace the admin shell. `saved()` synchronizes project-specific public dependencies after a content save.

ThreeV's adapter and Appearance renderer live in its project repository. They preserve 42 RU/EN/DE records, exact template block order, two service directions, per-language team publication, contacts, branding and copy delivery. Page/service creation is deliberately unavailable for this fixed layout. Existing project settings and data are retained on integration. Archived Atelier demo material is excluded from its lists.

Older project editor links redirect to the unified panel. Old content mutations and generic page bulk writes are rejected once a project workspace is active, so they cannot bypass structural and legal-publication checks. The owner's one-time project import remains available and repeat-safe.

## Installation and update acceptance

Build with `next build --webpack` and `node scripts/prepare-deploy.mjs`. The generated update candidate is Business 2.8.0, compatible with 2.7.2 and earlier declared versions. Do not publish it to other editions. Server-held authority keys sign published candidates; test keys must remain confined to disposable fixtures.

A fresh Business ZIP includes the repaired stable update engine. The earlier 2.7.2 engine mistakes private project PHP for public entrypoints. For an existing Business project, first install its reviewed adapter and run:

```text
php scripts/repair-project-updates.php /absolute/client/root
php scripts/repair-project-updates.php /absolute/client/root --apply
```

The first command inspects only. Apply accepts only the known original 2.7.2 engine or an already repaired engine, takes the runtime lock, refuses active updates, saves verified private originals, and replaces the engine atomically. Unexpected/custom files are refused. Signed updates continue to exclude stable Update*.php files. Project files remain outside signed core releases.

Before reserving any customer data, the repaired engine writes a harmless random PHP probe under `project/`, requests it through the site's actual server rules, requires HTTP 403, then removes it. Exposed PHP, HTTP redirects/errors, an unwritable project folder, and unknown public entrypoints still stop the update. Site/project/uploads/config/licence backup and rollback behavior is retained.

Acceptance includes: empty-database ZIP install and repeat import; real translated edits and public previews; stale revisions; CSRF/role/record boundaries; partial bulk failure; actual menu/appearance/contact/branding changes; shared licence/update endpoints; signed 2.7.2 → 2.8.0 update; versioned assets; full customer-data fingerprints and rollback. Check desktop and narrow layouts plus keyboard search and row menus in the browser.

Project health checks request its public root through HTTP. Internal content slugs are not interpreted as URLs, and replaceable project classes are never loaded into the stable updater process.

Auxiliary public PHP entrypoints must use the exact guarded wrapper below (adjust dirname depth and the private controller basename). The updater accepts only this complete template, a real private target, and an HTTP-verified protected project directory; appended PHP, traversal, wrong depth and unguarded controllers remain rejected. The private controller may close the session for read-only responses. The stable runtime holds its lock until request shutdown, including on older active releases.

```php
<?php
declare(strict_types=1);
$root=dirname(__DIR__,1);
header('X-Robots-Tag: noindex, nofollow, noarchive, noimageindex');
require_once $root.'/_core/UpdateRuntime.php';
\BYPCMS\Core\UpdateRuntime::serve($root,'_core/bootstrap.php');
require $root.'/project/Archive.php';
```
