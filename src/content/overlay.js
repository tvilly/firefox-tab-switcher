(function initOverlay(global) {
  "use strict";

  if (global.__mruTabSwitcherOverlay) {
    return;
  }

  const browserApi = global.browser;
  const core = global.TabSwitcherCore;
  const state = {
    allTabs: [],
    visibleTabs: [],
    selectedIndex: 0,
    searchMode: false,
    query: "",
    options: core.normalizeOptions(),
    root: null,
    list: null,
    searchWrap: null,
    searchInput: null,
    count: null,
    previewPane: null,
    previewImage: null,
    previewFallback: null,
    previewCache: new Map(),
    previewRequestId: 0,
    lastMouseX: null,
    lastMouseY: null,
    originalTabId: null,
    modifierReleased: false,
    wheelRemainder: 0,
    isOpen: false
  };

  function start(payload) {
    state.allTabs = Array.isArray(payload.tabs) ? payload.tabs : [];
    state.visibleTabs = state.allTabs.slice();
    state.selectedIndex = core.wrapIndex(payload.selectedIndex || 0, state.visibleTabs.length);
    state.options = core.normalizeOptions(payload.options);
    state.originalTabId = payload.originalTabId;
    state.query = "";
    state.searchMode = Boolean(payload.enterSearch);
    state.modifierReleased = false;
    state.isOpen = true;
    state.previewCache.clear();
    state.previewRequestId += 1;

    ensureDom();
    render();
    state.root.hidden = false;
    state.root.focus({ preventScroll: true });
  }

  function openOrCycle(payload) {
    if (state.root && state.isOpen && !state.root.hidden) {
      move(1);
      return;
    }

    start(payload);
  }

  function ensureDom() {
    if (state.root) {
      return;
    }

    const root = document.createElement("section");
    root.id = "mru-tab-switcher";
    root.className = "mru-tab-switcher";
    root.tabIndex = -1;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "Quick Tab Switcher");
    root.hidden = true;
    const panel = document.createElement("div");
    panel.className = "mru-tab-switcher__panel";

    const header = document.createElement("div");
    header.className = "mru-tab-switcher__header";

    const title = document.createElement("div");
    title.className = "mru-tab-switcher__title";
    title.textContent = "Switch tabs";

    const count = document.createElement("div");
    count.className = "mru-tab-switcher__count";

    const searchWrap = document.createElement("label");
    searchWrap.className = "mru-tab-switcher__search";
    searchWrap.hidden = true;

    const searchLabel = document.createElement("span");
    searchLabel.textContent = "Search";

    const searchInput = document.createElement("input");
    searchInput.type = "search";
    searchInput.autocomplete = "off";
    searchInput.spellcheck = false;

    const list = document.createElement("ol");
    list.className = "mru-tab-switcher__list";
    list.setAttribute("role", "listbox");

    const body = document.createElement("div");
    body.className = "mru-tab-switcher__body";

    const previewPane = document.createElement("aside");
    previewPane.className = "mru-tab-switcher__preview";
    previewPane.setAttribute("aria-label", "Tab preview");

    const previewFrame = document.createElement("div");
    previewFrame.className = "mru-tab-switcher__preview-frame";

    const previewImage = document.createElement("img");
    previewImage.className = "mru-tab-switcher__preview-image";
    previewImage.alt = "";
    previewImage.hidden = true;

    const previewFallback = document.createElement("div");
    previewFallback.className = "mru-tab-switcher__preview-fallback";
    previewFallback.textContent = "Preview unavailable";

    previewFrame.append(previewImage, previewFallback);
    previewPane.append(previewFrame);
    body.append(list, previewPane);

    header.append(title, count);
    searchWrap.append(searchLabel, searchInput);
    panel.append(header, searchWrap, body);
    root.append(panel);

    document.documentElement.append(root);
    state.root = root;
    state.list = list;
    state.searchWrap = searchWrap;
    state.searchInput = searchInput;
    state.count = count;
    state.previewPane = previewPane;
    state.previewImage = previewImage;
    state.previewFallback = previewFallback;

    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("keyup", handleKeyUp, true);
    root.addEventListener("wheel", handleWheel, { passive: false, capture: true });
    state.searchInput.addEventListener("input", handleSearchInput);
  }

  function render() {
    state.root.dataset.theme = state.options.theme;
    state.root.dataset.density = state.options.density;
    state.root.dataset.displayMode = state.options.displayMode;
    state.searchWrap.hidden = !state.searchMode;
    state.count.textContent = `${state.visibleTabs.length} tab${state.visibleTabs.length === 1 ? "" : "s"}`;

    if (state.searchMode && document.activeElement !== state.searchInput) {
      state.searchInput.focus({ preventScroll: true });
    }

    state.searchInput.value = state.query;
    state.list.textContent = "";

    if (!state.visibleTabs.length) {
      const empty = document.createElement("li");
      empty.className = "mru-tab-switcher__empty";
      empty.textContent = "No matching tabs";
      state.list.append(empty);
      return;
    }

    state.visibleTabs.forEach((tab, index) => {
      const item = document.createElement("li");
      item.className = "mru-tab-switcher__item";
      item.id = `mru-tab-switcher-option-${tab.id}`;
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", String(index === state.selectedIndex));
      if (index === state.selectedIndex) {
        item.classList.add("is-selected");
      }

      const icon = document.createElement("img");
      icon.className = "mru-tab-switcher__icon";
      icon.alt = "";
      icon.src = tab.favIconUrl || browserApi.runtime.getURL("icons/tab.svg");

      const text = document.createElement("span");
      text.className = "mru-tab-switcher__text";

      const title = document.createElement("span");
      title.className = "mru-tab-switcher__tab-title";
      title.textContent = tab.title || "Untitled";

      const url = document.createElement("span");
      url.className = "mru-tab-switcher__url";
      url.textContent = formatUrl(tab.url);

      text.append(title, url);
      item.append(icon, text);
      item.addEventListener("mousemove", (event) => {
        if (event.clientX === state.lastMouseX && event.clientY === state.lastMouseY) {
          return;
        }
        state.lastMouseX = event.clientX;
        state.lastMouseY = event.clientY;
        state.selectedIndex = index;
        render();
      });
      item.addEventListener("click", () => finish(true));
      state.list.append(item);
    });

    keepSelectedItemVisible();
    updatePreviewPane();
  }

  function updatePreviewPane() {
    if (state.options.displayMode !== "preview" || !state.previewPane) {
      return;
    }

    const selected = state.visibleTabs[state.selectedIndex];
    if (!selected) {
      showPreviewFallback("No tab selected");
      return;
    }

    const cachedPreview = state.previewCache.get(selected.id);
    if (cachedPreview && cachedPreview.ok) {
      showPreviewImage(cachedPreview.dataUrl);
      return;
    }

    showPreviewFallback(cachedPreview ? previewFailureText(cachedPreview) : "Loading preview...");
    requestPreview(selected.id);
  }

  function requestPreview(tabId) {
    const requestId = ++state.previewRequestId;
    browserApi.runtime
      .sendMessage({ type: "mru-switcher:get-preview", tabId })
      .then((result) => {
        state.previewCache.set(tabId, result || { ok: false, reason: "capture" });
        if (!state.root || state.root.hidden || state.options.displayMode !== "preview") {
          return;
        }
        const selected = state.visibleTabs[state.selectedIndex];
        if (!selected || selected.id !== tabId || requestId !== state.previewRequestId) {
          return;
        }
        if (result && result.ok) {
          showPreviewImage(result.dataUrl);
        } else {
          showPreviewFallback(previewFailureText(result));
        }
      })
      .catch(() => {
        state.previewCache.set(tabId, { ok: false, reason: "capture" });
        showPreviewFallback("Preview unavailable");
      });
  }

  function showPreviewImage(dataUrl) {
    state.previewImage.src = dataUrl;
    state.previewImage.hidden = false;
    state.previewFallback.hidden = true;
  }

  function showPreviewFallback(text) {
    state.previewImage.hidden = true;
    state.previewImage.removeAttribute("src");
    state.previewFallback.hidden = false;
    state.previewFallback.textContent = text;
  }

  function previewFailureText(result) {
    if (result && result.reason === "permission") {
      return "Grant live preview permission in settings";
    }
    return "Preview unavailable";
  }

  function keepSelectedItemVisible() {
    const selected = state.list.querySelector(".is-selected");
    if (!selected) {
      return;
    }

    const selectedTop = selected.offsetTop;
    const selectedBottom = selectedTop + selected.offsetHeight;
    const visibleTop = state.list.scrollTop;
    const visibleBottom = visibleTop + state.list.clientHeight;

    if (selectedTop < visibleTop) {
      state.list.scrollTop = selectedTop;
    } else if (selectedBottom > visibleBottom) {
      state.list.scrollTop = selectedBottom - state.list.clientHeight;
    }
  }

  function formatUrl(url) {
    try {
      const parsed = new URL(url);
      return parsed.hostname + parsed.pathname;
    } catch {
      return url || "";
    }
  }

  function handleSearchInput(event) {
    state.query = event.target.value;
    const previousTab = state.visibleTabs[state.selectedIndex];
    state.visibleTabs = core.filterTabs(state.allTabs, state.query);
    const previousIndex = previousTab ? state.visibleTabs.findIndex((tab) => tab.id === previousTab.id) : -1;
    state.selectedIndex = previousIndex >= 0 ? previousIndex : core.wrapIndex(0, state.visibleTabs.length);
    render();
  }

  function handleKeyDown(event) {
    if (state.root.hidden) {
      return;
    }

    const key = event.key;
    const searchKey = state.options.searchKey || "s";

    if (key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (state.searchMode && state.query) {
        state.query = "";
        state.visibleTabs = state.allTabs.slice();
        state.selectedIndex = core.initialSelectedIndex(state.visibleTabs);
        render();
      } else {
        finish(false);
      }
      return;
    }

    if (key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      finish(true);
      return;
    }

    if (key === "Tab" && state.searchMode) {
      event.preventDefault();
      event.stopPropagation();
      move(event.shiftKey ? -1 : 1);
      return;
    }

    if (state.options.enableVimNavigation && !state.searchMode && isVimNavigationKey(event)) {
      event.preventDefault();
      event.stopPropagation();
      move(isKey(event, "K") ? -1 : 1);
      return;
    }

    if (!state.searchMode && isSearchTrigger(event, searchKey)) {
      event.preventDefault();
      event.stopPropagation();
      enterSearchMode();
    }
  }

  function isVimNavigationKey(event) {
    return isKey(event, "J") || isKey(event, "K");
  }

  function isKey(event, key) {
    if (event.key && event.key.length === 1 && event.key.toUpperCase() === key) {
      return true;
    }
    return event.code === `Key${key}`;
  }

  function isSearchTrigger(event, searchKey) {
    const normalizedKey = core.normalizeSearchKey(searchKey);
    if (event.key && event.key.length === 1 && event.key.toLowerCase() === normalizedKey) {
      return true;
    }

    if (/^[a-z]$/.test(normalizedKey)) {
      return event.code === `Key${normalizedKey.toUpperCase()}`;
    }

    if (/^[0-9]$/.test(normalizedKey)) {
      return event.code === `Digit${normalizedKey}`;
    }

    return false;
  }

  function handleKeyUp(event) {
    if (state.root.hidden || state.searchMode) {
      return;
    }

    if (event.key === "Alt" || event.key === "Option") {
      event.preventDefault();
      event.stopPropagation();
      finish(true);
    }
  }

  function handleWheel(event) {
    if (state.root.hidden) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    state.wheelRemainder += event.deltaY;

    if (Math.abs(state.wheelRemainder) < 8) {
      return;
    }

    move(state.wheelRemainder > 0 ? 1 : -1);
    state.wheelRemainder = 0;
  }

  function enterSearchMode() {
    state.searchMode = true;
    state.query = "";
    state.visibleTabs = state.allTabs.slice();
    state.selectedIndex = core.initialSelectedIndex(state.visibleTabs);
    render();
  }

  function move(delta) {
    state.selectedIndex = core.moveSelection(state.selectedIndex, delta, state.visibleTabs.length);
    state.previewRequestId += 1;
    render();
  }

  function finish(activate) {
    const selected = state.visibleTabs[state.selectedIndex];
    state.root.hidden = true;
    state.isOpen = false;
    browserApi.runtime.sendMessage({ type: "mru-switcher:closed" });

    if (activate && selected) {
      browserApi.runtime.sendMessage({
        type: "mru-switcher:activate",
        tabId: selected.id,
        windowId: selected.windowId
      });
    }
  }

  browserApi.runtime.onMessage.addListener((message) => {
    if (message && message.type === "mru-switcher:start") {
      start(message);
    } else if (message && message.type === "mru-switcher:open-or-cycle") {
      openOrCycle(message);
    } else if (message && message.type === "mru-switcher:cycle" && state.root && !state.root.hidden) {
      move(message.delta || 1);
    } else if (message && message.type === "mru-switcher:enter-search" && state.root && !state.root.hidden) {
      enterSearchMode();
    }
  });

  global.__mruTabSwitcherOverlay = { start };
})(typeof globalThis !== "undefined" ? globalThis : this);
