# Design System Specification: Editorial Ecology

## 1. Overview & Creative North Star
### Creative North Star: "The Living Archive"
This design system rejects the clinical, "tech-first" aesthetic of traditional recycling apps in favor of a high-end, editorial experience. We are not building a utility; we are curating a movement. The "Living Archive" philosophy blends **Organic Brutalism**—bold, intentional layouts—with the softness of nature. 

By utilizing intentional asymmetry, expansive negative space, and a layering technique we call "Tonal Stacking," we move away from generic "card-and-grid" templates. The goal is to make the user feel as though they are leafing through a premium sustainable-living magazine where every element has the "breath" of the natural world.

---

## 2. Color & Atmosphere
Our palette is rooted in the forest floor, moving from the deep shadows of the undergrowth to the vibrant life of new shoots.

### The "No-Line" Rule
**Prohibit the use of 1px solid borders for sectioning.** To define boundaries, use background shifts. For example, a `surface-container-low` section should sit directly on a `surface` background. The eye should perceive change through tone, not lines.

### Surface Hierarchy & Nesting
Treat the UI as physical layers of recycled paper. 
- **Base Layer:** `surface` (#f9faf5)
- **Secondary Depth:** `surface-container-low` (#f3f4ef)
- **Actionable Depth:** `surface-container-highest` (#e2e3de)
*Nesting Example:* A high-priority "Impact Card" (`surface-container-highest`) should be nested within a general information section (`surface-container-low`).

### The "Glass & Gradient" Rule
To elevate the "eco" feel into a "premium" space:
- **Glassmorphism:** Use semi-transparent versions of `surface-container` (60-80% opacity) with a `20px` backdrop blur for floating navigation bars or modal overlays.
- **Signature Textures:** Apply a subtle linear gradient (45deg) from `primary` (#343c0a) to `primary-container` (#4b5320) on Hero CTAs to create a sense of organic depth and "soul."

---

## 3. Typography: The Editorial Voice
We use a dual-typeface system to balance authority with approachability.

*   **Display & Headlines (Manrope):** Chosen for its geometric precision and modern warmth. Use `display-lg` (3.5rem) with tight letter-spacing (-0.02em) to create an authoritative, editorial impact.
*   **Body & Labels (Plus Jakarta Sans):** A highly legible sans-serif with a taller x-height, ensuring clarity even in complex recycling instructions.

**Hierarchy as Identity:** 
- Use `headline-lg` in `primary` for storytelling.
- Use `title-sm` in `on-surface-variant` for metadata.
- Large scale contrasts (e.g., a `display-md` headline followed by `body-md` text) are encouraged to break the "standard app" monotony.

---

## 4. Elevation & Depth: Tonal Layering
We do not use shadows to mimic light; we use tone to mimic mass.

*   **The Layering Principle:** Depth is achieved by stacking. Place `surface-container-lowest` (#ffffff) elements on top of `surface-dim` (#d9dad6) to create a soft, natural "lift."
*   **Ambient Shadows:** If a floating action is required (e.g., a scan button), use a diffused shadow: `box-shadow: 0 20px 40px rgba(52, 60, 10, 0.08)`. The shadow must be tinted with the `primary` hue, never pure black/grey.
*   **The "Ghost Border" Fallback:** For high-accessibility needs, use the `outline-variant` (#c8c7b8) at 20% opacity. **Never use 100% opaque borders.**
*   **Organic Shapes:** Apply `xl` (3rem) or `lg` (2rem) corner radii to containers to mimic the softened edges of river stones.

---

## 5. Components & Interaction

### Buttons
- **Primary:** Gradient fill (`primary` to `primary-container`), `full` (9999px) radius. Text in `on-primary`.
- **Secondary:** `secondary-container` fill with `on-secondary-container` text. No border.
- **Tertiary:** Text-only in `primary`, using `title-sm` for a bold, editorial feel.

### Cards & Lists
- **Forbid Divider Lines.** Separate list items using `spacing-4` (1.4rem) of vertical white space or by alternating background tones (`surface-container-low` vs `surface-container`).
- **Cards:** Use `md` (1.5rem) roundedness and "Ghost Borders" only when high contrast is toggled.

### Input Fields
- **Style:** Subtle `surface-container-high` fills. Labels should be `label-md` in `on-surface-variant`.
- **Active State:** Transition the background to `surface-container-lowest` and provide a 2px `primary` underline—avoid full-box strokes.

### Contextual Components: "The Impact Petal"
A custom component for this system: A soft, organic shape (using `xl` rounding) that displays a user's CO2 savings. It uses a `tertiary-container` (#005c15) background to stand out as a "vibrant green" success state.

---

## 6. High-Accessibility / Disability Modes
Design is only high-end if it is inclusive.

*   **High Contrast Mode:**
    - Swap all `surface-container` tiers for `surface` (#f9faf5).
    - Replace tonal layering with a 2px solid border using `outline` (#77786b).
    - Increase all `body` text to `title-sm` weight for enhanced legibility.
*   **Large Target Targets:**
    - All touch targets (Chips, Buttons, Links) must maintain a minimum height of `12` (4rem) in accessibility mode.
    - Increase `spacing` tokens by a factor of 1.5x to prevent mis-taps.

---

## 7. Do’s and Don’ts

### Do
- **Do** use asymmetrical margins (e.g., `spacing-10` on the left, `spacing-6` on the right) for headline sections to create an editorial look.
- **Do** use `tertiary` (#00420c) for success states and positive reinforcement—it’s our "Vibrant Green."
- **Do** embrace "Breathing Room." If a screen feels full, increase the spacing to the next tier in the scale.

### Don't
- **Don't** use pure black (#000000) for text. Use `on-surface` (#1a1c19) to maintain the organic, earthy softness.
- **Don't** use standard Material Design drop shadows. If it looks like a "default" card, it’s a failure of the system.
- **Don't** use sharp 90-degree corners. Everything in nature has been weathered; our UI should reflect that.