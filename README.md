P5LIVE
-------------------------------
cc [teddavis.org](http://teddavis.org) 2019  
p5.js live-coding vj environment!


GETTING STARTED
-------------------------------
- Create, New Sketch + start coding!  
  Save, Type a name into 'Save Sketch As...' and hit Return.  
  Save As, same as above while editing existing sketch.
  
- Sketches Menu:  
  NEW, new sketch.  
  IMPORT, select JSON file from export (all or single sketch).  
  EXPORT, download entire sketch list as JSON for import.  
  CLEAR, erase entire sketches list.
  
- Sketches List:  
  Load, click on sketch name.  
  Rename, click 'id' and type new name.  
  Export, click '↓' to download JSON file for import.  
  Remove, click 'x' and comfirm removal.  
  Sort, click and drag to desired order.  
  
- Settings:  
  Font Size, adjust size of editor text.  
  Strict Compile, avoid bugs as only valid code will compiple.  
  Auto Compile, live-coding mode, refreshes on keyup.  
  Fullscreen, toggle fullScreen(), ideal for VJing  
  Eco Render, toggle loop()/noLoop() when browser   window is out of focus.
  Cursor, toggle visible cursor when hiding editor
  
- Note that all settings/sketches are stored in localStorage.  
  Clearing browser cache/storage = will probably erase sketches.   
  Be sure to export often.
  
- Write ES5 JS code (var), due to recompiling issues with let/const.

- Fan going nuts? Set `pixelDensity(1);` in `setup()` if on a retina display.
  

SHORTCUTS
-------------------------------
- CTRL + N » new sketch
- CTRL + ENTER » recompile
- CTRL + A » autocompile toggle
- CTRL + E » editor toggle
- CTRL + F » fullscreen toggle
- CTRL + M » menu toggle
- CTRL + O » open sketch prompt
- CTRL + C » cursor toggle
- CTRL + T » tidy code
- CTRL + - » decrease fontsize
- CTRL + + » increase fontsize
- CTRL + 1,2,3...0 » load first 10 sketches


FUNCTIONS
-------------------------------
- `ease(inVal, outVal, easeVal);` // use to smooth values


FUTURE
-------------------------------
- [ ] etherpad-like collaborative editing (firepad?)
- [ ] custom code/functions header
- [ ] api (get request for sketch + settings)
- [ ] mobile optimization
- [ ] additional js libs (via settings)
- [ ] audio variables (avg amp, fft)
- [ ] export image [video?]
- [ ] tree structure for sketches
- [ ] export as HTML for website usage
    

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
[github](https://github.com/ffd8/p5live)