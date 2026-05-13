# Code Review: Project Page (`/projects/[uid]`)

**Reviewer:** Senior Full-Stack Engineer / Next.js Expert  
**Date:** May 1, 2026  
**Scope:** All files composing the `/projects/[uid]` route — server page, client workspace, gallery, composer, settings, and shared utilities.

---

## Executive Summary

The project page is well-architected overall. The server/client split is clean, the justified-rows gallery algorithm is a strong implementation, and the credit store is elegantly designed. However, several issues merit attention: the **generation-composer.tsx is a 1,067-line monolith** with heavily duplicated image/video branches, **pending-generation matching uses fragile prompt-string comparison** that will break with duplicate prompts, and **multiple components re-implement the same popover/menu-dismiss pattern** instead of sharing a hook. The inline SVG icon count is excessive and should be extracted. None of these are ship-blockers, but they accumulate into meaningful maintenance debt.

**Severity scale used below:**  
🔴 Bug / will break — 🟠 Significant smell / fragile — 🟡 Improvement opportunity — 🟢 Positive note

---

## 1. `page.tsx` — Server Component (Entry Point)

### 🟢 What's done well

The server component is lean and focused. Parallel data fetching with `Promise.all` for generations + balance is correct. The `generateMetadata` function properly handles missing projects. The generation-item mapping logic (expanding batch results into individual gallery items) is clean.

### 🟠 Double `await params` / double auth call

```ts
// generateMetadata
const { uid } = await params;
const { user } = await requireOnboardedUser();

// ProjectPage
const { uid } = await params;
const { user } = await requireOnboardedUser();
```

`generateMetadata` and `ProjectPage` both independently `await params` and call `requireOnboardedUser()`. Next.js calls these separately — there's no shared execution context. This means **two auth checks per page load**. If `requireOnboardedUser()` hits a database or external auth provider, this doubles the latency for the metadata phase.

**Recommendation:** Next.js 15 deduplicates `fetch()` calls automatically, but custom functions like `requireOnboardedUser()` are *not* deduped unless you wrap them in `React.cache()`. Wrap it:

```ts
// lib/auth-server.ts
import { cache } from "react";
export const requireOnboardedUser = cache(_requireOnboardedUser);
```

### 🟠 Inconsistent JSX indentation (lines 123–142)

The `<ProjectWorkspace>` closing props are indented at 8 spaces while the opening tag is at 12. This suggests a copy-paste or auto-format mishap. While cosmetic, inconsistent indentation in JSX makes it harder to visually parse which props belong to which component.

### 🟡 `generationItems` mapping is in the wrong layer

The `flatMap` that converts `GenerationRow` → `GenerationItem[]` is 30+ lines of data-transformation logic sitting inside a React component function. This should be a standalone utility function (e.g., `mapGenerationsToItems(generations)`) in `lib/generations.ts`, co-located with the query. This makes it testable in isolation and keeps the page component focused on composition.

### 🟡 Hardcoded limit `100`

```ts
listGenerationsByProject(project.id, user.id, 100)
```

The `100` is a magic number. If the gallery ever supports pagination or infinite scroll from the server, this will need to change. Extract it as a named constant (`INITIAL_GENERATION_LIMIT`).

---

## 2. `project-workspace.tsx` — Client Orchestrator

### 🟢 What's done well

Clean state ownership model. The workspace owns `generations[]` and delegates display to the gallery and mutation to the composer. The `useCallback` wrapping is correctly applied. The imperative handle pattern (`composerRef`) is a good choice for cross-component actions without lifting all composer state.

### 🔴 Pending-generation matching by prompt string is fragile

```ts
const firstPendingIdx = prev.findIndex(
    (g) => g.status === "pending" && g.prompt === result.prompt,
);
```

This matches pending placeholders to completed results **by prompt text**. If a user submits the same prompt twice in quick succession (common for "regenerate" workflows), the second completion will match and replace the *first* prompt's pending items, corrupting the gallery state.

**Recommendation:** Match by a unique generation ID. Pass the `idempotencyKey` (already generated in the composer) through `onGenerationStart` and `onGenerationComplete`, and use that as the match key instead of the prompt string.

### 🟠 `handleDeleteGeneration` — optimistic delete has a subtle race

```ts
let removed: GenerationItem | null = null;
setGenerations((prev) => {
    const found = prev.find((g) => g.uid === uid);
    if (!found) return prev;
    removed = found;
    return prev.filter((g) => g.uid !== uid);
});
if (!removed) return;
```

