/* 
	HY5 v0.1.1
	cc teddavis.org 2024
	hydra-synth 🙏 p5.js
	bridging the gap between hydra-synth and p5.js!
*/ 

if(window.Hydra == undefined){
	throw `HY5 error: hydra-synth.js missing?!`
}

if(window.p5 == undefined){
	throw `HY5 error: p5.js missing?!`
}

var HY5 = {
	version: '0.1.1',
	revision: 1,
	prefs : {
		delay : 50,
	},

	delay : (delay) => {
		HY5.prefs.delay = delay
	},

	hydra : (varHydra, varSynth) =>{
		return new HY5.hydraClass(varHydra, varSynth)
	}
}


var P5 = {
	active : () =>{
		if(window.hasOwnProperty('drawingContext') ){
			return true
		}else{
			return false
		}
	},

	prefs : {},

	init : (src = s0, canvas = '') => {
			if(P5.active()){
				if(canvas == ''){
					canvas = drawingContext.canvas
				}else{
					canvas = canvas.canvas
				}
				src.init({src: canvas, dynamic:true})
				P5.prefs.init = true
				P5.prefs.canvas = canvas
				P5.prefs.src = src
			}else{
				P5.prefs.initTimer = setTimeout(() => {
					P5.init(src, canvas)
				}, HY5.prefs.delay)
			}
	},

	layer: (layerName = 'layer0')=>{
		if(P5.active()){
			if(typeof window[layerName] === 'undefined'){
				window[layerName] = createGraphics(width, height)
			}
		}
	},

	hide : () => {
		if(P5.active()){
			drawingContext.canvas.style.display = 'none'
			P5.prefs.hide = true
		}else{
			P5.prefs.hideTimer = setTimeout(P5.hide, HY5.prefs.delay)
		}
	},

	show : () => {
		if(P5.active()){
			drawingContext.canvas.style.display = 'block'
			P5.prefs.hide = false
		}else{
			P5.prefs.showTimer = setTimeout(P5.show, HY5.prefs.delay)
		}
	},

	toggle : (tog = 0) => {
		if(tog){
			P5.show()
		}else{
			P5.hide()
		}
	},

	zIndex : (zVal = -1) => {
		if(P5.active()){
			drawingContext.canvas.style.zIndex = zVal
			P5.prefs.zIndex = zVal
		}else{
			P5.prefs.zTimer = setTimeout(() => {
				P5.zIndex(zVal)
			}, HY5.prefs.delay)
		}			
	},

	z : (zVal) =>{ P5.zIndex(zVal) }
}


