(function initOptions(global) {
  "use strict";

  const browserApi = global.browser;
  const core = global.TabSwitcherCore;
  const form = document.getElementById("options-form");
  const mainShortcut = document.getElementById("main-shortcut");
  const searchKey = document.getElementById("search-key");
  const captureTextInputShortcut = document.getElementById("capture-text-input-shortcut");
  const tabScope = document.getElementById("tab-scope");
  const density = document.getElementById("density");
  const theme = document.getElementById("theme");
  const status = document.getElementById("status");
  const shortcutSettings = document.getElementById("shortcut-settings");

  async function init() {
    const stored = await browserApi.storage.local.get(core.DEFAULT_OPTIONS);
    const options = core.normalizeOptions(stored);
    searchKey.value = options.searchKey;
    captureTextInputShortcut.checked = options.captureTextInputShortcut;
    tabScope.value = options.tabScope;
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
      tabScope: tabScope.value,
      density: density.value,
      theme: theme.value
    });

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

    setStatus("Options saved.");
  });

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
