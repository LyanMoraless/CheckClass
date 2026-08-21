# Brand & Visual Style Guide for HTML Documentation

> This file defines the visual style the Documentation Agent applies when
> generating HTML documentation. It is generic and reusable across
> projects. Whether the LGI Morales brand identity specifically applies to
> the current project is **not** decided here — see the "Branding
> applicability" section below.

## Format

Documentation is generated as a single **HTML file** (not PDF). Reasons:
plain text, diffable in version control, editable incrementally, opens
directly in any browser. Include an embedded `@media print` stylesheet so
the person can print/save-as-PDF from the browser when a PDF copy is
needed — do not maintain a separate PDF generation path.

## Structure (applies to every document, branded or not)

Every document must open with a short **Overview** before any technical
depth:

1. **Overview** — a few sentences: what this screen/module/system is, who
   it's for, what problem it solves. No jargon. If a diagram or a short
   example makes this clearer than prose, use it.
2. **Details** — the technical depth goes here, organized in clear
   sections. Prefer concrete examples (a real request/response, a real
   usage snippet, a real screenshot description) over abstract
   explanation.

Writing rules:
- Prefer short, plain sentences over long, dense ones.
- Prefer one good example over a paragraph of explanation.
- Cut redundancy and filler — but never cut information that's actually
  needed to understand or use what's documented. When in doubt between
  "too long" and "missing something essential", keep the essential
  information and cut everything else around it.
- Avoid unnecessarily technical/formal vocabulary when a simpler word says
  the same thing.

## Typography (when branding is applied)

Load via Google Fonts:
- **Montserrat** — body text, general UI text.
- **Archivo Black** — main headings / emphasis.
- **Bebas Neue** — section titles / display use where a bold, condensed
  look fits.

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Bebas+Neue&family=Montserrat:wght@400;600;700&display=swap" rel="stylesheet">
```

## Color

Documentation does **not** use a fixed brand color. It uses the color
already defined for the **current project** in `project-knowledge`. If no
project color is documented, use a neutral, professional default (dark
gray text on white/light background) and flag the absence — don't invent
a brand color.

## Logo

The logo file, when available, lives at:

```
skills/documentation/references/assets/logo.svg
```

(or `logo.png` if SVG isn't available). Before generating branded
documentation, check whether this file exists.

- **If it exists** → reference it in the HTML (`<img>` or inlined SVG).
- **If it doesn't exist yet** → do not fabricate a logo. Use a plain text
  fallback (the company name, styled with the heading font) and flag that
  the logo asset is missing, so it can be added later without needing to
  regenerate the whole document from scratch.

## Branding applicability (read this before using anything above)

Applying the LGI Morales brand identity (fonts, logo, brand treatment) is
a **per-project decision**, not a global default. Some projects must not
carry the company's branding.

Before generating any documentation, the Documentation Agent must check
`skills/project-knowledge/references/branding.md` for the current project:

- If it says branding **applies** → use this style guide in full.
- If it says branding **does not apply** → produce clean, unbranded HTML
  documentation (still following the Overview + Details structure and the
  writing rules above, but with a neutral typeface stack and no logo).
- If the file doesn't exist or the field isn't filled in → **treat as
  unconfirmed**. Do not apply branding by default. Flag this to the
  Orchestrator/user so it can be confirmed once, and record the answer in
  `project-knowledge/references/branding.md` for that project going
  forward.
