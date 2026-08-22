# QRYverse UI/UX decisions

This release uses a restrained **soft-neumorphic** visual language on top of conventional Android navigation, accessibility, and error-prevention patterns. Shadows communicate elevation, but borders, labels, text, and icons carry meaning so the interface remains usable in low contrast, dark mode, and reduced-motion settings.

## Rules applied

- Four persistent destinations plus one central, labeled Scan action on phones. At 720 px and wider, the same destinations move to a navigation rail.
- Persistent destination labels and `aria-current="page"`; screen changes scroll to the top and focus the new `h1` without showing an artificial focus ring.
- A minimum 48 × 48 CSS-pixel hit area for visible controls and at least 12 px visible supporting text. Inputs remain 16 px to avoid mobile zoom.
- Explicit 1 px boundaries and high-contrast foreground colors on every neumorphic surface. Shadows are never the only selected, disabled, warning, or status signal.
- Keyboard-visible focus, dialog focus trapping, Escape/Android Back dismissal, focus restoration, background inertness, and scroll locking.
- Local deletion offers Undo. Hosted deletion, account deletion, cloud replacement, and backup replacement require explicit confirmation.
- Status uses a text badge as well as color. Validation stays next to the relevant field and does not clear user input.
- Fast motion: about 120–160 ms for press feedback and 200–300 ms for screen/sheet transitions. `prefers-reduced-motion` reduces transitions to effectively instant.
- System, light, and dark appearance modes; `prefers-contrast: more` strengthens boundaries and removes decorative shadow dependence.
- Responsive checks at 320 × 568, 360 × 640, 412 × 915, and 1024 × 768 with no horizontal overflow.

## Primary references

- Android layout and navigation patterns: https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-and-nav-patterns
- Android themes and responsive UI: https://developer.android.com/design/ui/mobile/guides/styles/themes
- Android accessibility foundations: https://developer.android.com/design/ui/mobile/guides/foundations/accessibility
- Android button guidance: https://developer.android.com/develop/ui/compose/components/button
- Android input validation: https://developer.android.com/develop/ui/compose/quick-guides/content/validate-input
- Android snackbars: https://developer.android.com/develop/ui/compose/components/snackbar
- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- WCAG focus visible: https://www.w3.org/WAI/WCAG22/Understanding/focus-visible
- Material motion: https://m3.material.io/styles/motion/overview/how-it-works
- Nielsen Norman usability heuristics: https://www.nngroup.com/articles/ten-usability-heuristics/

## Release verification still requiring hardware

Browser geometry and keyboard checks do not replace TalkBack, Android font scaling, camera permission, rotation, or physical touch testing. Run those checks on the minimum supported API and a current Android device using the exact signed internal-testing bundle.
