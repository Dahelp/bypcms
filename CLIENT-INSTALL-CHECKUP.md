# Client installation acceptance gate

Status: not release-certified. A successful frontend build is not an installation test.

Update 2026-11-07: isolated Apache/MySQL installation acceptance for real ZIPs of all
three editions passed. See [the recorded results](docs/ACCEPTANCE-2026-11-07.md) for
scope, fixes and remaining release gates. Theme parity, module business flows,
activation and update/backup/rollback remain unverified.

## Confirmed by source inspection

- Demo frontend is React; package builder copies deployed files and adds edition/module manifest.
- Manifest selection alone does not prove module enforcement or frontend parity.
- Installer requires MySQL credentials and creates schema plus owner account.
- Private, runtime storage, environment and log files must never enter customer ZIPs.
- Preview page query parameters are demo navigation, not proof of server-rendered client routes.

## Required isolated acceptance run (Content / Business / Commerce)

1. Download each generated ZIP; enumerate entries and verify no private data or credentials.
2. Install in an empty directory with a new empty database, not the production database.
3. Check PHP version/extensions, filesystem permissions and database connectivity before writes.
4. Verify selected edition, included modules, license term and installed theme match manifest.
5. Request every public URL directly, reload it and test missing URLs return HTTP 404.
6. Test admin login/logout, session expiry, CSRF and access restrictions.
7. Create/edit/delete content, images and products; verify persistence after reload.
8. Test all nine themes at desktop/tablet/mobile widths and with long text/missing images.
9. Verify local assets work without BYPCMS production hosting dependencies.
10. Repeat installation attempt: must not overwrite an installed site.
11. Test failed installation recovery and backup/restore before updates.
12. Commerce: validate server-side price/stock/order checks and sandbox payment flow.

Do not claim customer-ready until these checks have recorded results for all editions.
