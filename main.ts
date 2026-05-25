import { App, Plugin, PluginSettingTab, Setting, ItemView, WorkspaceLeaf, MarkdownView } from "obsidian";
import { GoogleGenerativeAI } from "@google/generative-ai";

const VIEW_TYPE_ANIMA = "anima-view";

interface AnimaSettings {
  apiProvider: string;
  apiKey: string;
}

const DEFAULT_SETTINGS: AnimaSettings = {
  apiProvider: "gemini",
  apiKey: "",
};

const SAD_KEYWORDS = ["حزين", "sad", "تعب", "tired", "إرهاق", "exhausted", "هزيمة", "defeat", "depressed", "وحيد", "alone", "قلق", "anxious", "بكاء", "cry", "ألم", "pain"];
const HAPPY_KEYWORDS = ["فرح", "happy", "سعيد", "joy", "حب", "love", "جميل", "beautiful", "ممتاز", "excellent", "رائع", "amazing", "نصر", "victory", "شكر", "thank"];

const PET_NEUTRAL = "(◕‿◕)";
const PET_SAD = "(╥﹏╥)";
const PET_HAPPY = "(≧◡≦)";

export default class AnimaPlugin extends Plugin {
  settings!: AnimaSettings;
  private petState: string = PET_NEUTRAL;

  async onload() {
    await this.loadSettings();

    this.registerView(VIEW_TYPE_ANIMA, (leaf: WorkspaceLeaf) => new AnimaView(leaf, this));

    this.addRibbonIcon("heart", "Open Anima", () => {
      this.activateView();
    });

    this.addCommand({
      id: "open-anima-view",
      name: "Open Anima View",
      callback: () => this.activateView(),
    });

    this.addSettingTab(new AnimaSettingTab(this.app, this));

    this.registerEvent(
      this.app.workspace.on("modify" as any, () => this.handleModify())
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

  private async handleModify() {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
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
      const view = this.app.workspace.getLeavesOfType(VIEW_TYPE_ANIMA)[0]?.view as AnimaView | undefined;
      if (view) view.updatePet(this.petState);
    }
  }

  async sendMessageToAI(prompt: string): Promise<string> {
    if (!this.settings.apiKey) {
      return "Please configure your API key in Anima settings";
    }

    try {
      switch (this.settings.apiProvider) {
        case "gemini": {
          const genAI = new GoogleGenerativeAI(this.settings.apiKey);
          const model = genAI.getGenerativeModel({ model: "gemini-pro" });
          const result = await model.generateContent(prompt);
          return result.response.text();
        }
        case "openai": {
          const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${this.settings.apiKey}`,
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: [{ role: "user", content: prompt }],
            }),
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
}

class AnimaView extends ItemView {
  private plugin: AnimaPlugin;
  private petEl!: HTMLElement;
  private chatHistoryEl!: HTMLElement;
  private inputEl!: HTMLInputElement;
  private sendBtn!: HTMLElement;

  constructor(leaf: WorkspaceLeaf, plugin: AnimaPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_ANIMA;
  }

  getDisplayText(): string {
    return "Anima View";
  }

  getIcon(): string {
    return "heart";
  }

  async onOpen() {
    const container = this.containerEl.children[1] as HTMLElement;
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

  updatePet(state: string) {
    this.petEl.setText(state);
  }

  private async handleSend() {
    const text = this.inputEl.value.trim();
    if (!text) return;

    this.appendMessage(`You: ${text}`);
    this.inputEl.value = "";

    const reply = await this.plugin.sendMessageToAI(text);
    this.appendMessage(`Anima: ${reply}`);
  }

  private appendMessage(msg: string) {
    this.chatHistoryEl.appendText(msg + "\n");
    this.chatHistoryEl.scrollTop = this.chatHistoryEl.scrollHeight;
  }
}

class AnimaSettingTab extends PluginSettingTab {
  plugin: AnimaPlugin;

  constructor(app: App, plugin: AnimaPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Anima Settings" });
    containerEl.createEl("p", {
      text: "Enter your API key from a supported provider so Anima can chat with you.",
      cls: "setting-item-description",
    });

    new Setting(containerEl)
      .setName("AI Provider")
      .setDesc("Choose your API provider")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("gemini", "Gemini (Google)")
          .addOption("openai", "OpenAI")
          .setValue(this.plugin.settings.apiProvider)
          .onChange(async (value) => {
            this.plugin.settings.apiProvider = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("API Key")
      .setDesc("Your API key (stored locally in your vault)")
      .addText((text) =>
        text
          .setPlaceholder("sk-... or AIza...")
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (value) => {
            this.plugin.settings.apiKey = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
