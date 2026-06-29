
--- Guide for html ---
## Table of Contents

1. Fundamental Semantics and Validation
2. Content Grouping and Attribution
3. Resource Prioritization and Performance
4. Native Overlays: Dialogs and Popovers
5. Disclosures: Details and Summary
6. Focus Boundaries and Visibility
7. HTML APIs and Forms Grouping
8. Native Media Elements
9. Dynamic Styles and Interactivity

## 1. Fundamental Semantics and Validation

### Guidelines

- **DO** use the standard HTML5 doctype `<!DOCTYPE html>` to prevent quirky rendering modes. 
- **DO** set the `lang` attribute on the `<html>` element for screen reader pronunciation and translation tools.
- **DO** use the `<meta name="viewport">` element with the `content` attribute set to `"width=device-width, initial-scale=1.0"` to ensure page responsiveness.
- **DO** use a single `<h1>` per page/view representing the main topic. Exceptions can be made for modal dialogs, which can also use a single `<h1>`.
- **DO** maintain a sequential, non-skipping heading hierarchy (`<h2>` to `<h3>`, but not `<h2>` to `<h4>`).
- **DO** use semantic landmarks (`<header>`, `<nav>`, `<main>`, `<aside>`, `<footer>`) to create regional navigation for assistive technologies.
- **DO** use `<search>` to enclose search and filtering mechanisms (eliminates the need for `role="search"`).
- **DO** use `<button>` for triggered actions (JS, Modals, Forms) and `<a>` strictly for URL navigation. Set `type="button"` for non-submit buttons in forms to prevent unintended submission.
- **DO** use `<ul>`, `<ol>`, and `<dl>` elements for list content. 
- **DO** ensure that all interactive elements like links and buttons have accessible names.  
- **DO** hide purely decorative SVG images from assistive technology using `aria-hidden="true"`. If using a decorative `<img>`, always include an empty `alt` attribute (e.g. `alt=""`). 
- **DO** ensure that informative SVGs like logos, data visualizations, or icon buttons have a proper accessible name. 

- **DON'T** use generic `<div>` or `<span>` when semantic elements exist, for instance for interactive elements, headings, or independently reusable self-contained content.
- **DON'T** use boolean attributes with redundant values (e.g., use `disabled`, not `disabled="disabled"`).
- **DON'T** use generic elements with added ARIA roles or states when native elements with built-in semantics and behavior exist.
- **DON'T** change the native semantics of elements with ARIA unless it is a critical requirement. 
- **DON'T** use `role="presentation"` or `aria-hidden="true"` on focusable elements or their parents and ancestors. 
- **DON'T** disable page zooming capabilities.

### Code Example

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard | Platform</title>
</head>
<body>
  <header>
    <nav>
      <ul>
        <li><a href="#">About</a></li>
        <li><a href="#">Contact</a></li>
      </ul>
    </nav>
  </header>
  <main>
     <h1>Analytics</h1>
    <search>
      <form action="/filter" method="GET">
        <label for="search-input">Scan items:</label>
        <input type="search" id="search-input" name="q">
        <button type="submit">Search</button>
      </form>
    </search>
    <article>
      <h2>First post</h2>
    </article>
  </main>
</body>
</html>
```

## 2. Content Grouping and Attribution

### Guidelines

- **DO** use `<blockquote>` for extended quotations from another source, and use the `cite` attribute to provide a machine-readable URL for that source.
- **DO** use `<figure>` to group self-contained content (images, code snippets, or quotes) that is referenced from the main flow but could be moved to an appendix or sidebar without affecting the document's meaning.
- **DO** use `<figcaption>` as the first or last child of a `<figure>` to provide a human-readable caption or attribution.
- **DO** use the `<cite>` element inside a caption or attribution to identify the **title** of a work (e.g., a book or website name), not the author's name.
- **DO** use the `<code>` element for short fragments of computer code (e.g., variable names, file paths, or inline snippets).
- **DO** wrap `<code>` inside a `<pre>` element when displaying blocks of code to preserve whitespace and line breaks.
- **DO** ensure that code blocks are accessible by adding `tabindex="0"` to the `<pre>` element if it becomes scrollable, allowing keyboard users to reach the content.

- **DON'T** use `<blockquote>` for purely visual indentation of non-quoted text.
- **DON'T** use `<figure>` for every single image; use it only when a caption is required or when the content is a distinct, referenced unit.
- **DON'T** use `<pre>` without `<code>` for code blocks; `<pre>` alone only preserves formatting but doesn't convey that the content is a computer language.

### Code Example

```html
<!-- Quote with attribution using Figure -->
<figure>
  <blockquote cite="https://html.spec.whatwg.org/">
    <p>The figure element represents some flow content, optionally with a caption, that is self-contained and is typically referenced as a single unit from the main flow of the document.</p>
  </blockquote>
  <figcaption>
    Definition of the &lt;figure&gt; element from the <cite>HTML Living Standard</cite>
  </figcaption>
