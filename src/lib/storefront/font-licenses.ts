/**
 * Font license manifest — one entry per family Halyard exposes in the
 * storefront design system. Every entry was verified against the official
 * google/fonts repository (METADATA.pb `license` field + the OFL.txt shipped
 * with the family) on 2026-09-03; the license text is preserved verbatim under
 * docs/fonts/licenses/<slug>/OFL.txt. Halyard loads these families from the
 * Google Fonts CSS API (fonts.googleapis.com) — it does not redistribute,
 * modify, subset or self-host font files, so no Reserved Font Name is ever
 * used for a modified font. A test asserts that FONTS and this manifest stay
 * in sync, so a font cannot ship without a verified license entry.
 */
export type FontLicenseEntry = {
  key: string;
  family: string;
  /** Directory name under google/fonts/ofl. */
  slug: string;
  license: "SIL Open Font License";
  version: "1.1";
  copyright: string;
  designer: string;
  reservedFontNames: string[];
  officialSource: string;
  licenseFile: string;
};

/** How Halyard uses every family — identical for all entries. */
export const FONT_USAGE = {
  delivery: "Google Fonts CSS API (fonts.googleapis.com / fonts.gstatic.com)",
  commercialUse: true,
  websiteEmbedding: true,
  redistribution: "not performed",
  selfHosted: false,
  modified: false,
  subset: "served by Google Fonts; no Halyard-made subsets",
  requiredNotices: "OFL copyright + license text preserved under docs/fonts/licenses; no notice is required in served CSS because font files are served by Google.",
} as const;

