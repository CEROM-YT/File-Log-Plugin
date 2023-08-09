import { 
	App, 
	Editor, 
	MarkdownView, 
	Modal, 
	Notice, 
	Plugin, 
	PluginManifest,
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
	HoverPopover,
	Command,
	WorkspaceWindow,
	HoverLinkSource,
	HoverParent
} from 'obsidian';
// ParseYaml, 

interface LeafFiles {
	curLeaf: WorkspaceLeaf;
	lastLeaf: WorkspaceLeaf | undefined;
	curFile: string | undefined;
	curType:string;
	prevFile: string | undefined;
	prevType: string;//see what it changed from if switching type of view
	active:boolean;
	logged:boolean[];//false when an updated log needs to be given
	inview:boolean;
	//start:boolean;
}

// Remember to rename these classes and interfaces!

interface NoteLogSettings {
	mySetting: string;
	logFilePath: string;
	dailyNoteFormat: string;
	logLinks:boolean;
}

const DEFAULT_SETTINGS: NoteLogSettings = {
	mySetting: 'default',
	logFilePath: '',
	dailyNoteFormat: 'YYYY-MM-DD [LOG]',
	logLinks: false
}

export default class ObsidianNoteLog extends Plugin {
	// #region Intialisation of plugin
	settings: NoteLogSettings;
	leafFiles: LeafFiles[] = [];

