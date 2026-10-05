# Emissions Converter · consultant workbench

TypeScript + Vite static site, no framework and no backend. Built from the SustivioLabs workbench design.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # calculations, the app in a simulated page, saved-file and share-link safety
npm run verify-sources   # downloads the IPCC and CEA documents and checks every table value (needs the network and pdftotext)
npm run build    # static site in dist/, works from any folder or host
npm run desktop        # open the site as a desktop app (Electron)
npm run desktop:check  # prove the desktop app loads from disk, saves, and cannot reach the network
npm run desktop:win    # build the Windows installer into release/
```

| File | What it holds |
| --- | --- |
| `src/data.ts` | GWP tables (AR4/AR5/AR6), fuel factors, India grid factor. Edit factors here. |
| `src/calc.ts` | Pure calculation functions: line emissions, GWP swaps, number formatting. |
| `src/model.ts` | Turns the state into everything the screen shows. No DOM. |
| `src/view.ts` | HTML for the header, hero and the three tabs. |
| `src/app.ts` | State, events, copy and download, share links, undo, keyboard tabs, and a small DOM patcher that keeps focus while you type. |
| `src/main.ts` | Starts the app on the page. |
| `src/state.ts` | Defaults, saving to the browser, and cleaning anything that comes from a saved file or a link. |
| `src/share.ts` | Share links: the whole inventory in the address after the `#`. Nothing is uploaded. |
| `scripts/verify-sources.check.ts` | Re-checks every table value against the original IPCC and CEA documents. |
| `electron/main.cjs` | Desktop shell: shows the built site in a window and blocks all network access. |

Tabs: Inventory (Scope 1, 2, 3 lines), Quick converters, About.

The tables were keyed in by hand. Check any figure against its source before it goes into a client deliverable or a report.

## Keeping the data current

All reference values live in `src/data.ts`, and `DATA_CHECKED` records when they were last checked. The footer shows that date and warns once it is more than a year old.

To update, for example when CEA publishes a new grid factor each year:

1. Change the value, its label and `DATA_CHECKED` in `src/data.ts`.
2. Point the CEA address in `scripts/verify-sources.check.ts` at the new user guide (and update its `FY` text check).
3. Run `npm run verify-sources`. It fails if any value in the code is not found in its source row, so a typing slip cannot get through.
4. Run `npm test` and `npm run build`.

The source check looks for the expected numbers in order inside each gas or fuel row. It catches slips such as 3790 for 3710, but it does not replace reading the source when a new report is added.

## Saving and sharing

Work is kept in the browser automatically. The inventory also has Download CSV (numbers without thousands separators, so spreadsheets read them), Save to file and Open a file (JSON), and Copy share link (the inventory inside the link). Opening a file, a link or an example replaces the current inventory and offers an Undo, as does removing a line. Text that a spreadsheet would run as a formula gets a leading apostrophe in the CSV and the copied table. Negative quantities and factors count as zero and the line shows a warning. Anything that comes from a file or link is cleaned before use: unknown keys, units and fields are dropped, and text is trimmed and stripped of control characters.

## Privacy

The site has no backend, no analytics and no runtime dependencies. Work is saved in the browser's local storage only. The font is bundled, so the page makes no third-party requests. A share link keeps the inventory after the `#`, which browsers do not send to a server.

## Desktop app

`electron/main.cjs` wraps the built site for offline use. It refuses every request that is not one of the app's own files, so nothing can leave the computer. Share links are hidden there, because a link needs a web address; use Save to file instead.

`npm run desktop:win` builds an unsigned Windows installer (x64). The build downloads Electron and NSIS the first time. The installer has not been tested on Windows yet, and without a code-signing certificate Windows SmartScreen will warn on first run.

## Data sources

Reference values come from the IPCC assessment reports and 2006 Guidelines, the CEA CO₂ Baseline Database, UK DESNZ/DEFRA conversion factors and worldsteel. Each is cited in the page footer. The source documents are not included in this repository; `npm run verify-sources` downloads them to check the values.

## Licence

Code is released under the [MIT licence](LICENSE).

The SustivioLabs name and logo (`public/logo.png`, `build/icon.*`) are not covered by that licence. If you publish a changed version, replace them with your own.
