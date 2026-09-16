# Ume design review

Updated September 16, 2026.

## Direction

The founder requested a redesign using [Halsa](https://halsa-template.webflow.io/) as inspiration and [make-it-look-good](https://github.com/jdeworks/make-it-look-good) as a review toolkit. The product decisions in PLAN_REVIEW.md remain the source of truth.

The previous interface used a near-black background, bright pink glows, a floating mascot, dense feature copy, and repeated bordered cards. Too many elements competed for attention, and the product itself was hard to see.

The new direction is a quiet, welcoming listening room: white, navy, blue and lilac, one sans-serif family, generous spacing, and restrained borders. Halsa informed the centered introduction, generous proportions, static navigation, and prominent product preview. The founder then requested a distinct color palette, removal of decorative labels, and direct copy. No Halsa assets or template code were copied. The existing Ume mark is retained.

## Implementation

- Rebuilt the homepage around a small interactive music-library illustration. Its two sample playlists can be selected with pointer or keyboard; the content is explicitly labeled as a preview and does not pretend to stream audio or show real usage.
- Reduced feature copy and grouped it into presence, shared music, and permissions. Kept the rights requirement for adding audio.
- Simplified setup and command explanations. Shared plan constants continue to supply prices, quotas, and benefits.
- Extended the palette and typography through pricing, commands, legal pages, sign-in, shared controls, app navigation, and console charts. The authenticated app inherits the shared system; its data-dependent screens need live authenticated verification.
- Made primary buttons and mobile navigation controls at least 44 px tall, provided focus indicators and a skip link, and respected reduced-motion preferences.
- Corrected the pricing FAQ to explain that both uploads and audio extraction pause above quota.

All interface icons are selected from [Icones](https://icones.js.org/). The 82 used icons are bundled locally from its Lucide, Simple Icons, and Logos collections, with source links and licenses in `apps/web/public/icons/NOTICE.md`. The previous runtime icon dependency and duplicated hand-drawn provider marks were removed. Ume’s brand mark remains its own artwork.

## Tokens

| Purpose                     | Value                                      |
| --------------------------- | ------------------------------------------ |
| Page                        | `#ffffff`                                  |
| Foreground / primary button | `#253149`                                  |
| Body secondary text         | `#535e73`                                  |
| Small secondary text        | `#59647a`                                  |
| Surface                     | `#ffffff`                                  |
| Secondary surface           | `#eef0f6`                                  |
| Lilac surface               | `#ece6f6`                                  |
| Blue surface                | `#e4ebf9`                                  |
| Blue foreground             | `#435b90`                                  |
| Violet emphasis             | `#5f4c94`                                  |
| Typeface                    | Instrument Sans, locally served by Next.js |

The site deliberately uses a light theme to follow the selected reference. It does not advertise a theme switch. Body copy uses 16–18 px; compact preview metadata, labels, and application controls use smaller type with checked contrast. Space follows the existing Tailwind scale.

## Validation

The production build and all seven workspace type checks pass. Eight public/auth pages were checked at 320, 768, and 1440 px: no horizontal overflow, broken images, or missing primary headings. Chrome checks confirm playlist switching, mobile menu open/Escape close, and FAQ pointer/keyboard operation. Reduced-motion mode removes equalizer animation, accordion transitions, and smooth scrolling. Browser and analyzer reports are in `artifacts/design/`.

The existing lint command fails before linting source: eslint-plugin-react 7.37.5 calls `getFilename`, removed by ESLint 10.10.0. This dependency compatibility issue remains; lint is not reported as passing.

The analyzer is run against the actual rendered production build with the toolkit's extraction engine and all 14 scoring categories, rather than against a pasted HTML approximation. Before the latest sidebar and white-background refinements, the homepage scored 94/100 on desktop and mobile, with full marks for contrast, touch interaction, accessibility, and responsive checks. An initial 4.44:1 contrast finding on the recommended plan's monthly label was corrected.

Review the remaining heuristic findings with care:

- The animated FAQ answers in normal document flow are classified as hidden menus extending below the viewport. They expand within the page; this is not an offscreen modal. Pointer and keyboard expansion/collapse and horizontal reflow were checked in Chrome.
- Mixed full-bleed panels, inset previews, and text sections trigger section-spacing and alignment heuristics. Their intentional hierarchy is checked visually.
- The analyzer subtracts design-polish points for a single light theme. This is an intentional design choice, not an inaccessible control state.

No credentials or customer records are included in the reports. OAuth, uploads, billing, actual playback, and authenticated server management require the deployment services listed in DEPLOY_STATUS.md.

## Follow-up refinement

- Enlarged only the header logo’s lilac circle from 30 to 44 px; the image stays 30 px with its existing scale.
- Removed the free-plan hero caption, home-channel caption, repeated setup labels, and playlist metadata suffix.
- Moved preview playlist selection into the sidebar under Example Server, including on mobile. Replaced the preview badge with Nadia’s N avatar. The Filter button reveals a member filter that updates the sample tracks.
- Added a centre-out fill on the command link, with a delayed text-color change and reduced-motion support.
- Set the site background to pure white; strengthened panel borders and form outlines. Shared form controls and menu items now have 44 px targets.
- Reviewed route source across marketing, auth, server management, and the founder console. Simplified redundant and implementation-focused descriptions, removed remaining glass effects, and replaced the auth text arrow with an Icones icon. Legal and permission behavior stays intact. Authenticated routes still require live service configuration for visual verification.

Follow-up verification: the production web build and all seven type checks pass. The 24 public-route layout checks pass at 320, 768, and 1440 px. Playlist selection and member filtering were exercised in the browser. Hover fills the command button with navy and changes its text to white after a 240 ms delay; pointer exit reverses the state. Reduced motion removes both transitions. No browser errors were reported.

## Annotated design pass

The founder’s latest annotations supersede the earlier border treatment and centre-fill animation. Public surfaces now use spacing and soft backgrounds rather than outlines. The shared logo adds 14 px of circle padding at every size, including the demo and founder sign-in.

The demo has a Server sidebar, original cover artwork for playlists and all six sample tracks, and a borderless N avatar. The redundant voice-channel panel is removed; member attribution remains. Filter is a static illustration, as requested.

The #lounge feature uses 32 staggered spectrum bars with faster, varied motion; reduced-motion users see a static spectrum. Professional role names are Owner, Admin, Contributor, and Listener, with distinct Icones markers. The default names/colors are shared with new-server setup; existing role IDs, capabilities, and custom names are preserved.

Motion 13 powers an upward button wipe that reveals the background and reversed text together, with no separate text delay. Both pointer and keyboard focus work, and reduced-motion mode uses an immediate state change. Source: https://motion.dev/docs/react-use-animate.

Pricing uses tinted panels without outlines, setup has a wider title container, and the footer contains the supplied odiwr tag linked to https://odiwr.com in a new tab. The login back link is removed; the logo remains the home link. Headphones are the filled Phosphor icon from Icones.

Validation for the annotated pass: all three app builds and seven workspace type checks pass. The 24 public-page responsive checks report no overflow, missing primary headings, or broken images. The exact 934 px review viewport was also inspected. Default role keys, capability masks, and ordering were compared against the prior version and are unchanged.

## Final homepage and login refinements

- The fictional preview server is Moonwave. The feature card places `#Lounge` and its speaker icon on the right, without the connection status or trailing headphones.
- The spectrum now uses measured frequency data from an original 128 BPM, eight-bar music loop. `scripts/generate-demo-spectrum.mjs` synthesizes the source audio and calculates 32 logarithmic FFT bands from 30 Hz to 16 kHz. The browser interpolates the precomputed frames silently, pauses offscreen or in hidden tabs, and stops for reduced motion. The generator checks its FFT against a known 1 kHz tone. This is a sample visualization, not live server audio.
- The upload illustration has the requested dashed outline. Pricing removes the duplicate quota above each title and puts Recommended beside Plus. The developer tag is 30 × 24 px inside a larger link target.
- Login uses the shared navigation aligned right, without account actions, including its mobile menu. A slow blue/lilac wave replaces the headphones in the decorative panel. Both sign-in error paths use borderless lilac alerts with navy text and an Icones information marker. Reduced motion disables the wave.

Production builds for all three apps and all seven workspace type checks pass. The 24 public-route checks at 320, 768, and 1440 px pass with no horizontal overflow, broken images, or missing primary headings. Deployment and live OAuth still require the configuration recorded in DEPLOY_STATUS.md.