</figure>

<!-- Image with caption -->
<figure>
  <img 
    src="architecture-diagram.webp" 
    alt="Diagram showing the flow between Client, API Gateway, and Microservices"
    width="800"
    height="450"
    loading="lazy"
  >
  <figcaption>Figure 1: High-level system architecture overview.</figcaption>
</figure>

<!-- Code block with accessibility and language hint -->
<figure>
  <figcaption>Example configuration:</figcaption>
  <pre tabindex="0"><code class="language-json">
{
  "name": "gemini-cli",
  "version": "1.0.0",
  "private": true
}
  </code></pre>
</figure>

<!-- Inline code -->
<p>To initialize the project, run the <code>npm install</code> command.</p>
```

## 3. Resource Prioritization and Performance

### Guidelines

- **DO** use `fetchpriority="high"` for the Largest Contentful Paint (LCP) element (e.g., hero image) to elevate network priority.
- **DO** use `<link rel="preload" as="image">` with `fetchpriority="high"` for LCP background images defined in CSS.
- **DO** apply `loading="lazy"` to off-screen images and iframes to defer bandwidth.
- **DO** specify `width` and `height` on all `<img>` tags to preserve aspect ratio and prevent Layout Shifts (CLS).
- **DO** use the `srcset` attribute on `<img>`s for adding multiple versions of the same image at different sizes.
- **DO** use the `<picture>` element with a fallback `<img>` for more fine-grained image control like switching between image formats, image sizes, and cropping images at different device sizes. 

- **DON'T** apply `loading="lazy"` to above-the-fold or hero images. This delays LCP.
- **DON'T** overuse `fetchpriority="high"`; prioritization is a zero-sum mechanism. Use `fetchpriority="low"` to demote non-critical trackers or carousel items.

### Code Example

```html
<!-- High-priority hero image with responsive sizes -->
<img 
  src="hero-large.webp" 
  srcset="hero-small.webp 480w, hero-medium.webp 800w, hero-large.webp 1200w"
  sizes="(max-width: 600px) 100vw, (max-width: 1200px) 80vw, 70vw"
  alt="Main product view" 
  fetchpriority="high" 
  width="1200" 
  height="600"
>

<!-- Art direction and format switching with <picture> -->
<picture>
  <!-- Mobile Art Direction: Different aspect ratio (square) and format (AVIF) -->
  <source 
    media="(max-width: 600px)" 
    srcset="hero-mobile.avif 1x, hero-mobile-2x.avif 2x" 
    type="image/avif"
    width="600" 
    height="600"
  >
  <source 
    media="(max-width: 600px)" 
    srcset="hero-mobile.webp 1x, hero-mobile-2x.webp 2x"
    width="600" 
    height="600"
  >
  
  <!-- Desktop: Modern format for primary layout -->
  <source srcset="hero-desktop.avif" type="image/avif">

  <!-- Fallback img defines the default aspect ratio (2:1) -->
  <img 
    src="hero-desktop.webp" 
    alt="Platform dashboard overview" 
    width="1200" 
    height="600"
    loading="lazy"
  >
</picture>

<!-- Low-priority decorative footer image -->
<img 
  src="footer-art.png" 
  alt="" 
  loading="lazy" 
  width="200" 
  height="100"
>
```

## 4. Native Overlays: Dialogs and Popovers

### Guidelines

See `declarative-dialog-popover-control` (via `npx -y modern-web-guidance@latest retrieve "declarative-dialog-popover-control"`) for more info on fallback strategies for using the Popover API in a cross-browser way.
- **DO** use `<dialog>` for modal overlays (requires JS `.showModal()`) to automatically trap focus, dim backgrounds, and support dismissing via `Esc`. Use the `closedby="any"` attribute to enable native "light-dismiss" (closing on backdrop click) without custom JavaScript.
- **DO** utilize the Popover API (`popover` attribute) for non-modal UI (menus, tooltips) that do not require focus traps.
- **DO** use `::backdrop` to style modal backgrounds.
- **DO** use `<form method="dialog">` to dismiss dialogs without manual JS handlers. Combined button `formmethod="dialog"` yields the button's value to the dialog `.returnValue`.

- **DON'T** use `show()` for modals where keyboard traps are expected (use `showModal()`).
- **DON'T** call `showModal()` on elements possessing a `popover` attribute (they are mutually exclusive programmatic states). However, `<dialog popover="auto">` is a valid declarative architecture to combine dialog semantics with light-dismiss mechanics.

### Code Example

```html
<!-- Popover (No JS required for toggle) -->
<button popovertarget="help-menu">Info</button>
<div id="help-menu" popover="auto">
  <p>Standard help text.</p>
