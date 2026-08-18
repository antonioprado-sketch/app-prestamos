---
name: LendWise
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#44474e'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#75777f'
  outline-variant: '#c5c6cf'
  surface-tint: '#4e5e82'
  primary: '#031636'
  on-primary: '#ffffff'
  primary-container: '#1a2b4c'
  on-primary-container: '#8293ba'
  inverse-primary: '#b6c6f0'
  secondary: '#00629d'
  on-secondary: '#ffffff'
  secondary-container: '#00a2fd'
  on-secondary-container: '#003558'
  tertiary: '#141819'
  on-tertiary: '#ffffff'
  tertiary-container: '#292c2e'
  on-tertiary-container: '#909395'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#b6c6f0'
  on-primary-fixed: '#071b3b'
  on-primary-fixed-variant: '#364669'
  secondary-fixed: '#cfe5ff'
  secondary-fixed-dim: '#98cbff'
  on-secondary-fixed: '#001d33'
  on-secondary-fixed-variant: '#004a77'
  tertiary-fixed: '#e0e3e5'
  tertiary-fixed-dim: '#c4c7c9'
  on-tertiary-fixed: '#191c1e'
  on-tertiary-fixed-variant: '#444749'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
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
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  data-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
  3xl: 64px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
---

## Brand & Style

The design system is engineered for a high-trust fintech environment, prioritizing clarity, institutional stability, and modern efficiency. The aesthetic is **Modern Minimalist** with a focus on data density and legibility. 

The system utilizes heavy whitespace and a restricted color palette to reduce cognitive load during complex financial transactions. The emotional response should be one of "effortless control"—where the UI feels invisible, allowing the user's financial data to take center stage. High-quality execution is signaled through precise alignment, refined typography, and subtle tonal transitions rather than decorative flourishes.

## Colors

The palette is anchored by a deep navy to establish authority and trust, paired with a vibrant cyan for interactive elements and highlights. 

- **Primary (#1A2B4C):** Reserved for core branding, headers, and primary navigation.
- **Secondary (#00A3FF):** Used for primary actions (CTAs), progress indicators, and active states.
- **Surface/Background:** A clean white (#FFFFFF) base with a very light grey (#F8FAFC) used to distinguish between different content zones and card containers.
- **Semantic Palette:** High-saturation greens, oranges, and reds are utilized for status indicators and financial health alerts. These must always be paired with icons or text labels to ensure accessibility for color-blind users.

## Typography

The design system exclusively uses **Inter** to leverage its exceptional legibility and systematic weight distribution. 

- **Financial Data:** Use `data-lg` for account balances and loan amounts. The semi-bold and bold weights are critical for creating visual hierarchy in information-dense views.
- **Scale:** Large display sizes use negative letter-spacing to maintain a "tight," premium look.
- **Labels:** Small labels use an uppercase transformation with increased tracking to ensure readability at small scales on mobile devices.
- **Mobile Adaptation:** For screens under 600px, `headline-lg` should automatically downscale to `headline-lg-mobile` to prevent awkward line breaks.

## Layout & Spacing

This design system follows a **Fluid Grid** model optimized for a Mobile-First PWA (Progressive Web App) experience.

- **The 4px Rule:** All spacing and layout dimensions are multiples of 4px.
- **Grid:** Use a 4-column grid for mobile (375px+) and a 12-column grid for desktop (1024px+). 
- **Containers:** Content is housed in cards that stretch to fill the column width. Use 16px margins on mobile to maximize horizontal real estate.
- **Rhythm:** Use `lg` (24px) spacing between distinct content sections and `md` (16px) for internal card padding.

## Elevation & Depth

The design system employs **Tonal Layers** combined with **Ambient Shadows** to create a sophisticated sense of depth without clutter.

1.  **Level 0 (Base):** White (#FFFFFF) for the main background.
2.  **Level 1 (Sub-surface):** Very Light Grey (#F8FAFC) for grouping background content or secondary containers.
3.  **Level 2 (Interactive Cards):** White surface with a very soft, diffused shadow: `0px 4px 20px rgba(26, 43, 76, 0.05)`. This creates a subtle "lift" from the background.
4.  **Level 3 (Modals/Overlays):** White surface with a more pronounced shadow: `0px 12px 32px rgba(26, 43, 76, 0.12)`.

Avoid using pure black shadows; always tint shadows with the Primary Navy color at low opacities to maintain a premium feel.

## Shapes

The shape language is defined as **Rounded**, striking a balance between approachable softness and professional structure.

- **Standard Elements:** Buttons, input fields, and small UI elements use a 0.5rem (8px) radius.
- **Cards & Containers:** Large containers use a 1rem (16px) radius to create a distinct, modern containerized look.
- **Selection Controls:** Checkboxes use a 4px radius, while Radio buttons and Progress Steppers remain fully circular (pill-shaped) to distinguish their function.

## Components

### Buttons
- **Primary:** Solid Primary Navy (#1A2B4C) with White text. Use for core actions like "Apply Now."
- **Secondary:** Outline Primary Navy or Solid Secondary Cyan (#00A3FF).
- **Size:** Minimum touch target height of 48px for mobile accessibility.

### Cards
- **Financial Cards:** White background, 16px padding, 16px corner radius, and Level 2 shadow. 
- **Active State:** Highlight with a 2px left-border of Secondary Cyan to indicate selection.

### Form Elements
- **Inputs:** 1px border (#E2E8F0) with 8px radius. On focus, transition border color to Secondary Cyan and add a 3px soft outer glow.
- **Floating Labels:** Use for high-clarity data entry in mobile forms.

### Progress Steppers
- Use for loan applications. Horizontal on desktop, vertical on mobile. 
- Completed steps use Success Green (#10B981). Active steps use Secondary Cyan (#00A3FF).

### Custom Iconography
- Use 24px linear icons with a 2px stroke width. Icons should use the Primary Navy color for standard states and Secondary Cyan for active navigation states.

### Data Visualization
- **Line Charts:** Use Secondary Cyan for the main trend line with a subtle gradient fill underneath.
- **Status Pills:** Small chips with semi-transparent backgrounds of the semantic colors (e.g., 10% opacity Success Green background with 100% opacity Success Green text).