# Environment Switcher — Chrome extension

Two ways to open a page on DEV / UAT / PRD:

1. **After Preview or Publish in DA** (da.live): the tab DA opens shows a chooser.
2. **From the original (customer) site, or from any EDS page:** click the toolbar icon. The popup opens the
   matching EDS page on the chosen environment, as Preview (`.aem.page`) or Live (`.aem.live`).

| Choice | Preview | Live |
|---|---|---|
| 1 · DEV (`develop`) | `https://develop--{repo}--{org}.aem.page/{path}` | `https://develop--{repo}--{org}.aem.live/{path}` |
| 2 · UAT (`uat`) | `https://uat--{repo}--{org}.aem.page/{path}` | `https://uat--{repo}--{org}.aem.live/{path}` |
| 3 · PRD (`main`) | `https://main--{repo}--{org}.aem.page/{path}` | `https://main--{repo}--{org}.aem.live/{path}` |

Generic: it works for **any** DA / EDS site. Self-contained: this folder can be moved to its own repo as is. It
is not website code, and `.hlxignore` keeps it off the site.

## How it works

1. The author uses DA's **own** Preview / Publish buttons. DA does the preview / publish with its own login, so the
   extension has no credentials and makes no API calls.
2. DA then opens `main--{repo}--{org}.aem.page|live/{path}` in a new tab.
3. `background.js` sees that tab's navigation (`webRequest`, observe only). It acts only when the navigation was
   **started by `https://da.live`** and goes to a `main--…aem.page|live` URL. It then sends the tab to
   `chooser.html`.
4. The chooser lists the environments (click, or press 1/2/3). It replaces the tab with the same URL on the chosen
   branch. Only the host's `main--` prefix changes; the path, query and `.page` / `.live` stay.

Links to `main--…` opened from anywhere else (the address bar, other sites, the chooser itself) are left alone.

**Content is shared across branches.** In Edge Delivery every branch serves the same content; only the code
differs. So DA's preview / publish on `main` already updates the page for every branch, and **a publish is live
everywhere, production included**, whichever environment the author then opens.

## From the original site (toolbar popup)

1. Click the extension's toolbar icon on a page of the customer's site (pin it from the puzzle-piece menu).
2. Pick **Preview (.page)** or **Live (.live)**. The choice is remembered.
3. Click DEV / UAT / PRD, or press 1 / 2 / 3. The EDS page opens in a new tab, next to the current one.

On an EDS page (`{branch}--{repo}--{org}.aem.page|live`) the popup switches environments: same path, and it
starts on that page's `.page` / `.live`. The environment you are on is marked **Current** and can't be chosen
(button and number key). It is only disabled for the same `.page` / `.live`: on UAT Preview, switching to Live
makes UAT available again, because UAT Live is a different page.

**Path mapping** is the importer's rule (`WebImporter.FileUtils.sanitizePath`, as in `tools/importer/import-*.js`),
so the URL is the page the import created:
- drop the query, the hash, a trailing `/` and `.html`;
- lower case, accents removed, anything other than `a-z 0-9` becomes `-` (`Who_We_Are` → `who-we-are`);
- the home page `/` (= `/index`) → `/`.

| Original | EDS path |
|---|---|
| `https://www.ustafoundation.com/en/home.html` | `/en/home` |
| `https://www.ustafoundation.com/en/home/our-impact.html` | `/en/home/our-impact` |
| `https://www.ustafoundation.com/en/home/who-we-are/financials.html?x=1` | `/en/home/who-we-are/financials` |

If a page was imported to a different path (redirects, a custom path in an import script), the popup can't know:
it opens the path the default rule gives.

### Sites

The popup needs to know which EDS site an original site was moved to. Set it in the extension's **Settings**,
**Sites** box, one per line:

```
www.ustafoundation.com = usta-com--usta-digital
www.example.com/content/brand = site-b--acme
```

- Left: the original host (with or without `www.`; a port is allowed). An optional path prefix is removed from the
  URL (for AEM-style `/content/brand/…` sources). The longest matching prefix wins.
- Right: `repo--org` of the EDS site, as in `{branch}--{repo}--{org}.aem.page`.

## Environments

The defaults are `DEV = develop`, `UAT = uat`, `PRD = main`. To change them, open **Settings** (the link in the
toolbar popup, or the extension's **Options**): one per line, `NAME = branch`, lower-case branches (`a-z`, `0-9`, `-`). They are
saved in `chrome.storage.sync`, so they follow the author's Chrome profile. Every branch must exist in GitHub,
with AEM Code Sync on the repo.

## Install

- **Try it / small team:** `chrome://extensions` → turn on **Developer mode** → **Load unpacked** → pick this
  folder.


## Permissions (why each one is needed)

| Permission | Why |
|---|---|
| `webRequest` + hosts `*.aem.page`, `*.aem.live`, `da.live` | see that DA opened a `main--…` tab (observe only, nothing is blocked or read) |
| `storage` | save the environments, the sites and the Preview / Live choice |
| `activeTab` | read the current tab's URL, only when the toolbar icon is clicked |

## Files

| File | What it does |
|---|---|
| `manifest.json` | Manifest V3, Chrome 116+ |
| `background.js` | service worker: sends DA's `main--…` tabs to the chooser |
| `chooser.html` / `chooser.js` | the DEV / UAT / PRD choice |
| `popup.html` / `popup.js` | the toolbar popup: original or EDS page → DEV / UAT / PRD |
| `options.html` / `options.js` | Settings: environments and sites |
| `envs.js` | shared: defaults, parsing, the importer's path rule, URL building |
| `styles.css` | Spectrum-like look for all pages |
| `icons/` | `icon.svg` (32 / 48 / 128) and `icon-16.svg` (pixel-grid 16px version) are the sources of the PNGs Chrome uses. Icon: DEV → UAT → PRD, one page across three environments |

## Limits

- It depends on DA opening the page in a new tab on `main--{repo}--{org}.aem.page|live`, which is DA's behaviour
  today. If DA changes the host it opens, update `DA_TARGET` / `DA_ORIGINS` in `envs.js`.
- Chrome and Chromium browsers (Edge, Brave) only.
- Sites on a custom preview or production domain still get `{branch}--{repo}--{org}.aem.page|live` URLs.

## Test

`chrome://extensions` → Load unpacked (after an update, click the reload icon on the extension's card).
- DA: open a page in DA, click Preview: the chooser appears. Pick DEV and check the tab is on
  `develop--…aem.page`. Repeat with Publish (`.aem.live`) and with key 2 / 3.
- Original site: add the site under Settings → Sites. Open a migrated page on the original site, click the toolbar
  icon, pick UAT: the matching `uat--…aem.page` page opens in a new tab.
