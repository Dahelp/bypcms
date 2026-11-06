# BYPCMS checkup

## Update — 2026-11-07

Basic panel and installation acceptance is now recorded in
[`docs/ACCEPTANCE-2026-11-07.md`](docs/ACCEPTANCE-2026-11-07.md).
Real Content/Business/Commerce ZIPs were installed on isolated Apache/MySQL sites;
direct routes, server auth/CSRF, private directories, local assets, persistence,
reinstall protection and failed-install cleanup were exercised.
Browser scenarios ran for Demo/Owner/Admin, including 390px documents.
The remaining sale-certification gaps below still apply where not superseded by that report.

## Baseline — 2026-11-01

## Executed successfully

- `node --test tests/client-install.test.mjs`: 6/6 passed.
- PHP syntax validation: all files under `server/` passed PHP 8.2 lint.
- `pnpm exec tsc --noEmit`: passed, no diagnostics.
- Latest production deployment `f6c5dc3`: GitHub workflow completed successfully.
- Local PHP has PDO MySQL, mbstring, fileinfo, zip, JSON, OpenSSL.

The six tests inspect source contracts; they do NOT execute a ZIP installation or prove module functionality.

## Confirmed gaps

- Existing `rendered-html.test.mjs` asserts obsolete starter skeleton output; not a BYPCMS acceptance suite.
- No running local MySQL listener on port 3306 during check. Clean MySQL installation and rollback NOT tested.
- No browser visual/interaction acceptance run completed.
- Actual ZIP extraction and HTTP routing on Apache NOT tested.
- Package module registration does not implement missing Commerce/payment/shipping functionality.
- Customer frontend theme parity and complete module-dependent navigation NOT certified.
- Payment provider sandbox, email delivery, update rollback and license activation NOT tested.

## Release decision

NOT ready to certify for customer sale. Do not equate passing lint, typecheck or source checks with a complete CMS installation.
