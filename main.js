"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => AnimaPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var import_generative_ai = require("@google/generative-ai");
var VIEW_TYPE_ANIMA = "anima-view";
var DEFAULT_SETTINGS = {
  apiProvider: "gemini",
  apiKey: ""
};
var SAD_KEYWORDS = ["\u062D\u0632\u064A\u0646", "sad", "\u062A\u0639\u0628", "tired", "\u0625\u0631\u0647\u0627\u0642", "exhausted", "\u0647\u0632\u064A\u0645\u0629", "defeat", "depressed", "\u0648\u062D\u064A\u062F", "alone", "\u0642\u0644\u0642", "anxious", "\u0628\u0643\u0627\u0621", "cry", "\u0623\u0644\u0645", "pain"];
var HAPPY_KEYWORDS = ["\u0641\u0631\u062D", "happy", "\u0633\u0639\u064A\u062F", "joy", "\u062D\u0628", "love", "\u062C\u0645\u064A\u0644", "beautiful", "\u0645\u0645\u062A\u0627\u0632", "excellent", "\u0631\u0627\u0626\u0639", "amazing", "\u0646\u0635\u0631", "victory", "\u0634\u0643\u0631", "thank"];
var PET_NEUTRAL = "(\u25D5\u203F\u25D5)";
var PET_SAD = "(\u2565\uFE4F\u2565)";
var PET_HAPPY = "(\u2267\u25E1\u2266)";
var AnimaPlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.petState = PET_NEUTRAL;
  }
  async onload() {
    await this.loadSettings();
    this.registerView(VIEW_TYPE_ANIMA, (leaf) => new AnimaView(leaf, this));
    this.addRibbonIcon("heart", "Open Anima", () => {
      this.activateView();
    });
    this.addCommand({
      id: "open-anima-view",
      name: "Open Anima View",
      callback: () => this.activateView()
    });
    this.addSettingTab(new AnimaSettingTab(this.app, this));
    this.registerEvent(
      this.app.workspace.on("modify", () => this.handleModify())
    );
  }
  onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_ANIMA);
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  async activateView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_ANIMA)[0];
    if (!leaf) {
      const rightLeaf = workspace.getRightLeaf(false);
      if (!rightLeaf) return;
      leaf = rightLeaf;
      await leaf.setViewState({ type: VIEW_TYPE_ANIMA, active: true });
    }
    workspace.revealLeaf(leaf);
  }
  async handleModify() {
    const activeView = this.app.workspace.getActiveViewOfType(import_obsidian.MarkdownView);
    if (!activeView) return;
    const content = activeView.editor.getValue().toLowerCase();
    let newPet = PET_NEUTRAL;
    const isSad = SAD_KEYWORDS.some((kw) => content.includes(kw));
    const isHappy = HAPPY_KEYWORDS.some((kw) => content.includes(kw));
    if (isSad && !isHappy) {
      newPet = PET_SAD;
    } else if (isHappy && !isSad) {
      newPet = PET_HAPPY;
    }
    if (newPet !== this.petState) {
      this.petState = newPet;
      const view = this.app.workspace.getLeavesOfType(VIEW_TYPE_ANIMA)[0]?.view;
      if (view) view.updatePet(this.petState);
    }
  }
  async sendMessageToAI(prompt) {
    if (!this.settings.apiKey) {
      return "Please configure your API key in Anima settings";
    }
    try {
      switch (this.settings.apiProvider) {
        case "gemini": {
          const genAI = new import_generative_ai.GoogleGenerativeAI(this.settings.apiKey);
          const model = genAI.getGenerativeModel({ model: "gemini-pro" });
          const result = await model.generateContent(prompt);
          return result.response.text();
        }
        case "openai": {
          const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${this.settings.apiKey}`
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: [{ role: "user", content: prompt }]
            })
          });
          const data = await response.json();
          return data.choices?.[0]?.message?.content || "No response from OpenAI.";
        }
        default:
          return `Unknown provider: ${this.settings.apiProvider}`;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Anima AI Error:", err);
      return `AI request failed: ${message}`;
    }
  }
};
var AnimaView = class extends import_obsidian.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_TYPE_ANIMA;
  }
  getDisplayText() {
    return "Anima View";
  }
  getIcon() {
    return "heart";
  }
  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("anima-container");
    container.style.cssText = `
      display: flex;
      flex-direction: column;
      height: 100%;
      padding: 16px;
      background: #1e1e1e;
      color: #e0e0e0;
      font-family: system-ui, sans-serif;
    `;
    this.petEl = container.createDiv({ cls: "anima-pet" });
    this.petEl.style.cssText = `
      text-align: center;
      font-size: 48px;
      padding: 24px 0;
      user-select: none;
    `;
    this.petEl.setText(this.plugin["petState"] || PET_NEUTRAL);
    this.chatHistoryEl = container.createDiv({ cls: "anima-chat" });
    this.chatHistoryEl.style.cssText = `
      flex: 1;
      overflow-y: auto;
      margin: 12px 0;
      padding: 8px;
      background: #252525;
      border-radius: 8px;
      font-size: 14px;
      line-height: 1.6;
      white-space: pre-wrap;
    `;
    this.chatHistoryEl.setText("Hello, I'm Anima. How are you feeling today?");
    const inputRow = container.createDiv({ cls: "anima-input-row" });
    inputRow.style.cssText = `
      display: flex;
      gap: 8px;
    `;
    this.inputEl = inputRow.createEl("input", { cls: "anima-input", type: "text", placeholder: "Talk to Anima..." });
    this.inputEl.style.cssText = `
      flex: 1;
      padding: 10px;
      border: 1px solid #444;
      border-radius: 6px;
      background: #2a2a2a;
      color: #e0e0e0;
      font-size: 14px;
      outline: none;
    `;
    this.sendBtn = inputRow.createEl("button", { cls: "anima-send", text: "Send" });
    this.sendBtn.style.cssText = `
      padding: 10px 16px;
      border: none;
      border-radius: 6px;
      background: #6c5ce7;
      color: #fff;
      font-size: 14px;
      cursor: pointer;
    `;
    this.sendBtn.addEventListener("click", () => this.handleSend());
    this.inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.handleSend();
    });
  }
  updatePet(state) {
    this.petEl.setText(state);
  }
  async handleSend() {
    const text = this.inputEl.value.trim();
    if (!text) return;
    this.appendMessage(`You: ${text}`);
    this.inputEl.value = "";
    const reply = await this.plugin.sendMessageToAI(text);
    this.appendMessage(`Anima: ${reply}`);
  }
  appendMessage(msg) {
    this.chatHistoryEl.appendText(msg + "\n");
    this.chatHistoryEl.scrollTop = this.chatHistoryEl.scrollHeight;
  }
};
var AnimaSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Anima Settings" });
    containerEl.createEl("p", {
      text: "Enter your API key from a supported provider so Anima can chat with you.",
      cls: "setting-item-description"
    });
    new import_obsidian.Setting(containerEl).setName("AI Provider").setDesc("Choose your API provider").addDropdown(
      (dropdown) => dropdown.addOption("gemini", "Gemini (Google)").addOption("openai", "OpenAI").setValue(this.plugin.settings.apiProvider).onChange(async (value) => {
        this.plugin.settings.apiProvider = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("API Key").setDesc("Your API key (stored locally in your vault)").addText(
      (text) => text.setPlaceholder("sk-... or AIza...").setValue(this.plugin.settings.apiKey).onChange(async (value) => {
        this.plugin.settings.apiKey = value;
        await this.plugin.saveSettings();
      })
    );
  }
};
