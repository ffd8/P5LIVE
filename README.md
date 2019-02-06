P5LIVE
-------------------------------
cc [teddavis.org](http://teddavis.org) 2019  
p5.js live-coding vj environment!

INSTALL
-------------------------------
- Online: [https://teddavis.org/p5live](https://teddavis.org/p5live)
- Offline: Clone and view on localserver (ie. MAMP).


SHORTCUTS
-------------------------------
- CTRL + N » new sketch
- CTRL + ENTER » compile
- CTRL + A » autocompile toggle
- CTRL + E » editor toggle
- CTRL + F » fullscreen toggle
- CTRL + M » menu toggle
- CTRL + C » cursor toggle
- CTRL + T » tidy code
- CTRL + - » decrease fontsize
- CTRL + + » increase fontsize
- CTRL + O » open sketch prompt
- CTRL + 1,2,3...0 » load first 10 sketches


GETTING STARTED
-------------------------------
- Create, New Sketch + start coding!  
Run, CTRL + ENTER to compile new code.  
Save, Type name into 'Save Sketch As...' and hit Enter.  
Save As, same as above while editing existing sketch.
  
- P5LIVE Buttons:  
	ABOUT, what you're reading now.  
	RESET, re-initialize P5LIVE.  
	DEMOS, load presets to learn from.
  
- SKETCHES Menu:  
  NEW, new sketch.  
  IMPORT, select JSON files from export (all or single sketches).  
  EXPORT, download entire sketches list as JSON for import.  
  CLEAR, erase entire sketches list.
  
- SKETCHES List:  
  Load, click on sketch name.  
  Rename, click 'id' and type new name.  
  Export, click '↓' to download sketch as JSON file.  
  Remove, click 'x' and confirm removal.  
  Sort, click and drag to desired order.  
  
- SETTINGS:  
	Auto Compile, live-coding mode, refreshes on keyup.  
	Fullscreen, toggle fullScreen(), ideal for VJing.  
	Eco Render, toggle loop()/noLoop() if browser window is inactive.  
	Cursor, toggle visible cursor when hiding editor (ctrl + e).  
	Menu Tab, toggles menu tab.  
	Hide if VJ'ing (don't forget CTRL + M for menu).  
	Font Size, adjust size of editor text.  
	Theme, set code syntax coloring (ignored in Auto Compile mode).  
	Background, set color behind each line of code.
	
- SNIPPETS:  
Add custom snippets to '/includes/demos/P5L_snippets.json'.  
Load snippets via shortcut, CTRL + SHIFT + #  
ie. CTRL + SHIFT + 1, for audio-reactive visualizations.
  
- Note that all settings/sketches are stored in localStorage.  
  Clearing browser cache/storage = will probably erase sketches.   
  Be sure to export often.
  
- Write ES5 JS code (var), due to recompiling issues with let/const.

- Fan going nuts? Set `pixelDensity(1);` in `setup()` if on a retina display.


FUNCTIONS
-------------------------------
- `ease(inVal, outVal, easeVal);` use to smooth values.
- `frameCount` is continous per loaded sketch.


FUTURE
-------------------------------
- [ ] audio variables (easedAudio, fft bands)
- [ ] etherpad-like collaborative editing (firepad?)
- [ ] custom code/functions header
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


INSPIRATION
-------------------------------
- [cyril](https://github.com/cyrilcode/cyril)
- [Hydra](https://github.com/ojack/hydra)


SOURCE
-------------------------------
- [github](https://github.com/ffd8/p5live)