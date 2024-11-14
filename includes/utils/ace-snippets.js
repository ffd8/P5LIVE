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
	`width/2`
},{
	"tabTrigger": "h",
	"name": "h",
	"content": 
	`height`
},{
	"tabTrigger": "h/2",
	"name": "h/2",
	"content": 
	`height/2`
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
// sandbox - end`
},
{
	"tabTrigger": "hy5",
	"name": "hy5",
	"content": 
	`let libs = ['https://unpkg.com/hydra-synth', 'includes/libs/hydra-synth.js', 'https://cdn.jsdelivr.net/gh/ffd8/hy5@main/hy5.js', 'includes/libs/hy5.js']

// sandbox
\${1}

// s0.initP5()
// sandbox`
},
{
	"tabTrigger": "HY5",
	"name": "HY5",
	"content": 
	`let libs = ['https://unpkg.com/hydra-synth', 'includes/libs/hydra-synth.js', 'https://cdn.jsdelivr.net/gh/ffd8/hy5@main/hy5.js', 'includes/libs/hy5.js']

// sandbox
\${1}

// s0.initP5()
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
	"tabTrigger": "push",
	"name": "push",
	"content": 
	`push()
\${1}
pop()
`
},
]