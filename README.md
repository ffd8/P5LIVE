# P5LIVE
v 1.3.0  
cc [teddavis.org](http://teddavis.org) – 2019-2020  
p5.js collaborative live-coding vj environment!


## SHORTCUTS (default)
- `CTRL + N` » new sketch
- `CTRL + ENTER` » softCompile
- `CTRL + SHIFT + ENTER` » hardCompile
- `CTRL + A` » autocompile toggle
- `CTRL + E` » editor toggle
- `CTRL + M` » menu toggle
- `CTRL + ,` » settings toggle
- `CTRL + T` » tidy code
- `CTRL + SPACE` » autocomplete
- `CTRL + R` » references toggle
- `CTRL + C` » cursor toggle
- `CTRL + -` » decrease fontsize
- `CTRL + +` » increase fontsize
- `CTRL + S` » save png [ + code ]
- `CTRL + I` » 720*720px popup for screen-recording
- `CTRL + 1, 2, 3...0` » load first 10 sketches


## SAVING
Sketches are ONLY saved in your browser's localStorage so export all sketches regularly! Clearing browser history/data will likely erase all sketches.  

This means sketches are isolated to the localStorage per domain:port, so export/import all sketches to migrate between online/offline/browsers.


## INSTALL
Online: [p5live.org](https://p5live.org)

Offline: [Github Repo](https://github.com/ffd8/p5live)   
Details below to run via python webserver or nodejs/npm.


## GETTING STARTED
### LIVE-CODE IN 5... 4... 3...  
<img src="includes/images/menu-sketches-new-7.png" width="220px">  

- <img class="svg" src="includes/icons/file-plus.svg" height="12px"> Create New Sketch or `CTRL + N` and start coding!  
- Live-coding active by default, `CTRL + ENTER` to force recompile.  
- Sketch is auto-saved on every keystroke.  
  
## MENU
### P5LIVE MENU  
<img src="includes/images/menu-p5live-8.png" width="220px">  

- <img class="svg" src="includes/icons/help-circle.svg" height="12px"> About, what you're reading now.  
- <img class="svg" src="includes/icons/settings.svg" height="12px"> Settings, adjust editor settings + shortcuts (see details below).  
- <img class="svg" src="includes/icons/book-open-references.svg" height="12px"> Reference, `CTRL + R`, toggle p5.js reference list.  
- <img class="svg" src="includes/icons/camera.svg" height="12px"> Save .png + .json, `CTRL + S`, exports image [and snapshot of code].  
- <img class="svg" src="includes/icons/file-text.svg" height="12px"> Save .html, export single-page website (re-link path to custom assets).

### COCODING MENU  
<img src="includes/images/menu-cocoding-inactive-7.png" width="220px">  

- <img class="svg" src="includes/icons/share-2.svg" height="12px"> Press to start COCODING.  

<img src="includes/images/menu-cocoding-active-8.png" width="220px">  

- COCODING <sup>#</sub> of users - ⇡⇣ syncing up/down-stream.
- <img class="svg" src="includes/icons/power.svg" height="12px"> Exit, click the green 'power' button.  
- <img class="svg" src="includes/icons/copy.svg" height="12px"> Clone sketch, saves current co-code to local sketches within session folder.  
- <img class="svg" src="includes/icons/radio.svg" height="12px"> Sync Data, set local code for syncing local signals (midi, osc, mouse, etc.).  
- <img class="svg" src="includes/icons/unlock-mod.svg" height="12px"> Lockdown (admin), limit editing, toggle write privledges per user.  
- <img class="svg" src="includes/icons/cast.svg" height="12px"> Broadcast (admin + lockdown), sync mouseX/Y/frameCount/recompile with users.

<img src="includes/images/menu-cocoding-req-pre-7.png" width="220px">  

- Rename, click on your name (very top) to select a new nickname and color.

#### Lockdown (user)
<img src="includes/images/menu-cocoding-req-7.png" width="220px">  

- Request write-access, click edit button and wait for admin to allow.

#### Lockdown (admin)
<img src="includes/images/menu-cocoding-admin-vote-7.png" width="220px">  

- Decide write-access, reject or grant write-access from users.

<img src="includes/images/menu-cocoding-admin-allow-7.png" width="220px">  

- Toggle write-access, admin can always toggle write access per user. 

#### Chat
<img src="includes/images/menu-cocoding-chat-1.png" width="220px">   

Beyond chatting, you can send parsed links to external references. Nickname + color will update when changed. Chat displayed as notification (when active) if menu is hidden.

#### Sync Data
<img src="includes/images/menu-cocoding-syncdata-1.png" width="220px">  

<img class="svg" src="includes/icons/radio.svg" height="12px"> Press to launch Sync Data window.  

<img src="includes/images/menu-cocoding-syncdata-window-1.png" width="220px">   

Here you can enter custom local code used the COCODING session to send/get data. View preset `template` for guide on making your own, `mouseXY` and `midi` for syncing those signals. Any local data sent, needs to `parseData()` in COCODING session to access it. Further you can use `parseData()` to call `getData()` to locally process that shared data. This offers a way to control custom code parallel to the shared COCODE. Especially useful to give all users access to local siganls like MIDI or OSC. 
  
### SKETCHES MENU 
<img src="includes/images/menu-sketches-7.png" width="220px">  

- <img class="svg" src="includes/icons/file-plus.svg" height="12px"> New sketch.  
- <img class="svg" src="includes/icons/copy.svg" height="12px"> Clone sketch, duplicates active sketch.  
- <img class="svg" src="includes/icons/folder-plus.svg" height="12px"> New folder, nest sketches/folders within others.  
- <img class="svg" src="includes/icons/upload.svg" height="12px"> Import, select JSON files from export (single/folder/all).  
- <img class="svg" src="includes/icons/download.svg" height="12px"> Export, exports entire sketches list for import/backup.  
  
#### Filter
<img src="includes/images/menu-sketch-filter-blank.png" width="220px">  
<img src="includes/images/menu-sketch-filter.png" width="220px">  

Lost the overview of your sketches? Just type in keywords to match names of folders or sketches to filter and only show those results. To organize them, create a new folder with that word in the title and you can drag + drop them into it. 

#### Sketch  
<img src="includes/images/menu-sketch-nav-8.png" width="220px">  

- Load, click on sketch name.  
- <img class="svg" src="includes/icons/align-left.svg" height="12px"> Inspect,  view/edit code as popup.  
- <img class="svg" src="includes/icons/edit-3.svg" height="12px"> Rename, give sketch new name.  
- <img class="svg" src="includes/icons/download.svg" height="12px"> Export, export sketch as JSON file.  
- <img class="svg" src="includes/icons/trash-2.svg" height="12px"> Remove, delete sketch after confirmation.  
- Sort, click + hold + drag to desired order.  
- Place in folder, slowly drag + drop into/over folder.

#### Folder  
<img src="includes/images/menu-folder-nav-7.png" width="220px">  

- Expand/collapse, click on folder name.  
- <img class="svg" src="includes/icons/edit-3.svg" height="12px"> Rename, give folder new name.  
- <img class="svg" src="includes/icons/download.svg" height="12px"> Export, export entire contents as JSON file.  
- <img class="svg" src="includes/icons/trash-2.svg" height="12px"> Remove, delete folder + contents after confirmation.  
- Sort, click + hold + drag to desired order.  
  
### SETTINGS PANEL  
<img src="includes/images/menu-settings-nav.png" width="220px">

- <img class="svg" src="includes/icons/slash.svg" height="12px"> Completely reset P5LIVE (deletes all sketches!)
- <img class="svg" src="includes/icons/refresh-cw.svg" height="12px"> Reset Settings to defaults
- <img class="svg" src="includes/icons/upload.svg" height="12px"> Import Settings
- <img class="svg" src="includes/icons/download.svg" height="12px"> Export Settings
  
### Settings
- Live Coding, (auto-compiling mode), recompiles on error-free keyup.  
- Eco Render, toggle loop()/noLoop() if browser window is inactive.  
- Cursor, toggle visibility of cursor when hiding editor.  
- Console, toggle visibility of console incase of errors/warnings.  
- Menu Tab, toggles menu tab. (hide if visible while VJ'ing). 
- Snapshot Code, export current code with every image snapshot. 
- Line Numbers, toggle code editor gutter features + line numbers. 
- Autocomplete, toggle constant autocomplete suggestions. 
- Lock Code on Drag, toggle locked code editor on mouse drag. 
- Pass Editor Keys, toggle passing keyPress from editor to p5 canvas.
- Notifications, toggle notifications of setting changing shortcuts. 
- Code Size, adjust font size of editor text.  
- Code Background, toggle + set color behind each line of code.  
- Theme, select custom styling of code.

### Shortcuts
Customize by clicking on name, then press a new key combination.  

## DETAILS
### COMPILING
There are two modes of compiling in P5LIVE:  

- softCompile, `CTRL + ENTER`, (default) replaces changed functions (smooth refresh).  
- hardCompile, `CTRL + SHIFT + ENTER`, forces entire sketch to recompile.  

Changes to global variables and `setup()`/`preload()` automatically perform a hardCompile since the entire sketch needs it. If your change only occurs within the `draw()` and custom functions (that aren't used in `setup()`), you should see a smooth transition. This is especially useful if using preloaded assets or drawing without a background during a performance, as it allows things to keep flowing. `Classes` are also softCompiled, but remember that each instance will still hold the old variables/methods, so replace each instance as needed (you'll see the updates on each new copy).  

If in doubt or not seeing changes, run a hardCompile, `CTRL + SHIFT + ENTER`. 
	
### AUTOCOMPLETE
Custom autocomplete with p5.js functions and constants has been implemented.  

To activate, enter the first few characters of a function and press `CTRL + SPACE`, then select function alone or with parameters. If selecting with parameters, use `TAB` to cycle through each one.  

If you forget the name of a function, simply view the p5.js references `CTRL + R`.
	
### SNIPPETS  
Add custom snippets to '/includes/demos/P5L_snippets.json'.  
Load snippet via shortcut, `CTRL + SHIFT + key`  

- `CTRL + SHIFT + A`, adds audio-reactive code.  
- `CTRL + SHIFT + O`, adds OSC communication code.

### LIBRARIES
P5LIVE loads p5.js/p5.dom/p5.sound libraries by default. For additional libraries, load them remotely via [CDN hosted](https://www.jsdelivr.com/) or locally if running offline (ie `/data/libs/`).  

Add this snippet to the top of your sketch, placing one URL/path per array item:  

```
let libs = [
	""
	,""
];
```

### ASSETS
Load custom assets (image/font/obj/audio/...):  
 
- Remotely from a [CORS](https://enable-cors.org/resources.html) friendly server (ie. [imgur](https://imgur.com) for images)  
`loadImage('https://i.imgur.com/ijQzwsx.jpeg');`
- Locally, clone/download from GitHub and follow guide below for offline use.  
Drop files into a folder and link relatively, ie: `loadImage('data/images/fish.png');`

### EXPORT / IMPORT
Beyond exporting all sketches regularly (backup!) – you can export single sketches and/or entire folders (click the export icon next to their name). To re-import, click the import button in the Sketches panel or drag and drop the `P5L_***.json` file into the browser window.

### PERFORMANCE
Lagging or retina display creates too large of a canvas?  
Use `pixelDensity(1);` in `setup()`.

### OSC/MIDI
OSC is implemented when running locally using node.js/npm.  
Load *osc_setup* demo and run Processing sketch, [p5live\_osc\_setup](https://gist.github.com/ffd8/f9f33cc7461f8467f62d5a792dde53ca)  
or use the OSC snippet (`CTRL + SHIFT + O`) and adjust in/out ports within the setup.  
MIDI is implemented with webmidi.js – see *midi_setup* demo.

### BUG/CRASH?! 
Infinite loop? Broken code?  

- Add `#bug` to URL and refresh URL to stop compiler to fix a bug/infinite-loop...  
- Add `#new` to URL and refresh URL to force a fresh blank sketch. Then you can inspect and fix broken sketch.


### FUNCTIONS
Additional custom functions are available in every sketch:  

- `frameCount`, `mouseX`, `mouseY` are continous per recompile for smooth refresh.  
- `ease(inValue, outVariable, easeValue)`  smooth values.  
- `println(foo)` Compatibility with Processing.  


## OFFLINE SERVER
### Basic webserver using Python (without COCODING/OSC):  
- Clone / Download [P5LIVE](https://github.com/ffd8/p5live)  
- MacOS – open `Terminal` // Windows – open `command prompt`  
- type `cd` + `SPACEBAR` + drag/drop P5LIVE folder into window, press `ENTER` 
- check Python version, type `python --version`, press `ENTER` 
	- `Python 2.0+`, type `python -m SimpleHTTPServer 5000`, press `ENTER`    
	- `Python 3.0+`, type `python -m http.server 5000`, press `ENTER`    
- P5LIVE is live! visit » [http://localhost:5000](http://localhost:5000)
- To quit, `CTRL + C` in Terminal (or command prompt)

### Fancy webserver using nodejs/npm (with COCODING/OSC):  
- Clone / Download [P5LIVE](https://github.com/ffd8/p5live)  
- Install Node.js + NPM ([official guide](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm) / [binary installers](https://nodejs.org/en/download/))  
- MacOS – open `Terminal` // Windows – open `command prompt`  
- type `cd` + `SPACEBAR` + drag/drop P5LIVE folder into window, press `ENTER`  
- type `npm install`, press `ENTER`  
- type `npm start`, press `ENTER`  (for custom port: `npm start ####`)
- P5LIVE is live! visit » [http://localhost:5000](http://localhost:5000)
- To quit, `CTRL + C` in Terminal (or command prompt)


## TOOLS USED
P5LIVE is possible thanks to these amazing open-source projects:  

- [p5.js](https://p5js.org), magic – v1.0.0
- [ace editor](https://ace.c9.io), code editor on top
- [peeredit / rga.js](https://github.com/jorendorff/peeredit), syncing text for cocoding
- [socket.io](https://socket.io/), websockets for cocoding
- [sortablejs](https://github.com/SortableJS/Sortable), drag + drop sorting of sketches/folders
- [beautify](https://github.com/beautify-web/js-beautify), tidy code in editor
- [pickr](https://github.com/Simonwep/pickr), color picker
- [tippy](https://atomiks.github.io/tippyjs/), tooltips
- [download.js](http://danml.com/download.html), exporting html file
- [vex](https://github.com/HubSpot/vex), custom dialog boxes
- [marked.js](https://github.com/markedjs/marked), parsing this readme into about
- [Roboto Mono](https://github.com/google/roboto), font
- [Feather Icons](https://feathericons.com), gui icons 
- [loading.io](https://loading.io/css/), css spinning intro loader
- [glitch.com](https://glitch.com), nodejs websocket hosting
- [node-osc](https://github.com/MylesBorins/node-osc), osc connection
- [WebMidi.js](https://github.com/djipco/webmidi), midi connection
- [dropzone.js](https://www.dropzonejs.com/), drag + drop importing
- [mousetrap.js](https://craig.is/killing/mice), custom shortcut key bindings
- [load-js](https://github.com/MiguelCastillo/load-js), promise loading of libs + sketch


## INSPIRATION
- [cyril](https://github.com/cyrilcode/cyril)
- [Hydra](https://github.com/ojack/hydra)


## SOURCE
- [GitHub](https://github.com/ffd8/p5live)