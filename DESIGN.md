---
name: Dynamic Island
description: macOS-style floating capsule overlay for Windows system monitoring and 3D printer status
colors:
  capsule-bg: "#0a0a0a"
  text-primary: "#ffffff"
  text-muted: "#aaa"
  text-dim: "#777"
  text-status: "#888"
  accent-green: "#22c55e"
  accent-yellow: "#eab308"
  accent-red: "#ef4444"
  indicator-gradient: "#22c55e"
  screen-bg: "#1a1a2e"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Display, Segoe UI, sans-serif"
    fontSize: "17px"
    fontWeight: 500
    letterSpacing: "0.03em"
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Display, Segoe UI, sans-serif"
    fontSize: "11px"
    fontWeight: 400
  micro:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Display, Segoe UI, sans-serif"
    fontSize: "8px"
    fontWeight: 400
  caption:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Display, Segoe UI, sans-serif"
    fontSize: "10px"
    fontWeight: 400
  printer-percent:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Display, Segoe UI, sans-serif"
    fontSize: "11px"
    fontWeight: 600
  printer-name:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Display, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 500
rounded:
  pill: "25px"
  capsule: "35px"
  circle: "50%"
  indicator: "2px"
spacing:
  panel-gap: "6px"
  capsule-top: "11px"
  panel-padding-x: "14px"
  printer-padding-x: "6px"
components:
  capsule:
    backgroundColor: "transparent"
    height: "50px"
    rounded: "{rounded.pill}"
    gap: "{spacing.panel-gap}"
  capsule-expanded:
    height: "74px"
    rounded: "{rounded.capsule}"
  left-panel:
    backgroundColor: "{colors.capsule-bg}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.pill}"
    padding: "0 {spacing.panel-padding-x}"
  right-panel:
    backgroundColor: "{colors.capsule-bg}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.pill}"
    padding: "0 {spacing.printer-padding-x}"
  printer-circle:
    width: "42px"
    height: "42px"
    rounded: "{rounded.circle}"
    backgroundColor: "{colors.capsule-bg}"
  indicator:
    width: "60px"
    height: "4px"
    rounded: "{rounded.indicator}"
    backgroundColor: "{colors.indicator-gradient}"
---

# Design System: Dynamic Island

## 1. Overview

**Creative North Star: "The System Whisper"**

A floating capsule that feels like a native Windows system component — always present, never intrusive. The design language is ultra-dark, ultra-compact, and motion-driven. Every pixel serves a purpose; every animation communicates state. The capsule lives at the top center of the screen, expanding on hover to reveal system stats and printer progress, collapsing back to a minimal pill when idle.

