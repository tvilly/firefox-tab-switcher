(function initTabSwitcherCore(global) {
  "use strict";

  const DEFAULT_OPTIONS = Object.freeze({
    mainShortcut: "Alt+Q",
    searchKey: "s",
    captureTextInputShortcut: false,
    enableVimNavigation: false,
    tabScope: "currentWindow",
    theme: "system",
    density: "comfortable"
  });

  const VALID_THEMES = new Set(["system", "light", "dark"]);
  const VALID_DENSITIES = new Set(["comfortable", "compact"]);
  const VALID_TAB_SCOPES = new Set(["currentWindow", "allWindows"]);

  function normalizeOptions(input) {
    const source = input && typeof input === "object" ? input : {};
    const mainShortcut = normalizeMainShortcut(source.mainShortcut);
    const searchKey = normalizeSearchKey(source.searchKey);
    const captureTextInputShortcut = source.captureTextInputShortcut === true;
    const enableVimNavigation = source.enableVimNavigation === true;
    const tabScope = VALID_TAB_SCOPES.has(source.tabScope) ? source.tabScope : DEFAULT_OPTIONS.tabScope;
    const theme = VALID_THEMES.has(source.theme) ? source.theme : DEFAULT_OPTIONS.theme;
    const density = VALID_DENSITIES.has(source.density) ? source.density : DEFAULT_OPTIONS.density;

    return { mainShortcut, searchKey, captureTextInputShortcut, enableVimNavigation, tabScope, theme, density };
  }

  function normalizeSearchKey(value) {
    if (typeof value !== "string") {
      return DEFAULT_OPTIONS.searchKey;
    }

    const trimmed = value.trim();
    if (/^[a-z0-9]$/i.test(trimmed)) {
      return trimmed.toLowerCase();
    }

    return DEFAULT_OPTIONS.searchKey;
  }

  function searchKeyToShortcut(value) {
    const searchKey = normalizeSearchKey(value);
    return `Alt+${searchKey.toUpperCase()}`;
  }

  function normalizeMainShortcut(value) {
    if (typeof value !== "string") {
      return DEFAULT_OPTIONS.mainShortcut;
    }

    const descriptor = parseShortcut(value);
    if (!descriptor) {
      return DEFAULT_OPTIONS.mainShortcut;
    }

    return descriptorToShortcut(descriptor);
  }

  function parseShortcut(value) {
    if (typeof value !== "string") {
      return null;
    }

    const parts = value
      .split("+")
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length < 2) {
      return null;
    }

    const descriptor = {
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      key: ""
    };

    const key = parts.pop();
    for (const part of parts) {
      const normalized = part.toLowerCase();
      if (normalized === "alt" || normalized === "option") {
        descriptor.altKey = true;
      } else if (normalized === "ctrl" || normalized === "control") {
        descriptor.ctrlKey = true;
      } else if (normalized === "command" || normalized === "cmd" || normalized === "meta" || normalized === "macctrl") {
        descriptor.metaKey = true;
      } else if (normalized === "shift") {
        descriptor.shiftKey = true;
      } else {
        return null;
      }
    }

    if (/^[a-z0-9]$/i.test(key)) {
      descriptor.key = key.toUpperCase();
      return descriptor;
    }

    return null;
  }

  function descriptorToShortcut(descriptor) {
    const parts = [];
    if (descriptor.ctrlKey) {
      parts.push("Ctrl");
    }
    if (descriptor.altKey) {
      parts.push("Alt");
    }
    if (descriptor.shiftKey) {
      parts.push("Shift");
    }
    if (descriptor.metaKey) {
      parts.push("Command");
    }
    parts.push(descriptor.key.toUpperCase());
    return parts.join("+");
  }

  function eventMatchesShortcut(event, shortcut) {
    const descriptor = parseShortcut(shortcut);
    if (!descriptor || !event) {
      return false;
    }

    return Boolean(event.altKey) === descriptor.altKey
      && Boolean(event.ctrlKey) === descriptor.ctrlKey
      && Boolean(event.metaKey) === descriptor.metaKey
      && Boolean(event.shiftKey) === descriptor.shiftKey
      && eventMatchesKey(event, descriptor.key);
  }

  function eventMatchesKey(event, key) {
    if (event.key && event.key.length === 1 && event.key.toUpperCase() === key) {
      return true;
    }

    if (/^[A-Z]$/.test(key)) {
      return event.code === `Key${key}`;
    }

    if (/^[0-9]$/.test(key)) {
      return event.code === `Digit${key}`;
    }

    return false;
  }

  function isUsableTab(tab) {
    return Boolean(tab && Number.isInteger(tab.id) && tab.id >= 0 && tab.hidden !== true);
  }

  function sortTabsByMostRecent(tabs) {
    return (Array.isArray(tabs) ? tabs : [])
      .filter(isUsableTab)
      .slice()
      .sort((left, right) => {
        const rightAccessed = Number.isFinite(right.lastAccessed) ? right.lastAccessed : 0;
        const leftAccessed = Number.isFinite(left.lastAccessed) ? left.lastAccessed : 0;
        if (rightAccessed !== leftAccessed) {
          return rightAccessed - leftAccessed;
        }
        return (left.index || 0) - (right.index || 0);
      });
  }

  function initialSelectedIndex(tabs) {
    return tabs.length > 1 ? 1 : 0;
  }

  function prioritizeActiveTab(tabs, activeTabId) {
    if (!Array.isArray(tabs) || !Number.isInteger(activeTabId)) {
      return Array.isArray(tabs) ? tabs.slice() : [];
    }

    const activeIndex = tabs.findIndex((tab) => tab.id === activeTabId);
    if (activeIndex <= 0) {
      return tabs.slice();
    }

    const orderedTabs = tabs.slice();
    const [activeTab] = orderedTabs.splice(activeIndex, 1);
    orderedTabs.unshift(activeTab);
    return orderedTabs;
  }

  function wrapIndex(index, length) {
    if (!length) {
      return -1;
    }
    return ((index % length) + length) % length;
  }

  function moveSelection(currentIndex, delta, length) {
    if (!length) {
      return -1;
    }
    const startIndex = Number.isInteger(currentIndex) ? currentIndex : 0;
    return wrapIndex(startIndex + delta, length);
  }

  function tabSearchText(tab) {
    return `${tab.title || ""} ${tab.url || ""}`.toLowerCase();
  }

  function filterTabs(tabs, query) {
    const normalizedQuery = typeof query === "string" ? query.trim().toLowerCase() : "";
    if (!normalizedQuery) {
      return Array.isArray(tabs) ? tabs.slice() : [];
    }

    const terms = normalizedQuery.split(/\s+/).filter(Boolean);
    return (Array.isArray(tabs) ? tabs : []).filter((tab) => {
      const haystack = tabSearchText(tab);
      return terms.every((term) => haystack.includes(term));
    });
  }

  function toSwitcherTab(tab) {
    return {
      id: tab.id,
      windowId: tab.windowId,
      title: tab.title || "Untitled",
      url: tab.url || "",
      favIconUrl: tab.favIconUrl || "",
      active: Boolean(tab.active),
      discarded: Boolean(tab.discarded),
      index: Number.isInteger(tab.index) ? tab.index : 0,
      lastAccessed: Number.isFinite(tab.lastAccessed) ? tab.lastAccessed : 0
    };
  }

  const api = {
    DEFAULT_OPTIONS,
    filterTabs,
    eventMatchesShortcut,
    initialSelectedIndex,
    moveSelection,
    normalizeMainShortcut,
    normalizeOptions,
    normalizeSearchKey,
    prioritizeActiveTab,
    searchKeyToShortcut,
    sortTabsByMostRecent,
    toSwitcherTab,
    wrapIndex
  };

  global.TabSwitcherCore = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
