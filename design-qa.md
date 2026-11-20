# Public website design acceptance

final result: passed

## Comparison target and evidence

- Approved direction: the first Product Design concept, revised for a build-sales funnel, a curated showcase and Russian/English navigation.
- Source visual: `C:/Users/babac/.codex/generated_images/01a1f79f-14ed-71b3-95d7-9be4574adb12/exec-e9b33204-da27-41e9-a7eb-6d98862ccf40.png` (856 × 1838 pixels).
- Implementation: `http://127.0.0.1:8020/?edition=Commerce&term=annual`.
- Initial desktop capture: `outputs/home-redesign/home-desktop.jpg` (1425 × 5513 pixels), CSS viewport 1440 × 1000, device pixel ratio 1. The browser capture excludes its outer scrollbar.
- Combined source/implementation evidence: `outputs/home-redesign/comparison-before.jpg`. The implementation through the configurator is resized proportionally to the source width of 856 pixels. No stretching is used.
- Initial mobile capture: `outputs/home-redesign/home-mobile-before.jpg`, CSS viewport 390 × 844.

## Findings and correction history

1. P2 — Edition prices and buttons did not share a baseline because included module counts differ. Corrected with flex columns, a consistent feature area and bottom-aligned prices. Verified in `comparison-final.jpg` and `home-desktop-final.jpg`.
2. P2 — Original website captures included scrollbar pixels. Replaced with measured crops of the same real captures; no invented website imagery or client claims. Verified in `comparison-final.jpg` and `home-desktop-final.jpg`.
3. P2 — Some supporting labels were below the project's 14px readability floor. Raised captions, labels and explanatory text. Verified in `comparison-final.jpg` and `home-desktop-final.jpg`.
4. P1 — Client navigation attempted a Next route fetch for the PHP buyer account. Public links now load their destination documents, retaining localized URLs. Same-page section links preserve the existing build query. Verified by clicking the final mobile menu Account link: the browser opened `/account/?lang=en` and displayed the real buyer account.
5. Inline copy spacing was restored from the source JSX text in checkout, services and contact pages, preserving readable fragments in both languages.

## Fidelity surfaces

- Typography: locally served Manrope with its included OFL license, clear display hierarchy and readable body copy. Russian and English use the same type system.
- Spacing: asymmetric hero, three-step introduction, showcase, edition comparison and a dark configurator retain the chosen hierarchy. The added language section and detailed deliverables intentionally extend the source composition.
- Color: existing paper, ink, lime, violet and blue tokens; restrained separation and elevation.
- Imagery: actual Atelier, Gallery and Chronicle demo website captures replace the mock's illustrative website previews. This is intentional source grounding. Demonstrations are labeled as such; the platform itself is the RU/EN portfolio example.
- Content: fixed edition prices and included modules come from the existing catalog. Services remain separately agreed and excluded from the payable license total.

## Functional verification completed

- Real isolated installation and database on loopback; no production database or live payment involved.
- Eleven HTTP assertions passed for English registration, checkout return URL, authenticated bootstrap, server quote, saved order, repeat submission and English order/account rendering.
- Mobile browser journey preserved domain, comment, edition, license term and selected service across sign-in; the real frontend saved local order 2 and opened its English result page.
- Russian and English language switching preserves the home configuration and anchor.
- Mobile menu opens and closes; initial mobile capture has no horizontal overflow.
- Six public locale/document tests, 22 recovery/return-URL checks and 33 existing payment boundary checks passed.

## Final comparison and verification

- Final desktop evidence: `outputs/home-redesign/home-desktop-final.jpg` (1425 × 5535 pixels), 1440 × 1000 CSS viewport, DPR 1.
- Final English mobile evidence: `outputs/home-redesign/home-mobile-en-final.jpg` (375 × 8658 pixels), 390 × 844 CSS viewport, DPR 1; Content / lifetime / launch service selected.
- Full combined comparison: `outputs/home-redesign/comparison-final.jpg` (1736 pixels wide), source at left and proportional implementation through the configurator at right.
- Focused hero/typography comparison: `outputs/home-redesign/comparison-hero-final.jpg`. Both artifacts were opened together. Native product typography is calibrated for actual desktop/mobile readability rather than treating the generated image's raster pixels as CSS pixels.
- Desktop edition price baselines all equal 2577.953125 CSS pixels. Captions are 14px. All four showcase images loaded. No horizontal overflow at either tested viewport.
- Real demo captures and the added language section are intentional departures from the generated mock, not missing assets or invented client examples. Existing product tokens and typography hierarchy are retained; no actionable P0/P1/P2 visual mismatch remains.
- The final public Account link was clicked successfully in the mobile English menu. The Atelier case and purchase terms opened as English documents; the latter had no Russian body text and `html lang=en`.
- Final mobile language switch preserved Content, lifetime, launch service and the builder anchor; license total remained 19,900 RUB, with services separate.
- Browser console error check: empty.
- Production build: 49 static pages exported; PHP copied; English root language post-processing completed. Changed-file ESLint finished with zero errors; only four static-image recommendations remain. The project deliberately uses static, locally served screenshots with explicit dimensions and lazy loading where appropriate.

