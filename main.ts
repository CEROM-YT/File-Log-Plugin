import { 
	App, 
	Editor, 
	MarkdownView, 
	Modal, 
	Notice, 
	Plugin, 
	PluginSettingTab, 
	Setting, 
	debounce, 
	TFile, 
	Workspace, 
	WorkspaceLeaf, 
	View,
	MarkdownFileInfo,
	TFolder,
	TAbstractFile,
} from 'obsidian';
// ParseYaml, 




// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	mySetting: string;
	logFilePath: string;
	dailyNoteFormat: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default',
	logFilePath: '',
	dailyNoteFormat: 'YYYY-MM-DD [LOG]'
}

export default class MyPlugin extends Plugin {
	// #region Intialisation of plugin
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();

			/*
		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('dice', 'Sample Plugin', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice('This is a notice!');
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status Bar Text');

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-sample-modal-simple',
			name: 'Open sample modal (simple)',
			callback: () => {
				new SampleModal(this.app).open();
			}
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'sample-editor-command',
			name: 'Sample editor command',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection('Sample Editor Command');
			}
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-sample-modal-complex',
			name: 'Open sample modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
		*/

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));	
		
		this.app.workspace.onLayoutReady( () => {
			//Only show create events after the file has been loaded
			this.registerGeneralEvents();
			
		});

		this.registerOpenCloseEvents();
	}

	onunload() {
		//Plugin disabled
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	// #endregion

	//Start Logging Function

	registerGeneralEvents() {
		let logfile = window.moment().format(this.settings.logFilePath);

		this.writeChangelog(this.ObsidianStartLog());

		//Monitors Files created while application running and not during start up
		this.registerEvent(this.app.vault.on("create", (file:TAbstractFile) => {
			this.writeChangelog(this.FileCreateLog(file.path));
		}));

		/* Move/rename File Events
		get old path, then what the new path will be
		This idea might be scraped because say I have a lot of files and a lot of logs, obsidian auto updates links, 
			so even showing that would cause lag, as the application tries to update all the links
			instead I should store the names as strings and not links, just to show what the text said but not the actual link
			because we want the log to be a record of the renaming and moving, for the inbox filtering process for example, to see
			what stages it has gone through, or for a file, how the name for the concept has changed over time, although this would
			mostly be minimised I think but I'm not sure, most of this program is thinking just in case*/
		this.registerEvent(this.app.vault.on("rename", (file:TAbstractFile, oldName:string) => {
			console.log("renamed: " + file.path + " from " + oldName);
			this.writeChangelog(this.FileMoveLog(file.path, oldName));
		})); 

		/* Modify File Events
			The event is carried out every 2 seconds, and currently if editing for a long time it will show all those details
		bare in mind that the accuracy of the information would be of by +- 2 seconds at the start and end times of a modification block*/
		this.registerEvent(this.app.vault.on("modify", (file:TAbstractFile) => {
			if (file.path != logfile) {
				this.writeChangelog(this.FileModifyLog(file.path));
			}
		}));

		// Delete File Events
		this.registerEvent(this.app.vault.on("delete", (file:TAbstractFile) => {
			this.writeChangelog(this.FileDeleteLog(file.path));
		}));

		//When application quits
		this.registerEvent(this.app.workspace.on("quit", () => {
			this.writeChangelog(this.ObsidianStopLog());
		}))
	}

	registerOpenCloseEvents() {
		//Gets all the leaves in the workspace that are visible
		let prevVisibleLeaves = this.getVisibleLeaves(this.getLeafsInWorkspace());
		//Gets the active leaf 
		let prevLeaf = this.app.workspace.getActiveViewOfType(View)?.leaf;
		//dedicated to openFile event since other ones already update the other one so it won't work properly anymore
		let prevLeaf2 = this.app.workspace.getActiveViewOfType(View)?.leaf;
		let prevFile = prevLeaf2?.getViewState().state?.file;

		///*File Opening (open file becomes active, can be use for closing by checking previous active leaf)
		this.registerEvent(this.app.workspace.on("active-leaf-change", () => {//when active leaf is changed
			let currLeaf = this.app.workspace.getActiveViewOfType(View)?.leaf;
			//console.log("ACtive leaf changed!")
			//update the fact that the leaf has changed, and update the variable after to set up new old leaf
			//Allows for checking what opened a leaf
			try {
				//pass through the new leaf, and the active leaf before it (can be where opened from)
				this.LeafDifferenceActions(prevVisibleLeaves, prevLeaf, "leaf");
			} finally { 
				//sets the old leaf to the current leaf, ready for next active leaf change
				prevLeaf = currLeaf;
				//sets the current visible leafs as the old visible leafs
				prevVisibleLeaves = this.getVisibleLeaves(this.getLeafsInWorkspace());
			}
		}));

		//Opening and closing (when changing up the layout, closing tabs, creating new splits etc.)
		this.registerEvent(this.app.workspace.on("layout-change", () => {//When you change the layout of the workspace
			let currLeaf = this.app.workspace.getActiveViewOfType(View)?.leaf;
			console.log("Layout has Changed!");
			try {
				//pass through the new leaf, and the active leaf before it (can be where opened from)
				this.LeafDifferenceActions(prevVisibleLeaves, prevLeaf2, "leaf");
				//this.findOpenFileSameLeaf(prevFile, currLeaf?.getViewState().state?.file, prevLeaf2);
			} finally { 
				//sets the old leaf to the current leaf, ready for next active leaf change
				prevLeaf = currLeaf;
				//sets the current visible leafs as the old visible leafs
				prevVisibleLeaves = this.getVisibleLeaves(this.getLeafsInWorkspace());
			}
		}));

		//File Opening and closing (mainly for sidebars)
		this.registerEvent(this.app.workspace.on("resize", () => {//When you resize any component in the workspace
			let currLeaf = this.app.workspace.getActiveViewOfType(View)?.leaf;
			//console.log("RESIZE EVENT!!!");
			try {
				//pass through the new leaf, and the active leaf before it (can be where opened from)
				this.LeafDifferenceActions(prevVisibleLeaves, prevLeaf, "leaf");
			} finally { 
				//sets the old leaf to the current leaf, ready for next active leaf change
				prevLeaf = currLeaf;
				//sets the current visible leafs as the old visible leafs
				prevVisibleLeaves = this.getVisibleLeaves(this.getLeafsInWorkspace());
			}
		}))//*/

		//File Opening
		this.registerEvent(this.app.workspace.on("file-open", (file:TFile) => {//When you open a file (normal open file not custom one I want)
			let currLeaf = this.app.workspace.getActiveViewOfType(View)?.leaf;
			if (currLeaf?.getViewState().type == "markdown") {
				//console.log("New file has opened!");
				let currFile = currLeaf?.getViewState().state?.file;
				
				//console.log("----------");

				try {
					try {
						//if the leaf did not change
						if (currLeaf === prevLeaf2) {
							//and if the file for the current leaf is different
							if (prevFile != currFile && currFile !== undefined && prevFile !== undefined) {
								console.log(prevFile + " => " + currFile);
								console.log("Different file same leaf!");
								//console.log(prevFile);
								this.findOpenFileSameLeaf(prevFile, currFile, prevLeaf2)
							}
							//else if ()
						}//if the leaf did change
					} finally {
						prevLeaf2 = currLeaf;
					}
				} finally {
					prevFile = currFile;
				}

				//console.log("--------");
			}
		}));

		this.registerEvent(this.app.workspace.on("window-close", (window) => {
			window.win.;
		}));
	}

	//Log building Logic

	async writeInFile(filePath: string, content: string) {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (file instanceof TFile) {
		  	await this.app.vault.append(file, content);
		} else {
		  	new Notice("Couldn't write changelog: check the file path, file might not exist");
		}
		console.log(file, content);
	}

	buildChangelog(logText:string): string {
		
		let logFormat = "[[date::] YYYY-MM-DD[]] [at] [[time::] HH:mm:ss[]]"

		let changelogContent = ``;
		const humanTime = window
			.moment()
			.format(logFormat);//[date:: YYYY-MM-DD] [time:: HH:mm:ss]
		changelogContent += `- ${humanTime} · ${logText}\n`;

		return changelogContent;
	}

	async writeChangelog(logText:string) {
		const log = this.buildChangelog(logText);
		let file = window.moment().format(this.settings.logFilePath);//.toString();
		//console.log(file)
		await this.writeInFile(file, log);
	}

	//Open and Closing 
	// Problem where when going back and forth with buttons does not oopen and close relevant files
	//still have not factured in hover open notes

	getLeafsInWorkspace():WorkspaceLeaf[] {
		let leafsInWorkspace:WorkspaceLeaf[] = [];

		this.app.workspace.iterateAllLeaves(leaf => {
			leafsInWorkspace.push(leaf);
		});
		//console.log(leafsInWorkspace);
		return leafsInWorkspace;
	}

	getVisibleLeaves(leafs:WorkspaceLeaf[] ):WorkspaceLeaf[] {

		let visibleLeafs:WorkspaceLeaf[] = [];

		for (var leaf in leafs) {
			//console.log(index); // prints indexes: 0, 1, 2, 3
			//console.log(arr[index].getDisplayText()); // prints elements: 10, 20, 30, 40
			let leafStyle = leafs[leaf].view.containerEl.parentElement?.style.display;
			let mainSplit = leafs[leaf].view.containerEl.parentElement?.parentElement?.parentElement?.parentElement;

			if (leafs[leaf].getViewState().type == "markdown") {
				if(mainSplit?.className.includes("mod-left-split") && mainSplit.style.display == "none") {
					//if the left side bar is collapsed
					//console.log(leafs[index].getViewState().state?.file + " is hidden");
				}
				else if(mainSplit?.className.includes("mod-right-split") && mainSplit.style.display == "none") {
					//if the right side bar is collapsed
					//console.log(leafs[index].getViewState().state?.file + " is hidden");
				}
				else if (leafStyle == "none") {
					//if the leaf is in background (invisible)
					//console.log(leafs[index].getViewState().state?.file + " is hidden");
				}
				else if (leaf == undefined) {
	
				}
				else {
					//else (if visible in foreground)
					//console.log(leafs[index].getViewState().state?.file + " is in foreground");
					visibleLeafs.push(leafs[leaf]);
				}
			}
		}//*/
		//console.log(visibleLeafs);
		return visibleLeafs;
	}

	getOpenFileInstances(leaves:WorkspaceLeaf[]): Map<string,number> {

		let fileInstances = new Map<string, number>([]);
		
		//const fileInstances: { [key: string]: number } = {}

		for (let leaf = 0; leaf < leaves.length; leaf++) {
			const file = leaves[leaf].getViewState().state?.file;
			if (fileInstances.has(file)) {
				//fileInstances[file]++;
				let num = fileInstances.get(file) + 1;
				fileInstances.delete(file);
				fileInstances.set(file, num);
			} else {
				//fileInstances.push({ })
				//fileInstances[file] = 0;
				fileInstances.set(file,1);
			}
		}
		return fileInstances;
	}

	LeafDifferenceActions(prevVisibleLeaves:WorkspaceLeaf[], prevLeaf:any, mode:string) {
		let curVisibleLeaves = this.getVisibleLeaves(this.getLeafsInWorkspace());
		
		// Dictionary to store the number of instances open for each workspace (before active leaf change and after)
		//the amount of times a note is open in the previous workspace
		let prevFileInstances = new Map<string, number>(this.getOpenFileInstances(prevVisibleLeaves));
		//the amoung of times a note is open in the current workspace
		let curFileInstances= new Map<string, number>(this.getOpenFileInstances(curVisibleLeaves));

		this.findLeafFileDifference(prevFileInstances, curFileInstances, prevLeaf);
	}

	findLeafFileDifference(oldView:Map<string,number>, newView:Map<string,number>, prevLeaf:any):Map<string,number> {
		let difference = new Map<string,number>();
		let state = ''

		// Check keys in oldView that are not in newView or have different values
		for (const [key, value] of oldView) {
			//if File exists in oldView but not in newView
			if (!newView.has(key)) {
				//File Closed
				console.log(key);
				this.writeChangelog(this.FileCloseLog(key));
				state = "close";
				//difference.set(key, (value - 1)); 
				//oldView.get(key);
			}
		}
		
		// Check keys in newView that are not in oldView
		for (const [key, value] of newView) {
			//if File exists in newView but not in oldView
			if (!oldView.has(key)) {
				//File Opened
				this.writeChangelog(this.FileOpenLog(key, prevLeaf));
				state = "open";
				//difference.set(key, value);
				//newView.get(key);
			}
		}

		if (difference.size > 0) {
			console.log(difference);
		}
	  
		return difference;
	}

	findOpenFileSameLeaf(prevFile:string, newFile:string, prevLeaf2:WorkspaceLeaf) {
		let curVisibleLeaves = this.getVisibleLeaves(this.getLeafsInWorkspace());
		let newFileOccurences = 0;
		let prevFileOccurence = 0;

		for (let leaf = 0; leaf < curVisibleLeaves.length; leaf++) {
			let file = curVisibleLeaves[leaf].getViewState().state?.file;
			if (file == prevFile) {
				prevFileOccurence++;
			}
			
			if (file == newFile) {
				newFileOccurences++;
			}
		}

		//console.log(prevLeaf2);

		//if there are no more of the file open, close it
		if (prevFileOccurence == 0) {
			this.writeChangelog(this.FileCloseLog(prevFile));					
		}

		//if there is only one file open just now, open it
		if (newFileOccurences == 1) {
			this.writeChangelog(this.FileOpenLog(newFile, prevLeaf2));
		}
	}

	CloseOpenFiles() {
		
	}
	
	//Opening and closing files done, apart from hover open file, and logic for having screen available but obsidian tabbed out and multi monitor mode
	//I think obsidian in foreground is something that is more of a system specific action so might have to ignore that for now but include condition for no leafs active at all (undefined)

	//[action:: start, end, open, close, create, modify, delete, move]
	//[method:: command, link]
	//if through link or if command based on a certain page
	//[origin:: [[note link]], file explorer, back links, graph]

	// Logic for opening and closing files
	// opened file has extra conditonal state (markdown & other), (if markdown, show file from)
	//- [[File]] Opened through [view:: viewType], [link:: ] at [date:: YYYY-MM-DD] [time:: HH:mm:ss]

	FileOpenLog(file:string, prevLeaf:any) {
		let log = "";
		let filename = this.app.vault.getAbstractFileByPath(file)?.name;
		
		if (prevLeaf == undefined) {
			log = "[target:: [[" + file + "|" + filename + "]]]  [action:: Opened]";
		}
		else {
			//let openedFrom = prevLeaf.getViewState().type;
			//log = "[target:: [[" + file + "|" + filename + "]]]  [action:: Opened] through [method:: " + openedFrom + "] from [origin::" +  + "]";
			log = "[target:: [[" + file + "|" + filename + "]]]  [action:: Opened]";
		}

		/*LOGIC ERROR
			//there is a problem where if I rearrange the layout, it will say that the note was opened from the thing that rearranged the layout
			//include opened from ribbon
			//include already open in background so not opened from anywhere (brought to foreground)
			//include else condition for any extra plugin actions (opened from so and so plugin)
			//opened through command

			//Opened from (the note that it came from)
				//markdown, graph, 
			//Opened through (how it was opened)
				//link, command, button


		*/


		//This will be for the opened from section, probably going to be a switch statement with all the different basic windows
		// 		What I can also do is to change it 
		/*
		let fileFrom = ''

		if (openedFrom == "markdown") {
			fileFrom = prevLeaf.getViewState().state?.file

			log = "[[file]] Opened through ";
		}
		else {
			log = "[[file]] Opened through";
		}*/
		
		//log = "[target:: [[" + file + "|" + filename + "]]]  [action:: Opened] through [view:: " + openedFrom + "]";

		//.getViewState().state?.file
		return log;
	}

	//- [[File]] Closed at [date:: YYYY-MM-DD] [time:: HH:mm:ss]
	FileCloseLog(file:string) {
		let filename = this.app.vault.getAbstractFileByPath(file)?.name;
		let log = "[target:: [[" + file + "|" + filename + "]]]  [action:: Closed]";
		return log;
	}

	//Logic for modifying files
	//- [[File]] Modified at [date:: YYYY-MM-DD] [time:: HH:mm:ss]
	FileModifyLog(file:string) {
		let filename = this.app.vault.getAbstractFileByPath(file)?.name;
		let log = "[target:: [[" + file + "|" + filename + "]]]  [action:: Modified]";
		return log;
	}

	// Logic for creating filees
	//- [[File]] Created at [date:: YYYY-MM-DD] [time:: HH:mm:ss]
	FileCreateLog(file:string) {
		let createdFile = this.app.vault.getAbstractFileByPath(file);
		//Should Include use cases for the different types of things created, e.g. image, file, canvas
		let fileName = createdFile?.path;

		let type:string;

		if (createdFile instanceof TFile) {
			//later look into adding different ty pes more specifically e.g. image, pdf or differentiating canvas from normal note
			if (createdFile.extension === ".md") {
				type = "Note"
			}
			else {
				type = "Attachment"
			}
		} else if (createdFile instanceof TFolder) {
			type = "Folder";
		}else {
			type = "Other";
		}
		
		let log = "[target:: [[" + file + "|" + fileName + "]]]  [type:: " + type + "]  [action:: Created]  ";
		return log;
	}

	// Logic for renaming/moving files
	//- [[OldFilePath]] renamed [[NewFilepath]] at [date:: YYYY-MM-DD] [time:: HH:mm:ss]
	FileMoveLog(file:string, oldFile:string) {
		let filename = this.app.vault.getAbstractFileByPath(file)?.name;
		let oldFolderPath = oldFile.replace('.*\/', "");
		let newFolderPath = file.replace(filename, "");
		let log;

		console.log(oldFolderPath, newFolderPath, oldFile);
		if (oldFolderPath === newFolderPath) {
			log = "[target-old:: [[" + oldFile + "]]]  [action:: Renamed] to [target-new:: [[" + file + "|" + filename + "]]]";
		}
		else {
			log = "[target-old:: [[" + oldFile + "]]]  [action:: Moved] to [target-new:: [[" + file + "|" + filename + "]]]";
		}
		
		return log;
	}

	/* Logic for deleting files
	- [[File]] Deleted at [date:: YYYY-MM-DD] [time:: HH:mm:ss]
	Perhaps instead of doing a wikilink to the note in this case, do a 
		I could treat the deleting of a file as a move, and then just create a trash bin folder like I was thinking of doing anyway, which could be a seperate vault, 
		so I move the note all the way to a different one, with a new link to that location so I can still refer to it, or keep a folder in the same vault for it 
		(later on move it, assign a trash location in settings, or use standard .trash folder option => find out how to activate in settings => files and links tab in settings!)*/
	FileDeleteLog(file:string) {
		let log = "[target:: [[" + file + "]]]  [action:: Deleted]";
		return log;
	}

	// Logic for the obsidian app opening and closing
	//Find out how to do this on start and stop
	//add maybe session information for the other logs, so I can tell if they belong to a certain session or not, but then maybe I need more states than start and stopped, e.g. paused, resumed, as well
	// close all files on pause, open all files on resume
	ObsidianStartLog(){
		let log = "[target:: Obsidian]  [action:: Started]";
		return log;
	}

	ObsidianStopLog() {
		let log = "[target:: Obsidian]  [action:: Stopped]";
		return log;
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class SampleSettingTab extends PluginSettingTab {
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
