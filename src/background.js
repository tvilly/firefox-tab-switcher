(function initBackground(global) {
  "use strict";

  const browserApi = global.browser;
  const core = global.TabSwitcherCore;
  const OPEN_COMMAND = "open-switcher";
  const SEARCH_COMMAND = "enter-search";
  const OVERLAY_FILES = ["shared/core.js", "content/overlay.js"];
  const OVERLAY_CSS = ["content/overlay.css"];
  let activeOverlay = null;
  let lastContentShortcutAt = 0;
  let lastCommandShortcutAt = 0;

  async function getOptions() {
    const stored = await browserApi.storage.local.get(core.DEFAULT_OPTIONS);
    return core.normalizeOptions(stored);
  }

  async function collectTabs(options, activeTabId) {
    const query = options.tabScope === "allWindows" ? {} : { currentWindow: true };
    const tabs = await browserApi.tabs.query(query);
    const sortedTabs = core.sortTabsByMostRecent(tabs).map(core.toSwitcherTab);
    return core.prioritizeActiveTab(sortedTabs, activeTabId);
  }

  async function getActiveTab() {
    const [tab] = await browserApi.tabs.query({ active: true, currentWindow: true });
    return tab || null;
  }

  async function activateTab(tabId, windowId) {
    if (Number.isInteger(windowId)) {
      await browserApi.windows.update(windowId, { focused: true }).catch(() => undefined);
    }
    await browserApi.tabs.update(tabId, { active: true });
  }

  async function injectOverlay(tabId) {
    await browserApi.scripting.insertCSS({
      target: { tabId },
      files: OVERLAY_CSS
    });
    await browserApi.scripting.executeScript({
      target: { tabId },
      files: OVERLAY_FILES
    });
  }

  async function openPopupFallback(windowId) {
    if (browserApi.action && browserApi.action.openPopup) {
      try {
        await browserApi.action.openPopup({ windowId });
        return;
      } catch {
        try {
          await browserApi.action.openPopup();
          return;
        } catch {
          await browserApi.tabs.create({ url: browserApi.runtime.getURL("popup/popup.html") });
        }
      }
    }
  }

  async function sendOverlayMessage(tabId, message) {
    await browserApi.tabs.sendMessage(tabId, message);
  }

  async function captureTabPreview(tabId) {
    const hasPermission = await browserApi.permissions
      .contains({ origins: ["<all_urls>"] })
      .catch(() => false);

    if (!hasPermission) {
      return { ok: false, reason: "permission" };
    }

    try {
      const dataUrl = await browserApi.tabs.captureTab(tabId, {
        format: "jpeg",
        quality: 45
      });
      return { ok: true, dataUrl };
    } catch (error) {
      return {
        ok: false,
        reason: "capture",
        message: error && error.message ? error.message : "Unable to capture preview"
      };
    }
  }

  async function startSwitcher(source) {
    const activeTab = await getActiveTab();
    if (!activeTab || !Number.isInteger(activeTab.id)) {
      return;
    }

    const options = await getOptions();
    const tabs = await collectTabs(options, activeTab.id);
    const payload = {
      type: "mru-switcher:open-or-cycle",
      source,
      options,
      originalTabId: activeTab.id,
      originalWindowId: activeTab.windowId,
      selectedIndex: core.initialSelectedIndex(tabs),
      enterSearch: source === "search-command",
      tabs
    };

    try {
      await injectOverlay(activeTab.id);
      await sendOverlayMessage(activeTab.id, payload);
      activeOverlay = {
        tabId: activeTab.id,
        windowId: activeTab.windowId
      };
    } catch (error) {
      activeOverlay = null;
      await browserApi.storage.session.set({ fallbackPayload: payload }).catch(() => undefined);
      await openPopupFallback(activeTab.windowId);
    }
  }

  async function enterSearchFromCommand() {
    const activeTab = await getActiveTab();
    if (activeTab && activeOverlay && activeOverlay.tabId === activeTab.id) {
      try {
        await sendOverlayMessage(activeTab.id, { type: "mru-switcher:enter-search" });
        return;
      } catch {
        activeOverlay = null;
      }
    }

    await startSwitcher("search-command");
  }

  browserApi.commands.onCommand.addListener((command) => {
    if (command === OPEN_COMMAND) {
      lastCommandShortcutAt = Date.now();
      if (lastCommandShortcutAt - lastContentShortcutAt < 120) {
        return;
      }
      startSwitcher("command").catch((error) => console.error("Unable to open Quick Tab Switcher", error));
    } else if (command === SEARCH_COMMAND) {
      enterSearchFromCommand().catch((error) => console.error("Unable to search Quick Tab Switcher tabs", error));
    }
  });

  browserApi.runtime.onMessage.addListener((message, sender) => {
    if (!message || typeof message !== "object") {
      return undefined;
    }

    if (message.type === "mru-switcher:activate" && Number.isInteger(message.tabId)) {
      return activateTab(message.tabId, message.windowId);
    }

    if (message.type === "mru-switcher:open-from-popup") {
      return startSwitcher("popup");
    }

    if (message.type === "mru-switcher:get-fallback") {
      return browserApi.storage.session.get("fallbackPayload").then((result) => result.fallbackPayload || null);
    }

    if (message.type === "mru-switcher:clear-fallback") {
      return browserApi.storage.session.remove("fallbackPayload");
    }

    if (message.type === "mru-switcher:get-preview" && Number.isInteger(message.tabId)) {
      return captureTabPreview(message.tabId);
    }

    if (message.type === "mru-switcher:content-shortcut") {
      lastContentShortcutAt = Date.now();
      if (lastContentShortcutAt - lastCommandShortcutAt < 120) {
        return undefined;
      }
      return startSwitcher("content-shortcut");
    }

    if (message.type === "mru-switcher:closed") {
      const senderTabId = sender && sender.tab ? sender.tab.id : null;
      if (!senderTabId || !activeOverlay || activeOverlay.tabId === senderTabId) {
        activeOverlay = null;
      }
      return undefined;
    }

    return undefined;
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