## Limits and follow-up

- This verifies a local build and an isolated real backend/database. No live payment, production publication, or real email delivery was performed.
- The showcase contains labeled demo websites and the bilingual BYPCMS platform. Customer case studies require approved real project material.
- Client demo themes and administrative panels remain in their existing language; the public sales site and buyer account are localized.
- Optional P3 refinement: give the language links larger touch areas while keeping the compact header.

## Implementation checklist

- [x] Resolve all recorded P1/P2 findings and recapture.
- [x] Compare the final full view and a focused region against the source.
- [x] Verify the real buyer journey, language preservation and mobile navigation.
- [x] Verify the export and retain the local preview for review.


## Service estimate correction

The reported configurator omitted selected services from its prominent total. A shared estimate now adds one-time services and the first month of monthly support, itemizes each category and labels the sum as preliminary. The checkout uses server catalog prices for the same display. Server payment amounts and service approval remain unchanged.

- Four estimate calculation tests passed, along with changed-file ESLint and production TypeScript checks. The static export completed successfully (`.next/export-detail.json`), and the local preview was refreshed.
- Browser verification: Commerce / lifetime / all five services totals from 254,900 RUB (49,900 license + 193,000 one-time work + 12,000 first month of support). Removing frontend gives 169,900; no services gives 49,900; UX/UI alone gives 114,900; UX/UI plus support gives 126,900. Totals update immediately.
- The order link preserves all five selected services. The server-backed order estimate matches 254,900 RUB in Russian and English. Support after the first month is explicitly listed from 12,000 RUB/month.
- Responsive checks at 390 and 834 CSS pixels showed no horizontal overflow; the initial total remains readable. Browser error logs were empty. The user's existing local tab was refreshed with the corrected estimate.
- Desktop evidence: `outputs/home-redesign/services-estimate-fixed.jpg`, inspected at full size. Mobile evidence: `outputs/home-redesign/home-estimate-mobile.jpg` and `outputs/home-redesign/order-estimate-mobile-en.jpg`; the English checkout capture was visually inspected.
- This correction is verified locally; no production deployment or payment was performed.

## Checkout clarity and mobile refinement

One cost summary replaces repeated license/item/subtotal blocks. Server quote items are rendered only where they provide a breakdown; the selected edition and license term appear without another price. Consent text uses normal inline wrapping next to a fixed-size checkbox. Field labels, optional/required hints and focus targets are explicit. A four-step explanation covers saving, the invoice, payment and delivery, with separate outcomes for services-only orders and license renewal.

- Production build passed: 49 static pages, TypeScript validation, PHP export and update candidate generation. Changed-file ESLint passed. The mechanical design scan returned no findings. Four cost tests, six locale tests and 33 existing payment/configuration checks passed.
- Eleven real local account/quote/order checks passed, including saving an order, idempotent retry and its appearance in the buyer account. No real payment or email delivery was performed.
- Browser: one summary/total; all-service estimate 254,900 RUB; removing frontend gives 169,900; license only shows one 49,900 RUB total without duplicate line prices. Services-only support gives 12,000 RUB initially with subsequent monthly cost disclosed. An empty services-only selection hides the total and displays a recoverable error; selecting launch restores the 25,000 RUB estimate.
- Browser: project fields and selected services survive Russian/English switches and the real buyer sign-in return. The temporary test account was signed out and synthetic field entries cleared after verification.
- Desktop 1280px and mobile 390px CSS viewports: no horizontal overflow. Consent text spans use normal block flow, with inline legal links, 20px checkboxes aligned to the first line and label targets at least 44px high. Optional fields and the domain requirement agree with existing submission behavior. Keyboard focus is visible. Browser error logs were empty.
- Batched visual inspection found one missing English step title and excess desktop spacing before the next steps. Both were corrected and a final desktop/mobile pass confirmed the result.
- Final evidence, inspected: `outputs/home-redesign/checkout-desktop-final.jpg`, `outputs/home-redesign/checkout-mobile-en-final.jpg`, `outputs/home-redesign/checkout-mobile-ru-final.jpg`, and `outputs/home-redesign/checkout-mobile-consents-final.jpg`. Original evidence: `outputs/home-redesign/checkout-mobile-before.jpg`.
- Updated local order preview is retained for review. No production publication was performed.

## Detailed portfolio and delivered websites

Scope: expand existing case pages with briefs, design/interaction decisions, large actual screenshots, scope, honest project labels and an order/configurator path. Add the nine websites supplied by the user with their confirmed full-development scope; retain the three clearly labeled demo themes and the BYPCMS product. No technology, completion year or performance metric is invented for external projects. Public source captures are retained in `outputs/home-redesign/portfolio-captures/`.

