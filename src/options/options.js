(function initOptions(global) {
  "use strict";

  const browserApi = global.browser;
  const core = global.TabSwitcherCore;
  const form = document.getElementById("options-form");
  const mainShortcut = document.getElementById("main-shortcut");
  const searchKey = document.getElementById("search-key");
  const captureTextInputShortcut = document.getElementById("capture-text-input-shortcut");
  const enableVimNavigation = document.getElementById("enable-vim-navigation");
  const tabScope = document.getElementById("tab-scope");
  const displayMode = document.getElementById("display-mode");
  const scrollSensitivity = document.getElementById("scroll-sensitivity");
  const scrollSensitivityValue = document.getElementById("scroll-sensitivity-value");
  const density = document.getElementById("density");
  const theme = document.getElementById("theme");
  const status = document.getElementById("status");
  const shortcutSettings = document.getElementById("shortcut-settings");

  async function init() {
    const stored = await browserApi.storage.local.get(core.DEFAULT_OPTIONS);
    const options = core.normalizeOptions(stored);
    searchKey.value = options.searchKey;
    captureTextInputShortcut.checked = options.captureTextInputShortcut;
    enableVimNavigation.checked = options.enableVimNavigation;
    tabScope.value = options.tabScope;
    displayMode.value = options.displayMode;
    scrollSensitivity.value = options.scrollSensitivity;
    updateScrollSensitivityLabel();
    density.value = options.density;
    theme.value = options.theme;

    const commands = await browserApi.commands.getAll();
    const command = commands.find((item) => item.name === "open-switcher");
    mainShortcut.value = command && command.shortcut ? command.shortcut : options.mainShortcut;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const options = core.normalizeOptions({
      searchKey: searchKey.value,
      mainShortcut: mainShortcut.value,
      captureTextInputShortcut: captureTextInputShortcut.checked,
      enableVimNavigation: enableVimNavigation.checked,
      tabScope: tabScope.value,
      displayMode: displayMode.value,
      scrollSensitivity: scrollSensitivity.value,
      density: density.value,
      theme: theme.value
    });

    const previewPermissionGranted = await ensurePreviewPermission(options.displayMode);
    await browserApi.storage.local.set(options);

    if (options.mainShortcut) {
      try {
        await browserApi.commands.update({
          name: "open-switcher",
          shortcut: options.mainShortcut
        });
      } catch (error) {
        setStatus(`Options saved, but Firefox rejected that shortcut: ${error.message}`);
        return;
      }
    }

    try {
      await browserApi.commands.update({
        name: "enter-search",
        shortcut: core.searchKeyToShortcut(options.searchKey)
      });
    } catch (error) {
      setStatus(`Options saved, but Firefox rejected the search shortcut: ${error.message}`);
      return;
    }

    setStatus(previewPermissionGranted === false
      ? "Options saved. Live previews need all-sites permission before screenshots can appear."
      : "Options saved.");
  });

  scrollSensitivity.addEventListener("input", updateScrollSensitivityLabel);

  function updateScrollSensitivityLabel() {
    const value = core.normalizeScrollSensitivity(scrollSensitivity.value);
    scrollSensitivity.value = value;
    scrollSensitivityValue.textContent = String(value);
  }

  async function ensurePreviewPermission(displayModeValue) {
    if (displayModeValue !== "preview" || !browserApi.permissions || !browserApi.permissions.request) {
      return null;
    }

    const alreadyGranted = await browserApi.permissions
      .contains({ origins: ["<all_urls>"] })
      .catch(() => false);
    if (alreadyGranted) {
      return true;
    }

    return browserApi.permissions
      .request({ origins: ["<all_urls>"] })
      .catch(() => false);
  }

  shortcutSettings.addEventListener("click", () => {
    if (browserApi.commands.openShortcutSettings) {
      browserApi.commands.openShortcutSettings();
    } else {
      browserApi.tabs.create({ url: "about:addons" });
    }
  });

  function setStatus(message) {
    status.textContent = message;
    setTimeout(() => {
      if (status.textContent === message) {
        status.textContent = "";
      }
    }, 4000);
  }

  init().catch((error) => setStatus(`Unable to load options: ${error.message}`));
})(typeof globalThis !== "undefined" ? globalThis : this);