	//this.app.command.g

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
			this.initialiseLeafFile();
			this.logLeafChanges(false, this.processLeaves(false));
			//let leafFiles:LeafFiles[] = [];
			//this.leafFiles = //initialise leafs, and then log those changes
			this.registerOpenCloseEvents();
		});
	}

	onunload() {
		//Plugin disabled
		this.initialiseLeafFile();
		this.logLeafChanges(true, this.processLeaves(true));
		//this.leafFiles = 
		this.writeChangelog(this.ObsidianStopLog());
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	// #endregion

	// #region 

	registerGeneralEvents() {
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
			//console.log("renamed: " + file.path + " from " + oldName);
			this.writeChangelog(this.FileMoveLog(file.path, oldName));
		})); 

		/* Modify File Events
			The event is carried out every 2 seconds, and currently if editing for a long time it will show all those details
		bare in mind that the accuracy of the information would be of by +- 2 seconds at the start and end times of a modification block*/
		this.registerEvent(this.app.vault.on("modify", (file:TAbstractFile) => {
			let logfile = window.moment().format(this.settings.logFilePath);
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
			//
			this.initialiseLeafFile();
			this.logLeafChanges(true, this.processLeaves(true));

			this.writeChangelog(this.ObsidianStopLog());
		}))
	}

	registerOpenCloseEvents() {

		let hover = new Map<string,HTMLCollectionOf<Element>>()

		const debouncedActiveLeafChange = debounce(() => {
			this.initialiseLeafFile();
			this.logLeafChanges(false, this.processLeaves(false));
			//let hoverNotes = this.app.workspace.containerEl.parentElement.parentElement.parentElement.getElementsByClassName("hover-popover");
		  }, 100);

		///*File Opening (open file becomes active, can be use for closing by checking previous active leaf)
		
		this.registerEvent(this.app.workspace.on("active-leaf-change", (leaf) => {//when active leaf is changed
			//Instead of using my previous approach of handling everything through every single action on each event, only change the specifics in here 
			this.initialiseLeafFile();

			if (leaf !== undefined) {
				//get the index of the new current active leaf
				let newActiveIndex = this.leafFiles.findIndex(leafdata => leafdata.curLeaf === leaf);

				//get the index of the last active leaf
				let lastActive = this.leafFiles.find(leafdata => leafdata.active === true);
				let lastActiveIndex = this.leafFiles.findIndex(leafdata => leafdata.active === true);

				//this sets the active leaf the new active leaf to true
				this.leafFiles[newActiveIndex].active = true;
				//if there was indeed a last active leaf
				if(lastActive !== undefined) {
					//then set lastleaf to that leaf you found
					this.leafFiles[lastActiveIndex].active = false;
					this.leafFiles[newActiveIndex].lastLeaf = lastActive.curLeaf;
				}
			}
			else {
				//if there is no leaf active, close all open notes (but then comes the problem, that on the closing of the main leaf note,
				//	 it will be empty, which will also make active leaf null, unless I just don't do that), i count it as open for as long as I don't close it
			}
		}));

		//Opening and closing (when changing up the layout, closing tabs, creating new splits etc.)
		this.registerEvent(this.app.workspace.on("layout-change", () => {//When you change the layout of the workspace
			//console.log("Layout change");
			debouncedActiveLeafChange();
		}));

		//File Opening and closing (mainly for sidebars)
		this.registerEvent(this.app.workspace.on("resize", () => {//When you resize any component in the workspace
			//console.log("resize");
			debouncedActiveLeafChange();
		}))//*/

		//File Opening
		this.registerEvent(this.app.workspace.on("file-open", (file:TFile) => {//When you open a file (normal open file not custom one I want)
			//console.log("file open");
			debouncedActiveLeafChange();
		}));

		//this.app..plugins.plugins["obsidian-hover-editor"].activePopovers  

		/*
		this.app.workspace.trigger("link-hover",
			console.log('hover')
		);

		this.registerDomEvent(document, 'mouseover', (evt: MouseEvent) => {
			//console.log('click', evt);
			//console.log('mouseover', evt.target.);
			//let leafEl = app.workspace.containerEl.find(".hover-popover");
			//console.log('Hover Element: ',leafEl);
			//let allLeaves = app.workspace.getLeavesOfType("markdown");

			const targetEl = evt.target as HTMLElement;

			/*app.workspace.trigger("link-hover", {
				event: evt,
				//source: ,
				hoverParent: targetEl.parentElement,
				targetEl,
				//linktext: currFile.path,
			});*

			app.workspace.t
			
		});

		this.registerDomEvent(document, 'mouseout', (evt: MouseEvent) => {
			//console.log("not hovering anymore")
		});//*/
		
	}

	// #endregion

	// #region LeafFile Functions

	/*
	get all the leaves that currently exist and are viewable and add them to array, if they aren't in there yet, then add them newly, with initialised values
	*/
	initialiseLeafFile() {
		//let leafFiles:LeafFiles[] = [];
		//First I want to get all the visible leaves currently in the workspace window
		let allLeaves = this.getVisibleLeaves(this.getLeafsInWorkspace());//this.getVisibleLeaves(this.getLeafsInWorkspace());

		//for every existing leaf
		for (let leaf = 0; leaf < allLeaves.length; leaf++) {
			let thisLeaf = allLeaves[leaf];
			
			let thisLeafData = this.leafFiles.find( (leafdata) => leafdata.curLeaf === thisLeaf)
			//if the leaf is not already been added to leafFiles
			if (thisLeafData === undefined ) {

				let newLeaf:LeafFiles = {
					curLeaf:thisLeaf,
					lastLeaf:undefined,
					curFile:undefined,
					curType:"empty",
					prevFile:undefined,
					prevType:"empty",
					active:false,
					logged:[true, true],
					inview:true,
					//:false
				};
				
				//if can find current leaf, in visible leaves
				this.leafFiles.push(newLeaf);
			}
			//else if it already exits
		}
	}

	/*
	if a leaf has changed from how it was before, update the details stored about that leaf
	*/
	processLeaves(end:boolean):number[] {// start:boolean, end:boolean
		//let newLeafFiles:LeafFiles[] = [];
		//check what the active leaf currently is
		//let activeLeaf = leafFiles.find( leafdata => leafdata.active === true);
		let allLeaves = this.getLeafsInWorkspace();
		let visibleLeaves = this.getVisibleLeaves(allLeaves);
		//find the file occurences of each file active in the leaf

		let deleteLeafFile:number[] = [];
		let occcurences = this.getOpenFileInstances(visibleLeaves);//set occurences of the file you are trying to close

		for (let leaf = 0; leaf < this.leafFiles.length; leaf++) {
			let leafdata = this.leafFiles[leaf];
			let viewable = visibleLeaves.find(visibleLeaf => visibleLeaf === leafdata.curLeaf);//if current leaf is visible?
			
			//if there has been a change in the file shown in the leaf, or the type of the leaf has changed, and the leaf can be found in the workspace
			if ((leafdata.curFile !== leafdata.curLeaf.getViewState()?.state.file || leafdata.curType != leafdata.curLeaf.getViewState().type) || 
			(leafdata.inview === true && viewable === undefined) || (leafdata.inview === false && viewable !== undefined) || end === true) {

				//if (leafdata.curFile !== leafdata.curLeaf.getViewState().state?.file || leafdata.curType != leafdata.curLeaf.getViewState().type) {
				leafdata.logged = [true, true];//set leaf for needing updating

				//find whether there is an occurence of the new file in the leafFiles that has already been made in view
				let newFileOccurence = this.leafFiles.find(leafData => leafData.curFile === leafdata.curLeaf.getViewState()?.state.file && leafData.inview === true && leafData.curType === "markdown" && leafdata.curLeaf.getViewState()?.type === "markdown");
				
				//if there are no occurences of that file in leafFiles inview
				if (newFileOccurence === undefined && leafdata.curLeaf.getViewState()?.type == "markdown" && (leafdata.curFile !== leafdata.curLeaf.getViewState().state?.file || leafdata.inview === false)) {
					leafdata.logged[0] = false;//set leaf for needing logs for the action of opening
					leafdata.inview = true;//set to true for that leaf

				}

				//if there are no occurences of the current file somewhere else and you are trying to close it
				if ( (leafdata.curFile !== undefined && occcurences.get(leafdata.curFile) === undefined || viewable === undefined) && leafdata.curType == "markdown") {
					leafdata.inview = false;//set view for that leaf/file to false for that leaf

					let oldFileOccurence = this.leafFiles.find(leafData => leafData.curFile === leafdata.curFile && leafData.inview === true);
					//console.log(oldFileOccurence);
					if (oldFileOccurence === undefined) {
						leafdata.logged[1] = false;//set leaf for needing updating

						if (viewable === undefined) {
							//this.leafFiles.splice(leaf,1);
							deleteLeafFile.push(leaf);
						}
					}
				}

				if (end === true) {
					if (leafdata.curFile !== undefined && occcurences.get(leafdata.curFile) !== undefined) {
						//update values for files and types
						leafdata.prevFile = leafdata.curFile;
						leafdata.prevType = leafdata.curType;
						leafdata.curFile = leafdata.curLeaf.getViewState().state?.file;
						leafdata.curType = leafdata.curLeaf.getViewState().type;
						occcurences.set(leafdata.curFile, undefined);
					}
				}
				else if (end === false){
					//update values for files and types
					leafdata.prevFile = leafdata.curFile;
					leafdata.prevType = leafdata.curType;
					leafdata.curFile = leafdata.curLeaf.getViewState().state?.file;
					leafdata.curType = leafdata.curLeaf.getViewState().type;
				}
				
			}
		}

		//console.log("---------------------------");
		//console.log(this.leafFiles);
		//console.log(deleteLeafFile);

		return deleteLeafFile;
	}

	/*
	Check all the changes that have been recorded for needing updates, and then output the result of that
	*/
	logLeafChanges(end:boolean, deletedLeaf:number[]) {
		//let newLeafFiles:LeafFiles[] = [];

		//let allLeaves = this.getLeafsInWorkspace();
		//let visibleLeaves = this.getVisibleLeaves(allLeaves);
		//let openFilesMap = this.getOpenFileInstances(visibleLeaves);

		//iterate through all the leafs, that have had changes
		for (let leaf = 0; leaf < this.leafFiles.length; leaf++) {
			let leafdata = this.leafFiles[leaf];
			//let viewable = this.getVisibleLeaves(allLeaves).find(visibleLeaf => visibleLeaf === leafdata.curLeaf);//checks if leaf is currently viewable

			//rework logic for closing all open files
			if (end === true && leafdata.inview === true && leafdata.prevType === "markdown") {
				leafdata.logged[1] = false;
				leafdata.inview = false;
				//console.log("Closing open files");
			}

			if (leafdata.logged[1] === false && leafdata.prevFile !== undefined) {
				this.writeChangelog(this.FileCloseLog(leafdata.prevFile));
				leafdata.logged[1] = true
			}
			
			if (leafdata.logged[0] === false && leafdata.curFile !== undefined ) {
				this.writeChangelog(this.FileOpenLog( leafdata.curFile, this.leafFiles.find(data => data.curLeaf === leafdata.lastLeaf) ));
				leafdata.logged[0] = true
			}
		}


		for (let data = deletedLeaf.length - 1; data > -1; data--) {
			this.leafFiles.splice(deletedLeaf[data],1);
		}

		//console.log(this.leafFiles);
		//console.log("---------------------------");
		//return deletedLeaf;
	}

	//#endregion 

	// #region File Writing

	//Log building Logic

	async writeInFile(filePath: string, content: string) {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (file instanceof TFile) {
		  	await this.app.vault.append(file, content);
		} else {
		  	new Notice("Couldn't write Note log: check the file path, file might not exist");
		}
		//console.log(file, content);
	}

	buildChangelog(logText:string): string {
		let logFormat = "[[date::] YYYY-MM-DD[]] [at] [[time::] HH:mm:ss[]] [[timezone::]Z[]]";// [from] [[location:: 

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

	// #endregion

	//Open and Closing 
	//still have not factured in hover open notes
	getLeafsInWorkspace():WorkspaceLeaf[] {
		//Flaw in logic, since it doesn't count all the leaves in a different window
		//does not account for hovering over files
		let leafsInWorkspace:WorkspaceLeaf[] = [];

		//this.app.workspace.iterateAllLeaves(leaf => { leafsInWorkspace.push(leaf); });
		
		//Changed this so that instead I don't care about other types of leaves, and in this way, also find any hidden leaves that aren't showing in the workspace iterate all
		leafsInWorkspace = this.app.workspace.getLeavesOfType("markdown");
		//console.log(leafsInWorkspace);
		return leafsInWorkspace;
	}

	getVisibleLeaves(leafs:WorkspaceLeaf[] ):WorkspaceLeaf[] {

		let visibleLeafs:WorkspaceLeaf[] = [];

		for (let leaf = 0; leaf < leafs.length; leaf++) {
			//console.log(index); // prints indexes: 0, 1, 2, 3
			//console.log(arr[index].getDisplayText()); // prints elements: 10, 20, 30, 40
			let leafStyle = leafs[leaf].view.containerEl.parentElement?.style.display;
			let mainSplit = leafs[leaf].view.containerEl.parentElement?.parentElement?.parentElement?.parentElement;

			//if (leafs[leaf].getViewState().type == "markdown") {
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
				else if (leafs[leaf] == undefined) {
	
				}
				else {
					//else (if visible in foreground)
					//console.log(leafs[index].getViewState().state?.file + " is in foreground");
					visibleLeafs.push(leafs[leaf]);
				}
			//}
		}//*/
		//console.log(visibleLeafs);
		return visibleLeafs;
	}

	getOpenFileInstances(leaves:WorkspaceLeaf[]): Map<string,number> {

		let fileInstances = new Map<string, number>([]);
		
		//const fileInstances: { [key: string]: number } = {}

		for (let leaf = 0; leaf < leaves.length; leaf++) {
			//This is what is causing undefined error on close of note
			//when the leaf is destroyed or not their anymore (also close note event), you cant read the viewstate since it isn't viewable
			const file = leaves[leaf].getViewState().state?.file; 
			const type = leaves[leaf].getViewState().type
			
			if (fileInstances.has(file) && file != undefined && type == "markdown") {
				//fileInstances[file]++;
				let num = fileInstances.get(file) + 1;
				fileInstances.delete(file);
				fileInstances.set(file, num);
			} 
			else if (file != undefined){
				//fileInstances.push({ })
				//fileInstances[file] = 0;
				fileInstances.set(file,1);
			}
			else {
				//This condition is nearly right
				//fileInstances.set(fileAlt,1);
			}
		}

		return fileInstances;
	}

	// #region Log Functions
	
	//Opening and closing files done, apart from hover open file, and logic for having screen available but obsidian tabbed out and multi monitor mode
	//I think obsidian in foreground is something that is more of a system specific action so might have to ignore that for now but include condition for no leafs active at all (undefined)

	//[action:: start, end, open, close, create, modify, delete, move]
	//[method:: command, link]
	//if through link or if command based on a certain page
	//[origin:: [[note link]], file explorer, back links, graph]

	// Logic for opening and closing files
	// opened file has extra conditonal state (markdown & other), (if markdown, show file from)
	//- [[File]] Opened through [view:: viewType], [link:: ] at [date:: YYYY-MM-DD] [time:: HH:mm:ss]

	FileOpenLog(file:string, prevLeafFiles:LeafFiles | undefined) {
		let filename = this.app.vault.getAbstractFileByPath(file)?.name;
		/*
		if (prevLeafFiles !== undefined) {
			//log = "[target:: [[" + file + "|" + filename + "]]]  [action:: Opened]";
			if (prevLeafFiles.curFile !== undefined && ) {
				log = "[target:: [[" + file + "|" + filename + "]]]  [action:: Opened] through [method:: " + prevLeafFiles.curType + "] from [origin:: [[" + prevLeafFiles.curFile + "]]]";
			}
			else {
				log = "[target:: [[" + file + "|" + filename + "]]]  [action:: Opened] through [method:: " + prevLeafFiles.curType + "]";
			}
			
		}
		else {
			log = "[target:: [[" + file + "|" + filename + "]]]  [action:: Opened]";
		}//*/
		let log:string;
		if (this.settings.logLinks === true) {
			log = "[target:: [[" + file + "|" + filename + "]]]  [action:: Opened]";
		}
		else {
			log = '[target:: "' + file + '"]  [action:: Opened]';
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

		return log;
	}

	//- [[File]] Closed at [date:: YYYY-MM-DD] [time:: HH:mm:ss]
	FileCloseLog(file:string) {
		let filename = this.app.vault.getAbstractFileByPath(file)?.name;
		let log:string;
		if (this.settings.logLinks === true) {
			log = "[target:: [[" + file + "|" + filename + "]]]  [action:: Closed]";
		}
		else {
			log = '[target:: "' + file + '"]  [action:: Closed]';
		}
		
		return log;
	}

	//Logic for modifying files
	//- [[File]] Modified at [date:: YYYY-MM-DD] [time:: HH:mm:ss]
	FileModifyLog(file:string) {
		let filename = this.app.vault.getAbstractFileByPath(file)?.name;
		let log:string;
		if (this.settings.logLinks === true) {
			log = "[target:: [[" + file + "|" + filename + "]]]  [action:: Modified]";
		}
		else {
			log = '[target:: "' + file + '"]  [action:: Modified]';
		}
		return log;
	}

	// Logic for creating filees
	//- [[File]] Created at [date:: YYYY-MM-DD] [time:: HH:mm:ss]
	FileCreateLog(file:string) {
		let createdFile = this.app.vault.getAbstractFileByPath(file);
		//Should Include use cases for the different types of things created, e.g. image, file, canvas
		let fileName = createdFile?.path;
		let type:string;
		let log:string;

		if (this.settings.logLinks === true) {
			if (createdFile instanceof TFile) {
				//later look into adding different ty pes more specifically e.g. image, pdf or differentiating canvas from normal note
				if (createdFile.extension === "md") {
					type = "Note"
				}
				else {
					type = "Attachment"
				}
				//console.log(createdFile, createdFile.extension);
				log = "[target:: [[" + file + "|" + fileName + "]]]  [type:: " + type + "]  [action:: Created]";
			} else if (createdFile instanceof TFolder) {
				type = "Folder";
				log = '[target:: "' + file + '"]]]  [type:: ' + type + ']  [action:: Created]';
			}else {
				type = "Other";
				log = "[target:: [[" + file + "|" + fileName + "]  [type:: " + type + "]  [action:: Created]";
			}
		}
		else {
			if (createdFile instanceof TFile) {
				//later look into adding different ty pes more specifically e.g. image, pdf or differentiating canvas from normal note
				if (createdFile.extension === "md") {
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
			log = '[target:: "' + file + '"]  [type:: ' + type + ']  [action:: Created]';
		}
		
		return log;
	}

	// Logic for renaming/moving files
	//- [[OldFilePath]] renamed [[NewFilepath]] at [date:: YYYY-MM-DD] [time:: HH:mm:ss]
	FileMoveLog(file:string, oldFile:string) {
		let filename = this.app.vault.getAbstractFileByPath(file)?.name;
		let oldFolderPath = oldFile.replace('.*\/', "");
		let newFolderPath = file.replace(filename, "");

		let log:string;

		if (this.settings.logLinks === true) {
			if (oldFolderPath === newFolderPath || this.app.vault.getAbstractFileByPath(file) instanceof TFolder) {
				log = "[target-old:: [[" + oldFile + "]]]  [action:: Renamed] to [target:: [[" + file + "|" + filename + "]]]";
			}
			else {
				log = "[target-old:: [[" + oldFile + "]]]  [action:: Moved] to [target:: [[" + file + "|" + filename + "]]]";
			}
		}
		else {
			if (oldFolderPath === newFolderPath) {
				log = '[target-old:: "' + oldFile + '"]  [action:: Renamed] to [target:: "' + file + '"]';
			}
			else {
				log = '[target-old:: "' + oldFile + '"]  [action:: Moved] to [target:: "' + file + '"]';
			}
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
		let log:string;
		if (this.settings.logLinks === true) {
			log = "[target:: [[" + file + "]]]  [action:: Deleted]";
		}
		else {
			log = '[target:: "' + file + '"]  [action:: Deleted]';
		}
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
	// #endregion
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
	plugin: ObsidianNoteLog;

	constructor(app: App, plugin: ObsidianNoteLog) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		/*new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText( (text) => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			
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
		
		new Setting(containerEl)
			.setName('Links or Strings')
			.setDesc('Whether to have links to files enabled or just the paths to files')
			.addToggle( (toggle) => toggle
				.setValue(this.plugin.settings.logLinks)
				.onChange(async (value) => {
					this.plugin.settings.logLinks = value;
					await this.plugin.saveSettings();
				}));
	}
}
