(function initShortcutListener(global) {
  "use strict";

  const browserApi = global.browser;
  const core = global.TabSwitcherCore;
  let options = core.normalizeOptions();

  function loadOptions() {
    browserApi.storage.local
      .get(core.DEFAULT_OPTIONS)
      .then((stored) => {
        options = core.normalizeOptions(stored);
      })
      .catch(() => {
        options = core.normalizeOptions();
      });
  }

  function isEditableTarget(target) {
    if (!target || target.nodeType !== Node.ELEMENT_NODE) {
      return false;
    }

    const element = target;
    if (element.isContentEditable) {
      return true;
    }

    const tagName = element.tagName ? element.tagName.toLowerCase() : "";
    if (tagName === "textarea") {
      return true;
    }

    if (tagName !== "input") {
      return false;
    }

    const type = (element.getAttribute("type") || "text").toLowerCase();
    return ![
      "button",
      "checkbox",
      "color",
      "file",
      "hidden",
      "image",
      "radio",
      "range",
      "reset",
      "submit"
    ].includes(type);
  }

  function handleKeyDown(event) {
    if (!options.captureTextInputShortcut || !isEditableTarget(event.target)) {
      return;
    }

    if (!core.eventMatchesShortcut(event, options.mainShortcut)) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    browserApi.runtime.sendMessage({ type: "mru-switcher:content-shortcut" }).catch(() => undefined);
  }

  browserApi.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") {
      return;
    }

    if (
      changes.mainShortcut
      || changes.captureTextInputShortcut
      || changes.enableVimNavigation
      || changes.displayMode
      || changes.searchKey
      || changes.tabScope
      || changes.theme
      || changes.density
    ) {
      loadOptions();
    }
  });

  document.addEventListener("keydown", handleKeyDown, true);
  loadOptions();
})(typeof globalThis !== "undefined" ? globalThis : this);