Source websites captured on 2026-11-20: ekkatire.com (catalog and technical product), aspon.org (homepage and membership), 3vconsulting.ru (scenario entry and service selection), shinaspec.ru (equipment catalog and category), vsemposhine.ru (homepage and equipment selection), mlt-lifestyle.com (actual RU/EN homepages), specialnayatechnica.ru (homepage and manufacturers), remizmebel.ru (homepage and estimate calculator), kuhni-remiz.ru (homepage and project story). Client tasks are editorial descriptions of observable public journeys; full-development attribution comes from the user.

MLT's menu offers EN/DE/RU/IT/PL; Russian and English pages were inspected and captured. An initial network interruption on RU recovered in a fresh tab. Slow loading animations on legacy sources were allowed to finish before capture. The shinaspec and EKKA cover captures show the catalog rather than an unloaded opening screen. No source website was modified and no inquiry, subscription or purchase was submitted.

Verification completed:

- Final production build exported 67 pages, including 26 Russian/English case pages. TypeScript and ESLint passed (only the established static-image recommendations remain). The design detector returned no findings; six locale tests passed. All 26 local case URLs and the 13 portfolio sitemap entries were checked successfully.
- Data checks: 13 unique projects, nine user-supplied delivered websites, one own product and three demos. All 31 referenced media assets exist; every case has English content. External client projects do not claim a BYPCMS edition. The home showcase now features MLT Lifestyle, Remiz Furniture and EKKA Tire with full-development labels.
- Source/implementation comparison: `outputs/home-redesign/portfolio-comparison.jpg`, original at left and updated portfolio at right. The smaller introduction now gives room to the actual projects. Final desktop: `outputs/home-redesign/portfolio-desktop-final.jpg`; focused handoff image: `outputs/home-redesign/portfolio-review.jpg`.
- Desktop layout verified at 1280 CSS pixels and mobile layout at 390 CSS pixels, with no horizontal overflow. Final mobile evidence: `outputs/home-redesign/case-mlt-mobile-final.jpg`; initial responsive portfolio evidence: `outputs/home-redesign/portfolio-mobile-after.jpg`. Large images keep their natural proportions and link to the full-size files.
- MLT: RU/EN controls swap the actual screenshot and live destination. Arrow-key navigation moves selection and focus. English next-case navigation was corrected to use the translated project title; final mobile output reads `Next case: Remiz Furniture`.
- BYPCMS: choosing the English example opened the actual English configurator with Commerce and lifetime selected, preserving its 49,900 RUB license price. The Ekkatire development CTA opened a services-only order with UX/UI, frontend and launch selected and a 175,000 RUB estimate. No order or external inquiry was submitted in this portfolio check.
- The Ekkatire case uses its real desktop catalog and product screen. Its mobile source capture showed horizontal scrolling on the external website, so that capture was removed from the published case rather than being presented as a responsive example. The external site was not modified.
- Final browser errors: empty. The updated portfolio is open and retained in the in-app browser. This is a verified local export; no production deployment was performed.

## Commerce product page

Implemented `/solutions/commerce/` and `/en/solutions/commerce/` in the existing public design system. The page contains large actual Gallery screenshots, desktop/mobile product screens, a live demo link, six capability explanations, exact package scope, separate-service limitations, hosting requirements, license terms, pricing and checkout links. Gallery, Market and Luxe inclusion is grounded in the client payload, installed theme selector and the nine-theme acceptance record. The archive description matches the actual package generator; license wording matches the current purchase terms. External client projects are not used as examples of this purchasable build.

- Final `pnpm build:ftp` passed: 69 exported pages, TypeScript, PHP export and update candidate preparation. Changed-file ESLint: zero errors, seven static-image recommendations. Six locale tests and four estimate tests passed; diff whitespace check passed.
- HTTP checks passed for both language pages, their canonical/alternate metadata, one h1 each, all three screenshots, 35 distinct internal destinations, four entry pages (RU/EN home and Gallery case) and both sitemap entries. Results: `outputs/commerce-page/http-results.json`.
- Actual browser journey: Commerce page → lifetime → English → checkout preserved Commerce/lifetime and the 49,900 RUB total. The mobile annual path preserved Commerce/annual and the 19,900 RUB total. No order or payment was submitted. Returning to the product page retained the selected term.
- Home Commerce detail link carries the selected term. All three edition-price baselines remain equal. The Gallery case's existing configuration CTA opens the new product page. Actual Gallery demo opened successfully on its production demo domain.
- Desktop and mobile visual inspection: images loaded, no horizontal overflow. English layout checked at 320, 768, 1024 and 1440 CSS pixels; Russian mobile checked at 390 pixels. Section links have 44px targets. Native radio ArrowLeft selection updates price, URL and order link; focus is visible. FAQ and limitation disclosures open with Enter.
- Final screenshots inspected: `outputs/commerce-page/desktop-en.jpg`, `desktop-ru-final.jpg`, `mobile-ru-final.jpg` and the focused `commerce-preview.jpg`. An early mobile capture was replaced after confirming all lazy-loaded images had finished loading. Browser error logs were empty.
- The verified page is retained in the local in-app preview. This addition has not been published to the production site.
