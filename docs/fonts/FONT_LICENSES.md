# Font license manifest

Verified 2026-09-03 against the official `google/fonts` repository (`METADATA.pb` license field and the `OFL.txt` shipped with each family). Halyard loads every family through the Google Fonts CSS API; it does not redistribute, modify, subset or self-host font files. The verbatim license text for each family is preserved in `docs/fonts/licenses/<slug>/OFL.txt`. The machine-readable copy is `src/lib/storefront/font-licenses.ts`, and `tests/font-licenses.test.ts` fails if a font is added to the design system without an entry here.

## Usage terms (all families)

| Question | Answer |
|---|---|
| License | SIL Open Font License 1.1 (all 24 families) |
| Commercial use | Permitted by OFL §1 — fonts may be used, studied, modified and redistributed freely, including commercially |
| Website embedding | Permitted; delivered by Google Fonts, not by Halyard |
| Redistribution of font files | Not performed by Halyard |
| Self-hosting | Not performed; if adopted later, OFL permits it provided the license text accompanies the files and Reserved Font Names are respected for modified versions |
| Modification / subsetting | Not performed by Halyard; Google Fonts serves its own subsets |
| Reserved Font Names | Recorded per family below; only relevant if Halyard ever modifies a font |
| Sale of the fonts by themselves | Prohibited by OFL §1 — Halyard never sells fonts; premium themes sell a design configuration, never font files |
| Attribution | Copyright notices preserved below and in each OFL.txt |

## Families