**Key Characteristics:**
- **Ultra-dark surfaces** — near-black (#0a0a0a) backgrounds that blend into any desktop
- **Elastic motion** — cubic-bezier(0.34, 1.56, 0.64, 1) bouncy transitions for state changes
- **Minimal footprint** — 50px collapsed height, expanding only when needed
- **Information density** — time, memory, network, printer status in a single glance
- **Two-panel architecture** — left (time/shortcuts) + right (printer circles) with a 6px gap

## 2. Colors

A near-monochromatic dark palette with a single green accent. The system is designed to be invisible against dark desktops and unobtrusive against light ones.

### Primary
- **Capsule Surface** (#0a0a0a): The dominant surface color. Used for both panel backgrounds. Near-black with zero saturation — reads as system-level, not decorative.

### Accent
- **Status Green** (#22c55e): Progress rings, collapsed indicator bar, successful states. The only chromatic color in the system — its rarity makes it meaningful.
- **Printing Yellow** (#eab308): Active printing state on progress rings. Warm amber signals activity without urgency.
- **Paused Red** (#ef4444): Paused/error state on progress rings. Reserved for alerts only.

### Neutral
- **Text Primary** (#ffffff): Time display, printer percentages. Maximum contrast on capsule surface.
- **Text Muted** (#aaa): Memory labels, shortcut names. Secondary information that doesn't compete.
- **Text Dim** (#777): Network speed indicators. Tertiary data visible on expansion.
- **Text Status** (#888): Printer status text (Printing, Paused). Functional, not decorative.

### Named Rules
**The Green Accent Rule.** Green (#22c55e) appears on ≤5% of any given screen. Its scarcity is the signal — when you see green, something requires attention.

## 3. Typography

**Display Font:** SF Pro Display / Segoe UI / system sans-serif stack
**Body Font:** Same system stack (unified family)

**Character:** System-native typography that feels like Windows itself. No decorative fonts, no contrast pairing — one clean sans-serif in multiple weights.

### Hierarchy
- **Time Display** (500 weight, 17px, 0.03em spacing): The primary focal point. Always visible, always centered.
- **Printer Name** (500 weight, 12px): Expanded state only. Identifies which printer.
- **Label** (400 weight, 11px): Memory usage, printer percentages. Functional data.
- **Caption** (400 weight, 10px): Network speeds, printer status. Tertiary information.
- **Micro** (400 weight, 8px): Shortcut labels. Maximum density, minimum footprint.

### Named Rules
**The System Font Rule.** Never introduce a custom font. The capsule should feel like it ships with Windows.

## 4. Elevation

No shadows. Depth is conveyed through spatial positioning (fixed at top of screen) and motion (elastic expansion). The capsule floats above the desktop via z-index (100), not via drop shadows.

### Shadow Vocabulary
- **Collapsed Indicator** (`box-shadow: 0 0 8px rgba(34, 197, 94, 0.5)`): Ambient glow on the green indicator bar. The only shadow in the system — used to draw attention to the minimised state.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest. The single shadow exists only on the collapsed indicator to signal interactivity.

## 5. Components

### Capsule Container
- **Shape:** Pill (25px radius collapsed, 35px expanded)
- **Background:** Transparent (panels provide the surface)
- **Height:** 50px collapsed, 74px expanded
- **Gap:** 6px between panels
- **Position:** Fixed, top center, z-index 100

### Left Panel (Time/Shortcuts)
- **Shape:** Pill (25px radius collapsed, 35px expanded)
- **Background:** Near-black (#0a0a0a)
- **Width:** 140px collapsed (time or shortcuts), 300px expanded single, 200px expanded multi-open
- **Padding:** 0 14px
- **Content:** Time view (memory + time + network) or shortcut view (icon grid)

### Right Panel (Printer)
- **Shape:** Pill (25px radius collapsed, 35px expanded)
- **Background:** Near-black (#0a0a0a)
- **Width:** 50px collapsed single, 104px collapsed multi, 110px expanded single, 210px expanded multi
- **Padding:** 0 6px
- **Content:** Printer circle(s) with progress ring

### Printer Circle
- **Shape:** Circle (42×42px)
- **Background:** Near-black (#0a0a0a)
- **Progress Ring:** SVG circle, 3.5px stroke, rounded caps
- **Color by State:** Green (completed), Yellow (printing), Red (paused)
- **Detail (expanded):** Printer name (12px) + status (10px) to the right

### Collapsed Indicator
- **Shape:** Horizontal bar (60×4px, 2px radius)
- **Background:** Green gradient (linear-gradient)
- **Shadow:** 0 0 8px rgba(34, 197, 94, 0.5)
- **Hover:** Scale 1.15x, width 70px, stronger glow
- **Position:** Fixed, top 13px, centered

### Shortcut Item
- **Shape:** Column layout (icon + label)
- **Icon Size:** 18px (24px with image)
- **Label:** 8px, truncated with ellipsis
- **Width:** 36px collapsed, 41px expanded, 34px multi-open
- **Bottom Padding:** 14px (space for label)

## 6. Do's and Don'ts

### Do:
- **Do** use near-black (#0a0a0a) for all capsule surfaces — it reads as system-level, not decorative.
- **Do** use elastic cubic-bezier(0.34, 1.56, 0.64, 1) for all expansion/collapse animations — the bounce communicates playful precision.
- **Do** keep the capsule at 50px height when collapsed — any taller wastes vertical space.
- **Do** use green (#22c55e) sparingly — it's the only chromatic accent, and its rarity is the signal.
- **Do** respect prefers-reduced-motion — collapse all animations to instant transitions.
- **Do** keep font sizes under 17px — this is a compact overlay, not a full-page UI.

### Don't:
- **Don't** add card-style layouts — the capsule IS the card; nested cards are always wrong.
- **Don't** use drop shadows on panels — depth comes from position and motion, not shadows.
- **Don't** introduce custom fonts — the capsule should feel like it ships with Windows.
- **Don't** use gradient text or glassmorphism — decorative effects undermine the system-tool feel.
- **Don't** add texture, patterns, or decorative borders — the dark surface speaks for itself.
- **Don't** make the capsule resizable or add a visible titlebar — it's a fixed-size overlay by design.
- **Don't** exceed 35px border-radius on panels — full pill (25px) is the collapsed default; 35px is the expanded ceiling.