The `removed` variable is assigned *inside* the `setState` updater, which React may batch or defer. In React 18's concurrent mode, reading `removed` immediately after `setGenerations` is not guaranteed to reflect the updater's execution. The variable will usually be set because React processes updaters synchronously in event handlers, but this is an implementation detail, not a contract.

**Recommendation:** Compute `removed` before calling `setGenerations`:

```ts
const removed = generations.find((g) => g.uid === uid);
if (!removed) return;
setGenerations((prev) => prev.filter((g) => g.uid !== uid));
```

### 🟠 Restore-on-failure inserts at the wrong position

```ts
// On delete failure:
setGenerations((prev) => [restored, ...prev]);
```

The item is prepended to the top of the gallery, but it was originally at an arbitrary position. After a failed delete, the card "jumps" to the top of the grid, which is disorienting. Store the original index and splice it back.

### 🟡 `Model` and `VideoModel` interfaces are identical

```ts
interface Model { id: string; name: string; description: string; creditBase: number; }
interface VideoModel { id: string; name: string; description: string; creditBase: number; }
```

These are the same shape. Use a single `Model` type. The duplication signals a premature distinction that was never realized.

---

## 3. `generation-gallery.tsx` — Justified-Rows Grid (847 lines)

### 🟢 What's done well

The justified-rows packing algorithm is excellent — the partition-selection approach (comparing `scaleWith` vs. `scaleWithout` in log space) is the right algorithm for this job, and the implementation is clean and well-commented. The `LAST_ROW_JUSTIFY_THRESHOLD` avoids the "hero row" problem. The `useContainerWidth` hook with ResizeObserver is correct.

### 🟠 `GalleryCardMenu` re-implements popover logic from scratch

The menu uses `createPortal`, manual `getBoundingClientRect` measurement, `ResizeObserver`-style re-anchoring on scroll/resize, and outside-click + Escape dismissal. This exact same pattern appears in `ComposerSettings`, `ProjectActionMenu`, and `ImageThumbnail`. That's **four independent implementations** of the same popover behavior across the project page.

**Recommendation:** Extract a `usePopover(anchorRef)` hook or a `<Popover>` component that handles:
- Portal rendering
- Anchor measurement + repositioning on scroll/resize
- Outside-click dismissal
- Escape-key dismissal
- The `setTimeout(0)` trick to avoid same-click dismiss

This would eliminate ~60 lines from each consumer and make behavior consistent.

### 🟠 `useLayoutEffect` in a client component with SSR

```ts
useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    setWidth(node.clientWidth);
    // ...
}, [ref]);
```

`useLayoutEffect` fires a React warning during SSR. While this component is marked `"use client"`, Next.js still server-renders client components on the first request. The warning is harmless but noisy in development. Consider using an `useIsomorphicLayoutEffect` wrapper (a one-liner that picks `useLayoutEffect` on the client and `useEffect` on the server).

### 🟡 Inline SVG icons are excessive

The file contains **7 icon components** (`EditIcon`, `LayersIcon`, `RefreshIcon`, `DownloadIcon`, `LinkIcon`, `TrashIcon`, and the retry icon) all defined inline. Meanwhile, the project already has `components/icons/action-icons.tsx`. These should be moved there or replaced with a lightweight icon library (e.g., `lucide-react`, which is already likely in the dependency tree given the Tailwind + shadcn setup).

### 🟡 `key={rowIndex}` on rows

```tsx
{rows.map((row, rowIndex) => (
    <div key={rowIndex} ...>
```

Using array index as key means React can't efficiently reconcile when items are prepended (which happens on every new generation). When a new generation appears, *every* row's key shifts by one, forcing React to re-mount all row DOM nodes. Consider deriving a stable key from the row's first item UID: `key={row.items[0]?.item.uid}`.

### 🟡 No virtualization

The gallery renders all generations at once (up to 100 items). Each `GalleryCard` has its own state (`mediaLoaded`, `mediaError`) and event handlers. For 100+ items, this creates significant DOM and memory overhead. Consider `react-window` or a custom virtual scroll that only renders rows within the viewport. The justified-rows layout makes this straightforward since row heights are pre-computed.

### 🟡 Missing `aria-hidden` on retry icon SVG

The retry button's SVG (line 430) lacks `aria-hidden`. Screen readers will try to announce the SVG paths.

---

## 4. `generation-composer.tsx` — Prompt Input Bar (1,067 lines)

### 🔴 This file is the single biggest problem in the codebase

At 1,067 lines, this is a monolith that handles: prompt input, image attachment (file picker + drag-and-drop + paste + URL fetch), thumbnail preview with hover/tap popover, video/image mode toggle, aspect ratio controls, settings panel orchestration, credit cost calculation, generation submission (both image and video), error recovery with polling, imperative handle for parent-driven actions, and keyboard shortcuts.