export const FONT_LICENSES: FontLicenseEntry[] = [
  {
    "key": "inter",
    "family": "Inter",
    "slug": "inter",
    "license": "SIL Open Font License",
    "version": "1.1",
    "copyright": "Copyright 2016 The Inter Project Authors (https://github.com/rsms/inter)",
    "designer": "Rasmus Andersson",
    "reservedFontNames": [],
    "officialSource": "https://github.com/google/fonts/tree/main/ofl/inter",
    "licenseFile": "docs/fonts/licenses/inter/OFL.txt"
  },
  {
    "key": "geist",
    "family": "Geist",
    "slug": "geist",
    "license": "SIL Open Font License",
    "version": "1.1",
    "copyright": "Copyright 2024 The Geist Project Authors (https://github.com/vercel/geist-font)",
    "designer": "Andrés Briganti, Mateo Zaragoza, Guillermo Rauch, Evil Rabbit, José Rago, Facundo Santana",
    "reservedFontNames": [],
    "officialSource": "https://github.com/google/fonts/tree/main/ofl/geist",
    "licenseFile": "docs/fonts/licenses/geist/OFL.txt"
  },
  {
    "key": "schibsted",
    "family": "Schibsted Grotesk",
    "slug": "schibstedgrotesk",
    "license": "SIL Open Font License",
    "version": "1.1",
    "copyright": "Copyright 2023 The Schibsted-Grotesk Project Authors (https://github.com/schibsted/schibsted-grotesk)",
    "designer": "Bakken & Bæck, Henrik Kongsvoll",
    "reservedFontNames": [],
    "officialSource": "https://github.com/google/fonts/tree/main/ofl/schibstedgrotesk",
    "licenseFile": "docs/fonts/licenses/schibstedgrotesk/OFL.txt"
  },
  {
    "key": "spaceGrotesk",
    "family": "Space Grotesk",
    "slug": "spacegrotesk",
    "license": "SIL Open Font License",
    "version": "1.1",
    "copyright": "Copyright 2020 The Space Grotesk Project Authors (https://github.com/floriankarsten/space-grotesk)",
    "designer": "Florian Karsten",
    "reservedFontNames": [],
    "officialSource": "https://github.com/google/fonts/tree/main/ofl/spacegrotesk",
    "licenseFile": "docs/fonts/licenses/spacegrotesk/OFL.txt"
  },
  {
    "key": "archivo",
    "family": "Archivo",
    "slug": "archivo",
    "license": "SIL Open Font License",
    "version": "1.1",
    "copyright": "Copyright 2020 The Archivo Project Authors (https://github.com/Omnibus-Type/Archivo)",
    "designer": "Omnibus-Type",
    "reservedFontNames": [],
    "officialSource": "https://github.com/google/fonts/tree/main/ofl/archivo",
    "licenseFile": "docs/fonts/licenses/archivo/OFL.txt"
  },
  {
    "key": "anton",
    "family": "Anton",
    "slug": "anton",
    "license": "SIL Open Font License",
    "version": "1.1",
    "copyright": "Copyright 2020 The Anton Project Authors (https://github.com/googlefonts/AntonFont.git)",
    "designer": "Vernon Adams",
    "reservedFontNames": [],
    "officialSource": "https://github.com/google/fonts/tree/main/ofl/anton",
    "licenseFile": "docs/fonts/licenses/anton/OFL.txt"
  },
  {
    "key": "bebas",
    "family": "Bebas Neue",
    "slug": "bebasneue",
    "license": "SIL Open Font License",
    "version": "1.1",
    "copyright": "Copyright 2019 The Bebas Neue Project Authors (https://github.com/dharmatype/Bebas-Neue)",
    "designer": "Ryoichi Tsunekawa",
    "reservedFontNames": [],
    "officialSource": "https://github.com/google/fonts/tree/main/ofl/bebasneue",
    "licenseFile": "docs/fonts/licenses/bebasneue/OFL.txt"
  },
  {
    "key": "syne",
    "family": "Syne",
    "slug": "syne",
    "license": "SIL Open Font License",
    "version": "1.1",
    "copyright": "Copyright 2019 The Syne Project Authors (https://gitlab.com/bonjour-monde/fonderie/syne-typeface)",
    "designer": "Bonjour Monde, Lucas Descroix, George Triantafyllakos",
    "reservedFontNames": [],
    "officialSource": "https://github.com/google/fonts/tree/main/ofl/syne",
    "licenseFile": "docs/fonts/licenses/syne/OFL.txt"
  },
  {
    "key": "unbounded",
    "family": "Unbounded",
    "slug": "unbounded",
    "license": "SIL Open Font License",
    "version": "1.1",
    "copyright": "Copyright 2022 The Unbounded Project Authors (https://github.com/googlefonts/unbounded)",
    "designer": "NaN",
    "reservedFontNames": [],
    "officialSource": "https://github.com/google/fonts/tree/main/ofl/unbounded",
    "licenseFile": "docs/fonts/licenses/unbounded/OFL.txt"
  },
  {
    "key": "fraunces",
    "family": "Fraunces",
    "slug": "fraunces",
    "license": "SIL Open Font License",
    "version": "1.1",
    "copyright": "Copyright 2020 The Fraunces Project Authors (github.com/undercasetype/Fraunces)",
    "designer": "Undercase Type, Phaedra Charles, Flavia Zimbardi",
    "reservedFontNames": [],
    "officialSource": "https://github.com/google/fonts/tree/main/ofl/fraunces",
    "licenseFile": "docs/fonts/licenses/fraunces/OFL.txt"
  },
  {
    "key": "playfair",
    "family": "Playfair Display",
    "slug": "playfairdisplay",
    "license": "SIL Open Font License",
    "version": "1.1",
    "copyright": "Copyright 2017 The Playfair Display Project Authors (https://github.com/clauseggers/Playfair-Display), with Reserved Font Name \\",
    "designer": "Claus Eggers Sørensen",
    "reservedFontNames": [
      "Playfair Display"
    ],
    "officialSource": "https://github.com/google/fonts/tree/main/ofl/playfairdisplay",
    "licenseFile": "docs/fonts/licenses/playfairdisplay/OFL.txt"
  },
  {
    "key": "cormorant",
    "family": "Cormorant Garamond",
    "slug": "cormorantgaramond",
    "license": "SIL Open Font License",
    "version": "1.1",
    "copyright": "Copyright 2015 The Cormorant Project Authors (github.com/CatharsisFonts/Cormorant)",
    "designer": "Christian Thalmann",
    "reservedFontNames": [],
    "officialSource": "https://github.com/google/fonts/tree/main/ofl/cormorantgaramond",
    "licenseFile": "docs/fonts/licenses/cormorantgaramond/OFL.txt"
  },
  {
    "key": "dmSerif",
    "family": "DM Serif Display",
    "slug": "dmserifdisplay",
    "license": "SIL Open Font License",
    "version": "1.1",
    "copyright": "Copyright 2014 - 2017 Adobe Systems Incorporated (http://www.adobe.com/), with Reserved Font Name \\'Source\\'. Copyright 2019 Google LLC.",
    "designer": "Colophon Foundry",
    "reservedFontNames": [
      "Source"
    ],
    "officialSource": "https://github.com/google/fonts/tree/main/ofl/dmserifdisplay",
    "licenseFile": "docs/fonts/licenses/dmserifdisplay/OFL.txt"
  },
  {
    "key": "lora",
    "family": "Lora",
    "slug": "lora",
    "license": "SIL Open Font License",
    "version": "1.1",
    "copyright": "Copyright 2011 The Lora Project Authors (https://github.com/cyrealtype/Lora-Cyrillic), with Reserved Font Name \\",
    "designer": "Cyreal",
    "reservedFontNames": [
      "Lora"
    ],
    "officialSource": "https://github.com/google/fonts/tree/main/ofl/lora",
    "licenseFile": "docs/fonts/licenses/lora/OFL.txt"
  },
  {
    "key": "poppins",
    "family": "Poppins",
    "slug": "poppins",
    "license": "SIL Open Font License",
    "version": "1.1",
    "copyright": "Copyright 2020 The Poppins Project Authors (https://github.com/itfoundry/Poppins)",
    "designer": "Indian Type Foundry, Jonny Pinhorn, Ninad Kale",
    "reservedFontNames": [],
    "officialSource": "https://github.com/google/fonts/tree/main/ofl/poppins",
    "licenseFile": "docs/fonts/licenses/poppins/OFL.txt"
  },
  {
    "key": "fredoka",
    "family": "Fredoka",
    "slug": "fredoka",
    "license": "SIL Open Font License",
    "version": "1.1",
    "copyright": "Copyright 2016 The Fredoka Project Authors (https://github.com/hafontia/Fredoka-One)",
    "designer": "Milena Brandão, Hafontia",
    "reservedFontNames": [],
    "officialSource": "https://github.com/google/fonts/tree/main/ofl/fredoka",
    "licenseFile": "docs/fonts/licenses/fredoka/OFL.txt"
  },
  {
    "key": "jost",
    "family": "Jost",
    "slug": "jost",
    "license": "SIL Open Font License",
    "version": "1.1",
    "copyright": "Copyright 2020 The Jost Project Authors (https://github.com/indestructible-type/Jost)",
    "designer": "Owen Earl",
    "reservedFontNames": [],
    "officialSource": "https://github.com/google/fonts/tree/main/ofl/jost",
    "licenseFile": "docs/fonts/licenses/jost/OFL.txt"
  },
  {
    "key": "dmSans",
    "family": "DM Sans",
    "slug": "dmsans",
    "license": "SIL Open Font License",
    "version": "1.1",
    "copyright": "Copyright 2014 The DM Sans Project Authors (https://github.com/googlefonts/dm-fonts)",
    "designer": "Colophon Foundry",
    "reservedFontNames": [],
    "officialSource": "https://github.com/google/fonts/tree/main/ofl/dmsans",
    "licenseFile": "docs/fonts/licenses/dmsans/OFL.txt"
  },
  {
    "key": "nunito",
    "family": "Nunito Sans",
    "slug": "nunitosans",
    "license": "SIL Open Font License",
    "version": "1.1",
    "copyright": "Copyright 2016 The Nunito Sans Project Authors (https://github.com/Fonthausen/NunitoSans)",
    "designer": "Vernon Adams, Jacques Le Bailly, Manvel Shmavonyan, Alexei Vanyashin",
    "reservedFontNames": [],
    "officialSource": "https://github.com/google/fonts/tree/main/ofl/nunitosans",
    "licenseFile": "docs/fonts/licenses/nunitosans/OFL.txt"
  },
  {
    "key": "plexSans",
    "family": "IBM Plex Sans",
    "slug": "ibmplexsans",
    "license": "SIL Open Font License",
    "version": "1.1",
    "copyright": "Copyright 2019 IBM Corp. All rights reserved.",
    "designer": "Mike Abbink, Bold Monday",
    "reservedFontNames": [
      "Plex"
    ],
    "officialSource": "https://github.com/google/fonts/tree/main/ofl/ibmplexsans",
    "licenseFile": "docs/fonts/licenses/ibmplexsans/OFL.txt"
  },
  {
    "key": "libreFranklin",
    "family": "Libre Franklin",
    "slug": "librefranklin",
    "license": "SIL Open Font License",
    "version": "1.1",
    "copyright": "Copyright 2020 The Libre Franklin Project Authors (https://github.com/googlefonts/Libre-Franklin)",
    "designer": "Impallari Type",
    "reservedFontNames": [],
    "officialSource": "https://github.com/google/fonts/tree/main/ofl/librefranklin",
    "licenseFile": "docs/fonts/licenses/librefranklin/OFL.txt"
  },
  {
    "key": "manrope",
    "family": "Manrope",
    "slug": "manrope",
    "license": "SIL Open Font License",
    "version": "1.1",
    "copyright": "Copyright 2019 The Manrope Project Authors (https://github.com/sharanda/manrope)",
    "designer": "Mikhail Sharanda",
    "reservedFontNames": [],
    "officialSource": "https://github.com/google/fonts/tree/main/ofl/manrope",
    "licenseFile": "docs/fonts/licenses/manrope/OFL.txt"
  },
  {
    "key": "plexMono",
    "family": "IBM Plex Mono",
    "slug": "ibmplexmono",
    "license": "SIL Open Font License",
    "version": "1.1",
    "copyright": "Copyright 2017 IBM Corp. All rights reserved.",
    "designer": "Mike Abbink, Bold Monday",
    "reservedFontNames": [
      "Plex"
    ],
    "officialSource": "https://github.com/google/fonts/tree/main/ofl/ibmplexmono",
    "licenseFile": "docs/fonts/licenses/ibmplexmono/OFL.txt"
  },
  {
    "key": "splineMono",
    "family": "Spline Sans Mono",
    "slug": "splinesansmono",
    "license": "SIL Open Font License",
    "version": "1.1",
    "copyright": "Copyright 2022 The Spline Sans Mono Project Authors (https://github.com/SorkinType/SplineSansMono)",
    "designer": "Eben Sorkin, Mirko Velimirović",
    "reservedFontNames": [],
    "officialSource": "https://github.com/google/fonts/tree/main/ofl/splinesansmono",
    "licenseFile": "docs/fonts/licenses/splinesansmono/OFL.txt"
  }
];
