## P5LIVE
v 1.1.1  
cc [teddavis.org](http://teddavis.org) – 2019  
p5.js collaborative live-coding vj environment!


## SHORTCUTS
- `CTRL + N` » new sketch
- `CTRL + ENTER` » softCompile
- `CTRL + SHIFT + ENTER` » hardCompile
- `CTRL + A` » autocompile toggle
- `CTRL + E` » editor toggle
- `CTRL + F` » fullscreen toggle
- `CTRL + M` » menu toggle
- `CTRL + T` » tidy code
- `CTRL + R` » references toggle
- `CTRL + C` » cursor toggle
- `CTRL + -` » decrease fontsize
- `CTRL + +` » increase fontsize
- `CTRL + S` » save png + code
- `CTRL + I` » 720*720px popup for screen-recording
- `CTRL + 1, 2, 3...0` » load first 10 sketches


## LOCALSTORAGE
Sketches are ONLY stored in your browser's localStorage,   
so export sketches/folders often!  
Clearing browser history/data will likely erase all sketches.  

This means sketches are isolated to the localStorage per domain:port,  
so export/import all sketches to migrate between online/offline/browsers.


## INSTALL
Online: [p5live.org](https://p5live.org)

Offline: [Github Repo](https://github.com/ffd8/p5live)   
Details below to run via python webserver or nodejs/npm (for complete functionality).


## GETTING STARTED
### LIVE-CODE IN 5... 4... 3... 2...
![menu-sketches-new](includes/images/menu-sketches-new-7.png)  
Create New Sketch via GUI icon or `CTRL + N` and start coding!  
Live-coding active by default, `CTRL + ENTER` to force recompile.  
Sketch is auto-saved on every keystroke.  
  
### P5LIVE MENU  
![menu-p5live](includes/images/menu-p5live-7.png)  
- About, what you're reading now.  
- Reset, re-initialize P5LIVE (erases sketches/settings).  
- Reference, `CTRL + R`, toggle p5.js reference list.  
- Save PNG + CODE, `CTRL + S`, exports timestamped image and snapshot of code.  
- Save HTML, export single-page website (re-link path to any assets).

### COCODING MENU  
![menu-cocoding-inactive](includes/images/menu-cocoding-inactive-7.png)  
- Start, click the single 'network' button.  

![menu-cocoding-active](includes/images/menu-cocoding-active-7.png)  
- Exit, click the green 'network' button.  
- Share, click copy URL and share with friends.  
- Clone sketch, saves current co-code to local sketches within session folder.  
- Lockdown (admin), limit editing, toggling privledges per user.  
- Broadcast (admin + lockdown), sync mouseX/Y/frameCount with users.

![menu-cocoding-active](includes/images/menu-cocoding-req-pre-7.png)  
- Rename, click on your name (very top) to select a new nickname.

#### Lockdown (user)
![menu-cocoding-active](includes/images/menu-cocoding-req-7.png)    
- Request Write-access, click edit button and wait for admin to allow.

#### Lockdown (admin)
![menu-cocoding-active](includes/images/menu-cocoding-admin-vote-7.png)  
- Request Deny/Accept, reject or grant write-access from users.

![menu-cocoding-active](includes/images/menu-cocoding-admin-allow-7.png)  
- Toggle Write-access, admin can always toggle write access of user.  
  
#### SKETCHES MENU 
![menu-sketches](includes/images/menu-sketches-7.png)  
- New sketch.  
- Clone sketch, duplicates active sketch.  
- New folder, used to nest sketches/folders within others.  
- Import, select JSON files from export (single/folder/all).  
- Export, exports entire sketches list as JSON for import.  
  
### SKETCH  
![menu-sketch](includes/images/menu-sketch-nav-7.png)  
Load, click on sketch name.  
Rename, click pencil icon and type new name.  
Export, click download icon to export sketch as JSON file.  
Remove, click trash icon and confirm deletion.  
Sort, click + hold + drag to desired order.  
Add to folder, careully drag + drop into/over folder.

### FOLDER  
![menu-folder](includes/images/menu-folder-nav-7.png)  
Expand/collapse, click on folder name.  
Rename, click pencil icon and type new name.  
Export, click download icon to export entire contents as JSON file.  
Remove, click trash icon and confirm deletion.  
Sort, click + hold + drag to desired order.  
  
### SETTINGS  
Check short-cuts above for faster toggling:  
- Live Coding, (auto-compiling mode), recompiles on error-free keyup.  
- Fullscreen, toggle fullScreen(), ideal for VJing.  
- Eco Render, toggle loop()/noLoop() if browser window is inactive.  
- Cursor, toggle visibility of cursor when hiding editor.  
- Console, toggle visibility of console incase of errors/warnings.  
- Menu Tab, toggles menu tab. (hide if visible while VJ'ing).  
- Font Size, adjust size of editor text.  
- Background, toggle + set color behind each line of code.  
- Theme, select custom styling of code.

### COMPILING
There are two modes of compiling in P5LIVE:  
- softCompile, `CTRL + ENTER`, (default) only replaces changed functions (smooth refresh).  
- hardCompile, `CTRL + SHIFT + ENTER`, forces entire sketch to recompile.  

Changes to global variables and `setup()`/`preload()` automatically perform a hardCompile since the entire sketch needs it. If your change only occurs within the `draw()` and custom functions (that aren't used in `setup()`), you should see a smooth transition. This is especially useful if using preloaded assets or drawing without a background during a performance, as it allows things to keep flowing. `Classes` are also softCompiled, but remember that each instance will still hold the old variables/methods, so replace each instance as needed (you'll see the updates on each new copy). If in doubt or not seeing changes, run a hardCompile, `CTRL + SHIFT + ENTER`. 
	
### SNIPPETS  
Add custom snippets to '/includes/demos/P5L_snippets.json'.  
Load snippet via shortcut, `CTRL + SHIFT + key`  

- `CTRL + SHIFT + A`, adds audio-reactive code.  
- `CTRL + SHIFT + D`, adds WEBGL code to disable depth-test.
- `CTRL + SHIFT + O`, adds OSC communication code.

### LIBRARIES
P5LIVE loads p5.js/p5.dom/p5.sound libraries by default. For additional libraries, there's an experimental mode for loading external [CDN hosted](https://www.jsdelivr.com/) javascript files (or local if running offline). Use the following syntax at the top of your sketch, placing each link into the following array:  

```
let loadScripts = [
	"", 
	""
];
```

### ASSETS
Want custom assets (fonts/images/...)?   
Load from a CORS friendly webserver (ie. [imgur](https://imgur.com) for images), or better yet,  
Clone/download from GitHub and run locally.  
Drop files into folder and link relatively, ie: `loadImage('data/fish.png');`

### PERFORMANCE
Set `pixelDensity(1);` in `setup()` if on a retina display and lagging.

### OSC/MIDI
OSC is implemented when running locally using node.js/npm.  
Load *osc_setup* demo and run Processing sketch, [p5live\_osc\_setup](https://gist.github.com/ffd8/f9f33cc7461f8467f62d5a792dde53ca)  
or use the OSC snippet (`CTRL + SHIFT + O`) and adjust in/out ports within the setup.  
MIDI is implemented with webmidi.js – see *midi_setup* demo.

### Bug?! 
Infinite loop? Broken code?  
- Add `#bug` to URL and try refreshing to stop compiler to fix a bug/infinite-loop...  
- Add `#new` to URL and refresh to force a fresh blank sketch. Then you can export and delete broken sketch, try fixing externally, and re-import.


## FUNCTIONS
Additional custom functions are available in every sketch:  
- `ease(inValue, outVariable, easeValue)`  smooth values.  
- `println(foo)` Compatibility with Processing.  
- `frameCount`, `mouseX`, `mouseY` are continous per recompile for smooth refresh.


## OFFLINE SERVER
#### Basic webserver using Python (without COCODING/OSC):  
- Clone / Download [P5LIVE](https://github.com/ffd8/p5live)  
- MacOS – open `Terminal` // Windows – open `command prompt`  
- type `cd` + `SPACEBAR` + drag/drop P5LIVE folder into window, press `ENTER` 
- check Python version, type `python --version`, press `ENTER` 
	- `Python 2.0+`, type `python -m SimpleHTTPServer 5000`, press `ENTER`    
	- `Python 3.0+`, type `python -m http.server 5000`, press `ENTER`    
- goto [http://localhost:5000](http://localhost:5000)

#### Fancy webserver using nodejs/npm (with COCODING/OSC):  
- Clone / Download [P5LIVE](https://github.com/ffd8/p5live)  
- Install Node.js + NPM ([official guide](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm) / [binary installers](https://nodejs.org/en/download/))  
- MacOS – open `Terminal` // Windows – open `command prompt`  
- type `cd` + `SPACEBAR` + drag/drop P5LIVE folder into window, press `ENTER`  
- type `npm install`, press `ENTER`  
- type `npm start`, press `ENTER`  
- goto [http://localhost:5000](http://localhost:5000)
    

## TOOLS USED
P5LIVE is possible thanks to these amazing open-source projects:  

- [p5.js](https://p5js.org), magic – v0.9.0
- [ace editor](https://ace.c9.io), code editor on top
- [peeredit / rga.js](https://github.com/jorendorff/peeredit), syncing text for cocoding
- [socket.io](https://socket.io/), websockets for cocoding
- [sortablejs](https://github.com/SortableJS/Sortable), drag + drop sorting of sketches/folders
- [beautify](https://github.com/beautify-web/js-beautify), tidy code in editor
- [jscolor](http://jscolor.com/), color picker for background
- [tippy](https://atomiks.github.io/tippyjs/), tooltips
- [download.js](http://danml.com/download.html), exporting html file
- [vex](https://github.com/HubSpot/vex), custom dialog boxes
- [markdown.js](https://github.com/cadorn/markdown-js), parsing this readme into about section
- [Roboto Mono](https://github.com/google/roboto), font
- [Feather Icons](https://feathericons.com), gui icons 
- [loading.io](https://loading.io/css/), css spinning intro loader
- [glitch.com](https://glitch.com), nodejs websocket hosting
- [p5js-osc](https://github.com/genekogan/p5js-osc/), osc connection
- [WebMidi.js](https://github.com/djipco/webmidi), midi connection


## INSPIRATION
- [cyril](https://github.com/cyrilcode/cyril)
- [Hydra](https://github.com/ojack/hydra)


## SOURCE
- [GitHub](https://github.com/ffd8/p5live)