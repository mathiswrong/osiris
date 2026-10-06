---
name: KNUCKLETAT
description: A plain news-wire intelligence workspace with attributed evidence and explicit attention signals.
colors:
  desk-bg: "#ffffff"
  desk-panel: "#ffffff"
  desk-edge: "#cccccc"
  desk-text: "#171717"
  desk-muted: "#595959"
  desk-soft: "#f6f6f6"
  desk-hover: "#f1f1f1"
  desk-active: "#fceced"
  desk-accent: "#a81824"
  desk-green: "#08786c"
  desk-amber: "#a85c11"
  night-bg: "#101010"
  night-panel: "#181818"
  night-edge: "#494949"
  night-text: "#f4f4f4"
  night-muted: "#bbbbbb"
  night-soft: "#202020"
  night-hover: "#292929"
  night-active: "#392024"
  night-accent: "#ff9399"
  night-green: "#6dd6bb"
  night-amber: "#f4be75"
  watch-emerging: "#a81824"
  watch-early: "#685647"
  watch-multiple: "#8e481b"
  watch-verified: "#08786c"
  watch-long-term: "#555555"
  activity-low: "#795421"
  activity-active: "#a34318"
  activity-high: "#a81824"
  night-activity-low: "#dbc09a"
  night-activity-active: "#f7ad81"
  night-activity-high: "#ff9399"
typography:
  display:
    fontWeight: 700
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "clamp(28px, 3vw, 42px)"
    lineHeight: 1
    letterSpacing: "-.025em"
  headline:
    fontWeight: 700
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "22px"
    letterSpacing: "-.02em"
  title:
    fontWeight: 700
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "20px"
    lineHeight: 1.35
    letterSpacing: "normal"
  body:
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "14px"
    lineHeight: 1.5
  label:
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "11px"
  metadata:
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "11px"
  watch-tag:
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "10px"
    fontWeight: 700
  data:
    fontFamily: '"Courier New", Courier, monospace'
rounded:
  square: "0"
  tag: "0"
  control: "0"
  supporting-panel: "6px"
  legacy-panel: "7px"
  pill: "999px"
spacing:
  compact: "6px"
  control-gap: "8px"
  panel-gap: "12px"
  desk-gap: "14px"
  content: "16px"
  evidence: "18px"
components:
  button:
    backgroundColor: "{colors.desk-soft}"
    textColor: "{colors.desk-text}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "6px 9px"
  button-selected:
    backgroundColor: "{colors.desk-active}"
    textColor: "{colors.desk-accent}"
    rounded: "{rounded.control}"
    padding: "6px 9px"
  workspace-navigation:
    backgroundColor: "{colors.desk-text}"
    textColor: "{colors.desk-panel}"
    rounded: "{rounded.control}"
    padding: "8px 13px"
  desk-search:
    backgroundColor: "{colors.desk-panel}"
    textColor: "{colors.desk-text}"
    rounded: "{rounded.square}"
    padding: "7px 9px"
    width: "230px"
  watch-filter:
    backgroundColor: "{colors.desk-panel}"
    textColor: "{colors.desk-text}"
    rounded: "{rounded.control}"
    padding: "7px 10px"
  watch-tag:
    typography: "{typography.watch-tag}"
    rounded: "{rounded.tag}"
    padding: "2px 5px"
  evidence-card:
    backgroundColor: "{colors.desk-panel}"
    textColor: "{colors.desk-text}"
    rounded: "{rounded.square}"
    padding: "18px 0"
  source-stream-row:
    textColor: "{colors.desk-text}"
    padding: "14px 16px"
  locale-callout:
    backgroundColor: "{colors.desk-panel}"
    textColor: "{colors.desk-text}"
    rounded: "{rounded.square}"
    padding: "10px 12px"
    height: "128px"
    width: "216px"
  region-pill:
    backgroundColor: "{colors.desk-panel}"
    textColor: "{colors.desk-text}"
    rounded: "{rounded.pill}"
    padding: "5px 11px"
---

# Design System: KNUCKLETAT

## Overview

**Creative North Star: "The Regional News Wire"**

KNUCKLETAT uses plain white daylight surfaces and charcoal night surfaces to make dense intelligence readable. Inter reading text, native Courier data, strong underlined report links, simple rules, and the existing illustrated logo establish the user's approved news-wire direction, inspired by Drudge Report. Compact controls support investigation without competing with the evidence.

The system is mostly flat: hairline dividers and subtle surface changes establish structure. Amber, burnt orange, and red show reporting attention; separate labeled status tags show the kind of watch. Source and time context remain close to each headline.

**Key Characteristics:**

- White day and charcoal night themes.
- Inter for reading and controls; native Courier for data.
- Square controls and evidence separated by rules.
- Bold underlined report links.
- Labeled attention and watch-status colors.
- Existing KNUCKLETAT illustrated logo.

This scan describes the current intelligence workspace, drawn from the shared desk, globe, and regional styles and their components. Older gold/violet globe styling elsewhere in the project is outside this system.

## Colors

