# Icon sources

All interface icons are selected from [Icones](https://icones.js.org/), which browses Iconify collections. Ume’s own brand mark is a separate brand asset.

Icons are checked-in SVG React components in `src/components/ui/icons.tsx`. They render on the server without an icon API request, client-side icon loader, or additional runtime dependency. Each component links to its Icones entry. Only icons used by Ume are included.

Source packages downloaded from the npm registry on September 16, 2026:

- `@iconify-json/lucide@1.2.132`
- `@iconify-json/logos@1.2.14`
- `@iconify-json/simple-icons@1.2.96`

- Lucide: ISC license, including MIT-licensed Feather derivatives. Full notice in `lucide-LICENSE.txt`.
- Simple Icons (Discord mark): CC0 1.0, https://github.com/simple-icons/simple-icons/blob/develop/LICENSE.md
- SVG Logos (Google mark): CC0 1.0, https://github.com/gilbarbara/logos/blob/master/LICENSE.txt

Brand names and logos remain trademarks of their respective owners.

Filled headphones: [Phosphor / headphones-fill on Icones](https://icones.js.org/collection/ph?icon=ph:headphones-fill), fetched from the Iconify API on September 16, 2026. MIT license retained in `phosphor-LICENSE.txt`.
