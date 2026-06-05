# OpenBlueprint

**An interactive, open-source service blueprint builder.** By [h1ndman](https://x.com/h1ndman).

OpenBlueprint is a fast, local-first canvas for mapping services: phases and steps across the top, actor/lane groupings down the side, and rich cells you can fill with text, images, video, and links. It runs entirely in your browser — no account, no server, nothing to sign up for.

## Features

- **Phases → steps** across the top, **actor groups → rows** down the side. Add, delete, and rename anything inline.
- **Drag and drop** to reorder phases, steps, rows, and actor groups (rows can even move between groups).
- **Rich cells**: type text, upload an image, upload a video, and add links — all in one cell.
- **Resizable rows** and full **undo / redo** (`⌘Z` / `⌘⇧Z`).
- **Custom color palette**: pick primary and secondary colors, fade them as a gradient across phases and lanes, save your own swatches. All text stays contrast-aware automatically.
- **Local-first saving** (see below) — your data never leaves your device.

## Run it locally

Requires [Node.js](https://nodejs.org/) 18+.

```bash
npm install
npm run dev      # start the dev server (http://localhost:5173)
```

To create a production build:

```bash
npm run build    # outputs static files to dist/
npm run preview  # preview the production build locally
```

Because the build is a fully static site, you can host `dist/` for free on GitHub Pages, Netlify, Vercel, or any static host.

## Saving your work

OpenBlueprint is **local-first** — there is no backend and no login, so your blueprints never leave your browser. Saving works in two complementary ways:

1. **Autosave (automatic).** Your current blueprint is continuously saved to your browser's local storage, so it survives refreshes and closing the tab. The toolbar shows the autosave status. Note this is tied to one browser on one device, and clearing site data will erase it.
2. **Save / Open a file (durable + portable).** Use **Save** in the toolbar to download a `.obp.json` file you fully own. You can back it up, store it in Git or a shared drive, email it, or re-open it on any machine with **Open**. This is also how you **share** a blueprint with someone else.

> Tip: embedded images and videos are stored *inside* the saved file, so a `.obp.json` is fully self-contained. Large media can exceed the browser's autosave quota (you'll see an "Autosave full" warning) — when that happens, just use **Save** to keep a file.

## Contributing

Issues and pull requests are welcome — this is a community tool meant to be forked and built upon. Clone it, run `npm run dev`, and hack away.

## License & naming

- The code in this repository is released under the **MIT License** (see [`LICENSE`](./LICENSE)) — you are free to use, modify, and distribute it, including commercially, with no warranty.
- **Third-party dependencies** (React, Vite, and others) retain their own licenses, which are permissive (MIT/BSD-style). The MIT license here covers only the original code in this project.
- The name **"OpenBlueprint"** is used in good faith for a free community project. The MIT license covers copyright, not trademark.