| Key | Family | Copyright | Reserved Font Names | Official source | License file |
|---|---|---|---|---|---|
| `inter` | Inter | Copyright 2016 The Inter Project Authors (https://github.com/rsms/inter) | — | [google/fonts/ofl/inter](https://github.com/google/fonts/tree/main/ofl/inter) | `docs/fonts/licenses/inter/OFL.txt` |
| `geist` | Geist | Copyright 2024 The Geist Project Authors (https://github.com/vercel/geist-font) | — | [google/fonts/ofl/geist](https://github.com/google/fonts/tree/main/ofl/geist) | `docs/fonts/licenses/geist/OFL.txt` |
| `schibsted` | Schibsted Grotesk | Copyright 2023 The Schibsted-Grotesk Project Authors (https://github.com/schibsted/schibsted-grotesk) | — | [google/fonts/ofl/schibstedgrotesk](https://github.com/google/fonts/tree/main/ofl/schibstedgrotesk) | `docs/fonts/licenses/schibstedgrotesk/OFL.txt` |
| `spaceGrotesk` | Space Grotesk | Copyright 2020 The Space Grotesk Project Authors (https://github.com/floriankarsten/space-grotesk) | — | [google/fonts/ofl/spacegrotesk](https://github.com/google/fonts/tree/main/ofl/spacegrotesk) | `docs/fonts/licenses/spacegrotesk/OFL.txt` |
| `archivo` | Archivo | Copyright 2020 The Archivo Project Authors (https://github.com/Omnibus-Type/Archivo) | — | [google/fonts/ofl/archivo](https://github.com/google/fonts/tree/main/ofl/archivo) | `docs/fonts/licenses/archivo/OFL.txt` |
| `anton` | Anton | Copyright 2020 The Anton Project Authors (https://github.com/googlefonts/AntonFont.git) | — | [google/fonts/ofl/anton](https://github.com/google/fonts/tree/main/ofl/anton) | `docs/fonts/licenses/anton/OFL.txt` |
| `bebas` | Bebas Neue | Copyright 2019 The Bebas Neue Project Authors (https://github.com/dharmatype/Bebas-Neue) | — | [google/fonts/ofl/bebasneue](https://github.com/google/fonts/tree/main/ofl/bebasneue) | `docs/fonts/licenses/bebasneue/OFL.txt` |
| `syne` | Syne | Copyright 2019 The Syne Project Authors (https://gitlab.com/bonjour-monde/fonderie/syne-typeface) | — | [google/fonts/ofl/syne](https://github.com/google/fonts/tree/main/ofl/syne) | `docs/fonts/licenses/syne/OFL.txt` |
| `unbounded` | Unbounded | Copyright 2022 The Unbounded Project Authors (https://github.com/googlefonts/unbounded) | — | [google/fonts/ofl/unbounded](https://github.com/google/fonts/tree/main/ofl/unbounded) | `docs/fonts/licenses/unbounded/OFL.txt` |
| `fraunces` | Fraunces | Copyright 2020 The Fraunces Project Authors (github.com/undercasetype/Fraunces) | — | [google/fonts/ofl/fraunces](https://github.com/google/fonts/tree/main/ofl/fraunces) | `docs/fonts/licenses/fraunces/OFL.txt` |
| `playfair` | Playfair Display | Copyright 2017 The Playfair Display Project Authors (https://github.com/clauseggers/Playfair-Display), with Reserved Font Name \ | Playfair Display | [google/fonts/ofl/playfairdisplay](https://github.com/google/fonts/tree/main/ofl/playfairdisplay) | `docs/fonts/licenses/playfairdisplay/OFL.txt` |
| `cormorant` | Cormorant Garamond | Copyright 2015 The Cormorant Project Authors (github.com/CatharsisFonts/Cormorant) | — | [google/fonts/ofl/cormorantgaramond](https://github.com/google/fonts/tree/main/ofl/cormorantgaramond) | `docs/fonts/licenses/cormorantgaramond/OFL.txt` |
| `dmSerif` | DM Serif Display | Copyright 2014 - 2017 Adobe Systems Incorporated (http://www.adobe.com/), with Reserved Font Name \'Source\'. Copyright 2019 Google LLC. | Source | [google/fonts/ofl/dmserifdisplay](https://github.com/google/fonts/tree/main/ofl/dmserifdisplay) | `docs/fonts/licenses/dmserifdisplay/OFL.txt` |
| `lora` | Lora | Copyright 2011 The Lora Project Authors (https://github.com/cyrealtype/Lora-Cyrillic), with Reserved Font Name \ | Lora | [google/fonts/ofl/lora](https://github.com/google/fonts/tree/main/ofl/lora) | `docs/fonts/licenses/lora/OFL.txt` |
| `poppins` | Poppins | Copyright 2020 The Poppins Project Authors (https://github.com/itfoundry/Poppins) | — | [google/fonts/ofl/poppins](https://github.com/google/fonts/tree/main/ofl/poppins) | `docs/fonts/licenses/poppins/OFL.txt` |
| `fredoka` | Fredoka | Copyright 2016 The Fredoka Project Authors (https://github.com/hafontia/Fredoka-One) | — | [google/fonts/ofl/fredoka](https://github.com/google/fonts/tree/main/ofl/fredoka) | `docs/fonts/licenses/fredoka/OFL.txt` |
| `jost` | Jost | Copyright 2020 The Jost Project Authors (https://github.com/indestructible-type/Jost) | — | [google/fonts/ofl/jost](https://github.com/google/fonts/tree/main/ofl/jost) | `docs/fonts/licenses/jost/OFL.txt` |
| `dmSans` | DM Sans | Copyright 2014 The DM Sans Project Authors (https://github.com/googlefonts/dm-fonts) | — | [google/fonts/ofl/dmsans](https://github.com/google/fonts/tree/main/ofl/dmsans) | `docs/fonts/licenses/dmsans/OFL.txt` |
| `nunito` | Nunito Sans | Copyright 2016 The Nunito Sans Project Authors (https://github.com/Fonthausen/NunitoSans) | — | [google/fonts/ofl/nunitosans](https://github.com/google/fonts/tree/main/ofl/nunitosans) | `docs/fonts/licenses/nunitosans/OFL.txt` |
| `plexSans` | IBM Plex Sans | Copyright 2019 IBM Corp. All rights reserved. | Plex | [google/fonts/ofl/ibmplexsans](https://github.com/google/fonts/tree/main/ofl/ibmplexsans) | `docs/fonts/licenses/ibmplexsans/OFL.txt` |
| `libreFranklin` | Libre Franklin | Copyright 2020 The Libre Franklin Project Authors (https://github.com/googlefonts/Libre-Franklin) | — | [google/fonts/ofl/librefranklin](https://github.com/google/fonts/tree/main/ofl/librefranklin) | `docs/fonts/licenses/librefranklin/OFL.txt` |
| `manrope` | Manrope | Copyright 2019 The Manrope Project Authors (https://github.com/sharanda/manrope) | — | [google/fonts/ofl/manrope](https://github.com/google/fonts/tree/main/ofl/manrope) | `docs/fonts/licenses/manrope/OFL.txt` |
| `plexMono` | IBM Plex Mono | Copyright 2017 IBM Corp. All rights reserved. | Plex | [google/fonts/ofl/ibmplexmono](https://github.com/google/fonts/tree/main/ofl/ibmplexmono) | `docs/fonts/licenses/ibmplexmono/OFL.txt` |
| `splineMono` | Spline Sans Mono | Copyright 2022 The Spline Sans Mono Project Authors (https://github.com/SorkinType/SplineSansMono) | — | [google/fonts/ofl/splinesansmono](https://github.com/google/fonts/tree/main/ofl/splinesansmono) | `docs/fonts/licenses/splinesansmono/OFL.txt` |

## Other design assets

| Asset | Source | License | Notes |
|---|---|---|---|
| Interface icons | `lucide-react` (npm) | ISC | Bundled via npm; license in `node_modules/lucide-react/LICENSE` |
| Social network glyphs (Instagram, TikTok, X, YouTube, LinkedIn) | Simple Icons path data, inlined in `src/components/marketing/social-icons.tsx` | CC0 1.0 | Brand marks remain trademarks of their owners; used only to link to the merchant’s own profiles |
| Halyard logo mark, waitlist background, marketing art | Original Halyard work (this repository) | Halyard-owned | — |
| Demo store imagery (`public/demo/**`) | Generated SVG placeholder art in this repository | Halyard-owned | No stock photography, no third-party imagery |
| Theme gallery preview art | Rendered from the theme’s own tokens (CSS), no imagery | Halyard-owned | — |

## Rejected / not included

No font was rejected on licensing grounds: every family Halyard exposes is OFL 1.1 in the official repository. Families were **not added** beyond the verified set; commercial foundry fonts, Adobe Fonts and merchant-uploaded fonts stay out of scope until a licensing decision is made (see the post-beta backlog).

## How to add a font

1. Confirm the family exists under `google/fonts/ofl` (or `apache`/`ufl`) and read its `METADATA.pb` license field and license file.
2. Copy the license file to `docs/fonts/licenses/<slug>/`.
3. Add an entry to `src/lib/storefront/font-licenses.ts` **and** to `FONTS` in `src/lib/storefront/theme.ts`.
4. Run `npx vitest run tests/font-licenses.test.ts`.
