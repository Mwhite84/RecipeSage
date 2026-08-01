# RecipeSage Design Context

## Users & Purpose

**Primary user**: Tressa — uses on her phone in the kitchen while cooking and on iPad for meal planning. Atlas uses it too (dark mode devotee). Household-only right now.

**Primary context**: Phone, one hand, standing in a kitchen. Glancing at steps, checking ingredients. Occasional iPad session for meal planning at the couch or table.

**Instagram native**: Tressa is very comfortable with modern, image-forward, swipeable UIs. That's the benchmark for what "good" looks like to her.

**Atlas's agenda**: More polish, more modern, better accessibility. The current app feels primitive. The goal is something that looks like it was actually designed, not assembled.

**What they're doing**: browsing saved recipes, viewing step-by-step while cooking, adding new recipes, planning meals.

---

## Brand Personality

**Three words**: smart, comfortable, seamless

**Extended feel**: Like a well-designed iOS app — not a consumer toy, not a clinical enterprise tool. Something that respects the user's intelligence without making them work for it. Warm but not precious. Clean but not cold.

**Anti-references**: CopyMeThat (also primitive, maybe worse), generic recipe apps, anything cluttered or confusing, anything that requires thinking to navigate.

**Key constraint**: Navigation must be obvious. No hunting. No confusion about where things are.

---

## Aesthetic Direction

**Theme**: Both light AND dark — non-negotiable. Light is Tressa's default. Dark is Atlas's. Both must be excellent, not afterthoughts.

**Color**: Current palette is okay (#00a8ff cyan, #353b48 dark navy) but open to evolution. Food context suggests warmth, but the blue is functional. Don't torch it — refine it. Consider whether the accent reads "food app" or "tech dashboard" and adjust accordingly.

**Typography**: Strong hierarchy. Recipe steps need to be readable across a counter at arm's length. Generous font sizes for body/instructions. Bold, confident headings. 

**Layout**: Mobile-first, always. Max 700px desktop width already established — respect it. Large touch targets (cooking with wet/dirty hands). Swipe-friendly patterns familiar from Instagram.

**Density**: Current spacing is "meh" — not wrong, just unmemorable. Add rhythm: tighter groupings within sections, more generous breathing room between them. Don't spread everything evenly.

**Imagery**: Recipes with photos should lead with the photo. Image-forward browsing, not list-forward.

---

## What Not To Do

- Don't make navigation confusing — simplicity of flow is the #1 requirement
- Don't use clinical or generic styling (blue/gray enterprise vibes)
- Don't clutter — every element on screen should earn its place
- Don't design for desktop and shrink it — design for the kitchen phone first
- Don't make the dark mode an afterthought; it needs equal care

---

## Technical Context

- Angular 17 standalone components + Ionic Angular
- 4 themes already: light, dark, black, midnight (SCSS custom properties)
- Existing brand color vars: `--ion-color-primary: #00a8ff`, `--ion-color-medium: #353b48`
- Max content width: 700px
- Desktop breakpoint: 641px
- Capacitor (native iOS/Android builds)
- Self-hosted on k0s cluster (recipes.levenite.com)
