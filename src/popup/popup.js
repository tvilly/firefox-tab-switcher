(function initPopup(global) {
  "use strict";

  const browserApi = global.browser;
  const core = global.TabSwitcherCore;
  const state = {
    tabs: [],
    visibleTabs: [],
    selectedIndex: 0
  };

  const list = document.getElementById("tabs");
  const search = document.getElementById("search");
  const tryOverlay = document.getElementById("try-overlay");
  const openOptions = document.getElementById("open-options");

  async function init() {
    const fallback = await browserApi.runtime.sendMessage({ type: "mru-switcher:get-fallback" }).catch(() => null);
    if (fallback && Array.isArray(fallback.tabs)) {
      state.tabs = fallback.tabs;
      state.selectedIndex = core.wrapIndex(fallback.selectedIndex || 0, state.tabs.length);
      await browserApi.runtime.sendMessage({ type: "mru-switcher:clear-fallback" }).catch(() => undefined);
    } else {
      const tabs = await browserApi.tabs.query({ currentWindow: true });
      state.tabs = core.sortTabsByMostRecent(tabs).map(core.toSwitcherTab);
      state.selectedIndex = core.initialSelectedIndex(state.tabs);
    }
    state.visibleTabs = state.tabs.slice();
    render();
    search.focus();
  }

  function render() {
    list.textContent = "";
    if (!state.visibleTabs.length) {
      const empty = document.createElement("li");
      empty.className = "empty";
      empty.textContent = "No matching tabs";
      list.append(empty);
      return;
    }

    state.visibleTabs.forEach((tab, index) => {
      const item = document.createElement("li");
      item.className = index === state.selectedIndex ? "is-selected" : "";
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", String(index === state.selectedIndex));
      item.addEventListener("mouseenter", () => {
        state.selectedIndex = index;
        render();
      });
      item.addEventListener("click", () => activateSelected(index));

      const icon = document.createElement("img");
      icon.alt = "";
      icon.src = tab.favIconUrl || browserApi.runtime.getURL("icons/tab.svg");

      const text = document.createElement("span");
      text.className = "text";

      const title = document.createElement("span");
      title.className = "title";
      title.textContent = tab.title || "Untitled";

      const url = document.createElement("span");
      url.className = "url";
      url.textContent = formatUrl(tab.url);

      text.append(title, url);
      item.append(icon, text);
      list.append(item);
    });
  }

  function formatUrl(url) {
    try {
      const parsed = new URL(url);
      return parsed.hostname + parsed.pathname;
    } catch {
      return url || "";
    }
  }

  function activateSelected(index) {
    if (Number.isInteger(index)) {
      state.selectedIndex = index;
    }

    const selected = state.visibleTabs[state.selectedIndex];
    if (selected) {
      browserApi.runtime.sendMessage({
        type: "mru-switcher:activate",
        tabId: selected.id,
        windowId: selected.windowId
      });
      window.close();
    }
  }

  search.addEventListener("input", () => {
    const previous = state.visibleTabs[state.selectedIndex];
    state.visibleTabs = core.filterTabs(state.tabs, search.value);
    const previousIndex = previous ? state.visibleTabs.findIndex((tab) => tab.id === previous.id) : -1;
    state.selectedIndex = previousIndex >= 0 ? previousIndex : core.wrapIndex(0, state.visibleTabs.length);
    render();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Tab") {
      event.preventDefault();
      state.selectedIndex = core.moveSelection(state.selectedIndex, event.shiftKey ? -1 : 1, state.visibleTabs.length);
      render();
    } else if (event.key === "Enter") {
      event.preventDefault();
      activateSelected();
    } else if (event.key === "Escape") {
      window.close();
    }
  });

  tryOverlay.addEventListener("click", () => {
    browserApi.runtime.sendMessage({ type: "mru-switcher:open-from-popup" });
    window.close();
  });

  openOptions.addEventListener("click", () => {
    browserApi.runtime.openOptionsPage();
    window.close();
  });

  init().catch((error) => {
    list.textContent = "";
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "Unable to load tabs";
    list.append(empty);
    console.error(error);
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