</div>

<!-- Modal Dialog with Form-based closing -->
<button id="show-dialog">Open dialog</button>
<dialog id="fav-modal">
  <!-- method="dialog" closes the dialog natively and sets the returnValue -->
  <form method="dialog">
    <p>Confirm action?</p>
    <button value="cancel">Cancel</button>
    <button value="confirm">Confirm</button>
  </form>
</dialog>

<script>
  const dialog = document.getElementById("fav-modal");
  const openModal = document.getElementById("show-dialog");
  
  // Show modal dialog
  openModal.addEventListener('click', () => dialog.showModal());
  
  // Listen for the 'close' event to retrieve the user's choice (returnValue)
  dialog.addEventListener('close', () => {
    console.log(dialog.returnValue); // "confirm" or "cancel"
  });
</script>
```

### Native UI Overlay & Disclosure Matrix

| Feature | Modality | Focus | Dismiss Mechanism | Use Case |
| :--- | :--- | :--- | :--- | :--- |
| **`<dialog>`** | Modal / Non-modal | Automatic trap (Modal) | Esc / Form / `closedby` | Critical Actions, Settings |
| **`[popover]`** | Non-modal | Standard Tab flow | Light-dismiss (Click outside) | Menus, Tooltips, Toasts |
| **`<details>`** | Inline Disclosure | Standard Tab flow | Toggle summary | Accordions, FAQs |

**Heuristic Rule**: Use `<dialog>` for interruptions requiring user action, `popover` for transient info, and `<details>` for inline content expansion.

## 5. Disclosures: Details and Summary

### Guidelines

- **DO** use `<details>` and `<summary>` for native accordions or revealable content without JS.
- **DO** place `<summary>` as the *first* child of `<details>`.
- If headings must be used within a `<summary>`, consider if the heading is essential for understanding or navigating the document structure. If it is, use a more robust disclosure approach that allows wrapping the disclosure trigger with the heading (e.g. `<h2><button type="button" aria-expanded="false" aria-controls="significant-section-content">Significant section</button></h2>`). This ensures the heading semantics aren’t lost, and the button and its state are announced.
- **DO** use `details[open]` attribute for styling expanded states.
- **DO** use `details::details-content` for styling the contents of the `<details>` element.
- **DO** use the `name` attribute on multiple `<details>` elements to create exclusive accordions (opening one closes others).

- **DON'T** nest other interactive elements (links, buttons) directly inside `<summary>` text as it acts as a button and breaks focus.
- **DON'T** hide visible triangles via `list-style: none` without providing explicit directional cues (via `::before`/`::after` pseudo-elements).
- **DON'T** use the `title` attribute to create tooltip effects. 

### Code Example

```html
<!-- Exclusive Accordion Set -->
<details name="faq">
  <summary>Item 1</summary>
  <p>Contents...</p>
</details>
<details name="faq">
  <summary>Item 2</summary>
  <p>Contents...</p>
</details>
```

## 6. Focus Boundaries and Visibility

### Guidelines

- **DO** use the global `inert` attribute for entire hidden sections (off-screen menus, background while custom modal is open) to remove them from tab flows and accessibility trees.
- **DO** pair `[inert]` with CSS (`opacity: 0.5`) to visually signify inactivity.
- **DO** rely on natural DOM order for sequential navigation. 

- **DON'T** use positive `tabindex` values (e.g., `1`, `2`). Use `0` to add element to tab flow, or `-1` for JS program focus.
- **DON'T** alter focus flow using CSS properties (`flex-flow: row-reverse`, `order`) without aligning the DOM structure.
- **DON'T** use `node.focus({ preventScroll: true })` without usability validation; it can hide the focused element off-screen.

### Code Example

```html
<!-- De-tabbing a background app shell while custom drawer is open -->
<main id="app-shell" inert>
  <a href="/">Dashboard</a>
</main>
<aside id="drawer">
  <button>Close</button>
