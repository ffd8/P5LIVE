var aceSnippets = [
{
	"tabTrigger": "libs",
	"name": "libs",
	"content": 
	`let libs = ['\${1}']`
},{
	"tabTrigger": "p5",
	"name": "p5",
	"content": 
	`function setup() {
	createCanvas(windowWidth, windowHeight)
}

function draw() {
	\${1}
}
`
},{
	"tabTrigger": "w",
	"name": "w",
	"content": 
	`width`
},{
	"tabTrigger": "w/2",
	"name": "w/2",
	"content": 
	`width / 2`
},{
	"tabTrigger": "h",
	"name": "h",
	"content": 
	`height`
},{
	"tabTrigger": "h/2",
	"name": "h/2",
	"content": 
	`height / 2`
},{
	"tabTrigger": "translate",
	"name": "translate",
	"content": 
	`translate(width / 2, height / 2)`
},{
	"tabTrigger": "fc",
	"name": "fc",
	"content": 
	`frameCount`
},{
	"tabTrigger": "bg",
	"name": "bg",
	"content": 
	`background(\${1})`
},{
	"tabTrigger": "fi",
	"name": "fi",
	"content": 
	`fill(\${1})`
},{
	"tabTrigger": "nf",
	"name": "nf",
	"content": 
	`noFill()`
},{
	"tabTrigger": "s",
	"name": "s",
	"content": 
	`stroke(\${1})`
},{
	"tabTrigger": "ns",
	"name": "ns",
	"content": 
	`noStroke()`
},{
	"tabTrigger": "am",
	"name": "am",
	"content": 
	`angleMode(DEGREES)`
},{
	"tabTrigger": "rm",
	"name": "rm",
	"content": 
	`rectMode(CENTER)`
},{
	"tabTrigger": "im",
	"name": "im",
	"content": 
	`imageMode(CENTER)`
},{
	"tabTrigger": "oc",
	"name": "oc",
	"content": 
	`orbitControl(3)`
},{
	"tabTrigger": "circle",
	"name": "circle",
	"content": 
	`circle(mouseX, mouseY, 100)`
},
{
	"tabTrigger": "hydra",
	"name": "hydra",
	"content": 
	`let libs = ['https://unpkg.com/hydra-synth', 'includes/libs/hydra-synth.js']

// hydra canvas + init
let hc = document.createElement('canvas')
hc.width = window.innerWidth
hc.height = window.innerHeight
document.body.appendChild(hc)
let hydra = new Hydra({
	detectAudio: false,
	canvas: hc
})
hydra.setResolution(window.innerWidth * 2, window.innerHeight * 2) // retina res
noize = noise // use noize() since noise() is taken by p5js

// sandbox - start



// sandbox - stop
// s0.init({src:canvas}) // add to setup`
},
{
	"tabTrigger": "hydraonly",
	"name": "hydraonly",
	"content": 
	`// no p5
let libs = ['https://unpkg.com/hydra-synth', 'includes/libs/hydra-synth.js']
let hydra = new Hydra()
hydra.setResolution(window.innerWidth*2, window.innerHeight*2) // retina res
noize = noise

// sandbox - start

\${1}

// sandbox - stop`
},
{
	"tabTrigger": "sandbox",
	"name": "sandbox",
	"content": 
	`// sandbox - start
\${1}
// sandbox - stop`
},{
	"tabTrigger": "strudel",
	"name": "strudel",
	"content": 
	`// strudel
\${1}
// strudel`
},
{
	"tabTrigger": "hy5",
	"name": "hy5",
	"content": 
	`let libs = ['https://unpkg.com/hydra-synth', 'includes/libs/hydra-synth.js', 'https://cdn.jsdelivr.net/gh/ffd8/hy5@main/hy5.js', 'includes/libs/hy5.js']

// sandbox
\${1}

s0.initP5()
// sandbox`
},
{
	"tabTrigger": "HY5",
	"name": "HY5",
	"content": 
	`let libs = ['https://unpkg.com/hydra-synth', 'includes/libs/hydra-synth.js', 'https://cdn.jsdelivr.net/gh/ffd8/hy5@main/hy5.js', 'includes/libs/hy5.js']

// sandbox
\${1}

s0.initP5()
// sandbox`
},
{
	"tabTrigger": "hy5offline",
	"name": "hy5offline",
	"content": 
	`let libs = ['includes/libs/hydra-synth.js', 'includes/libs/hy5.js']

// sandbox
\${1}

// s0.initP5()
// sandbox`
},{
	"tabTrigger": "hy5-p5-hydra",
	"name": "hy5-p5-hydra",
	"content": 
	`let libs = ['https://unpkg.com/hydra-synth', 'includes/libs/hydra-synth.js', 'https://cdn.jsdelivr.net/gh/ffd8/hy5@main/hy5.js', 'includes/libs/hy5.js']

// sandbox - start
// H.pixelDensity() //  2x retina

solid().layer(src(s0))
	.out()
// sandbox - stop


function setup() {
	createCanvas(windowWidth, windowHeight)
	s0.initP5()
	P5.toggle(0)
}

function draw() {
	\${1}
}`
},{
	"tabTrigger": "hy5-hydra-p5",
	"name": "hy5-hydra-p5",
	"content": 
	`let libs = ['https://unpkg.com/hydra-synth', 'includes/libs/hydra-synth.js', 'https://cdn.jsdelivr.net/gh/ffd8/hy5@main/hy5.js', 'includes/libs/hy5.js']

// sandbox - start
\${1}
// sandbox - stop


function setup() {
	createCanvas(windowWidth, windowHeight, WEBGL)
}

function draw() {
	H.get()
	texture(h0)
	
	plane(width, height)
}`
},{
	"tabTrigger": "hy5-hydra-p5-x4",
	"name": "hy5-hydra-p5-x4",
	"content": 
	`let libs = ['https://unpkg.com/hydra-synth', 'includes/libs/hydra-synth.js', 'https://cdn.jsdelivr.net/gh/ffd8/hy5@main/hy5.js', 'includes/libs/hy5.js']

// sandbox - start
\${1}
render()
// H.toggle(0)
// sandbox - stop


function setup() {
	createCanvas(windowWidth, windowHeight, WEBGL)
}

function draw() {
	H.render()
	texture(h0)

	texture(h1)

	texture(h2)

	texture(h3)
	
}`
},{
	"tabTrigger": "hy5-hydra-p5-x4-demo",
	"name": "hy5-hydra-p5-x4-demo",
	"content": 
	`let libs = ['https://unpkg.com/hydra-synth', 'includes/libs/hydra-synth.js', 'https://cdn.jsdelivr.net/gh/ffd8/hy5@main/hy5.js', 'includes/libs/hy5.js']

// sandbox - start
osc(\${1}).out()
noize().out(o1)
voronoi().out(o2)
src(o0).diff(o1).diff(o2).out(o3)

render()
H.toggle(0)
// sandbox - stop


function setup() {
	createCanvas(windowWidth, windowHeight, WEBGL)
}

function draw() {
	clear()
	noStroke()
	orbitControl(3)
	H.render()

	texture(h0)
	plane(width/2, height/2)
	
	texture(h1)
	translate(50, 50, 50)
	plane(width/2, height/2)

	texture(h2)
	translate(50, 50, 50)
	plane(width/2, height/2)

	texture(h3)
	translate(50, 50, 50)
	plane(width/2, height/2)
}`
},{
	"tabTrigger": "h2",
	"name": "h2",
	"content": 
`var H2 = HY5.hydra('hydra2', 'synth')
synth.s0.initP5()
// H2.z(2) // bring to front

H2.pixelDensity(2)

//synth.src(synth.s0).out(synth.o0)`
},{
	"tabTrigger": "src",
	"name": "src",
	"content": 
`src(s0).out(o0)`
},{
	"tabTrigger": "push",
	"name": "push",
	"content": 
	`push()
\${1}
pop()
`
},{
	"tabTrigger": "xy2",
	"name": "xy2",
	"content": 
`xy2.clearWaves()
// xy2.freq(25)
\${1}
xy2.buildWaves()`
},{
	"tabTrigger": "midi",
	"name": "midi",
	"content": 
`setupMidi(0, 0, true)
// midi5.debug = ['note', 'controlchange']
updateMidi() // to draw`
},{
	"tabTrigger": "font",
	"name": "font",
	"content": 
`font = loadFont("includes/demos-data/fonts/RobotoMono-Regular.otf")`
},{
	"tabTrigger": "preload",
	"name": "preload",
	"content": 
`function preload(){
	\${1}
}`
},{
	"tabTrigger": "mouse",
	"name": "mouse",
	"content": 
`function mousePressed(){
	\${1}
}`
},{
	"tabTrigger": "key",
	"name": "key",
	"content": 
`function keyPressed(){
	\${1}
}`
},{
	"tabTrigger": "center",
	"name": "center",
	"content": 
`CENTER, CENTER`
},{
	"tabTrigger": "mouseXY",
	"name": "mouseXY",
	"content": 
`mouseX, mouseY`
},{
	"tabTrigger": "wh/2",
	"name": "wh/2",
	"content": 
`width/2, height/2`
},{
	"tabTrigger": "canvas",
	"name": "canvas",
	"content": 
`let cnv = document.createElement('canvas')
let ctx = cnv.getContext("2d")
var width = window.innerWidth
var height = window.innerHeight
cnv.width = width
cnv.height = height
document.body.append(cnv)

window.addEventListener('resize', ()=>{
	width = window.innerWidth
	height = window.innerHeight
	cnv.width = width
	cnv.height = height
	p5live.recompile()
})`
},{
	"tabTrigger": "fft",
	"name": "fft",
	"content": 
`for(let i = 0; i < fft.length; i++) {
	let freq = fft[i]; // (0, 255)
	let x = map(i, 0, fft.length, 0, width)
	let w = width / fft.length
	\${1}
}`
},{
	"tabTrigger": "fftEase",
	"name": "fftEase",
	"content": 
`for(let i = 0; i < fftEase.length; i++) {
	let freq = fftEase[i]; // (0, 255)
	let x = map(i, 0, fftEase.length, 0, width)
	let w = width / fftEase.length
	\${1}
}`
},{
	"tabTrigger": "waveform",
	"name": "waveform",
	"content": 
`for(let i = 0; i < waveform.length; i++) {
	let freq = waveform[i] * height / 4 // (-1, 1)
	let x = map(i, 0, waveform.length, 0, width)
	\${1}
}`
},{
	"tabTrigger": "waveformEase",
	"name": "waveformEase",
	"content": 
`for(let i = 0; i < waveformEase.length; i++) {
	let freq = waveformEase[i] * height / 4 // (-1, 1)
	let x = map(i, 0, waveformEase.length, 0, width)
	\${1}
}`
},{
	"tabTrigger": "grid",
	"name": "grid",
	"content": 
`let grid = 20; 
for(let i=0; i < grid; i++){ 
	for(let j=0; j < grid; j++){ 
		let sw = width/grid; 
		let sh = height/grid; 
		let x = map(j, 0, grid-1, 0, width-sw); 
		let y = map(i, 0, grid-1, 0, height-sh); 
		//rect(x, y, sw, sh); 
	} 
} `
},{
	"tabTrigger": ".p5live",
	"name": ".p5live",
	"content": 
`.p5live(()=>{
	// console.log(hap)
	\${1}
})`
},
]