// potential for hydra with multiple heads!
HY5.hydraClass = class HY5_HYDRA{
	constructor(hydra = 'hydra', synth = ''){
		if(window[hydra] == undefined){
			window[hydra] = new Hydra({
				detectAudio: synth == '' ? true : false,
				dynamic: false,
				makeGlobal: synth == '' ? true : false
			}) 
		}
		this.hydra = window[hydra]
		if(synth !== ''){
			window[synth] = this.hydra.synth
			window[synth].noize = this.hydra.synth.noise
		}else{
			window['noize'] = this.hydra.synth.noise // p5/hydra conflict			
		}
		this.canvas = this.hydra.canvas
		this.prefs = {
			noSmooth : true,
		}

		this.linkP5()
	}

	linkP5(){
		// p5 » hydra
		this.hydra.s.forEach((source) => {
			source.initP5 = (canvas) => {
				if(P5.active()){
					if(canvas === undefined){
						canvas = drawingContext.canvas
					}else{
						canvas = canvas.canvas
					}
					source.init({src: canvas, dynamic:true})
					P5.prefs.init = true
					P5.prefs.canvas = canvas
					P5.prefs.src = source
				}else{
					P5.prefs.initTimer = setTimeout(() => {
						source.initP5(canvas)
					}, HY5.prefs.delay, canvas)
				}
			}
		})

		// hydra » p5
		this.hydra.o.forEach((output) => {
			output.get = (layer) => {
				layer = this.checkLayer(layer)
				this.initLayer(layer)
				var sx = 0, sy = 0, swh = 1, swh = 2
				switch(output){
					case o1:
						sy = this.canvas.height/2
						break
					case o2:
						sx = this.canvas.width/2
						break
					case o3:
						sx = this.canvas.width/2
						sy = this.canvas.height/2
						break
				}
				layer.drawingContext.drawImage(this.canvas, sx, sy, this.canvas.width/swh, this.canvas.height/swh, 0, 0, layer.width, layer.height)
				return layer
			}
		})
	}

	checkLayer(layer = 'h0'){
		if(typeof window[layer] === 'undefined'){
			window[layer] = createGraphics(width, height)
			return window[layer]
		}else if(typeof layer === 'string'){
			return window[layer]
		}else{
			return layer
		}
	}

	noSmooth(toggle = true){
		this.prefs.noSmooth = toggle
	}

	smooth(toggle = false){
		this.prefs.noSmooth = toggle
	}

	initLayer(layer){
		layer.clear()
		if(this.prefs.noSmooth){
			layer.noSmooth()
		}else{
			layer.smooth()
		}
	}

	pixelDensity(res = 2){
		if(res > 10){res = 10}
		this.hydra.setResolution(window.innerWidth*res, window.innerHeight*res)
		if(P5.active()){
			resizeCanvas(windowWidth, windowHeight)
		}
		this.prefs.pixelDensity = res
	}

	pd(res = 2){
		this.pixelDensity(res)
	}

	get(out = '', layer){
		if(typeof out === 'string' && out !== ''){
			layer = out
		}
		layer = this.checkLayer(layer)
		this.initLayer(layer)
		
		var sx = 0, sy = 0, swh = 1
		if(typeof out === 'object' && out !== ''){
			swh = 2
			switch(out){
				case o1:
					sy = this.canvas.height/2
					break
				case o2:
					sx = this.canvas.width/2
					break
				case o3:
					sx = this.canvas.width/2
					sy = this.canvas.height/2
					break
			}
		}
		layer.drawingContext.drawImage(this.canvas, sx, sy, this.canvas.width/swh, this.canvas.height/swh, 0, 0, layer.width, layer.height)
		return layer
	}

	getCanvas(canvas, layer){
		layer = this.checkLayer(layer)
		this.initLayer(layer)
		layer.drawingContext.drawImage(canvas, 0, 0, layer.width, layer.height)
		return layer
	}

	render(out = '', layer = 'h'){
		var sx = 0, sy = 0, prefix = 'h'
		
		// catch custom layer as 1st param
		if(typeof out === 'string' && out !== '' && layer == 'h'){
			prefix = out
		}else if(typeof layer === 'string'){
			prefix = layer
		}

		if(out == '' || (prefix == out)){
			window[prefix] = []
			for(let i=0; i < 4; i++){
				if(typeof window[prefix+i] === 'undefined'){
					window[prefix+i] = createGraphics(width, height)
				}
				layer = window[prefix+i]
				this.initLayer(layer)

				switch(i){
					case 1:
						sy = this.canvas.height/2
						break
					case 2:
						sx = this.canvas.width/2
						sy = 0
						break
					case 3:
						sx = this.canvas.width/2
						sy = this.canvas.height/2
						break
				}
				layer.drawingContext.drawImage(this.canvas, sx, sy, this.canvas.width/2, this.canvas.height/2, 0, 0, layer.width, layer.height)
				window[prefix].push(layer)
			}
			return layer
		}else{
			if(layer !== 'h'){
				return this.get(out, layer)
			}else{
				return this.get(out)
			}	
		}
	}

	save(){
		this.hydra.synth.screencap()
	}

	hide(){
		this.canvas.style.display = 'none'
		this.prefs.hide = true
	}

	show(){
		this.canvas.style.display = 'block'
		this.prefs.hide = false
	}

	toggle(tog = 0){
		if(tog){
			this.show()
		}else{
			this.hide()
		}
	}
	
	audio(toggle = true){this.hydra.detectAudio = toggle}
	
	zIndex(zVal = -1){
		setTimeout(() => {
			this.canvas.style.zIndex = zVal
			this.prefs.zIndex = zVal
		}, HY5.prefs.delay)						
	}

	z(zVal){
		this.zIndex(zVal)
	}
}

var H = HY5.hydra('hydra', '')