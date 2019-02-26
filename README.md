P5LIVE
-------------------------------
v 1.0.2  
cc [teddavis.org](http://teddavis.org) 2019  
p5.js live-coding vj environment!

INSTALL
-------------------------------
- Online: [https://teddavis.org/p5live](https://teddavis.org/p5live)
- Offline: Clone and view on localserver (ie. MAMP).


SHORTCUTS
-------------------------------
- `CTRL + N` » new sketch
- `CTRL + ENTER` » compile
- `CTRL + A` » autocompile toggle
- `CTRL + E` » editor toggle
- `CTRL + F` » fullscreen toggle
- `CTRL + M` » menu toggle
- `CTRL + R` » references toggle
- `CTRL + C` » cursor toggle
- `CTRL + T` » tidy code
- `CTRL + -` » decrease fontsize
- `CTRL + +` » increase fontsize
- `CTRL + O` » open sketch prompt
- `CTRL + 1,2,3...0` » load first 10 sketches


LOCALSTORAGE
-------------------------------
Sketches are only stored in your browser's localStorage.  
Clearing browser history/data will surely erase all sketches.  
Export all sketches often.


GETTING STARTED
-------------------------------
![menu-sketches-save](includes/images/menu-sketches-save.png)
Start New Sketch `CTRL + N` and start coding!  
Live-coding mode by default, `CTRL + ENTER` to force recompile.  
Save Type name into 'Save Sketch As...' and hit Enter.  
Save As, same as above while editing existing sketch.
  
#### P5LIVE NAV  
![menu-p5live-nav](includes/images/menu-p5live-nav.png)
- About, what you're reading now.  
- Reset, re-initialize P5LIVE (erases sketches/settings).  
- Reference, toggle p5.js reference list.
  
#### SKETCHES NAV 
![menu-sketches-nav](includes/images/menu-sketches-nav.png)
- New sketch.  
- Import, select JSON file from export (all or single sketches).  
- Export, download entire sketches list as JSON for import.  
- Demos, load presets.  
- Clear, erase sketches list.
  
#### SKETCHES LIST  
![menu-sketches-list](includes/images/menu-sketches-list.png)
Load, click on sketch name.  
Rename, click pencil icon and type new name.  
Export, click download icon to download sketch as JSON file.  
Remove, click trash icon and confirm removal.  
Sort, click + hold + drag to desired order.  
  
#### SETTINGS  
Check short-cuts above for faster toggling:  
- Auto Compile, live-coding mode, refreshes on keyup.  
- Fullscreen, toggle fullScreen(), ideal for VJing.  
- Eco Render, toggle loop()/noLoop() if browser window is inactive.  
- Cursor, toggle visible cursor when hiding editor (ctrl + e).  
- Menu Tab, toggles menu tab. (hide if visible while VJ'ing).  
- Font Size, adjust size of editor text.  
- Background, set color behind each line of code.
	
#### SNIPPETS  
Add custom snippets to '/includes/demos/P5L_snippets.json'.  
Load snippets via shortcut, CTRL + SHIFT + _  
ie. CTRL + SHIFT + A, for audio-reactive visualizations.

#### ASSETS
Want custom assets (fonts/images)?   
Clone/download from github and host locally using MAMP server.  
Drop files into folder and link relatively, ('data/fish.png')

#### MISC
Fan going nuts?  
Set `pixelDensity(1);` in `setup()` if on a retina display.


FUNCTIONS
-------------------------------
- `ease(inVal, outVariable, easeVal)`  smooth values
- `frameCount`, `mouseX`, `mouseY` continous per sketch.


FUTURE
-------------------------------
- [ ] audio variables (easedAudio, fft bands)
- [ ] etherpad-like collaborative editing (firebase/yjs?)
- [ ] api (get request for sketch + settings)
- [ ] mobile optimization
- [ ] additional js libs (via settings)
- [ ] additional assets
- [ ] export image [video?]
- [ ] tree structure for sketches
- [ ] export as HTML for website usage
- [ ] autocomplete w/ p5.js functions
    

THANKS
-------------------------------
- [p5.js](https://p5js.org) (magic)
- [ace editor](https://ace.c9.io) (editor)
- [tinkerpad](https://github.com/tomhodgins/tinkerpad) (localstorage idea)
- [Roboto Mono](https://github.com/google/roboto) (font)
- [Feather Icons](https://feathericons.com) (gui icons)



INSPIRATION
-------------------------------
- [cyril](https://github.com/cyrilcode/cyril)
- [Hydra](https://github.com/ojack/hydra)


SOURCE
-------------------------------
- [github](https://github.com/ffd8/p5live)