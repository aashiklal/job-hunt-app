export type StyleHints = {
  bodyFont: string;
  bodyFontSizePt: number;
  h1Font: string;
  h1SizePt: number;
  h1Color: string; // hex without #, e.g. "2E74B5" or "000000"
  h2Font: string;
  h2SizePt: number;
  h2Color: string;
  h3Font: string;
  h3SizePt: number;
  h3Color: string;
  marginTopPt: number;
  marginBottomPt: number;
  marginLeftPt: number;
  marginRightPt: number;
};

export const DEFAULT_STYLE_HINTS: StyleHints = {
  bodyFont: "Helvetica",
  bodyFontSizePt: 10.5,
  h1Font: "Helvetica",
  h1SizePt: 20,
  h1Color: "000000",
  h2Font: "Helvetica",
  h2SizePt: 12,
  h2Color: "000000",
  h3Font: "Helvetica",
  h3SizePt: 11,
  h3Color: "000000",
  marginTopPt: 72,
  marginBottomPt: 72,
  marginLeftPt: 72,
  marginRightPt: 72,
};