</aside>
```

```css
[inert], [inert] * {
  opacity: 0.5;
  cursor: default;
  user-select: none;
}
```

## 7. HTML APIs and Forms Grouping

### Guidelines

See `forms` (via `npx -y modern-web-guidance@latest retrieve "forms"`) for more details on creating modern web forms.

- **DO** utilize the `form="form-id"` attribute to decouple inputs from the physical `<form>` tree.
- **DO** use `<datalist>` coupled with `<input list="id">` for lightweight auto-suggestions (note: visually unstylable and has screen-reader quirks). 
- **DON'T** use `autocomplete="off"` on credential, address, payment, or contact fields. Browsers and password managers ignore it there by design. Use a specific token instead (`autocomplete="email"`, `"street-address"`, `"cc-number"`, etc.).
- **DON'T** use `autocomplete="off"` unless handling highly sensitive tracking tokens (violates standard password manager overrides). Use standard inputs `type="email"`, `type="tel"`.
- **DO** distinguish `autocomplete="current-password"` (sign-in) from `autocomplete="new-password"` (registration / password change) so password managers offer the right action.                                                    
- **DO** match `autocomplete` tokens with appropriate `inputmode` and `type` (`type="email"` + `inputmode="email"` + `autocomplete="email"`). They control different things — keyboard, validation, and autofill respectively — and reinforce each other.

### Code Example

```html
<form>
  <fieldset>
    <legend>Address Information</legend>
    <label for="city">City:</label>
    <input type="text" id="city" list="cities" autocomplete="address-level2">
    <datalist id="cities">
      <option value="New York">
      <option value="London">
    </datalist>
  </fieldset>
</form>
```

## 8. Native Media Elements

### Guidelines

- **DO** set `width` and `height` to prevent layout shifts (CLS) on `<video>` elements.
- **DO** provide a `poster` image fallback for videos.
- **DO** include subtitles and captions with `<track>`.
- **DO** ensure background videos are `muted`, provide users with full control over playback, and use `role="none"` or `aria-hidden="true"`. The `controls` attribute must also be omitted to make sure the video is not focusable.  

- **DON'T** rely on JS for basic video controls if native `controls` attribute is sufficient.
- **DON'T** apply `role="none"` or `aria-hidden="true"` to focusable elements (such as embedded interactive `<iframe>` components). Hiding elements from the assistive technology tree while leaving them accessible to sequential keyboard navigation violates core accessibility heuristics. The background video exception holds solely because omitting the `controls` attribute renders the `<video>` element fully non-focusable.

### Code Example

```html
<video 
  controls 
  width="800" 
  height="450" 
  poster="poster.webp"
>
  <source src="intro.webm" type="video/webm">
  <source src="intro.mp4" type="video/mp4">
  <track src="caps.vtt" kind="captions" srclang="en" label="English">
</video>
```

## 9. Dynamic Styles and Interactivity

### Guidelines
- **DO** use the `style` attribute to pass state to CSS via **Custom Properties**. This keeps visual logic in your stylesheet while JavaScript provides the raw data.

- **DON'T** use inline styles for static design (colors, padding, margins) that belong in a stylesheet.
- **DON'T** use inline event handlers (e.g., `onclick`). Trigger actions using `addEventListener()`.

### Code Example

```html
<body>
  <!-- Progress with style-driven color data -->
  <label for="upload-progress">Upload status:</label>
  <progress id="upload-progress" class="loading-bar" value="0" max="100" style="--brand-hue: 200;"></progress>

  <script>
    const updateProgress = (percent, hue) => {
      const bar = document.querySelector('.loading-bar');
      bar.value = percent;
      
      // Update dynamic style variable 
      if (hue) bar.style.setProperty('--brand-hue', hue);
    };

    // Example: Move to 85% and shift color to green (120)
    setTimeout(() => updateProgress(85, 120), 1000);
  </script>
</body>
```
```css
.loading-bar {
  accent-color: hsl(var(--brand-hue, 200) 80% 50%);
  transition: accent-color 0.3s ease;
}
```


--- Guide for animate-to-from-top-layer ---
Elements that render in the "top layer" (like `<dialog>`, elements with the `popover` attribute, or tooltips) have historically been difficult to animate because they toggle between `display: none` and a visible state. Modern CSS provides `@starting-style`, `transition-behavior: allow-discrete`, and the `overlay` property to enable smooth entry and exit transitions for these elements. Note that native CSS nesting is used in the examples below.

## Implementation

### 1. Enable Discrete Transitions

To animate the `display` property, you must set `transition-behavior: allow-discrete`. This allows the element to remain visible during its exit transition. If using transition shorthands, be sure to place the `transition-behavior: allow-discrete` afterwards to prevent the shorthand from negating it.

### 2. The `overlay` Property

When an element moves in or out of the top layer, it must transition the `overlay` property. This ensures the element stays in the top layer for the duration of the animation, preventing it from being clipped by other elements or the viewport prematurely.

### 3. Entry Animations with `@starting-style`

Use the `@starting-style` at-rule to define the styles an element should transition *from* when it is first rendered or its `display` changes from `none`.

### 4. Animating the Backdrop

The `::backdrop` pseudo-element can be animated similarly by applying transitions to its own properties.

## Example

```css
/* 1. Define the visible (open) state */
dialog[open],
[popover]:popover-open {
  opacity: 1;
  transform: scale(1);

  /* 2. Define the starting state for entry (must come after open state) */
  @starting-style {
    opacity: 0;
    transform: scale(0.9);
  }
}