The palette uses neutral surfaces and a warm attention spectrum. The frontmatter contains the exact shipped values; night tokens replace the corresponding desk tokens under `data-theme="night"`.

### Primary

- **News-Wire Red:** links, selected controls, keyboard focus, high reporting volume, emerging status, measured alerts, and reporting surges. The label identifies which meaning applies.
- **Night Red:** the brighter interaction and high-attention counterpart on charcoal surfaces.

### Secondary

- **Low-Volume Amber / Night Low-Volume Amber:** ordinary watches with 1–3 reports in the displayed watch's 24h window.
- **Active Burnt Orange / Night Active Burnt Orange:** ordinary watches with 4–9 reports in that window.
- **Early Brown:** early reports and single-source leads.
- **Multi-Source Burnt Orange:** multi-source watch tags and filters; distinct from the active-volume color.
- **Observation Teal:** measured/verified provider observations; night green supports operational accents.
- **Long-Term Grey:** long-running watch tags and filters.
- **Warning Amber:** retrieval issues and unverified source labels, with a brighter night counterpart.

### Neutral

- **White / Charcoal Canvas:** page backgrounds.
- **White / Raised Charcoal Panel:** evidence and investigation containers.
- **Soft Surface:** controls, map fallback areas, and notes.
- **Edge:** one-pixel divisions between regions of content.
- **Ink / Night Text:** primary titles and reading text.
- **Muted:** source metadata, explanations, and timestamps.
- **Hover / Active:** neutral hover feedback and the pale red selection surface.

**The Attention Label Rule.** Ordinary reporting watches use low attention at 1–3 reports, active attention at 4–9, and high attention at 10+ in the displayed watch's 24h window. Measured alerts and established reporting surges take precedence and use red with their own explicit labels. Reporting volume does not establish severity or verification.

**The Status Continuity Rule.** Emerging, early reports, multi-source, verified observations, and long term retain their labeled status colors across filters and tags. Geographic watch markers use the separate attention scale; they do not redefine the status tags.

## Typography

**Display, Body, and Label Font:** Inter, followed by the native system sans-serif fallbacks in the frontmatter.

**Data Font:** native Courier New, followed by Courier and monospace.

Inter carries headlines, evidence prose, source descriptions, controls, and readable status text. Courier distinguishes timestamps, UTC clocks, numeric counts, regional metrics, orbital telemetry, and count-bearing activity rows. Data uses tabular numerals. Weight, size, and underlines retain the reading hierarchy. This split follows the user's explicit readability correction.

### Hierarchy

- **Display:** bold responsive regional names with a tight single line height. The existing regional heading retains its slight negative tracking.
- **Headline:** bold globe workspace title, reducing to 19px on small screens; its existing slight negative tracking remains.
- **Title:** bold evidence headlines at 20px, constrained to 75ch. Source-stream titles use 14px with 1.4 line height and a 100ch maximum.
- **Body:** the shared 14px desk base. Supporting descriptions commonly use 13px; explanatory paragraphs use line heights from 1.5 to 1.6.
- **Label:** compact 11px interface labels in Inter.
- **Metadata:** compact 11px source descriptions; globe callouts reduce secondary context to 10px.
- **Watch Tag:** bold 10px status text beside explicit status wording.
- **Data:** Courier applied at each component's existing size, including 11px stream timestamps, filter counts, 10px locale report-count rows, regional summary values, orbital object counts and telemetry, and numeric source-health cells.

**The Data Type Rule.** Use Inter for reading text, headlines, controls, and watch-status labels. Reserve Courier with tabular numerals for data, including timestamps, counts, metrics, telemetry, and count-bearing activity rows. In source-health tables, provider descriptions and state labels use Inter; record counts, last-success timestamps, and refresh intervals use Courier.

**The Evidence First Rule.** Report links are bold and underlined, with source and time context immediately available. Globe callout headlines use a 2px underline offset; regional stream and original evidence links use 3px. High-volume, measured-alert, and surge callout headlines also adopt their attention color.

## Layout

The desk uses the available width rather than a narrow central column. The shared shell has 20px horizontal padding; the regional shell uses `clamp(12px, 2vw, 28px)` and 64px bottom padding. Most panel groups use a 12px gap; the regional context row uses 14px.

The regional context grid divides map and broadcasts at a 1.6:1 ratio, with a 300px minimum for broadcasts. The source stream spans both columns. Evidence and supporting investigations use a flexible main column plus a 250–320px sidebar, separated by 24px. At 900px these grids become one column.

At 600px the home shell uses 10px gutters, search and desk selection share a compact control row, and watch filters scroll horizontally. Source-stream timestamps move above the headline. The regional map drops from 390px to 300px high. The home map and globe use a responsive viewport-height clamp: 520–950px on larger screens and 350–560px on small screens. The orbital view shares this stage on larger screens; its small-screen layout is described under Geographic Exploration.

## Elevation & Depth

Primary regional containers and locale callouts use borders and tonal layering without shadows. The globe supplies geographic depth; the interface remains visually quiet above it. The existing orbital surface retains its dark astronomical canvas inside the paired day/night desk chrome. Supporting workspaces retain some rounded legacy panels. Detached evidence previews elsewhere in the desk use soft ambient shadows, recorded in the sidecar rather than applied to ordinary evidence rows.

