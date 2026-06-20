# Changelog

This changelog tracks the recent updates and features added to the BigQuery Release Notes Explorer application.

| Date | Version | Type | Description | Files Affected |
| :--- | :--- | :--- | :--- | :--- |
| 2026-06-19 | `v1.2.0` | ✨ Feature | Implemented modern dark/light mode toggle switch widget in the header. | [index.html](../templates/index.html), [app.js](../static/js/app.js), [style.css](../static/css/style.css) |
| 2026-06-19 | `v1.1.0` | ✨ Feature | Added **Copy to Clipboard** and **Export to CSV** utility functions. | [index.html](../templates/index.html), [app.js](../static/js/app.js), [style.css](../static/css/style.css) |
| 2026-06-19 | `v1.0.0` | 🎉 Release | Initial application launch with Flask RSS parser, layout templates, filters, and sharing. | All project files |

---

## Detailed Version Breakdown

### `v1.2.0` — Modern Theme Toggle Switch (Recent Change)
Replaced the basic icon-only theme button in the header with a modern slider/pill toggle switch.
* **Slider Switch UI**: Implemented a CSS custom switch styled with a glassmorphic background that transitions between light/dark presets.
* **Rotating Thumb Icons**: The circular knob contains both Sun and Moon SVGs, rotating ($90^\circ$) and cross-fading smoothly as it transitions between states.
* **Persistent Event Wiring**: Wired the checkbox to a `change` event listener in [app.js](../static/js/app.js) and synced page state automatically on DOM content load.
* **Accessibility**: Added standard outline indicators using `:focus-visible` and disabled animations for users with `prefers-reduced-motion` enabled.

### `v1.1.0` — Card Utilities & CSV Data Exporter
Added helper buttons to increase utility of the feed viewer cards.
* **Copy to Clipboard**: Added a "Copy" button to each feed card. When clicked, it copies the parsed, clean text content directly into the clipboard using `navigator.clipboard.writeText` and flashes a green checkmark visual feedback for 2 seconds.
* **Export to CSV**: Introduced an "Export CSV" button in the header. Clicking this converts the currently visible (filtered) release notes list to CSV format, handles quote-escaping, adds a UTF-8 BOM byte marker so Microsoft Excel reads special characters correctly, and generates a timestamped browser download.

> [!NOTE]
> All changes are pushed and tracked in the remote Git repository main branch.