/* 3. Define the base (closed/exit) state and transitions */
dialog,
[popover] {
  opacity: 0;
  transform: scale(0.9);

  /* MANDATORY: transition display and overlay for top-layer elements */
  transition-property: opacity, transform, display, overlay;
  transition-duration: 0.3s;
  transition-timing-function: ease-out;
  /* Applies to discrete properties like display and overlay */
  transition-behavior: allow-discrete; /* Note: be sure to write this after the shorthand */
}

/* 4. Animate the backdrop */
dialog::backdrop,
[popover]::backdrop {
  background-color: rgba(0, 0, 0, 0);
  /* The transition shorthand can also be used with allow-discrete */
  transition:
    display 0.3s allow-discrete,
    overlay 0.3s allow-discrete,
    background-color 0.3s ease-out;
}

dialog[open]::backdrop,
[popover]:popover-open::backdrop {
  background-color: rgba(0, 0, 0, 0.5);

  @starting-style {
    background-color: rgba(0, 0, 0, 0);
  }
}

/* 5. Respect user preference for reduced motion */
@media (prefers-reduced-motion: reduce) {
  dialog,
  [popover] {
    /* Disable movement and shorten duration for a simple fade */
    transform: none;
    transition-duration: 0.1s;
  }

  @starting-style {
    dialog[open],
    [popover]:popover-open {
      transform: none;
    }
  }
}
```

## Constraints & Accessibility

- **MANDATORY**: Include `overlay` in your `transition` list for any element moving into or out of the top layer.
- **MANDATORY**: Use `allow-discrete` for the `display` property transition.
- **MANDATORY**: Respect user preferences for reduced motion using `prefers-reduced-motion` by simplifying transitions (e.g., removing transforms and shortening duration).
- **DO**: Place the `@starting-style` block inside or after the "open" state selector to ensure proper cascading.
- **DO NOT**: Use `@starting-style` for exit animations; exit animations are defined by the transition to the base (closed) state.

## Fallback strategies

#### Top-layer animation features

Baseline status for @starting-style: Newly available. It's been Baseline since 2024-08-06.
Supported by: Chrome 117 (Sep 2023), Edge 117 (Sep 2023), Firefox 129 (Aug 2024), and Safari 17.5 (May 2024).
Baseline status for transition-behavior: Newly available. It's been Baseline since 2024-08-06.
Supported by: Chrome 117 (Sep 2023), Edge 117 (Sep 2023), Firefox 129 (Aug 2024), and Safari 17.4 (Mar 2024).
overlay has limited availability.
Supported by: Chrome 117 (Sep 2023) and Edge 117 (Sep 2023).
Unsupported in: Firefox and Safari.

For browsers that do not support these features, top-layer elements will appear and disappear instantly. To provide animations in older browsers, you must use JavaScript to coordinate classes and wait for `transitionend` events or use the Web Animations API.

```javascript
// Feature detection for top-layer animations
const supportsTopLayerAnimation =
  window.CSS &&
  CSS.supports('transition-behavior', 'allow-discrete') &&
  CSS.supports('overlay', 'auto');

if (!supportsTopLayerAnimation) {
  // Manual JS fallback for entry/exit animations:
  // 1. Add an `.is-opening` class for entry.
  // 2. On close, add an `.is-closing` class, wait for the `transitionend` event, then call .close() or hide the popover.
}
```

#### popover

Baseline status for Popover: Newly available. It's been Baseline since 2025-01-27.
Supported by: Chrome 116 (Aug 2023), Edge 116 (Aug 2023), Firefox 125 (Apr 2024), Safari 17 (Sep 2023), and Safari iOS 18.3 (Jan 2025).

If the browser does not support Popover, use the `@oddbird/popover-polyfill`:

```html
<script type="module">
  if (!HTMLElement.prototype.hasOwnProperty('popover')) {
    await import('https://unpkg.com/@oddbird/popover-polyfill');
  }
</script>
```

Alternatively, for legacy support without a polyfill, use `position: fixed` and manually calculate coordinates via JavaScript `getBoundingClientRect()`.