**Recommendation:** Split into at minimum:
- `generation-composer.tsx` — ~200 lines: shell, prompt input, mode toggle, keyboard, imperative handle
- `composer-attachments.tsx` — ~200 lines: image attachment logic, drag/drop, paste, thumbnail row
- `image-thumbnail.tsx` — ~150 lines: the `ImageThumbnail` component (already a self-contained 180-line component at the bottom)
- `use-generation-submit.ts` — ~200 lines: the `handleGenerate` logic as a custom hook

### 🔴 Image and video submission branches are 90% duplicated

The `handleGenerate` callback contains two nearly identical branches (~100 lines each) for image and video generation. The only differences are: the API endpoint (`/api/generate` vs `/api/generate-video`), the request body shape (slightly different), and the poll recovery parameters. Everything else — error handling, toast calls, state cleanup, the `pollForCompletion` fallback flow — is copy-pasted.

```ts
// Image branch (lines 483-560)
try {
    const res = await fetch("/api/generate", { ... });
    const data = await res.json();
    if (!res.ok) { toast.error(...); onGenerationError(...); }
    else { onGenerationComplete({...}); setPrompt(""); setAttachedImages(...); }
} catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") { ... }
    else { const recovered = await pollForCompletion({...}); ... }
}

// Video branch (lines 369-451) — same structure, different endpoint
```

**Recommendation:** Extract a `submitGeneration(config)` function that takes `{ endpoint, body, kind, maxPollAttempts }` and handles the entire fetch → parse → error → poll → cleanup pipeline. The two branches become two-line calls.

### 🟠 `attachedImages` in the dependency array but `visibleImages` used in the closure

```ts
const handleGenerate = useCallback(async () => {
    // Uses `visibleImages` (derived from attachedImages + mode)
    if (visibleImages.length > 0) { ... }
}, [
    // ...
    attachedImages, // listed here, but visibleImages is what's actually read
]);
```

`visibleImages` is a derived variable (`isVideo ? attachedImages.slice(0, 2) : attachedImages`), so listing `attachedImages` in deps is technically correct. But it's misleading — if someone later memoizes `visibleImages` or changes its derivation, the dep array becomes stale. Either list `visibleImages` directly (if memoized) or add a comment explaining the indirection.

### 🟠 `addImages` closure captures stale `isVideo`

```ts
const addImages = useCallback((files: File[]) => {
    setAttachedImages((prev) => {
        const limit = isVideo ? MAX_ATTACHED_IMAGES_VIDEO : MAX_ATTACHED_IMAGES_PHOTO;
        // ...
    });
}, [isVideo]);
```

