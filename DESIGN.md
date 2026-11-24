# DESIGN.md — BG-Health v2 Style Direction

## 1. Product Identity & Character
- **Product Name:** BG-Health v2
- **Organization:** PT. BAGONG DEKAKA MAKMUR (Departemen QSHE)
- **Domain:** Occupational Health & Industrial Hygiene Management System (Kesehatan Kerja, MCU, Higiene Industri, Kuesioner Mandiri Karyawan).
- **Aesthetic Inspiration:** Clean macOS-style application (subtle frosted panels, crisp SF Pro / Geist typography, structured window panels, uncluttered hierarchy).
- **Honest Simplicity:** No artificial macOS window chrome (no red/yellow/green traffic light dots in web contexts). Controls exist only where functional.

## 2. Palette & Visual Tokens
- **Dominant Brand Accent:** Bagong Orange
  - Primary: `#FF4D00` (Light) / `#FF5E00` (Dark)
  - Hover / Focus Ring: `rgba(255, 77, 0, 0.35)`
  - Soft Tint Accent: `rgba(255, 77, 0, 0.08)`
- **Neutrals (Light Mode):**
  - Background: `#ECECEC` (Solid neutral desktop surface)
  - Card / Panel Surface: `#FFFFFF`
  - Text Primary: `#1A1A1A`
  - Text Secondary: `#555555` (meets WCAG AA 4.5:1 against `#ECECEC` and `#FFFFFF`)
  - Border: `#D8D8D8`
- **Neutrals (Dark Mode):**
  - Background: `#111111`
  - Card / Panel Surface: `#1C1C1E`
  - Text Primary: `#F0F0F0`
  - Text Secondary: `#A0A0A5`
  - Border: `#38383A`

## 3. Typography
- **Font Sans:** `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", var(--font-geist-sans), "Helvetica Neue", sans-serif`
- **Font Mono:** `var(--font-geist-mono), monospace`
- **Scale:** High density, legible, clean tabular numerals for clinical & industrial hygiene records.

## 4. Dials
- **ENERGY: 1 (Calm)** — Utilitarian, reliable clinical/occupational health application. Information density without visual clutter or shouting gradients.
- **RHYTHM: 2 (Structured)** — Consistent card panels and data tables with dedicated focus workflows for questionnaire respondents and medical officers.
- **MOTION: 1 (Minimal)** — Subtle functional transitions (150ms-200ms ease), respectful of `prefers-reduced-motion: reduce`. No hover spin or bouncing decoration.

## 5. Mobile & Ergonomic Standards
- **Minimum Tap Target:** 44px × 44px for touch interactions on mobile.
- **Zero Horizontal Overflow:** Tables wrap in smooth horizontal scroll containers (`overflow-x-auto`); all modal dialogs fit within `100vw - 32px`.
- **Accessibility:** Full WCAG AA contrast compliance, visible keyboard focus indicators (`focus-visible:ring-2`), and complete keyboard operability (Tab, Enter, Escape).
