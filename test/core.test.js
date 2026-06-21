const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../src/shared/core.js");

test("sortTabsByMostRecent orders tabs by lastAccessed and skips hidden or invalid tabs", () => {
  const tabs = [
    { id: 1, title: "Old", index: 2, lastAccessed: 10 },
    { id: 2, title: "Newest", index: 1, lastAccessed: 30 },
    { id: 3, title: "Hidden", index: 0, hidden: true, lastAccessed: 40 },
    { id: -1, title: "Invalid", index: 0, lastAccessed: 50 },
    { id: 4, title: "Tie A", index: 0, lastAccessed: 20 },
    { id: 5, title: "Tie B", index: 3, lastAccessed: 20 }
  ];

  assert.deepEqual(core.sortTabsByMostRecent(tabs).map((tab) => tab.id), [2, 4, 5, 1]);
});

test("filterTabs matches title and URL case-insensitively with all terms required", () => {
  const tabs = [
    { title: "Project Notes", url: "https://docs.example.com/spec" },
    { title: "News", url: "https://example.org/project-update" },
    { title: "Calendar", url: "https://calendar.example.com" }
  ];

  assert.deepEqual(core.filterTabs(tabs, "project docs").map((tab) => tab.title), ["Project Notes"]);
  assert.deepEqual(core.filterTabs(tabs, "PROJECT").map((tab) => tab.title), ["Project Notes", "News"]);
  assert.equal(core.filterTabs(tabs, "missing").length, 0);
});

test("moveSelection wraps forward and backward", () => {
  assert.equal(core.moveSelection(1, 1, 3), 2);
  assert.equal(core.moveSelection(2, 1, 3), 0);
  assert.equal(core.moveSelection(0, -1, 3), 2);
  assert.equal(core.moveSelection(0, 1, 0), -1);
});

test("initialSelectedIndex prefers the second most-recent tab when possible", () => {
  assert.equal(core.initialSelectedIndex([]), 0);
  assert.equal(core.initialSelectedIndex([{ id: 1 }]), 0);
  assert.equal(core.initialSelectedIndex([{ id: 1 }, { id: 2 }]), 1);
});

test("prioritizeActiveTab moves the active tab to the front without disturbing other tabs", () => {
  const tabs = [{ id: 1 }, { id: 2 }, { id: 3 }];
  assert.deepEqual(core.prioritizeActiveTab(tabs, 2).map((tab) => tab.id), [2, 1, 3]);
  assert.deepEqual(core.prioritizeActiveTab(tabs, 1).map((tab) => tab.id), [1, 2, 3]);
  assert.deepEqual(core.prioritizeActiveTab(tabs, 9).map((tab) => tab.id), [1, 2, 3]);
});

test("normalizeOptions keeps valid preferences and repairs invalid values", () => {
  assert.deepEqual(core.normalizeOptions({
    mainShortcut: "Alt+K",
    searchKey: "K",
    captureTextInputShortcut: true,
    enableVimNavigation: true,
    displayMode: "preview",
    tabScope: "allWindows",
    density: "compact",
    theme: "dark"
  }), {
    mainShortcut: "Alt+K",
    searchKey: "k",
    captureTextInputShortcut: true,
    enableVimNavigation: true,
    displayMode: "preview",
    tabScope: "allWindows",
    density: "compact",
    theme: "dark"
  });

  assert.deepEqual(core.normalizeOptions({
    searchKey: "Enter",
    tabScope: "sideways",
    density: "tiny",
    theme: "neon"
  }), core.DEFAULT_OPTIONS);
});

test("searchKeyToShortcut maps the configured search key to an Alt shortcut", () => {
  assert.equal(core.searchKeyToShortcut("s"), "Alt+S");
  assert.equal(core.searchKeyToShortcut("K"), "Alt+K");
  assert.equal(core.searchKeyToShortcut("bad"), "Alt+S");
});

test("normalizeMainShortcut accepts single-key modifier shortcuts", () => {
  assert.equal(core.normalizeMainShortcut("alt+q"), "Alt+Q");
  assert.equal(core.normalizeMainShortcut("Ctrl+Alt+K"), "Ctrl+Alt+K");
  assert.equal(core.normalizeMainShortcut("nope"), "Alt+Q");
});

test("eventMatchesShortcut compares modifiers and key code", () => {
  assert.equal(core.eventMatchesShortcut({
    altKey: true,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    key: "œ",
    code: "KeyQ"
  }, "Alt+Q"), true);

  assert.equal(core.eventMatchesShortcut({
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    key: "q",
    code: "KeyQ"
  }, "Alt+Q"), false);
});
