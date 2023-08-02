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
	HoverPopover,
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
		//this.addSettingTab(new SampleSettingTab(this.app, this));	
		
		this.app.workspace.onLayoutReady( () => {
			//Only show create events after the file has been loaded
			this.registerGeneralEvents();
			
		});

		this.registerOpenCloseEvents();
	}

	onunload() {
		//Plugin disabled
		this.writeChangelog(this.ObsidianStopLog());
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

		//stores previous file before a new open file event
		let prevFile = prevLeaf?.getViewState().state?.file;
		let LeafFileArray:LeafFiles[] = this.initialiseLeafFile();

		const debouncedActiveLeafChange = debounce(() => {
			// Update the state and perform your actions
			//let currLeaf = this.app.workspace.getActiveViewOfType(View)?.leaf;
			//console.log(currLeaf?.getViewState().active);
			//Allows for checking what opened a leaf
			try {
				//pass through the new leaf, and the active leaf before it (can be where opened from)
				
				//this.LeafDifferenceActions(prevVisibleLeaves, prevLeaf, prevFile);

				//console.log( this.getVisibleLeaves(this.getLeafsInWorkspace()) );
				console.log( this.processLeaves(LeafFileArray, this.getLeafsInWorkspace()) );//this.getVisibleLeaves(this.getLeafsInWorkspace())
				//console.log("prevFile = " + prevFile);
			} finally { 
				//sets the old leaf to the current leaf, ready for next active leaf change
				//prevLeaf = currLeaf;
				//sets the current visible leafs as the old visible leafs
				//prevVisibleLeaves = this.getVisibleLeaves(this.getLeafsInWorkspace());
			}
			//
			
			// ...
		  }, 100);

		///*File Opening (open file becomes active, can be use for closing by checking previous active leaf)
		this.registerEvent(this.app.workspace.on("active-leaf-change", () => {//when active leaf is changed
			console.log("Leaf change");
			debouncedActiveLeafChange();
		}));

		//Opening and closing (when changing up the layout, closing tabs, creating new splits etc.)
		this.registerEvent(this.app.workspace.on("layout-change", () => {//When you change the layout of the workspace
			console.log("Layout change");
			debouncedActiveLeafChange();
		}));

		//File Opening and closing (mainly for sidebars)
		this.registerEvent(this.app.workspace.on("resize", () => {//When you resize any component in the workspace
			console.log("resize");
			debouncedActiveLeafChange();
		}))//*/

		//File Opening
		this.registerEvent(this.app.workspace.on("file-open", (file:TFile) => {//When you open a file (normal open file not custom one I want)
			console.log("file open");
			/*
			console.log("OPENED A NEW FILES");
			let currLeaf = this.app.workspace.getActiveViewOfType(View)?.leaf;
			console.log(currLeaf?.getDisplayText());
			if (currLeaf?.getViewState().type == "markdown") {
				//console.log("New file has opened!");
				let currFile = currLeaf?.getViewState().state?.file;

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
			}//*/
			debouncedActiveLeafChange();
		}));
	}

	initialiseLeafFile():LeafFiles[] {
		let leafFiles:LeafFiles[] = [];
		//First I want to get all the visible leaves currently in the workspace window
		let allLeaves = this.getLeafsInWorkspace();//this.getVisibleLeaves(this.getLeafsInWorkspace());
		let visibleLeaves = this.getVisibleLeaves(allLeaves);

		for (let leaf = 0; leaf < allLeaves.length; leaf++) {
			let newLeaf = new LeafFiles();

			newLeaf.initLeaf(allLeaves[leaf]);
			//if can find current leaf, in visible leaves
			if (visibleLeaves.find( (leaf) => newLeaf.curLeaf === leaf)) {
				newLeaf.inview = true;
			}
			leafFiles.push(newLeaf);
			//this.writeChangelog(this.FileOpenLog(leafFiles[leaf].curFile, leafFiles[leaf].leaf));
		}

		return leafFiles;
	}

	processLeaves(leafFiles:LeafFiles[], allLeaves:WorkspaceLeaf[]):LeafFiles[] {
		//this will update all the leaves that are in both the curVisibleLeaves and leafFiles
		//	but this will miss the leaves closed and opened newly

		//maps the objects from the 2 arrays to a new one, which will be the new updated values of leafFiles for current visible leaves
		let newLeafData = leafFiles.map(leafdata => { 
			//finds the leaf in the curVisibleLeaves array that is the same as the current leaf's files we are looking at
			let curleaf = allLeaves.find(curleaf => curleaf === leafdata.curLeaf); 
			//if the file for that leaf is not active/visible anymore (So leaf deleted) and it hasn't already been processed.

			//find whether the curleaf is active
			let visibleLeaves = this.getVisibleLeaves(allLeaves);
			let curVisibleLeaf = visibleLeaves.find(curVisibleLeaf => curVisibleLeaf === leafdata.curLeaf);

			/*
			//if there is atleast one leaf visible, or active
			if (curVisibleLeaf !== undefined) {
				//if the current visible leaf is of markdown type, where the files are relevant
				if (curVisibleLeaf?.getViewState().type == "markdown") {
					//if it just changed file, the file would change and not become undefined
					if (curVisibleLeaf?.getViewState().state?.file === undefined && visibleLeaves.contains(curVisibleLeaf) ) {
						leafdata.initLeaf(curVisibleLeaf);
						leafdata.updateLeafData(curVisibleLeaf);
						
					}
					//if the curFile in both of the leafs are different
					else if (leafdata.curFile != curVisibleLeaf?.getViewState().state?.file) {
						leafdata.prevFile = leafdata.curFile;					//update the prevFile to the curFile
						leafdata.curFile = curVisibleLeaf?.getViewState().state?.file; //update the curFile to the new one in curLeaf
						leafdata.active = true;//
						leafdata.logged = false;
					}
					else {
						//leafdata.prevFile = leafdata.curFile;
						//leafdata.curFile = curleaf?.getViewState().state?.file;
						leafdata.curType = curVisibleLeaf.getViewState().type;
						leafdata.prevType = leafdata.curType;
						//leafdata.active = false;
						leafdata.logged = false;
					}
				}
			}//*/
			
			return { ...leafdata, ...curleaf }; 
		});
		//So now we have dealt with closing leaves, and opeing new files in same leaves

		//We now have to process new leaves that show up by finding if they already exist in the leafFiles, and if they don't, push them into it

		//Find values that are in newLeafData but not in curVisibleLeaves (newly closed leaves)
		let expiringLeaves = newLeafData.filter(function(obj) {
			return !allLeaves.some(function(obj2) {
				return obj.curLeaf == obj2;
			});
		});

		//Find values that are in curVisibleLeaves but not in newLeafData (newly opened leaves)
		let newLeafs = allLeaves.filter(function(obj) {
			return !newLeafData.some(function(obj2) {
				return obj == obj2.curLeaf;
			});
		});

		//Finds all the unlogged leaf's that had updates (do different since I want to do actions and return final array at end)
		let unprocessedFiles = newLeafData.filter(function(obj) {
			return obj.logged == false;
		});
		//this.writeChangelog(this.FileCloseLog(leafdata.prevFile));
		//this.writeChangelog(this.FileOpenLog(leafdata.curFile, leafdata.leaf));

		//Combine the two arrays of unique entries
		console.log(expiringLeaves, newLeafs, unprocessedFiles);

		//const unprocessedLeaves = curVisibleLeaves.filter((curleaf) => !leafFiles.some(({ leaf: fileleaf }) => curleaf === fileleaf));
		//console.log(curVisibleLeaves, unprocessedLeaves);

		//find out the leaves in leafFiles not in curVisibleLeaves
		// close that leaf, with the new prevFile, and set 

		return newLeafData;
	}

	setLeafFile(leafFiles:LeafFiles[], curVisibleLeaves:WorkspaceLeaf[]) {
		//find out which of the 2 arrays is bigger and base the amount of things to process around the highest number
		let numLeaves:number = 0;
		let type:number = -1;

		//if the leafFiles array is larger
		if (leafFiles.length > curVisibleLeaves.length) {
			numLeaves = leafFiles.length
			type = 1;
		}//if the curVisibleLeaves array is larger
		else if (leafFiles.length < curVisibleLeaves.length) {
			numLeaves = curVisibleLeaves.length
			type = 2;
		}//if they are both the same length
		else {
			numLeaves = curVisibleLeaves.length
			type = 0;
		}

		//This will map the index of the leaf in both arrays
		let indeces = new Map<number, number>();

		leafFiles.forEach( (leaf) => {
			//
		})
		/*
		leafFiles.

		curVisibleLeaves.forEach( (leaf) => {
			//
			leaf.
		})*/

		//For every leaf that needs to be processed (leafs will be the unique object here)
		for (let leaf = 0; leaf < numLeaves; leaf++) {
			//first find if the leaf is in both of the arrays
			
			//then get the actual indexes, maybe push tthose items to have the same order, so that the leaf items stay in same order


			//if both the leaf in the leafFiles array is currently visible
			//if (leafFiles[leaf]) {}
			if (leafFiles[leaf].leaf === curVisibleLeaves[leaf]) {
				//if leaf files are the same
				if (leafFiles[leaf].curFile === curVisibleLeaves[leaf].getViewState().state?.file) {
					//do nothing - already in array, and processed
				}
				//else if the files are different
				else {
					//if not already processed and active
					if (leafFiles[leaf].active === false) {
						//make prevFile = curFile, and curFile = the new leaf file
						leafFiles[leaf].prevFile = leafFiles[leaf].curFile;
						leafFiles[leaf].curFile = curVisibleLeaves[leaf].getViewState().state?.file;
						leafFiles[leaf].active = true;
					}
				}	
			}
			
			//if leafFiles array has more items
			if (type === 1) {
				//one leaf has been removed from visible ones

			}//if currVisible array has more items
			else if (type === 2) {
				//extra visible leaf so needs to be added to leafFiles

			}//if they both have the same amount
			else if (type === 0) {
				//check if there are unprocessed leaves hav ebeen fully removed

			}
			//if leaf not in array
				//and leaf is not already active? - unnecessary (would have already been added to array and do nothing this time)
					//add to array, and set currFile = leaf files, active = ture, leaf = curLeaf, and prevFile = ""

			//if leaf in array but not currVisible (so closed)
				//and not already unactive
					//change that array element, leaf stays the same, prevFile = curFile, curFile = "", active = false

			//if the leaf has been completely processed, so both prevFile and curFile = "", then remove from leafFile array
		}

		try {
			//
			

		}
		finally {
			//
		}

		//After doing all of this, I can then read the values from leafFile Array to then figure out the actions to take and process the leafs
		//	 in terms of opening and closing them with their logs. Do function call for that here.
		//	 maybe allow passing in information to this function where I can then try to 
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
				else if (leaf == undefined) {
	
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

	// #region Old Leaf Logic Funcitons

	getOpenFileInstances(leaves:WorkspaceLeaf[]): Map<string,number> {

		let fileInstances = new Map<string, number>([]);
		
		//const fileInstances: { [key: string]: number } = {}

		for (let leaf = 0; leaf < leaves.length; leaf++) {
			//This is what is causing undefined error on close of note
			//when the leaf is destroyed or not their anymore (also close note event), you cant read the viewstate since it isn't viewable
			const file = leaves[leaf].getViewState().state?.file; 

			/*
			const lastOpen = leaves[leaf].view.app.workspace.getLastOpenFiles()[0];

			if (prevFile != lastOpen) {
				//console.log("file:" +prevFile + " => leaf:" + lastOpen)
			}

			const fileAlt = prevFile;//leaves[leaf].view.app.workspace.getLastOpenFiles()[0];

			//console.log("check: " + file + " => " + fileAlt);
			//console.log("Last open files: " + leaves[leaf].view.app.workspace.getLastOpenFiles());

			//console.log(leaves[leaf]);//*/
			
			if (fileInstances.has(file) && file != undefined) {
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

	LeafDifferenceActions(prevVisibleLeaves:WorkspaceLeaf[], prevLeaf:any, prevFile:string) {
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
		
		// Check keys in oldView that are not in newView or have different values
		for (const [key, value] of oldView) {
			//if File exists in oldView but not in newView
			if (!newView.has(key)) {
				//File Closed
				//console.log(key);
				this.writeChangelog(this.FileCloseLog(key));
				difference.set(key, value); 
				//oldView.get(key);
			}
		}
		
		// Check keys in newView that are not in oldView
		for (const [key, value] of newView) {
			//if File exists in newView but not in oldView
			if (!oldView.has(key)) {
				//File Opened
				this.writeChangelog(this.FileOpenLog(key, prevLeaf));
				difference.set(key, value);
				//newView.get(key);
			}
		}

		/*
		if (difference.size > 0) {
			console.log("------");
			console.log(difference);
			console.log(oldView, newView);
			console.log("------");
		}*/
	  
		return difference;
	}

	findOpenFileSameLeaf(prevFile:string, newFile:string, prevLeaf2:WorkspaceLeaf) {
		let curVisibleLeaves = this.getVisibleLeaves(this.getLeafsInWorkspace());
		let newFileOccurences = 0;
		let prevFileOccurence = 0;

		for (let leaf = 0; leaf < curVisibleLeaves.length; leaf++) {
			let file = curVisibleLeaves[leaf].getViewState().state?.file;
			if (prevFile != newFile) {
				if (file == prevFile) {
					prevFileOccurence++;
				}
				
				if (file == newFile) {
					newFileOccurences++;
				}
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

	// #endregion

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
	// #endregion
}

class LeafFiles {
	curLeaf: WorkspaceLeaf;
	lastLeaf: WorkspaceLeaf | undefined = undefined;
	curFile: string;
	curType:string
	prevFile: string = "";
	prevType: string = "";//see what it changed from if switching type of view
	active:boolean = false;
	logged:boolean = false;//update close open
	inview:boolean = false;

	//This is done when the leaf is added to the array keeping track of all leaves
	public initLeaf(newLeaf:WorkspaceLeaf) {
		this.curLeaf = newLeaf; //Sets the current leaf
		this.curFile = newLeaf.getViewState().state?.file; //Sets the current file for that current leaf
		this.curType = newLeaf.getViewState().type; //sets the type of view the current leaf is in
	}

	//because leaf becomes active on creation, we want to set that
	public focus(state: boolean) {
		this.active = state;
	}

	public view(state: boolean) {
		this.inview = state;
	}

	//updates the file 
	public updateLeafData(oldLeaf:WorkspaceLeaf) {
		//updating the leaf data
		this.prevFile = this.curFile;
		this.prevType = this.curType;
		this.curFile = this.curLeaf.getViewState().state?.file;
		this.curType = this.curLeaf.getViewState().type;
		this.lastLeaf = oldLeaf;
		this.logged = false;
	}

	public logChange(state: true) {
		this.logged = state;
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