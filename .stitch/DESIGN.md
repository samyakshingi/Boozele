---
name: Velvet Neon
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#e6bcbd'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#ad8888'
  outline-variant: '#5d3f40'
  surface-tint: '#ffb3b5'
  primary: '#ffb3b5'
  on-primary: '#680019'
  primary-container: '#ff5167'
  on-primary-container: '#5b0015'
  inverse-primary: '#be0036'
  secondary: '#ffecc0'
  on-secondary: '#3d2f00'
  secondary-container: '#fecb00'
  on-secondary-container: '#6e5700'
  tertiary: '#adc6ff'
  on-tertiary: '#002e69'
  tertiary-container: '#4b8eff'
  on-tertiary-container: '#00285c'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdada'
  primary-fixed-dim: '#ffb3b5'
  on-primary-fixed: '#40000c'
  on-primary-fixed-variant: '#920027'
  secondary-fixed: '#ffe08b'
  secondary-fixed-dim: '#f1c100'
  on-secondary-fixed: '#241a00'
  on-secondary-fixed-variant: '#584400'
  tertiary-fixed: '#d8e2ff'
  tertiary-fixed-dim: '#adc6ff'
  on-tertiary-fixed: '#001a41'
  on-tertiary-fixed-variant: '#004493'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: '800'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.05em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  base: 8px
  margin-mobile: 20px
  gutter-md: 16px
  stack-sm: 12px
  stack-md: 24px
  stack-lg: 40px
---

## Brand & Style

The design system establishes a **Premium Nightlife** aesthetic that balances high-energy social discovery with an exclusive, lounge-like atmosphere. It is designed to feel like a VIP club experience: dark, intimate, but punctuated by vibrant, neon-lit energy.

The visual style is a hybrid of **Glassmorphism** and **High-Contrast Dark Mode**. It utilizes deep charcoal and pure black to create infinite depth, while vibrant accents serve as wayfinders in the night. The interface prioritizes tactile, high-radius components that feel modern and approachable, yet sophisticated.

**Key Brand Pillars:**
- **Electric Energy:** Using saturated neon light to draw the eye to core social actions.
- **Midnight Depth:** Layered dark surfaces that prevent visual fatigue while maintaining a premium feel.
- **Social Fluidity:** Soft, rounded shapes and smooth transitions that reflect the organic nature of social gatherings.

## Colors

The palette is anchored in a "True Dark" foundation to optimize OLED screens and maintain the nightlife vibe. 

- **Primary (Electric Pink):** Reserved for the most important calls to action, such as "Find Buddy" or "Join Party."
- **Secondary (Amber):** Used for rewards, "Send a Drink" features, and status highlights.
- **Tertiary (Cyan):** Used for location markers, active status indicators, and secondary navigation elements.
- **Neutrals:** A spectrum of charcoals are used to differentiate "Surface" from "Background." Surface layers use subtle translucency to create a sense of glass and depth.

## Typography

This design system uses **Inter** for its modern, neutral, and highly legible characteristics across all weights. 

**Hierarchical Strategy:**
- **Emphasis:** Use Extra Bold weights for names and event titles to cut through dark backgrounds.
- **Contrast:** High-contrast white text is used for primary info, while "Off-White" or "Muted Grey" is used for metadata (distance, time) to maintain visual hierarchy.
- **Labels:** Small labels use increased letter-spacing and uppercase styling to mimic architectural signage found in premium venues.

## Layout & Spacing

The layout follows a **Fluid Grid** model optimized for one-handed mobile use. 

- **Safe Zones:** Generous 20px side margins ensure content doesn't feel cramped and accounts for varied device bezels.
- **Rhythm:** An 8px base grid governs all spacing. Vertical stacks of information (e.g., user profiles) should use 24px or 40px gaps to allow the imagery to breathe.
- **Z-Axis:** Spacing is also used to imply depth. Floating action buttons (FABs) and navigation bars should feel "hovered" over the content with distinct padding from the screen edges.

## Elevation & Depth

Hierarchy is established through **Tonal Layering** and **Glassmorphism**. Shadows are used sparingly; instead, depth is communicated via surface color and blur.

- **Level 0 (Background):** Pure Black (#000000). Used for the base canvas.
- **Level 1 (Cards/Lists):** Deep Charcoal (#121212). Used for scrollable content.
- **Level 2 (Overlays/Modals):** Semi-transparent charcoal with a 20px background blur. These surfaces should have a subtle 0.5px white inner border to simulate a glass edge.
- **Accents:** Neon glows are used behind primary buttons to simulate light emission on dark surfaces.

## Shapes

The shape language is extremely soft and organic, utilizing **Pill-shaped (Level 3)** roundedness for buttons and high-radius corners (24px+) for containers.

- **Interactive Elements:** Buttons and tags must always be pill-shaped.
- **Content Containers:** Profile cards and map snippets use 24px corner radii.
- **Media:** Photos and videos should utilize the same 24px radius to maintain a consistent silhouette across the app.

## Components

### Buttons
- **Primary:** Pill-shaped, Solid Electric Pink background with white text. High-contrast and vibrant.
- **Secondary:** Outlined with a 1.5px border in Cyan or Amber.
- **Tertiary:** Ghost style, text-only with icons.

### Cards & Surfaces
- **Glass Cards:** Used for profile details. Should feature `backdrop-filter: blur(20px)` and a `rgba(255, 255, 255, 0.05)` background color.
- **Borders:** Use thin, low-opacity borders (`rgba(255, 255, 255, 0.1)`) instead of heavy shadows for card definition.

### Inputs & Selectors
- **Fields:** Darker-than-surface background with subtle focus states that glow in the Primary color.
- **Chips/Tags:** Small pill-shaped elements used for "Interests" (e.g., "Whiskey Lovers"). Active tags use a solid secondary color (Amber); inactive tags use a dark grey stroke.

### Specialized Components
- **The \"Drink\" Button:** A floating action button with a subtle gradient from Electric Pink to Amber, representing a mixed cocktail, used for the primary social nudge.
- **Map Pins:** Custom markers featuring user avatars with a glowing Cyan ring to indicate \"Active Now\" status.