Because `isVideo` is in the dependency array, `addImages` is recreated on every mode toggle. Any consumer holding a stale reference (e.g., the imperative handle's `attachReferenceFromUrl`) would use the wrong limit. This is currently safe because `useImperativeHandle` lists `addImages` in its deps, but it's a fragile chain — one missed dep and the bug appears.

### 🟡 `flushSync` in `applySnapshot` is a code smell

```ts
applySnapshot: (snapshot) => {
    flushSync(() => {
        setPrompt(snapshot.prompt);
        setMode(snapshot.kind);
        if (snapshot.aspectRatio) {
            setSettings((s) => ({ ...s, aspectRatio: snapshot.aspectRatio! }));
        }
    });
},
```

`flushSync` forces synchronous rendering, bypassing React's batching and concurrent features. The comment explains it's needed so the subsequent `submit()` call sees the new values. A cleaner approach would be to have `submit()` accept optional overrides:

```ts
submit: (overrides?: { prompt?: string; aspectRatio?: string; kind?: ComposerMode }) => {
    handleGenerate(overrides);
}
```

This eliminates the need for `flushSync` entirely.

### 🟡 `ImageThumbnail` is 180 lines with its own popover system

The `ImageThumbnail` component at the bottom of the file is a substantial component with: hover timer management, portal-rendered preview bubble, mobile/desktop detection, anchor measurement, fade+scale animation state. It deserves its own file and would benefit from the shared `usePopover` hook recommended in section 3.

### 🟡 Cleanup of object URLs could leak

```ts
setAttachedImages((prev) => {
    prev.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    return [];
});
```

This pattern appears three times (lines 401-403, 515-517, 547-549). If the component unmounts while images are attached (e.g., navigating away), the object URLs are never revoked. Add a cleanup effect:

```ts
useEffect(() => {
    return () => {
        attachedImages.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    };
}, []); // cleanup on unmount
```

---

## 5. `composer-settings.tsx` — Settings Modal

### 🔴 State update during render (lines 133-137)

```ts
if (!open || !anchorRect) {
    if (view !== "root") setView("root");
    if (modelSearch !== "") setModelSearch("");
    return null;
}
```

This calls `setView` and `setModelSearch` **during the render phase** (not in an effect or event handler). React will log a warning: "Cannot update a component while rendering a different component." While React tolerates this in some cases, it's technically incorrect and can cause infinite render loops if the state update triggers a re-render of a parent.

**Recommendation:** Move these resets to a `useEffect`:

```ts
useEffect(() => {
    if (!open) {
        setView("root");
        setModelSearch("");
    }
}, [open]);

if (!open || !anchorRect) return null;
```

### 🟠 Fifth instance of the popover dismiss pattern

Lines 104-131 implement outside-click + Escape dismissal with the `setTimeout(0)` trick — the same pattern from `GalleryCardMenu`, `ProjectActionMenu`, `ImageThumbnail`, and the gallery menu. This is the strongest argument for extracting a shared hook.

### 🟡 `ASPECT_RATIOS` stores JSX in a constant

```ts
const ASPECT_RATIOS = [
    { value: "16:9", icon: <rect width="18" height="10" x="3" y="7" rx="2" ry="2" /> },
    // ...
];
```

Storing React elements in a module-level constant works but is unusual. If this data ever needs to be serialized (e.g., for SSR or testing), the JSX prevents it. Consider storing the numeric dimensions and rendering the `<rect>` in the component.

### 🟡 `Model` type is re-exported awkwardly

```ts
export type { Model }; // line 574
```

The `Model` interface is defined locally in this file and then re-exported for the composer's use. This creates a circular-feeling dependency where the composer imports `Model` from the settings. Instead, define `Model` in a shared types file (`types/generation.ts`) and import it in both places.

---

## 6. `project-settings.tsx` — Header + Rename + Actions

### 🟢 What's done well

This is the cleanest component in the set. The rename flow (inline form → API call → router.refresh) is well-structured. Error handling is consistent. The archive confirmation dialog is properly guarded against double-submission.

### 🟡 `error` state is set but never cleared on success

```ts
async function handleTogglePin() {
    setError("");
    // ...
    if (!res.ok) { setError(...); return; }
    router.refresh();
}
```

On success, `router.refresh()` triggers a server re-render, which re-mounts the component with fresh props. So the error state is effectively cleared by unmount/remount. But if `router.refresh()` ever becomes non-destructive (preserving client state), stale errors would persist. Add `setError("")` in the success path explicitly.

### 🟡 Missing loading state for pin/unpin

The archive action has `isArchiving` state and disables the button while in flight. The pin/unpin action has no loading state — the user can rapidly click it, firing multiple requests. Add an `isTogglingPin` guard.

---

## 7. `loading.tsx` — Skeleton Screen

### 🟢 Solid implementation

Clean skeleton that matches the actual layout. Uses appropriate `animate-pulse` and opacity values. No issues.

### 🟡 Minor: skeleton grid doesn't match the justified-rows layout

The skeleton uses a CSS grid (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`) with uniform `aspect-square` cells. The actual gallery uses a justified-rows layout with varying aspect ratios. The visual disconnect between loading and loaded states can cause a jarring transition. Consider a simpler skeleton (e.g., three full-width rows of varying heights) that better approximates justified rows.

---

## 8. Shared Utilities

### 🟢 `lib/store.ts` — Excellent

The tiny external store is well-designed. `useSyncExternalStore` is the correct primitive. The `Object.is` comparison prevents unnecessary renders. The selector overload is properly typed. Zero dependencies, SSR-safe. No notes.

### 🟢 `lib/credit-store.ts` — Excellent

The `Symbol.for` singleton pattern to handle Next.js chunk duplication is clever and correct. The hydrator pattern avoids hydration mismatches. The mutation API is clean.

### 🟡 `lib/poll-generation.ts` — Abort listener leak

```ts
signal?.addEventListener("abort", () => {
    clearTimeout(timer);
    resolve();
}, { once: true });
```

If the poll completes normally before the signal fires, the `{ once: true }` listener is never removed (it waits for an abort that never comes). Over `maxAttempts` iterations, this accumulates listeners on the signal. Use `AbortSignal.throwIfAborted()` or manually remove the listener after the timeout resolves:

```ts
const onAbort = () => { clearTimeout(timer); resolve(); };
signal?.addEventListener("abort", onAbort, { once: true });
// After setTimeout fires:
signal?.removeEventListener("abort", onAbort);
```

### 🟡 `lib/constants.ts` — `SOLO_PLAN` uses `!` assertion

```ts
export const SOLO_PLAN = SUBSCRIPTION_PLANS.find((p) => p.id === "solo")!;
```

The non-null assertion is safe today but fragile if someone renames the plan ID. Add a compile-time guard:

```ts
const _solo = SUBSCRIPTION_PLANS.find((p) => p.id === "solo");
if (!_solo) throw new Error("SOLO_PLAN not found in SUBSCRIPTION_PLANS");
export const SOLO_PLAN = _solo;
```

---

## 9. Shared Components

### 🟢 `components/inline-rename-form.tsx` — Clean

Event swallowing for use inside `<Link>` wrappers is thoughtful. The `onSave` return-type pattern (string error or null) is a good API design. Size variants are well-organized.

### 🟢 `components/confirm-dialog.tsx` — Clean

Focus trapping via Escape, overlay click dismiss, busy-state guard — all correct. The `onMouseDown` on the inner div to stop propagation is the right approach.

### 🟠 `components/project-action-menu.tsx` — Sixth popover implementation

Same pattern again. This component is clean on its own, but its existence alongside five other copy-pasted popover implementations is the strongest evidence for extraction.

---

## 10. Cross-Cutting Concerns

### 🟠 No TypeScript strict mode indicators

None of the files use discriminated unions for generation status. The `status` field is typed as `"pending" | "done" | "failed"`, but `imageUrl` is `string | null` independently. This means TypeScript can't narrow — you can have `{ status: "done", imageUrl: null }` which is semantically invalid but type-valid. Use a discriminated union:

```ts
type GenerationItem =
    | { status: "pending"; imageUrl: null; errorMessage: null; /* ... */ }
    | { status: "done"; imageUrl: string; errorMessage: null; /* ... */ }
    | { status: "failed"; imageUrl: null; errorMessage: string; /* ... */ };
```

### 🟠 Hardcoded color values everywhere

The codebase uses raw hex/rgba values extensively: `#0f0f11`, `#1a1a1c`, `#9ca3af`, `#52525b`, `#2a2a2d`, `white/[0.06]`, `white/[0.08]`, `white/[0.12]`, etc. These appear across every file with no central theme definition. If the dark theme ever needs adjustment (e.g., shifting the base gray warmer), you'd need to find-and-replace across dozens of files.

**Recommendation:** Define a Tailwind theme extension in `tailwind.config.ts`:

```ts
colors: {
    surface: { DEFAULT: '#0f0f11', raised: '#1a1a1c', overlay: '#2a2a2d' },
    border: { subtle: 'rgba(255,255,255,0.06)', DEFAULT: 'rgba(255,255,255,0.08)' },
    muted: '#9ca3af',
}
```

### 🟡 No error boundaries

If the gallery or composer throws during render (e.g., a malformed generation item), the entire page crashes to the Next.js error page. Wrap the workspace in an error boundary so a single broken card doesn't take down the whole interface.

### 🟡 Accessibility gaps

- The gallery cards have no keyboard navigation — Tab doesn't move between cards, and there's no `role="grid"` or `role="listbox"` on the container.
- The mode toggle (Image/Video) doesn't use `role="tablist"` / `role="tab"`.
- The aspect ratio picker has no `role="radiogroup"` semantics.
- Focus is not trapped inside the `ComposerSettings` modal.

---

## 11. Summary of Recommendations (Priority Order)

**High priority (bugs / will break):**

1. Replace prompt-string matching for pending generations with idempotency-key matching.
2. Fix `ComposerSettings` render-phase state update (`setView`/`setModelSearch` during render).
3. Wrap `requireOnboardedUser` in `React.cache()` to avoid double auth calls.

**Medium priority (significant refactoring):**

4. Extract a shared `usePopover` / `useAnchoredMenu` hook — eliminates ~300 lines of duplicated dismiss/positioning logic across 5+ components.
5. Split `generation-composer.tsx` into 3-4 files; extract the shared submit pipeline to eliminate the image/video code duplication.
6. Use discriminated union types for `GenerationItem` status.
7. Centralize hardcoded color values into Tailwind theme tokens.

**Lower priority (quality of life):**

8. Move inline SVG icons to `components/icons/` or adopt `lucide-react`.
9. Add virtualization to the gallery for large generation sets.
10. Add error boundaries around the workspace.
11. Improve accessibility (keyboard nav, ARIA roles, focus trapping).
12. Fix `key={rowIndex}` to use stable item-based keys.
13. Add object URL cleanup on unmount in the composer.
14. Clean up the `Model` / `VideoModel` type duplication.

---

*End of review. Total files analyzed: 12. Total lines reviewed: ~3,200.*