Theme colors inherit the existing 0.6s transition with `cubic-bezier(0.16, 1, 0.3, 1)`. Regional map fitting and reset movements use 500ms and become immediate when reduced motion is requested. Selecting an evidence location similarly respects reduced motion when scrolling to its record.

## Shapes

Main investigation containers, maps, broadcasts, globe callouts, general controls, and watch tags have square corners. Regional evidence uses top rules rather than enclosed card borders. Existing region navigation links remain pills; supporting satellite/source panels retain their supporting-panel radius. The regional map scope switch also uses square corners. Existing supporting panels and region links do not change the square shape of the main controls.

Geographic anchors use circles. On the home map and globe, a solid attention dot connects to a headline card through a thin leader line. Dot sizes are 12px for low attention, 15px for active reporting, and 18px for high volume, measured alerts, or surges. Regional maps distinguish hollow context rings from filled provider-location points.

## Components

### Buttons
Compact square bordered controls use the soft surface and ink text. Hover changes the surface; selection changes the background, text, and border to the active/accent roles. Disabled controls reduce opacity to 0.55. Keyboard focus uses a two-pixel accent outline with two-pixel offset.

### Navigation
Workspace controls use 13px text with `8px 13px` padding; active navigation inverts ink and panel colors. Main route links and general navigation buttons have square corners. Small-screen home navigation compresses to 10px labels with 7px padding. Existing region pills remain horizontally scrollable and use accent borders plus the active surface on hover or selection.

### Inputs / Fields
Regional search is a square bordered field with `7px 9px` padding. Globe search is transparent and underlined, shifting its line to the accent on focus. Notes use the soft surface, inherited Inter type, and an accent caret. Placeholders use muted text.

### Chips
Watch filters combine a status dot, readable label, and count. Selected filters use a status-colored border and a 10% status tint mixed with the panel. Square bold tags use a 6% tint and the status color; night tags mix their text color toward white for legibility. Attention labels appear separately from status tags and include the watch's report count.

### Cards / Containers
Regional evidence records are flat panels separated by a top rule, with `18px 0` padding and 14px padding on small screens. Selecting a record changes its top rule to the accent and its fill to the hover surface. Original source links are bold and underlined; publication details remain immediately available. Review and notes use a collapsed disclosure.

### Source Stream
Rows use a 90px Courier timestamp column beside the bold underlined Inter headline, source type, and attribution. Thin dividers and a tonal hover state separate rows. Source filters reuse the shared selected-control state. Mobile rows stack their time above the record.

### Geographic Exploration
The home surface starts as a flat world map. Zooming out switches to the globe, then the existing satellite view; zooming in reverses the sequence. Each Earth projection fits the shared stage when entered. The map's zoom controls, wheel, and touch gestures drive this sequence, and its World map control resets the overview. The orbital view retains the geographic viewing direction and offers zoom controls plus an explicit Back to globe action.

Map and globe views share the same locale callouts, search, watch filters, attention labels, and regional destinations. Earth callouts are hidden during the satellite view and return with the geography. The orbital surface displays catalogue objects, hover identification, and dossier selection through the existing satellite workspace. Its labeled altitude display distinguishes the default spread scale from true distance; illustrative Earth lighting and sample trails remain explicitly identified.

On screens up to 600px wide, the embedded orbital stage is 720px high. Object count and scale metadata appear above the flexible canvas; wrapping actions and the interaction hint occupy separate rows below it. Filters, the category legend, and the scale note remain within the stage. Larger screens retain the heading and action overlays.

### Locale Callouts
Attention dots anchor compact headline cards with leader lines on both flat map and globe views. Cards show the locale, bold underlined headline, watch-status tags, and an explicit attention label with the displayed watch's report count. High volume, measured alerts, and reporting surges also color the headline. Pointer hover and keyboard focus expose a card and raise its stacking order; the border adopts the attention color. Globe markers behind the Earth stay hidden. The accessible locale index provides the same route destination below the map and remains available in the orbital view.

## Do's and Don'ts

### Do:

- **Do** preserve the existing KNUCKLETAT illustrated logo and its night-mode inversion.
- **Do** use the paired neutral day/night roles, Inter reading text, and native Courier data for new intelligence surfaces.
- **Do** pair attention colors with their volume, measured-alert, or reporting-surge labels.
- **Do** repeat watch-status colors with readable labels in filters and evidence tags.
- **Do** keep source attribution and original evidence links close to each headline.
- **Do** distinguish hollow regional-context rings from filled provider-location points.
- **Do** retain visible keyboard focus and respect reduced motion for map and evidence navigation.

### Don't:

- **Don't** use reporting volume or repeated publisher reporting to imply severity or verification.
- **Don't** present a country or waterway anchor as a precise incident site.
- **Don't** replace the established illustrated logo with a new typographic mark.
- **Don't** import the older gold/violet palette into the neutral news-wire desk.
