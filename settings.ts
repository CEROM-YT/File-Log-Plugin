import MyPlugin  from "main";
import {App, PluginSettingTab, Notice, Setting } from "obsidian";

export class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText( (text) => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));

		/*new Setting(containerEl)
			
			.setName('Log File Folder')
			.setDesc('The location for storing Log')
			.addDropdown(dropdown => dropdown
				.addOptions({
					this.app.vault
						.getAllLoadedFiles()
						.filter((f) => f instanceof TFolder)
						.map((f) => f.path).
				})
				.setValue(this.plugin.settings.dailyNoteFormat)
				.onChange(async (value) => {
					this.plugin.settings.logFilePath = value;
					await this.plugin.saveSettings();
				}));*/

		new Setting(containerEl)
			.setName('Log File Format')
			.setDesc('The format for the log file')
			.addText(text => text
				.setPlaceholder('Example: Folder/log.md')
				.setValue(this.plugin.settings.logFilePath)
				.onChange(async (value) => {
					this.plugin.settings.logFilePath = value;
					await this.plugin.saveSettings();
				}));
	}
}
