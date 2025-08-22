/* 
	XYscope.js v0.4.4
	cc teddavis.org 2025
*/

window.XYscope = class XYscopeJS {
	constructor(p, xyAC = null, opts = null) {
		this.version = '0.4.4'
		this.id = Math.floor(Math.random() * 9999)
		this.p = p // reference to the p5 instance

		this.opts = opts
		this.xyAC = xyAC

		// console.log(typeof xyAC)
		if(typeof xyAC == 'object' && xyAC != null){
			// console.log(xyAC)
			if(xyAC.hasOwnProperty('channels')){ // *** find better filter for ac
				this.opts = JSON.parse(JSON.stringify(xyAC))
				this.xyAC = null
			}
		}

		this.webgl = this.p._renderer.drawingContext instanceof CanvasRenderingContext2D ? false : true
		this.ellipsePoints = 50
		this.shapes = []
		this.limitPathVal = 0
		this.limitPathToggle = false
		this.renderShapes = false
		this.gapSize = 1
		this.coordsOffset = 0

		this.ac
		this.oscillatorNode
		this.msgBuffer = []
		this.useLaser = false
		this.channels = {left: 0, right: 1}

		// console.log(this.opts)
		if(this.opts != null){
			if(this.opts.hasOwnProperty('channels')){
				this.channels.left = this.opts.channels[0]
				this.channels.right = this.opts.channels[1]
			}
		}

		this.coords = {x: [], y: []}
		this.frequency = {x: 50, y: 50}
		this.amplitude = {x: 1.0, y: 1.0}
		this.mirrorCoords = {x: 1, y: 1}

		this.interpolation = true

		// HERSHEY
		this.hersheyFont = []
		this.hfactor = 1
		this.hheight = 21
		this.hleading = 0
		this.textAlignX = this.p.LEFT
		this.textAlignY = this.p.CENTER
		this.fontReady = false

		this.loadFontDefault()

		this.initXY()
		this.acSampleRate = this.ac.sampleRate

		// step sequencer to freq
		this.seq = new Sequencer({
			ac: this.ac, 
			'onStep':(step)=>{
				if(!this.seq.mute){
					this.freq(step.frequency)
				}
			},
			'onStepEnded':(step)=>{
				if(!this.seq.mute){
					this.freq(1)
				}
			}
		})

		// first instance builds XXY
		if(this.xyAC == null){
			this.buildScope()
		}
	}


	/* XYSCOPE MAGICAL PROCESSOR */
	initXY() {
		// xyscope-processor audio worklet
		this.worklet = `
registerProcessor('xyscope-processor-${this.id}', class VectorProcessor extends AudioWorkletProcessor {
	constructor() {
	super()
	this.initialSampleRate = sampleRate // Store the initial sample rate
	this.sampleRate = sampleRate // Current sample rate
	this.index = 0
	
	// Initialize frequency, amplitude, and coordinates as objects
	this.channels = [${this.channels.left}, ${this.channels.right}] // *** make as constructor custom!
	this.frequency = { x: 50, y: 50 }
	this.amplitude = { x: 1.0, y: 1.0 }
	this.coords = { x: [], y: [] }
	this.stroke = { r: .5, g: .5, b: .5}

	// Initialize filters
	this.lowPassFreq = null
	this.highPassFreq = null

	this.prevLeftLowPass = 0
	this.prevLeftHighPass = 0
	this.prevRightLowPass = 0
	this.prevRightHighPass = 0
	this.prevLeftInput = 0
	this.prevRightInput = 0

	this.port.onmessage = (event) => {
			switch (event.data.type) {
				case 'coords':
					this.coords = event.data.coords || { x: [], y: [] }
					break

				case 'freq':
					this.frequency = event.data.frequency || { x: 50, y: 50 }
					break

				case 'amp':
					this.amplitude = event.data.amplitude || { x: 1.0, y: 1.0 }
					break

				case 'sampleRate':
					if (event.data.sampleRate) {
						this.sampleRate = event.data.sampleRate
					}
					break

				case 'lowPassFreq':
					this.lowPassFreq = event.data.lowPassFreq
					break

				case 'highPassFreq':
					this.highPassFreq = event.data.highPassFreq
					break

				case 'stroke':
					this.stroke = event.data.stroke
					break
			}
		}
	}

	process(inputs, outputs, parameters) {
		const output = outputs[0]
		const leftChannelSelector = this.channels[0] < output.length ? this.channels[0] : 0
		const leftChannel = output[leftChannelSelector]
		const rightChannelSelector = this.channels[1] < output.length ? this.channels[1] : 1
		const rightChannel = output[rightChannelSelector]
			// console.log([this.channels[0], this.channels[1]])
		// *** future: RGB LASER if DAC with 5+ channels, or multiple-channel scopes??
		// const rChannel = output.length > 4 ? output[2] : null
		// const gChannel = output.length > 4 ? output[3] : null
		// const bChannel = output.length > 4 ? output[4] : null

		const xCoords = this.coords.x
		const yCoords = this.coords.y

		// Calculate the ratio of the initial sample rate to the current sample rate
		const sampleRateRatio = this.sampleRate / this.initialSampleRate

		let leftIndex = this.index
		let rightIndex = this.index


		// Calculate effective frequency to maintain consistency
		const effectiveFrequencyX = this.frequency.x * sampleRateRatio
		const effectiveFrequencyY = this.frequency.y * sampleRateRatio

		// Calculate index increment based on effective frequency
		const indexIncrementLeft = effectiveFrequencyX / this.sampleRate
		const indexIncrementRight = effectiveFrequencyY / this.sampleRate

		if (xCoords.length > 0 && yCoords.length > 0) {
			let tempL = new Array(leftChannel.length)
			let tempR = new Array(leftChannel.length)
			for (let i = 0; i < leftChannel.length; i++) {
				// console.log(xCoords.length)
				let indexLeft = Math.floor(leftIndex * xCoords.length) % xCoords.length
				let indexRight = Math.floor(rightIndex * yCoords.length) % yCoords.length

				// Apply amplitude adjustments to the left channel
				let rawLeftValue = xCoords[indexLeft] * this.amplitude.x * 1.0
				let rawRightValue = yCoords[indexRight] * this.amplitude.y * -1.0

				// Apply low pass filter to the left and right channels if frequency is set
				if (this.lowPassFreq) {
					const alphaLowPass = Math.exp(-2 * Math.PI * this.lowPassFreq / this.sampleRate)
					rawLeftValue = alphaLowPass * this.prevLeftLowPass + (1 - alphaLowPass) * rawLeftValue
					rawRightValue = alphaLowPass * this.prevRightLowPass + (1 - alphaLowPass) * rawRightValue
					this.prevLeftLowPass = rawLeftValue
					this.prevRightLowPass = rawRightValue
				}
			
				// Apply aggressive high-pass filter if frequency is set
				if (this.highPassFreq) {
					const alphaHighPass = Math.exp(-2 * Math.PI * this.highPassFreq / this.sampleRate)
					const highPassFilteredLeft = alphaHighPass * (this.prevLeftHighPass + rawLeftValue - this.prevLeftInput)
					const highPassFilteredRight = alphaHighPass * (this.prevRightHighPass + rawRightValue - this.prevRightInput)

					// Update previous values
					this.prevLeftInput = rawLeftValue
					this.prevRightInput = rawRightValue

					rawLeftValue = highPassFilteredLeft
					rawRightValue = highPassFilteredRight

					this.prevLeftHighPass = highPassFilteredLeft
					this.prevRightHighPass = highPassFilteredRight
				}

				// Store the processed values to the channels
				leftChannel[i] = rawLeftValue
				rightChannel[i] = rawRightValue

				// tempL[i] = rawLeftValue
				// tempR[i] = rawRightValue

				// *** future: laser if 5+ channels
				// *** use XYscope style of RGBshapes collection
				// if(rChannel != null){
				// 	rChannel[i] = this.stroke.r // -.5?
				// 	gChannel[i] = this.stroke.g
				// 	bChannel[i] = this.stroke.b
				// }

				// Increment index independently for left and right channels
				leftIndex += indexIncrementLeft
				rightIndex += indexIncrementRight
			}
			// console.log(tempL)
			
			// let fadeInLength = 0.00001;
			// let fadeInSampleLength = Math.floor(this.sampleRate * fadeInLength);
			// for(let i=0; i < leftChannel.length; i++){
			// 	// let att = i / fadeInSampleLength;
			// 	let att = Math.min(i / fadeInSampleLength, 1.0);
			// 	leftChannel[i] = tempL[i] * att
			// 	rightChannel[i] = tempR[i] * att
			// }
			// leftChannel = tempL
			// rightChannel = tempR
		}

		// send messages from processor
		// this.port.postMessage({
		// 	left: leftChannel,
		// 	right: rightChannel,
		// })

		// Store the updated indices back to the instance properties
		this.index = (leftIndex + rightIndex) / 2.0

		return true
	}
})
`

		const blob = new Blob([this.worklet], {type: "application/javascript"})
		const url = URL.createObjectURL(blob)

		// Initialize audio context or patch to existing
		if(this.xyAC != null){
			this.ac = this.xyAC
		}else{
			this.ac = new AudioContext() //({sampleRate: 96000})
			this.channelCount = this.ac.destination.maxChannelCount
			console.log(`XYscope.js v${this.version} \nChannels: ${this.channelCount}`)
			this.ac.destination.channelCount = this.channelCount
		}
		
		this.outXY = this.ac
		this.gainNode = this.ac.createGain();
		this.splitter = this.ac.createChannelSplitter(2)
		this.analyserL = this.ac.createAnalyser()
		this.analyserR = this.ac.createAnalyser()



		this.ac.audioWorklet.addModule(url).then(() => {
			this.oscillatorNode = new AudioWorkletNode(this.ac, `xyscope-processor-${this.id}`, {
				numberOfOutputs: 1,
				outputChannelCount: [this.ac.destination.maxChannelCount]
			})

			// Create a compressor node
			// const compressor = this.ac.createDynamicsCompressor();
			// compressor.threshold.setValueAtTime(-80, this.ac.currentTime);
			// compressor.knee.setValueAtTime(5, this.ac.currentTime);
			// compressor.ratio.setValueAtTime(20, this.ac.currentTime);
			// compressor.attack.setValueAtTime(0.0, this.ac.currentTime);
			// compressor.release.setValueAtTime(0.75, this.ac.currentTime);

			// this.gainNode.connect(compressor)
			
			this.oscillatorNode.connect(this.gainNode)
			this.oscillatorNode.connect(this.splitter)
			
			this.splitter.connect(this.analyserL, 0)
			this.splitter.connect(this.analyserR, 1)

			

			// this.gainNode.connect(compressor);
			// compressor.connect(this.ac.destination)

			this.gainNode.connect(this.ac.destination)
			this.acSampleRate = this.ac.sampleRate

			// get messages from processor
			this.oscillatorNode.port.onmessage = (e) => {
				// console.log(e)
			}

			this.addToScope()
		}).catch(err => {
			console.error('Error loading AudioWorklet module:', err)
		})
	}

	resume(){
		this.ac.resume()
	}

	volume(val){
		this.gainNode.gain.setValueAtTime(this.p.constrain(val, 0, 1), 0);
	}

	fullScreen(width = this.p.windowHeight, height = this.p.windowHeight){
		this.canvas(width, height)
	}

	resize(width = this.p.windowHeight, height = this.p.windowHeight){
		this.canvas(width, height)
	}

	canvas(width = this.p.windowHeight, height = this.p.windowHeight){
		this.cnv = this.p.createCanvas(width, height)

		if(this.webgl){
			// this.cnv = this.p.createCanvas(width, height, WEBGL)
		}

		this.cnv.position(this.p.windowWidth/2 - this.cnv.width/2, this.p.windowHeight/2 - this.cnv.height/2)
		// document.getElementById("crtCanvas").style.left = this.p.windowWidth/2 - this.cnv.width/2 + 'px'
		this.p.windowResized = null
		this.p.windowResized = ()=>{
			this.cnv.position(this.p.windowWidth/2 - this.cnv.width/2, this.p.windowHeight/2 - this.cnv.height/2)
			// document.getElementById("crtCanvas").style.left = this.p.windowWidth/2 - this.cnv.width/2 + 'px'
		}
	}

	saveScope(){
		let resizedCanvas = document.createElement("canvas");
		let resizedContext = resizedCanvas.getContext("2d");
		resizedCanvas.height = this.p.windowHeight;
		resizedCanvas.width = this.p.windowWidth;
		let canvas = document.getElementById("original-canvas");
		resizedContext.drawImage(this.scope, 0, 0, resizedCanvas.width, resizedCanvas.height);

		let canvasUrl = resizedCanvas.toDataURL("image/png;base64");
		const createEl = document.createElement('a');
		createEl.href = canvasUrl;
		createEl.download = "XYscopejs_";
		createEl.click();
		
		createEl.remove();
		resizedCanvas.remove();
	}

	// getScope(){
	// 	// *** return canvas as image for p5
	// }

	buildScope(){
		this.scopeOpts = {
			gui:1,
			fullscreen:1,
			grid:0,
			opacity:0.75,
			thickness:0.01,
			hue:120,
			gain:0.1,
			intensity:-.0,
			persistence:-1,
		}

		this.scopeMenu = this.p.createDiv('').id('scope')
		
		this.scopeHolder = this.p.createDiv('').id('scope-holder').class('scope-holder-fullscreen').parent(this.scopeMenu)
		this.p.createElement('canvas').id('crtCanvas').parent(this.scopeHolder)
		this.scope = document.getElementById('crtCanvas')

		this.scopeOverlay = this.p.createDiv('XYscope.js + XXY').class('scope-title overlay').parent(this.scopeMenu)
		if(typeof this.scopeOverlay.draggable == 'function'){
			this.scopeOverlay.draggable(this.scopeMenu)
		}
		
		document.addEventListener('mousemove', ()=>{
			if(this.scopeOpts.gui){
				this.toggleScopeGUI(1)
			}
		})
		document.addEventListener('keydown', (e)=>{if(e.keyCode == 9){this.toggleScopeGUIKey()}})

		this.scopeGUI = this.p.createDiv('').class('scope-gui overlay').parent(this.scopeMenu)

		this.scopeFullscreen = this.p.createDiv('').class('scope-item').parent(this.scopeGUI)
		this.p.createDiv('fullscreen').class('scope-label').parent(this.scopeFullscreen)
		this.scopeFullscreenCheckbox = this.p.createCheckbox('').checked(true).parent(this.scopeFullscreen).input((s)=>{
			if(s.target.checked){
				this.scopeHolder.elt.classList.add('scope-holder-fullscreen')
				this.scopeOpts.fullscreen = 1
			}else{
				this.scopeHolder.elt.classList.remove('scope-holder-fullscreen')
				this.scopeOpts.fullscreen = 0
			}
		})

		this.scopeGrid = this.p.createDiv('').class('scope-item').parent(this.scopeGUI)
		this.p.createDiv('grid').class('scope-label').parent(this.scopeGrid)
		this.scopeGridCheckbox = this.p.createCheckbox('').checked(false).parent(this.scopeGrid).input((s)=>{
			if(s.target.checked){
				XXY_controls.grid = true
				XXY_Render.screenTexture = XXY_Render.loadTexture(XXY_Render.noiseImg)
			}else{
				XXY_controls.grid = false
				XXY_Render.screenTexture = XXY_Render.loadTexture(XXY_Render.noiseImg)
			}
		})

		// opacity
		this.scopeOpacity = this.p.createDiv('').class('scope-item').parent(this.scopeGUI)
		this.p.createDiv('opacity').class('scope-label').parent(this.scopeOpacity)
		this.scopeOpacitySlider = this.p.createSlider(0, 1, this.scopeOpts.opacity, .01).parent(this.scopeOpacity).class('scope-slider').input((s)=>{this.scopeSetOpacity(s.target.value, false)})
		this.scopeOpacityInput = this.p.createInput(this.scopeOpacitySlider.value()).parent(this.scopeOpacity).class('scope-input').input((s)=>{this.scopeSetOpacity(s.target.value, true, false)})
		this.scopeSetOpacity(this.scopeOpts.opacity)

		// thickness
		this.scopeThickness = this.p.createDiv('').class('scope-item').parent(this.scopeGUI)
		this.p.createDiv('thickness').class('scope-label').parent(this.scopeThickness)
		this.scopeThicknessSlider = this.p.createSlider(0.004, .2, this.scopeOpts.thickness, .001).parent(this.scopeThickness).class('scope-slider').input((s)=>{this.scopeSetThickness(s.target.value, false)})
		this.scopeThicknessInput = this.p.createInput(this.scopeThicknessSlider.value()).parent(this.scopeThickness).class('scope-input').input((s)=>{this.scopeSetThickness(s.target.value, true, false)})
		this.scopeSetThickness(this.scopeOpts.thickness)

		// hue
		this.scopeHue = this.p.createDiv('').class('scope-item').parent(this.scopeGUI)
		this.p.createDiv('hue').class('scope-label').parent(this.scopeHue)
		this.scopeHueSlider = this.p.createSlider(0, 359, this.scopeOpts.thickness, .1).parent(this.scopeHue).class('scope-slider').input((s)=>{this.scopeSetHue(s.target.value, false)})
		this.scopeHueInput = this.p.createInput(this.scopeHueSlider.value()).parent(this.scopeHue).class('scope-input').input((s)=>{this.scopeSetHue(s.target.value, true, false)})
		this.scopeSetHue(this.scopeOpts.hue)

		// gain
		this.scopeGain = this.p.createDiv('').class('scope-item').parent(this.scopeGUI)
		this.p.createDiv('gain').class('scope-label').parent(this.scopeGain)
		this.scopeGainSlider = this.p.createSlider(-3, 3, this.scopeOpts.gain, .01).parent(this.scopeGain).class('scope-slider').input((s)=>{this.scopeSetGain(s.target.value, false)})
		this.scopeGainInput = this.p.createInput(this.scopeGainSlider.value()).parent(this.scopeGain).class('scope-input').input((s)=>{this.scopeSetGain(s.target.value, true, false)})
		this.scopeSetGain(this.scopeOpts.gain)		

		// intensity
		this.scopeIntensity = this.p.createDiv('').class('scope-item').parent(this.scopeGUI)
		this.p.createDiv('intensity').class('scope-label').parent(this.scopeIntensity)
		this.scopeIntensitySlider = this.p.createSlider(-5, 5, this.scopeOpts.intensity, .01).parent(this.scopeIntensity).class('scope-slider').input((s)=>{this.scopeSetIntensity(s.target.value, false)})
		this.scopeIntensityInput = this.p.createInput(this.scopeIntensitySlider.value()).parent(this.scopeIntensity).class('scope-input').input((s)=>{this.scopeSetIntensity(s.target.value, true, false)})
		this.scopeSetIntensity(this.scopeOpts.intensity)

		// persistence
		this.scopePersistence = this.p.createDiv('').class('scope-item').parent(this.scopeGUI)
		this.p.createDiv('persistence').class('scope-label').parent(this.scopePersistence)
		this.scopePersistenceSlider = this.p.createSlider(-3.5, 4, this.scopeOpts.persistence, .01).parent(this.scopePersistence).class('scope-slider').input((s)=>{this.scopeSetPersistense(s.target.value, false)})
		this.scopePersistenceInput = this.p.createInput(this.scopePersistenceSlider.value()).parent(this.scopePersistence).class('scope-input').input((s)=>{this.scopeSetPersistense(s.target.value, true, false)})
		this.scopeSetPersistense(this.scopeOpts.persistence)

		// GUI CSS
		this.p.createElement('style', `
			#scope{
				position:fixed;
				resize: none;
				overflow: auto;
				z-index:11;
				top:5px;
				right:5px;
				min-width:220px;
				// min-height:200px;
				width:200px;
				height:auto;
				// background:black;
				border:1px solid rgba(255, 255, 255, .75);
				font-family:monospace;
				color:#fff;
				display:none;
				mix-blend-mode:lighten; // *** overlay mode, dropdown options? 
			}
			#scope *{
				outline:none;
			}
			.lighten{
				mix-blend-mode:lighten !important;
			}
			
			.overlay{
				position:relative;
				opacity:1;
				transition:opacity .2s;
				height:auto;
			}
			.overlay:hover{
				// opacity:1;
			}

			#scope-holder{
				height:auto;
				opacity:1;
			}

			.scope-holder-fullscreen{
				position:fixed;
				top:0;
				left:0;
				width:100vw;
				height:100vh !important;
				text-align:center;
				background:rgba(0, 0, 0, .75);
				opacity:1;
				z-index:0;
				pointer-events:none;
			}

			#crtCanvas{
				position:relative;
				width:100%;
				height:100%;
				z-index:1;
			}
			.scope-gui{
				background:rgba(0, 0, 0, .5);
				// mix-blend-mode:normal !important;
				// border-top:1px solid rgba(255, 255, 255, .75);
				// border-top:none;
			}
			.scope-item{
				display:flex;
				// margin-bottom:3px;
				padding:5px 5px 2px 5px;
			}
			.scope-item:hover{
				background:#333;
			}
			.scope-slider{
				width:70px;
				clear:both;
			}
			.scope-label{
				font-size:8pt;
				float:left;
				width:50%;
			}
			.scope-grid{
				margin-left:50px;
			}
			.scope-input{
				width:2em;
				border:none;
				background:none;
				color:#fff;
				border-bottom:1px solid #fff;
				font-size:70%;
				padding:0px;
				margin-left:5px;
			}
			.scope-title{
				position:relative;
				background:rgba(40, 40, 40, 1);
				border-top:2px solid rgba(100, 100, 100, 1);
				border-bottom:2px solid rgba(100, 100, 100, 1);
				// border:2px solid rgba(255, 255, 255, .75);
				text-align:center;
				padding:5px;
			}
			.scope-gui{
				position:relative;
				// padding:5px;
				// bottom:0px;
			}
		`)

		// controls.freezeImage = false
	}

	scopeSetOpacity(s, updateSlider = true, updateInput = true){
		s = this.p.constrain(s, this.scopeOpacitySlider.elt.min, this.scopeOpacitySlider.elt.max)
		this.scopeHolder.elt.style.background = `rgba(0,0,0, ${s})`
		this.scopeOpts.opacity = s
		if(updateSlider){
				this.scopeOpacitySlider.value(s)
		}
		if(updateInput){
			this.scopeOpacityInput.value(s)			
		}
	}

	scopeSetThickness(s, updateSlider = true, updateInput = true){
		s = this.p.constrain(s, this.scopeThicknessSlider.elt.min, this.scopeThicknessSlider.elt.max)
		XXY_controls.thickness = s
		this.scopeOpts.thickness = s
		if(updateSlider){
				this.scopeThicknessSlider.value(s)
		}
		if(updateInput){
			this.scopeThicknessInput.value(s)			
		}
	}

	scopeSetHue(s, updateSlider = true, updateInput = true){
		s = this.p.constrain(s, this.scopeHueSlider.elt.min, this.scopeHueSlider.elt.max)
		XXY_controls.hue = s
		this.scopeOpts.hue = s
		if(updateSlider){
				this.scopeHueSlider.value(s)
		}
		if(updateInput){
			this.scopeHueInput.value(s)			
		}
	}

	scopeSetGain(s, updateSlider = true, updateInput = true){
		s = this.p.constrain(s, this.scopeGainSlider.elt.min, this.scopeGainSlider.elt.max)
		XXY_controls.mainGain = s
		this.scopeOpts.gain = s
		if(updateSlider){
				this.scopeGainSlider.value(s)
		}
		if(updateInput){
			this.scopeGainInput.value(s)			
		}
	}

	scopeSetIntensity(s, updateSlider = true, updateInput = true){
		s = this.p.constrain(s, this.scopeIntensitySlider.elt.min, this.scopeIntensitySlider.elt.max)
		XXY_controls.exposureStops = s
		this.scopeOpts.intensity = s
		if(updateSlider){
				this.scopeIntensitySlider.value(s)
		}
		if(updateInput){
			this.scopeIntensityInput.value(s)			
		}
	}

	scopeSetPersistense(s, updateSlider = true, updateInput = true){
		s = this.p.constrain(s, this.scopePersistenceSlider.elt.min, this.scopePersistenceSlider.elt.max)
		XXY_controls.persistence = s
		this.scopeOpts.persistence = s
		if(updateSlider){
				this.scopePersistenceSlider.value(s)
		}
		if(updateInput){
			this.scopePersistenceInput.value(s)			
		}
	}

	toggleScopeGUI(toggleVal){
		if(toggleVal && !this.toggleScopeGUIHide){
			clearTimeout(this.toggleScopeGUITimer)
			this.scopeGUI.elt.style.opacity = 1
			this.scopeMenu.elt.style.borderWidth = 1
			this.scopeOverlay.elt.style.opacity = 1
			this.scopeMenu.elt.style.resize = 'horizontal'
			this.scopeGUIVisible = true

			if(this.scopeOpts.fullscreen){
				this.toggleScopeGUITimer = setTimeout(()=>{this.toggleScopeGUI(0)}, 5000)
			}
		}else{
			this.scopeGUI.elt.style.opacity = 0
			this.scopeMenu.elt.style.borderWidth = 0
			this.scopeOverlay.elt.style.opacity = 0
			this.scopeMenu.elt.style.resize = 'none'
			this.scopeGUIVisible = false			
		}
	}

	toggleScope(opts = null){
		let scope = document.getElementById('scope')

		scope.style.display = 'block'
		XXY_controls.freezeImage = false
		this.scopeVisible = true

		// optionally hide
		if (opts == 0){
			scope.style.display = 'none'
			XXY_controls.freezeImage = true
			this.scopeVisible = false
			return
		}

		if(opts !== null){

			if(opts.hasOwnProperty('fs')){
				opts.fullscreen = opts.fs
			}
			if(opts.hasOwnProperty('o')){
				opts.opacity = opts.o
			}
			if(opts.hasOwnProperty('t')){
				opts.thickness = opts.t
			}
			if(opts.hasOwnProperty('h')){
				opts.hue = opts.h
			}
			if(opts.hasOwnProperty('g')){
				opts.gain = opts.g
			}
			if(opts.hasOwnProperty('i')){
				opts.intensity = opts.i
			}
			if(opts.hasOwnProperty('p')){
				opts.persistence = opts.p
			}

			if(opts.hasOwnProperty('toggle') && opts.toggle !== this.scopeOpts.toggle){
				if(!opts.toggle){
					scope.style.display = 'none'
					XXY_controls.freezeImage = true
					this.scopeVisible = false
				}
			}

			if(opts.hasOwnProperty('hide') && opts.hide !== this.scopeOpts.hide){
				if(opts.hide){
					scope.style.visibility = 'hidden'
					this.scopeVisible = false
				}else{
					scope.style.visibility = 'visible'
					this.scopeVisible = true
				}
			}

			if(opts.hasOwnProperty('fullscreen') && opts.fullscreen !== this.scopeOpts.fullscreen){
				if(opts.fullscreen){
					this.scopeFullscreenCheckbox.checked(true)
					this.scopeHolder.elt.classList.add('scope-holder-fullscreen')
					// scope.classList.add('lighten')
				}else{
					this.scopeFullscreenCheckbox.checked(false)
					this.scopeHolder.elt.classList.remove('scope-holder-fullscreen')
					// scope.classList.remove('lighten')
				}
				this.scopeOpts.fullscreen = opts.fullscreen
			}

			if(opts.hasOwnProperty('grid') && opts.grid !== this.scopeOpts.grid && window.gl !== undefined){
				if(opts.grid){
					this.scopeGridCheckbox.checked(true)
					XXY_controls.grid = true
					XXY_Render.screenTexture = XXY_Render.loadTexture(XXY_Render.noiseImg)
				}else{
					this.scopeGridCheckbox.checked(false)
					XXY_controls.grid = false
					XXY_Render.screenTexture = XXY_Render.loadTexture(XXY_Render.noiseImg)
				}
				this.scopeOpts.grid = opts.grid
			}

			if(opts.hasOwnProperty('gui') && opts.gui !== this.scopeOpts.gui){
				if(opts.gui){
					// this.scopeGUI.elt.style.opacity = 1
					this.toggleScopeGUI(1)
				}else{
					// this.scopeGUI.elt.style.opacity = 0
					this.toggleScopeGUI(0)
				}
				this.scopeOpts.gui = opts.gui
			}

			
			if(opts.hasOwnProperty('opacity') && opts.opacity !== this.scopeOpts.opacity){
				this.scopeSetOpacity(opts.opacity)
			}
			if(opts.hasOwnProperty('thickness') && opts.thickness !== this.scopeOpts.thickness){
				this.scopeSetThickness(opts.thickness)
			}
			if(opts.hasOwnProperty('hue') && opts.hue !== this.scopeOpts.hue){
				this.scopeSetHue(opts.hue)
			}
			if(opts.hasOwnProperty('gain') && opts.gain !== this.scopeOpts.gain){
				this.scopeSetGain(opts.gain)
			}
			if(opts.hasOwnProperty('intensity') && opts.intensity !== this.scopeOpts.intensity){
				this.scopeSetIntensity(opts.intensity)
			}
			if(opts.hasOwnProperty('persistence') && opts.persistence !== this.scopeOpts.persistence){
				this.scopeSetPersistense(opts.persistence)
			}
		}
	}

	toggleScopeGUIKey(){
		if(this.scopeGUIVisible){
			this.toggleScopeGUI(0)
			this.toggleScopeGUIHide = true
		}else{
			this.toggleScopeGUIHide = false
			this.toggleScopeGUI(1)
		}
	}

	addToScope(){
		var self = this

		// patch additional XYscope instances to XXY
		if(this.xyAC != null){
			setTimeout(()=>{
					this.oscillatorNode.connect(XXY_AudioSystem.scopeNode)
			}, 100)
		}else{
			this.checkInterval = setInterval(()=>{
				try{
					XXY_check_init(self)
				}catch(e){
					console.log(e)
				}
			}, 10)
		}
	}

	postMessage(msg) {
		if(this.oscillatorNode != undefined) {
			this.oscillatorNode.port.postMessage(msg)
		}else{
			this.msgBuffer.push(msg)

			this.msgInterval = setInterval(()=>{
				if(this.oscillatorNode != undefined){
					for(let m of this.msgBuffer){
						this.postMessage(m)
					}
					this.msgBuffer = []
					clearInterval(this.msgInterval)
				}
			}, 100)
		}
		// console.log('msgBuffer: ' + this.msgBuffer.length) // check msg buffer size
	}


	/* MODULATIONS */
	sampleRate(sampleRate) {
		if(sampleRate == undefined) {
			return this.acSampleRate
		} else {
			this.acSampleRate = sampleRate
			this.postMessage({
				type: 'sampleRate',
				sampleRate: this.acSampleRate
			})
		}
	}

	lpf(freq){
		this.lowpass(freq)
	}

	lowpass(freq){
		this.postMessage({
			type: 'lowPassFreq',
			lowPassFreq: freq,
		})
	}

	hpf(freq){
		this.highpass(freq)
	}

	highpass(freq){
		this.postMessage({
			type: 'highPassFreq',
			highPassFreq: freq,
		})
	}

	stroke(r = 255, g = 255, b = 255){
		this.scopeSetHue(this.getHue(r, g, b))
		this.postMessage({
			type: 'stroke',
			stroke: {r:this.p.constrain(r/255, 0, 1), g:this.p.constrain(g/255, 0, 1), b:this.p.constrain(b/255, 0, 1)},
		})
	}

	// input: r,g,b in [0,1], out: h in [0,360) and s,v in [0,1]
	rgb2hsv(r,g,b) {
		let v=Math.max(r,g,b), c=v-Math.min(r,g,b)
		let h= c && ((v==r) ? (g-b)/c : ((v==g) ? 2+(b-r)/c : 4+(r-g)/c)) 
		return 60*(h<0?h+6:h)
	}


	getHue(red, green, blue) {
		let min = Math.min(Math.min(red, green), blue)
		let max = Math.max(Math.max(red, green), blue)

		if (min == max) {
			return 0
		}

		let hue = 0.0
		if (max == red) {
			hue = (green - blue) / (max - min)

		} else if (max == green) {
			hue = 2.0 + (blue - red) / (max - min)

		} else {
			hue = 4.0 + (red - green) / (max - min)
		}

		hue = hue * 60
		if (hue < 0) hue = hue + 360

		return Math.round(hue)
	}

	ease(iVal, oVal, eVal){
		return oVal += (iVal - oVal) * eVal;
	}

	freq(freqX, freqY) {
		if(arguments.length == 0){
			return this.frequency
		}

		if(freqX != null && typeof freqX === 'object'){
			this.frequency = {x: freqX.x, y: freqX.y}
		}else{
			if(freqY > 0 && freqY <= 1){
				let easeFreq = this.ease(freqX, this.frequency.x, freqY)
				// this.ease(freqX, this.frequency.y, freqY)
				this.frequency = {x: easeFreq, y: easeFreq}
			}else{
				this.frequency = {x: freqX, y: freqY !== undefined ? freqY : freqX}
			}
		}

		this.postMessage({
			type: 'freq',
			frequency: { x: this.frequency.x, y: this.frequency.y }
		})
	}

	amp(ampX, ampY) {
		if(arguments.length == 0){
			return this.amplitude
		}

		if(ampX != null && typeof ampX === 'object'){
			this.amplitude = {x: ampX.x, y: ampX.y}
		}else{
			if(ampY > 0 && ampY <= 1){
				let easeAmp = this.ease(ampX, this.amplitude.x, ampY)
				this.amplitude = {x: easeAmp, y: easeAmp}
			}else{
				this.amplitude = {x: ampX, y: ampY !== undefined ? ampY : ampX}
			}
		}

		this.postMessage({
			type: 'amp',
			amplitude: { x: this.amplitude.x, y: this.amplitude.y }
		}) 
	}

	smooth(gapSize = 1) {
		this.gapSize = this.p.constrain(gapSize, 1, 500)
		this.interpolation = true
	}

	noSmooth() {
		this.interpolation = false
	}

	mirror(x = 1, y = 1){
		this.mirrorCoords = {x: this.p.constrain(Math.floor(x), -1, 1), y: this.p.constrain(Math.floor(y), -1, 1)}
	}


	/* WAVES */

	clearWaves() {
		this.shapes = []
		// this.buildWaves() // glitchy sounds
	}

	buildWaves() {
		if(this.oscillatorNode) {

			this.coords = {
				x: [],
				y: []
			}
			this.coordsTemp = {
				x: [],
				y: []
			}

			for(let shape of this.shapes) {
				if(shape.length === 1) {
					// Draw a point
					let v = shape[0]
					if(v.x > this.limitPathVal && v.x < this.p.width-this.limitPathVal && v.y > this.limitPathVal && v.y < this.p.height-this.limitPathVal || !this.limitPathToggle) {
						this.coords.x.push(this.normX(v.x))
						this.coords.y.push(this.normY(v.y))
					}				
				} else {
					// Draw shapes
					for(let v of shape) {
						// *** use a frame clipping technique, rather than excluding points
						if(v.x > this.limitPathVal && v.x < this.p.width-this.limitPathVal && v.y > this.limitPathVal && v.y < this.p.height-this.limitPathVal|| !this.limitPathToggle) {
						this.coords.x.push(this.normX(v.x))
						this.coords.y.push(this.normY(v.y))
						}
					}
				}
			}

			// *** potenial alt passing of shapes/coords into small frames of audio worklet?
			// let framesCount = 128
			// this.coordsTemp.x = this.arrayWrap(this.coords.x, this.coordsOffset, framesCount)
			// this.coordsTemp.y = this.arrayWrap(this.coords.y, this.coordsOffset, framesCount)
			// this.coordsOffset += framesCount
			// this.coordsOffset %= this.coords.x.length
			// this.coordsTemp.x = this.arrayPack(this.coords.x, framesCount)
			// this.coordsTemp.y = this.arrayPack(this.coords.y, framesCount)
			// console.log([this.coordsOffset, this.coords.x.length])

			this.postMessage({
				type: 'coords',
				coords: this.coords,
			})
		}
	}

	setWaves(arrX, arrY){
		if(this.oscillatorNode) {
			this.coords = {
				x: this.setWavesConstrain(arrX),
				y: this.setWavesConstrain(arrY)
			}

			this.postMessage({
				type: 'coords',
				coords: this.coords,
			})
		}
	}

	setWavesConstrain(arr){
		let arrTemp = []
		for(let a of arr){
			arrTemp.push(this.p.constrain(a, -1.0, 1.0))
		}
		return arrTemp
	}

	// arrayWrap(array, offset, count){
	// 	let arr = new Array(count).fill(0)
	// 	for(let i=0; i < count; i++){
	// 		arr[i] = array[(offset + i) % array.length]
	// 	}
	// 	return arr
	// }

	// arrayPack(array, count){
	// 	let arr = new Array(count).fill(0)
	// 	for(let i=0; i < count; i++){
	// 		arr[i] = array[Math.floor(this.p.map(i, 0, count, 0, array.length))]
	// 	}
	// 	return arr
	// }

	limitPath(val = 0){
		if(val < 0){
			this.limitPathToggle = false
		}else{
			this.limitPathToggle = true
			this.limitPathVal = val			
		}
	}


	/* RENDERINGS */

	drawAll(opts = null){
		this.drawXY(opts)
		this.drawWave(1)
		this.drawWaveform(2)
		// this.drawShapes()
	}

	drawXY(opts = null){
		this.toggleScope(opts)
	}

	// Draw all shapes
	drawShapes(toggle = 1) {
		this.renderShapes = toggle
	}


	// removing? just use drawShapes() for best rendering
	drawPoints(strokeWeight = 1){
		return false
		// this.p.push()
		// this.p.noFill()
		// this.p.stroke(255)
		// this.p.strokeWeight(strokeWeight)
		// for(let shape of this.shapes) {
		// 	if(shape.length === 1) {
		// 		// Draw a point
		// 		this.p.point(shape[0].x, shape[0].y)
		// 	} else {
		// 		// Draw points
		// 		for(let v of shape) {
		// 			this.p.point(v.x, v.y)
		// 		}
		// 	}
		// }
		// this.p.pop()
	}

	drawPath(strokeWeight = 1){
		return false
		// this.p.push()
		// this.p.noFill()
		// this.p.stroke(255)
		// this.p.strokeWeight(strokeWeight)
		// for(let shape of this.shapes) {
		// 	if(shape.length === 1) {
		// 		// Draw a point
		// 		this.p.point(shape[0].x, shape[0].y)
		// 	} else {
		// 		// Draw shapes
		// 		this.p.beginShape()
		// 		for(let v of shape) {
		// 			this.p.vertex(v.x, v.y)
		// 		}
		// 		this.p.endShape()
		// 	}
		// }
		// this.p.pop()
	}

	drawWave(strokeWeight = 1, color = 255){
		this.analyserL.fftSize = 2048;
		const bufferLength = this.analyserL.frequencyBinCount;
		const dataL = new Float32Array(bufferLength);
		this.analyserL.getFloatTimeDomainData(dataL)
		// this.analyserL.getFloatFrequencyData(dataL) //  + 140

		this.analyserR.fftSize = 2048;
		const dataR = new Float32Array(bufferLength);
		this.analyserR.getFloatTimeDomainData(dataR) // -1, 1
		// this.analyserR.getFloatFrequencyData(dataR) //  + 140

		this.p.noFill()
		this.p.strokeWeight(strokeWeight)
		this.p.stroke(color)

		this.drawWaveRender(dataL, .25, .25)
		this.drawWaveRender(dataR, .75, .25)
	}

	drawWaveRender(data, offset, amp){
		this.p.beginShape()
		for(let i = 0; i < data.length; i++) {
			let x = i * this.p.width / data.length
			let y = this.p.height * offset + data[i] * this.p.height * amp
			if(this.webgl){
				x -= this.p.width/2
				y -= this.p.height/2
			}
			this.p.vertex(x, y)
		}
		this.p.endShape()
	}

	drawWaveform(strokeWeight = 2) {
		this.p.noFill()
		this.p.strokeWeight(strokeWeight)
		
		this.p.stroke(0, 0, 255)
		this.drawWaveformRender(this.coords.x, .25, .25)

		this.p.stroke(255, 0, 0)
		this.drawWaveformRender(this.coords.y, .75, .25)
	}

	drawWaveformRender(data, offset, amp, sampleSize = 512){
		this.p.beginShape()
		for(let i = 0; i < sampleSize; i++) {
			let val = data[floor(map(i, 0, sampleSize, 0, data.length))]
			let x = i * this.p.width / sampleSize
			let y = this.p.height * offset + val * this.p.height * amp
			if(this.webgl){
				x -= this.p.width/2
				y -= this.p.height/2
			}
			this.p.vertex(x, y)
		}
		this.p.endShape()
	}

	
	/* CAMERA */

	camSetup(){
		if(this.capture == undefined || this.camOpts.refresh){
			this.capture = this.p.createCapture(this.p.VIDEO, ()=>{
				if(this.camOpts.orientation == 'width' || this.camOpts.orientation == 1){
					this.camOpts.scale = this.p.windowWidth / this.capture.width
				}else if(this.camOpts.orientation == 'height' || this.camOpts.orientation == 0){
					this.camOpts.scale = this.p.windowHeight / this.capture.height
				}else{
					this.camOpts.scale = this.p.windowHeight / this.capture.height
				}
				this.camOpts.refresh = false
			})
				this.capture.hide() // hide raw camera
		}
	}

	cam(opts){
		if(this.capture == undefined){
			this.camOpts = {
				orientation: 'height',
				scale: 1,
				horizontal: 1,
				vertical: 1,
				rotation:0,
				refresh: true,
				toggle: 1,
			}
		}

		if(typeof(opts) == 'object'){
			if(opts.hasOwnProperty('orientation')){
				if(this.camOpts.orientation != opts.orientation){
					this.camOpts.orientation = opts.orientation
					this.camOpts.refresh = true
				}
			}
			if(opts.hasOwnProperty('o')){
				if(this.camOpts.orientation != opts.o){
					this.camOpts.orientation = opts.o
					this.camOpts.refresh = true
				}
			}
			
			if(opts.hasOwnProperty('horizontal')){
				this.camOpts.horizontal = this.p.constrain(opts.horizontal, -1, 1)
			}
			if(opts.hasOwnProperty('h')){
				this.camOpts.horizontal = this.p.constrain(opts.h, -1, 1)
			}
			
			if(opts.hasOwnProperty('vertical')){
				this.camOpts.vertical = this.p.constrain(opts.vertical, -1, 1)
			}
			if(opts.hasOwnProperty('v')){
				this.camOpts.vertical = this.p.constrain(opts.v, -1, 1)
			}
			
			if(opts.hasOwnProperty('scale')){
				if(this.capture != undefined){
					this.camOpts.orientation = 'scale'
					this.camOpts.scale = opts.scale
					this.camOpts.refresh = false
				}
			}
			if(opts.hasOwnProperty('s')){
				if(this.capture != undefined){
					this.camOpts.orientation = 'scale'
					this.camOpts.scale = opts.s
					this.camOpts.refresh = false
				}
			}
			
			if(opts.hasOwnProperty('rotation')){
				this.camOpts.rotation = opts.rotation
			}
			if(opts.hasOwnProperty('r')){
				this.camOpts.rotation = opts.r
			}

			if(opts.hasOwnProperty('toggle')){
				this.camOpts.toggle = opts.toggle
			}
			if(opts.hasOwnProperty('t')){
				this.camOpts.toggle = opts.t
			}
		}else if(opts == 1 || opts == 0 || opts == 'width' || opts == 'height'){
			if(this.camOpts.orientation != opts){
				this.camOpts.orientation = opts
				this.camOpts.refresh = true
			}
		}else if(typeof(opts) == 'number'){
			this.camOpts.orientation = 'scale'
			this.camOpts.scale = opts
			if(this.capture != undefined){
				this.camOpts.refresh = false
			}
		}

		if(this.capture == undefined || this.camOpts.refresh){
			this.camSetup()
		}

		if(this.capture != undefined){
			if(this.camOpts.toggle){
				this.camDisplay()
			}
		}
	}

	camDisplay(){
		this.p.push()
		this.p.angleMode(DEGREES)
		this.p.imageMode(this.p.CENTER)
		if(!this.webgl){
			this.p.translate(this.p.width/2, this.p.height/2)
		}
		this.p.scale(this.camOpts.horizontal, this.camOpts.vertical)
		this.p.rotate(this.camOpts.rotation)
		this.p.image(this.capture, 0, 0, this.capture.width * this.camOpts.scale, this.capture.height * this.camOpts.scale)
		this.p.pop()
	}


	/* 2D PRIMATIVES */


	point(x = 0, y = 0, z = 0) {
		if(arguments.length < 2){
			x = this.p.random(this.p.width)
			y = this.p.random(this.p.height)
			if(this.webgl){
				x = this.p.random(-this.p.width/2, this.p.width/2)
				y = this.p.random(-this.p.height/2, this.p.height/2)
			}
		}

		let vertices = [
			this.createVector(x, y, z)
		]
		this.shapes.push(vertices)

		if(this.renderShapes){
			if(z != 0){
				this.p.point(x, y, z)
			}else{
				this.p.point(x, y)	
			}
		}
	}

	line(x1, y1, z1, x2, y2, z2) {
		let vertices

		if(arguments.length < 4){
			x1 = this.p.width/2
			y1 = this.p.height/2
			x2 = this.p.random(this.p.width)
			y2 = this.p.random(this.p.height)
			if(this.webgl){
				x1 = 0
				y1 = 0
				x2 = this.p.random(-this.p.width/2, this.p.width/2)
				y2 = this.p.random(-this.p.height/2, this.p.height/2)
			}

			vertices = [
				this.createVector(x1, y1),
				this.createVector(x2, y2),
			]
		}else if(arguments.length === 4){
			vertices = [
				this.createVector(x1, y1),
				this.createVector(z1, x2)
			]
		}else if(arguments.length === 6){
			vertices = [
				this.createVector(x1, y1, z1),
				this.createVector(x2, y2, z2)
			]
		}

		this.shapesInterpolation(vertices)

		if(this.renderShapes){
			this.p.line(x1, y1, x2, y2)
		}
	}

	rectMode(mode) {
		this.p._renderer._rectMode = mode
	}

	square(x = 0, y = 0, s = 100) {
		this.rect(x, y, s, s)
		
		if(this.renderShapes){
			this.p.square(x, y, s)
		}
	}

	rect(x = 0, y = 0, w = 100, h) {
		if(h == undefined) {
			h = w
		}
		let vertices
		switch (this.p._renderer._rectMode) {
			case this.p.CORNERS:
				vertices = [
					this.createVector(x, y),
					this.createVector(w, y),
					this.createVector(w, h),
					this.createVector(x, h),
					this.createVector(x, y)
				]
				break
			case this.p.RADIUS:
				vertices = [
					this.createVector(x - w, y - h),
					this.createVector(x + w, y - h),
					this.createVector(x + w, y + h),
					this.createVector(x - w, y + h),
					this.createVector(x - w, y - h)
				]
				break
			case this.p.CENTER:
				vertices = [
					this.createVector(x - w / 2, y - h / 2),
					this.createVector(x + w / 2, y - h / 2),
					this.createVector(x + w / 2, y + h / 2),
					this.createVector(x - w / 2, y + h / 2),
					this.createVector(x - w / 2, y - h / 2)
				]
				break
			case this.p.CORNER:
			default:
				vertices = [
					this.createVector(x, y),
					this.createVector(x + w, y),
					this.createVector(x + w, y + h),
					this.createVector(x, y + h),
					this.createVector(x, y)
				]
				break
		}
		this.shapesInterpolation(vertices)

		if(this.renderShapes){
			this.p.rect(x, y, w, h)
		}
	}

	ellipseDetail(newVal){
		if(newVal == undefined){
			return this.ellipsePoints
		}else{
			this.ellipsePoints = abs(newVal) > 0 ? newVal : 4
		}
	}

	circle(cx = 0, cy = 0, r = 100, numPoints = 50) {
		let tempAM = this.p.angleMode()
		this.p.angleMode(this.p.RADIANS)

		if(arguments.length < 4){
			numPoints = this.ellipsePoints
		}
		numPoints = this.p.constrain(numPoints, 1, 360);

		let vertices = []
		for(let i = 0; i < this.p.TWO_PI; i += this.p.TWO_PI / numPoints) {
			let x = cx + r / 2 * this.p.cos(i)
			let y = cy + r / 2 * this.p.sin(i)
			vertices.push(this.createVector(x, y))
		}
		vertices.push(vertices[0])

		this.shapesInterpolation(vertices)
		this.p.angleMode(tempAM)

		if(this.renderShapes){
			this.p.circle(cx, cy, r, r)
		}
	}

	ellipse(cx = 0, cy = 0, w = 100, h, numPoints = 50) {
		let tempAM = this.p.angleMode()
		this.p.angleMode(this.p.RADIANS)

		if(arguments.length < 4){
			numPoints = this.ellipsePoints
		}
		numPoints = this.p.constrain(numPoints, 1, 360);

		if(h == undefined) {
			h = w
		}
		let vertices = []
		for(let i = 0; i < this.p.TWO_PI; i += this.p.TWO_PI / numPoints) {
			let x = cx + (w / 2) * this.p.cos(i)
			let y = cy + (h / 2) * this.p.sin(i)
			vertices.push(this.createVector(x, y))
		}
		vertices.push(vertices[0])

		this.shapesInterpolation(vertices)
		this.p.angleMode(tempAM)

		if(this.renderShapes){
			this.p.ellipse(cx, cy, w, h)
		}
	}

	triangle(x1, y1, x2, y2, x3, y3){
		if(arguments.length === 0){
			x1 = -50
			y1 = 50
			x2 = 50
			y2 = 50
			x3 = 0
			y3 = -50
		}

		let vertices = [
			this.createVector(x1, y1),
			this.createVector(x2, y2),
			this.createVector(x3, y3),
			this.createVector(x1, y1)
		]
		this.shapesInterpolation(vertices)

		if(this.renderShapes){
			this.p.triangle(x1, y1, x2, y2, x3, y3)
		}
	}

	lissajous(xPos = 0, yPos = 0, radius = this.p.height/4, ratioA = 1, ratioB = 2, phase = 0, numPoints = 50) {
		if(arguments.length == 0){
			xPos = this.p.width/2
			yPos = this.p.height/2
		
			if(this.webgl){
				xPos = 0
				yPos = 0
			}
		}

		if(arguments.length == 0 || arguments.length < 7){
			numPoints = this.ellipsePoints
		}

		numPoints = this.p.constrain(numPoints, 1, 360);
		
		this.beginShape();
		for (let i = 0; i < numPoints + 1; i++) {
			let theta = TWO_PI / numPoints;
			let x = this.p.sin(i * theta * ratioA) * radius;
			let y = this.p.sin(this.p.radians(phase) + i * theta * ratioB) * radius;
			this.vertex(xPos + x, yPos + y);
		}
		this.endShape();
	  }

	
	/* WEBGL PRIMATIVES */

	box(w = 100, h, d) {
		let vertices = []

		let x = 0, y = 0, z = 0
		if(h == undefined){
			h = w
		}
		if(d == undefined){
			d = w
		}

		// Define the 8 vertices of the box
		let p1 = this.createVector(x - w / 2, y - h / 2, z - d / 2)
		let p2 = this.createVector(x + w / 2, y - h / 2, z - d / 2)
		let p3 = this.createVector(x + w / 2, y + h / 2, z - d / 2)
		let p4 = this.createVector(x - w / 2, y + h / 2, z - d / 2)
		let p5 = this.createVector(x - w / 2, y - h / 2, z + d / 2)
		let p6 = this.createVector(x + w / 2, y - h / 2, z + d / 2)
		let p7 = this.createVector(x + w / 2, y + h / 2, z + d / 2)
		let p8 = this.createVector(x - w / 2, y + h / 2, z + d / 2)

		// Define the 6 faces of the box
		let faces = [
			// Front face
			[p1, p2, p3, p4],
			// Back face
			[p5, p6, p7, p8],
			// Top face
			[p1, p2, p6, p5],
			// Bottom face
			[p4, p3, p7, p8],
			// Left face
			[p1, p4, p8, p5],
			// Right face
			[p2, p3, p7, p6]
		]

		for (let face of faces) {
			let faceVertices = []
			for (let v of face) {
				faceVertices.push(v)
			}
			faceVertices.push(face[0])

			this.shapesInterpolation(faceVertices)

			if(this.renderShapes){
				this.p.box(w, h, d)	
			}
		}
	}

	sphere(radius = 100, detailX = 24, detailY = 16, opts) {
		let curOpts = {long:true, lat:true}

		if(arguments.length < 4){
			if(typeof(detailX) == 'object'){
				opts = detailX
				detailX = 24
			}
			if(typeof(detailY) == 'object'){
				opts = detailY
				detailY = 16
			}
		}

		if(opts != undefined){
			for (const [key, value] of Object.entries(opts)) {
				curOpts[key] = value
			}
		}
		
		let tempAM = this.p.angleMode()
		this.p.angleMode(RADIANS)
		let vertices = []

		detailX = parseInt(detailX)
		detailY = parseInt(detailY)
		for (let i = 0; i <= detailX; i++) {
			let theta = this.p.map(i, 0, detailX, 0, this.p.TWO_PI)
			for (let j = 0; j <= detailY; j++) {
				let phi = this.p.map(j, 0, detailY, 0, this.p.PI)
				let x = radius * this.p.sin(phi) * this.p.cos(theta)
				let y = radius * this.p.sin(phi) * this.p.sin(theta)
				let z = radius * this.p.cos(phi)
				vertices.push(this.p.createVector(x, y, z))
			}
		}
 
		// Add longitudinal lines (theta lines)
		if(curOpts.long){
			for (let i = 0; i <= detailX; i++) {
				this.beginShape()
				for (let j = 0; j <= detailY; j++) {
					let index = i * (detailY + 1) + j
					this.vertex(vertices[index].x, vertices[index].y, vertices[index].z)
				}
				this.endShape()
			}
		}

		// Add latitudinal lines (phi lines)
		if(curOpts.lat){
			for (let j = 0; j <= detailY; j++) {
				this.beginShape()
				for (let i = 0; i <= detailX; i++) {
					let index = i * (detailY + 1) + j
					this.vertex(vertices[index].x, vertices[index].y, vertices[index].z)
				}
				this.endShape()
			}
		}
		this.p.angleMode(tempAM)

		if(this.renderShapes){
			this.p.sphere(radius, detailX, detailY)
		}
	}

	ellipsoid(radiusX = 100, radiusY = 100, radiusZ = 100, detailX = 24, detailY = 16, opts) {
		let curOpts = {long:true, lat:true}

		if(arguments.length < 6){
			if(typeof(detailX) == 'object'){
				opts = detailX
				detailX = 24
			}
			if(typeof(detailY) == 'object'){
				opts = detailY
				detailY = 16
			}
		}

		if(opts != undefined){
			for (const [key, value] of Object.entries(opts)) {
				curOpts[key] = value
			}
		}

		let tempAM = this.p.angleMode()
		this.p.angleMode(RADIANS)
		let vertices = []

		detailX = parseInt(detailX)
		detailY = parseInt(detailY)
		for (let i = 0; i <= detailX; i++) {
			let theta = this.p.map(i, 0, detailX, 0, this.p.TWO_PI)
			for (let j = 0; j <= detailY; j++) {
				let phi = this.p.map(j, 0, detailY, 0, this.p.PI)
				let x = radiusX * this.p.sin(phi) * this.p.cos(theta)
				let y = radiusY * this.p.sin(phi) * this.p.sin(theta)
				let z = radiusZ * this.p.cos(phi)
				vertices.push(this.p.createVector(x, y, z))
			}
		}

		// Add longitudinal lines (theta lines)
		if(curOpts.long){
			for (let i = 0; i <= detailX; i++) {
				this.beginShape()
				for (let j = 0; j <= detailY; j++) {
					let index = i * (detailY + 1) + j
					this.vertex(vertices[index].x, vertices[index].y, vertices[index].z)
				}
				this.endShape()
			}
		}

		// Add latitudinal lines (phi lines)
		if(curOpts.lat){
			for (let j = 0; j <= detailY; j++) {
				this.beginShape()
				for (let i = 0; i <= detailX; i++) {
					let index = i * (detailY + 1) + j
					this.vertex(vertices[index].x, vertices[index].y, vertices[index].z)
				}
				this.endShape()
			}
		}
		this.p.angleMode(tempAM)

		if(this.renderShapes){
			this.p.ellipsoid(radiusX, radiusY, radiusZ, detailX, detailY, )
		}
	}

	torus(radius = 100, tubeRadius = 40, detailX = 24, detailY = 16, opts) {
		let curOpts = {long:true, lat:true}

		if(arguments.length < 5){
			if(typeof(detailX) == 'object'){
				opts = detailX
				detailX = 24
			}
			if(typeof(detailY) == 'object'){
				opts = detailY
				detailY = 16
			}
		}

		if(opts != undefined){
			for (const [key, value] of Object.entries(opts)) {
				curOpts[key] = value
			}
		}

		let tempAM = this.p.angleMode()
		this.p.angleMode(RADIANS)
		let vertices = []

		detailX = parseInt(detailX)
		detailY = parseInt(detailY)
		for (let i = 0; i <= detailX; i++) {
			let theta = this.p.map(i, 0, detailX, 0, this.p.TWO_PI)
			for (let j = 0; j <= detailY; j++) {
				let phi = this.p.map(j, 0, detailY, 0, this.p.TWO_PI)
				let x = (radius + tubeRadius * this.p.cos(phi)) * this.p.cos(theta)
				let y = (radius + tubeRadius * this.p.cos(phi)) * this.p.sin(theta)
				let z = tubeRadius * this.p.sin(phi)
				vertices.push(this.p.createVector(x, y, z))
			}
		}

		// Add radial lines (phi lines)
		if(curOpts.long){
			for (let i = 0; i <= detailX; i++) {
				this.beginShape()
				for (let j = 0; j <= detailY; j++) {
					let index = i * (detailY + 1) + j
					this.vertex(vertices[index].x, vertices[index].y, vertices[index].z)
				}
				this.endShape()
			}
		}

		// Add circular lines (theta lines)
		if(curOpts.lat){
			for (let j = 0; j <= detailY; j++) {
				this.beginShape()
				for (let i = 0; i <= detailX; i++) {
					let index = i * (detailY + 1) + j
					this.vertex(vertices[index].x, vertices[index].y, vertices[index].z)
				}
				this.endShape()
			}
		}
		this.p.angleMode(tempAM)

		if(this.renderShapes){
			this.p.torus(radius, tubeRadius, detailX, detailY)
		}
	}

	model(obj, shape = 'points'){
		let geom = obj.computeFaces()
		if(shape == 'points'){
			for(let i = 0; i < geom.vertices.length; i++) {
				let v = geom.vertices[i]
				this.point(v.x, v.y, v.z)
			}
		}else if(shape == 'vertex'){
			this.beginShape()
			for(let i = 0; i < geom.vertices.length; i++) {
				let v = geom.vertices[i]
				this.vertex(v.x, v.y, v.z)
			}
			this.endShape()
		}

		if(this.renderShapes){
			this.p.model(obj)
		}
	}

	modelPoints(obj){
		let geom = obj.computeFaces()
		let points = []
		for(let i = 0; i < geom.vertices.length; i++) {
			let v = geom.vertices[i]
			points.push(v)
		}
		return points
	}


	/* PRIMATIVES PARSING*/

	beginShape() {
		// *** diff rendering styles
		this.currentShape = []

		if(this.renderShapes){
			this.p.beginShape()
		}
	}

	vertex(x, y, z) {
		if(arguments.length == 0){
			x = this.p.random(this.p.width)
			y = this.p.random(this.p.height)
			if(this.webgl){
				x = this.p.random(-this.p.width/2, this.p.width/2)
				y = this.p.random(-this.p.height/2, this.p.height/2)
			}
		}

		if(this.currentShape) {
			if(z == undefined){
				this.currentShape.push(this.createVector(x, y))
			}else{
				this.currentShape.push(this.createVector(x, y, z))
			}
		}

		if(this.renderShapes){
			if(z == undefined){
				this.p.vertex(x, y)
			}else{
				this.p.vertex(x, y, z)
			}
		}
	}

	// *** add spline, until then, edgy
	curveVertex(x, y, z) {
		this.vertex(x, y, z)
	}

	endShape(closeShape = false) {
		if(this.currentShape) {
			if(closeShape && this.currentShape.length > 0) {
				this.currentShape.push(this.currentShape[0])
			}
			this.shapesInterpolation(this.currentShape)
			this.currentShape = null
		}

		if(this.renderShapes){
			this.p.endShape()
		}
	}

	shapesInterpolation(vertices) {
		if (!this.interpolation) {
			this.shapes.push(vertices)
			return false
		}

		let interpolatedVertices = []
		for (let i = 0; i < vertices.length - 1; i++) {
			let v1 = this.p.createVector(vertices[i].x, vertices[i].y)
			let v2 = this.p.createVector(vertices[i + 1].x, vertices[i + 1].y)
			let distance = v1.dist(v2) // distance between the two vertices
			let numSteps = Math.ceil(distance / this.gapSize) // number of steps based on gapSize

			for (let j = 0; j <= numSteps; j++) {
				let lerped = p5.Vector.lerp(v1, v2, j / numSteps)
				interpolatedVertices.push(lerped)
			}
		}
		this.shapes.push(interpolatedVertices)
	}


	/* TYPO + HERSHEY FONTS*/

	loadFontDefault(){
		this.hershey_futural = `12345  1JZ
12345  9MWRFRT RRYQZR[SZRY
12345  6JZNFNM RVFVM
12345 12H]SBLb RYBRb RLOZO RKUYU
12345 27H\\PBP_ RTBT_ RYIWGTFPFMGKIKKLMMNOOUQWRXSYUYXWZT[P[MZKX
12345 32F^[FI[ RNFPHPJOLMMKMIKIIJGLFNFPGSHVHYG[F RWTUUTWTYV[X[ZZ[X[VYTWT
12345 35E_\\O\\N[MZMYNXPVUTXRZP[L[JZIYHWHUISJRQNRMSKSIRGPFNGMIMKNNPQUXWZY[[[\\Z\\Y
12345  8MWRHQGRFSGSIRKQL
12345 11KYVBTDRGPKOPOTPYR]T\`Vb
12345 11KYNBPDRGTKUPUTTYR]P\`Nb
12345  9JZRLRX RMOWU RWOMU
12345  6E_RIR[ RIR[R
12345  8NVSWRXQWRVSWSYQ[
12345  3E_IR[R
12345  6NVRVQWRXSWRV
12345  3G][BIb
12345 18H\\QFNGLJKOKRLWNZQ[S[VZXWYRYOXJVGSFQF
12345  5H\\NJPISFS[
12345 15H\\LKLJMHNGPFTFVGWHXJXLWNUQK[Y[
12345 16H\\MFXFRNUNWOXPYSYUXXVZS[P[MZLYKW
12345  7H\\UFKTZT RUFU[
12345 18H\\WFMFLOMNPMSMVNXPYSYUXXVZS[P[MZLYKW
12345 24H\\XIWGTFRFOGMJLOLTMXOZR[S[VZXXYUYTXQVOSNRNOOMQLT
12345  6H\\YFO[ RKFYF
12345 30H\\PFMGLILKMMONSOVPXRYTYWXYWZT[P[MZLYKWKTLRNPQOUNWMXKXIWGTFPF
12345 24H\\XMWPURRSQSNRLPKMKLLINGQFRFUGWIXMXRWWUZR[P[MZLX
12345 12NVROQPRQSPRO RRVQWRXSWRV
12345 14NVROQPRQSPRO RSWRXQWRVSWSYQ[
12345  4F^ZIJRZ[
12345  6E_IO[O RIU[U
12345  4F^JIZRJ[
12345 21I[LKLJMHNGPFTFVGWHXJXLWNVORQRT RRYQZR[SZRY
12345 56E\`WNVLTKQKOLNMMPMSNUPVSVUUVS RQKOMNPNSOUPV RWKVSVUXVZV\\T]Q]O\\L[JYHWGTFQFNGLHJJILHOHRIUJWLYNZQ[T[WZYYZX RXKWSWUXV
12345  9I[RFJ[ RRFZ[ RMTWT
12345 24G\\KFK[ RKFTFWGXHYJYLXNWOTP RKPTPWQXRYTYWXYWZT[K[
12345 19H]ZKYIWGUFQFOGMILKKNKSLVMXOZQ[U[WZYXZV
12345 16G\\KFK[ RKFRFUGWIXKYNYSXVWXUZR[K[
12345 12H[LFL[ RLFYF RLPTP RL[Y[
12345  9HZLFL[ RLFYF RLPTP
12345 23H]ZKYIWGUFQFOGMILKKNKSLVMXOZQ[U[WZYXZVZS RUSZS
12345  9G]KFK[ RYFY[ RKPYP
12345  3NVKFK[
12345 11JZVFVVUYTZR[P[NZMYLVLT
12345  9G\\KFK[ RYFKT RPOY[
12345  6HYLFL[ RL[X[
12345 12F^JFJ[ RJFR[ RZFR[ RZFZ[
12345  9G]KFK[ RKFY[ RYFY[
12345 22G]PFNGLIKKJNJSKVLXNZP[T[VZXXYVZSZNYKXIVGTFPF
12345 14G\\KFK[ RKFTFWGXHYJYMXOWPTQKQ
12345 25G]PFNGLIKKJNJSKVLXNZP[T[VZXXYVZSZNYKXIVGTFPF RSWY]
12345 17G\\KFK[ RKFTFWGXHYJYLXNWOTPKP RRPY[
12345 21H\\YIWGTFPFMGKIKKLMMNOOUQWRXSYUYXWZT[P[MZKX
12345  6JZRFR[ RKFYF
12345 11G]KFKULXNZQ[S[VZXXYUYF
12345  6I[JFR[ RZFR[
12345 12F^HFM[ RRFM[ RRFW[ R\\FW[
12345  6H\\KFY[ RYFK[
12345  7I[JFRPR[ RZFRP
12345  9H\\YFK[ RKFYF RK[Y[
12345 12KYOBOb RPBPb ROBVB RObVb
12345  3KYKFY^
12345 12KYTBTb RUBUb RNBUB RNbUb
12345  6JZRDJR RRDZR
12345  3I[Ib[b
12345  8NVSKQMQORPSORNQO
12345 18I\\XMX[ RXPVNTMQMONMPLSLUMXOZQ[T[VZXX
12345 18H[LFL[ RLPNNPMSMUNWPXSXUWXUZS[P[NZLX
12345 15I[XPVNTMQMONMPLSLUMXOZQ[T[VZXX
12345 18I\\XFX[ RXPVNTMQMONMPLSLUMXOZQ[T[VZXX
12345 18I[LSXSXQWOVNTMQMONMPLSLUMXOZQ[T[VZXX
12345  9MYWFUFSGRJR[ ROMVM
12345 23I\\XMX]W\`VaTbQbOa RXPVNTMQMONMPLSLUMXOZQ[T[VZXX
12345 11I\\MFM[ RMQPNRMUMWNXQX[
12345  9NVKFMGNFMEKF RMMM[
12345 12MWRFSGTFSERF RSMS^RaPbNb
12345  9IZMFM[ RWMMW RQSX[
12345  3NVKFK[
12345 19CaGMG[ RGQJNLMOMQNRQR[ RRQUNWMZM\\N]Q][
12345 11I\\MMM[ RMQPNRMUMWNXQX[
12345 18I\\QMONMPLSLUMXOZQ[T[VZXXYUYSXPVNTMQM
12345 18H[LMLb RLPNNPMSMUNWPXSXUWXUZS[P[NZLX
12345 18I\\XMXb RXPVNTMQMONMPLSLUMXOZQ[T[VZXX
12345  9KXOMO[ ROSPPRNTMWM
12345 18J[XPWNTMQMNNMPNRPSUTWUXWXXWZT[Q[NZMX
12345  9MYRFRWSZU[W[ ROMVM
12345 11I\\MMMWNZP[S[UZXW RXMX[
12345  6JZLMR[ RXMR[
12345 12G]JMN[ RRMN[ RRMV[ RZMV[
12345  6J[MMX[ RXMM[
12345 10JZLMR[ RXMR[P_NaLbKb
12345  9J[XMM[ RMMXM RM[X[
12345 40KYTBRCQDPFPHQJRKSMSOQQ RRCQEQGRISJTLTNSPORSTTVTXSZR[Q]Q_Ra RQSSUSWRYQZP\\P^Q\`RaTb
12345  3NVRBRb
12345 40KYPBRCSDTFTHSJRKQMQOSQ RRCSESGRIQJPLPNQPURQTPVPXQZR[S]S_Ra RSSQUQWRYSZT\\T^S\`RaPb
12345 24F^IUISJPLONOPPTSVTXTZS[Q RISJQLPNPPQTTVUXUZT[Q[O
12345 35JZJFJ[K[KFLFL[M[MFNFN[O[OFPFP[Q[QFRFR[S[SFTFT[U[UFVFV[W[WFXFX[Y[YFZFZ[
`

			this.hersheyFont = this.hershey_futural.split('\n')
			this.fontReady = true
	}

	loadFont(fontPath) {
		this.p.loadStrings(fontPath, (data) => {
			let hersheyFontString = ''
			for(let line of data) {
				line = line.trim()
				if(line.charAt(0) >= '0' && line.charAt(0) <= '9') {
					hersheyFontString += line + '\n'
				} else {
					hersheyFontString = hersheyFontString.slice(0, -1) + line + '\n'
				}
			}
			this.hersheyFont = hersheyFontString.split('\n')
			this.fontReady = true
		})
	}

	isFontReady() {
		return this.fontReady
	}

	textSize(fontSize) {
		if(arguments.length == 0){
			return this.hfactor * 21
		}
		this.hfactor = fontSize / this.hheight
		this.textLeading(fontSize*.7)
	}

	textLeading(leading) {
		if(arguments.length == 0){
			return this.hleading
		}
		this.hleading = leading
	}

	textAlign(alignX, alignY) {
		if(alignX !== undefined) {
			this.textAlignX = alignX
		}
		if(alignY !== undefined) {
			this.textAlignY = alignY
		}
	}

	text(s = 'XYscope', x = 0, y = 0) {
		if(!this.fontReady) return

		if(arguments.length == 0){
			x = this.p.width/2
			y = this.p.height/2
		
			if(this.webgl){
				x = 0
				y = 0
			}
		}

		s = s.replaceAll('\t', '    ')
		let parts = s.split(/\r?\n|\r|\n/g)

		switch (this.textAlignY) {
			case TOP:
				y += this.hfactor * 12 + this.hleading
				break
			case BOTTOM:
				y -= (this.hfactor * 21 + this.hleading) * parts.length
				break
			default:
				if(parts.length > 1) {
					y -= (this.hfactor * 21 + this.hleading) * parts.length / 2
				}
				break
		}

		let yOffset = y
		for(let i = 0; i < parts.length; i++) {
			this.textParse(parts[i], x, yOffset)
			yOffset += this.hfactor * this.hheight + this.hleading
		}
	}

	textParse(s, x, y) {
		x += 12 * this.hfactor

		switch (this.textAlignX) {
			case this.p.LEFT:
				x -= 5 * this.hfactor
				break
			case this.p.CENTER:
				x -= this.textWidth(s) / 2
				break
			case this.p.RIGHT:
				x -= this.textWidth(s) - 5 * this.hfactor
				break
		}

		switch (this.textAlignY) {
			case this.p.TOP:
				y += this.hfactor * 12
				break
			case this.p.BOTTOM:
				y -= this.hfactor * 12
				break
		}

		this.p.push()
		this.p.translate(x, y)

		for(let i = 0; i < s.length; i++) {
			this.drawCharacter(s.charAt(i))
		}
		this.p.pop()
	}

	textWidth(s) {
		let parts = s.split(/\n|\r/)

		let maxWidth = 0
		for(let part of parts) {
			let tWidth = this.textWidthParse(part)
			if(tWidth > maxWidth) {
				maxWidth = tWidth
			}
		}
		return maxWidth
	}

	textWidthParse(s) {
		let offx = 0
		for(let k = 0; k < s.length; k++) {
			let c = s.charAt(k)
			let h = this.hersheyFont[c.charCodeAt(0) - 32]

			let startCol = h.indexOf(" ")

			let hLeft = this.hershey2coord(h.charAt(startCol + 3))
			let hRight = this.hershey2coord(h.charAt(startCol + 4))
			let hWidth = (hRight - hLeft) * this.hfactor
			offx += hWidth + 5 * this.hfactor
		}
		return offx
	}

	textPaths(s, x, y) {
		if(!this.fontReady) return []
		let parts = s.split(/\n|\r/)

		switch (this.textAlignY) {
			case this.p.TOP:
				y += this.hfactor * 12 + this.hleading
				break
			case this.p.BOTTOM:
				y -= (this.hfactor * 21 + this.hleading) * parts.length
				break
			default:
				if(parts.length > 1) {
					y -= (this.hfactor * 21 + this.hleading) * parts.length / 2
				}
				break
		}

		let coords = []
		let yOffset = y
		for(let i = 0; i < parts.length; i++) {
			this.textPathsParse(parts[i], x, yOffset, coords)
			yOffset += this.hfactor * this.hheight + this.hleading
		}
		return coords
	}

	textPathsParse(s, x, y, coords) {
		x += 12 * this.hfactor

		switch (this.textAlignX) {
			case this.p.LEFT:
				x -= 5 * this.hfactor
				break
			case this.p.CENTER:
				x -= this.textWidth(s) / 2
				break
			case this.p.RIGHT:
				x -= this.textWidth(s) - 5 * this.hfactor
				break
		}

		let offx = x
		let offy = y
		for(let k = 0; k < s.length; k++) {
			let c = s.charAt(k)
			let h = this.hersheyFont[c.charCodeAt(0) - 32]

			let startCol = h.indexOf(" ")

			let hLeft = this.hershey2coord(h.charAt(startCol + 3))
			let hRight = this.hershey2coord(h.charAt(startCol + 4))
			let hWidth = (hRight - hLeft) * this.hfactor

			let hVertices = h.substring(startCol + 5).replace(/ R/g, " ").split(" ")

			for(let vert of hVertices) {
				let coord = []
				for(let j = 2; j < vert.length; j += 2) {
					let hx0 = this.hershey2coord(vert.charAt(j - 2)) * this.hfactor
					let hy0 = this.hershey2coord(vert.charAt(j - 1)) * this.hfactor
					// coord.push(this.p.createVector(offx + hx0, offy + hy0))
					let v1 = this.p.createVector(offx + hx0, offy + hy0)
					let hx1 = this.hershey2coord(vert.charAt(j)) * this.hfactor
					let hy1 = this.hershey2coord(vert.charAt(j + 1)) * this.hfactor
					// coord.push(this.p.createVector(offx + hx1, offy + hy1))
					let v2 = this.p.createVector(offx + hx1, offy + hy1)

					let distance = v1.dist(v2) // distance between the two vertices
					let numSteps = Math.ceil(distance / this.gapSize) // number of steps based on gapSize

					for (let j = 0; j <= numSteps; j++) {
						let lerped = p5.Vector.lerp(v1, v2, j / numSteps)
						coord.push(this.p.createVector(lerped.x, lerped.y))
					}
				}
				coords.push(coord)
			}
			offx += hWidth + 5 * this.hfactor
		}
	}

	drawCharacter(c) {
		let h = this.hersheyFont[c.charCodeAt(0) - 32]

		let startCol = h.indexOf(" ")

		let hLeft = this.hershey2coord(h.charAt(startCol + 3))
		let hRight = this.hershey2coord(h.charAt(startCol + 4))
		let hWidth = (hRight - hLeft) * this.hfactor
		let hVertices = h.substring(startCol + 5).replace(/ R/g, " ").split(" ")

		for(let vert of hVertices) {
			this.beginShape()
			for(let j = 2; j < vert.length; j += 2) {
				let hx0 = this.hershey2coord(vert.charAt(j - 2)) * this.hfactor
				let hy0 = this.hershey2coord(vert.charAt(j - 1)) * this.hfactor
				this.vertex(hx0, hy0)
				let hx1 = this.hershey2coord(vert.charAt(j)) * this.hfactor
				let hy1 = this.hershey2coord(vert.charAt(j + 1)) * this.hfactor
				this.vertex(hx1, hy1)
			}
			this.endShape()
		}
		this.p.translate(hWidth + 5 * this.hfactor, 0)
	}

	hershey2coord(c) {
		return c.charCodeAt(0) - 'R'.charCodeAt(0)
	}


	/* UTILS */

	normX(x) {
		x = this.p.constrain(x, 0, this.p.width)
		return (x / this.p.width - .5) * 2.0 * this.mirrorCoords.x
	}

	normY(y) {
		y = this.p.constrain(y, 0, this.p.height)
		return (y / this.p.height - .5) * 2.0 * this.mirrorCoords.y
	}

	createVector(x, y, z) {
		let sv = this.screenVector(this.p.createVector(x, y))
		if(this.webgl && z != undefined) {
			sv = this.screenVector(this.p.createVector(x, y, z))
		}
		return sv
	}

	// developed from conversation: https://github.com/processing/p5.js/issues/7059
	screenVector(v) {
		if(!this.webgl) {
			const matrix = new DOMMatrix()
				.scale(1 / this.p.pixelDensity())
				.multiply(this.p.drawingContext.getTransform())

			return matrix
				.transformPoint(
					new DOMPoint(v.x, v.y)
				)
		} else {
			const _gl = this.p._renderer
			const uMVMatrix = _gl.uModelMatrix.copy().mult(_gl.uViewMatrix)
			const camCoord = uMVMatrix.multiplyPoint(v)
			const ndc = _gl.uPMatrix.multiplyAndNormalizePoint(camCoord)
			const _x = (0.5 + 0.5 * ndc.x) * this.p.width
			const _y = (0.5 - 0.5 * ndc.y) * this.p.height
			const _z = (0.5 + 0.5 * ndc.z)
			return this.p.createVector(_x, _y, _z)
		}
	}

	note2freq(note) {
		const A4 = 440
		const A4_MIDI = 69

		if(typeof note === 'number') {
			// MIDI note number
			// return A4 * Math.pow(2, (note - A4_MIDI) / 12)
			return (A4 / 32) * (2 ** ((note - 9) / 12))
		} else if(typeof note === 'string') {
			// Note name
			const noteRegex = /^([A-Ga-g])([#b]?)(\d+)$/
			const match = note.match(noteRegex)
			if(match) {
				let [, noteName, accidental, octave] = match
				octave = parseInt(octave)

				const semitoneMap = {
					'C': 0,
					'C#': 1,
					'Db': 1,
					'D': 2,
					'D#': 3,
					'Eb': 3,
					'E': 4,
					'F': 5,
					'F#': 6,
					'Gb': 6,
					'G': 7,
					'G#': 8,
					'Ab': 8,
					'A': 9,
					'A#': 10,
					'Bb': 10,
					'B': 11
				}

				let key = noteName.toUpperCase() + (accidental || '')
				let semitoneOffset = semitoneMap[key]

				if(semitoneOffset !== undefined) {
					let midiNumber = (octave + 1) * 12 + semitoneOffset
					return this.note2freq(midiNumber)
				}
			}
		}
		return null // Invalid input
	}
}



/*
Sequencer *** lib coming soon!
cc teddavis.org 2025
*/

window.Sequencer = class Sequencer {
	constructor(opts = null) {
		this.settings = {
			bpm: 120,
			pbpm: 120,
			pattern: '',
			ppattern: '',
			octave: 3,
			poctave: 3,
			duration: 8,
			pduration: 8,
			rest: {pitch:'', duration:8, frequency:null},
			prest: {pitch:'', duration:8, frequency:null},
		}
		this.loop = true
		this.isPlaying = false
		this.steps = []
		this.step = {}
		this.frequency = 0
		this.frameCount = 0
		this.index = 0
		this.mute = false
		this.gain = 1.0

		this.listeners = {}
		this.onStepCallback = () => {}
		this.onStepEndedCallback = () => {}

		this.acInstance = false
		this.ac = null

		// parse options
		if(opts != null){
			if(opts.hasOwnProperty('ac')){
				this.ac = opts.ac
				this.acInstance = true
			}
			if(opts.hasOwnProperty('audioContext')){
				this.ac = opts.audioContext
				this.acInstance = true
			}
			if(opts.hasOwnProperty('onStep')){
				this.addEventListener('onStep', opts.onStep)
			}
			if(opts.hasOwnProperty('onStepEnded')){
				this.addEventListener('onStepEnded', opts.onStepEnded)
			}
		}		

	}

	onStep(callback = null) {
		if(callback != null) {
			this.onStepCallback = callback
		}
	}

	onStepEnded(callback = null) {
		if(callback != null) {
			this.onStepEndedCallback = callback
		}
	}

	emit(method, payload = null) {
		if(this.listeners.hasOwnProperty(method)){
			const callbacks = this.listeners[method]
			for(let [key, callback] of Object.entries(callbacks)){
				if(typeof callback === 'function'){
					callback(payload)
				}
			}
		}
	}

	addEventListener(method, callback) {
		if(!this.listeners.hasOwnProperty(method)){
			this.listeners[method] = {}
		}
		this.listeners[method][callback] = callback
	}

	removeEventListener (method, callback) {
		if(this.listeners.hasOwnProperty(method)){
			delete this.listeners[method][callback]		
		}
	}

	pattern(pat) {
		if(pat == undefined){
			return this.settings.pattern
		}
		this.settings.pattern = pat
		if(this.settings.ppattern != this.settings.pattern) {
			this.settings.ppattern = this.settings.pattern
			this.parseSteps()
		}
	}

	octave(oct) {
		if(oct == undefined){
			return this.settings.octave
		}
		this.settings.octave = Math.floor(oct)
		if(this.settings.poctave != this.settings.octave) {
			this.parseSteps()
			this.settings.poctave = this.settings.octave
		}
	}

	bpm(val) {
		if(val == undefined){
			return this.settings.bpm
		}
		this.settings.bpm = val
		if(this.settings.pbpm != this.settings.bpm) {
			this.parseSteps()
			this.settings.pbpm = this.settings.bpm
		}
	}

	duration(dur){
		if(dur == undefined){
			return this.settings.duration
		}

		this.settings.duration = dur
		if(this.settings.pduration != this.settings.duration) {
			this.parseSteps()
			this.settings.pduration = this.settings.duration
		}
	}

	parseSteps() {
		const stepPattern = /^([\d*]*[\d.*]*)([a-gA-GrR][#b]?)(\d?)([\*\d]*)$/ // ? to make octave optional

		// let stepsSplit = this.settings.pattern.split(/-|( )/g)
		let stepsSplit = this.settings.pattern.split(/-| /g)
		// stepsSplit = stepsSplit.filter(function(e){return e}); 
		let stepsTemp = []
		for(let step of stepsSplit){
			let stepAlt = step.split(/:|;/)

			let alt = 0
			if(step.includes(':')){
				alt = 1
			}
			if(step.includes(';')){
				alt = 2
			}
			
			let stepTemp = {index:0, steps:[], alt:alt} // alt 0-none, 1-cycle, 2-random
			
			// parse for alts
			for(let sa of stepAlt){
				let stepParsed = this.baseMatch(sa, stepPattern)
				let stepCollection = []
				for(let sp of stepParsed){
					stepCollection.push(sp)
				}
				stepTemp.steps.push(stepCollection)
			}
			stepsTemp.push(stepTemp)
		}

		this.steps = stepsTemp

		if(this.steps.length > 0) {
			this.step = this.steps[0]
		}
	}


	baseMatch(step, stepPattern){
		let stepMatch = step.match(stepPattern)
		if(stepMatch){
			// console.log(stepMatch)
			const [, dur, pitch, octave, repeat] = stepMatch
			let duration = dur ? parseFloat(dur) : parseFloat(this.settings.duration)
			let pitchWithOctave = pitch.toLowerCase() + (octave ? octave : this.settings.octave.toString())
			let stepRepeat = repeat ? parseFloat(repeat.substring(1)) : 1.0
			let baseDuration = 60.0 / parseFloat(this.settings.bpm) * 4.0 * (1.0 / duration) / stepRepeat
			let frequency = this.note2freq(pitchWithOctave)

			if(pitch.toLowerCase() == 'r'){
				pitchWithOctave = this.settings.rest.pitch
				frequency = this.settings.rest.frequency
			}

			if(stepRepeat > 1){
				// repeat steps
				return Array(stepRepeat).fill({
					pitch: pitchWithOctave,
					duration: baseDuration,
					frequency: frequency
				})
			}else{
				// single step
				return [{
					pitch: pitchWithOctave,
					duration: baseDuration,
					frequency: frequency
				}]
			}
		}else{
			// return rest
			return [{
				pitch: '',//this.settings.rest.pitch,
				duration: 60.0 / parseFloat(this.settings.bpm) * 4.0 * (1.0 / parseFloat(this.settings.duration)), // default 1/8th rest
				frequency: null//this.settings.rest.frequency // ** or 1?
			}]
		}
	}

	// *** remove? bad pitches...
	// getFrequency(step) {
	// 	const notes = {
	// 		'c': 261.63,
	// 		'd': 293.66,
	// 		'e': 329.63,
	// 		'f': 349.23,
	// 		'g': 392.00,
	// 		'a': 440.00,
	// 		'b': 493.88
	// 	}
	// 	const sharpOffset = Math.pow(2, 1 / 12)
	// 	const flatOffset = Math.pow(2, -1 / 12)

	// 	let octave = parseInt(step.slice(-1))
	// 	let pitch = step.slice(0, -1).toLowerCase()
	// 	let multiplier = Math.pow(2, octave - 4)
	// 	let frequency = notes[pitch[0]]

	// 	if(pitch.includes('#')) {
	// 		frequency *= sharpOffset
	// 	} else if(pitch.includes('b')) {
	// 		frequency *= flatOffset
	// 	}

	// 	return frequency * multiplier
	// }

	note2freq(note) {
		const A4 = 440
		const A4_MIDI = 69

		if(typeof note === 'number') {
			// MIDI note number
			// return A4 * Math.pow(2, (note - A4_MIDI) / 12)
			return (A4 / 32) * (2 ** ((note - 9) / 12))
		} else if(typeof note === 'string') {
			// Note name
			const noteRegex = /^([A-Ga-g])([#b]?)(\d+)$/
			const match = note.match(noteRegex)
			if(match) {
				let [, noteName, accidental, octave] = match
				octave = parseInt(octave)

				const semitoneMap = {
					'C': 0,
					'C#': 1,
					'Db': 1,
					'D': 2,
					'D#': 3,
					'Eb': 3,
					'E': 4,
					'F': 5,
					'F#': 6,
					'Gb': 6,
					'G': 7,
					'G#': 8,
					'Ab': 8,
					'A': 9,
					'A#': 10,
					'Bb': 10,
					'B': 11
				}

				let key = noteName.toUpperCase() + (accidental || '')
				let semitoneOffset = semitoneMap[key]

				if(semitoneOffset !== undefined) {
					let midiNumber = (octave + 1) * 12 + semitoneOffset
					return this.note2freq(midiNumber)
				}
			}
		}
		return null // Invalid input
	}

	playStepAtTime(step, startTime) {
		if(step.pitch.trim() === '') return // rest

		let oscillator, gainNode
		if(!this.acInstance) {
			oscillator = this.ac.createOscillator()
			gainNode = this.ac.createGain()
			gainNode.gain.value = this.gain
		}

		if(!isFinite(step.frequency)) return // skip bad frequency

		let nodeStart = this.ac.createConstantSource()
		let nodeStop = this.ac.createConstantSource()

		// on
		nodeStart.start(startTime)
		nodeStart.stop(startTime + 0.01)
		nodeStart.onended = () => {
			if(!this.acInstance) {
				if(!this.mute){
					oscillator.frequency.setValueAtTime(step.frequency, 0)
					oscillator.connect(gainNode)
					gainNode.connect(this.ac.destination)

					oscillator.start(startTime)
				}
			}

			this.frameCount++
			this.frequency = this.steps[this.frameCount % this.steps.length].frequency
			this.index = this.frameCount % this.steps.length
			this.step = step

			this.onStepCallback(step)
			this.emit('onStep', step)
		}

		// off
		nodeStop.start(startTime)
		nodeStop.stop(startTime + step.duration)
		nodeStop.onended = () => {
			if(!this.acInstance) {
				if(!this.mute){
					oscillator.stop(0)
				}
			}

			this.onStepEndedCallback(step)
			this.emit('onStepEnded', step)
		}
	}

	playSequence() {
		if(this.isPlaying) return
		if(!this.ac) {
			this.ac = new(window.AudioContext || window.webkitAudioContext)()
		}
		this.isPlaying = true
		let currentTime = this.ac.currentTime

		// handle altsteps
		for(const step of this.steps) {
			let index = 0
			if(step.alt == 1){
				index = step.index++%step.steps.length
			}else if(step.alt == 2){
				index = Math.floor(Math.random()*step.steps.length)
			}

			let stepAlt = step.steps[index]
			for(let s of stepAlt){
				this.playStepAtTime(s, currentTime)
				currentTime += s.duration
			}
		}

		const loopHandler = () => {
			if(this.isPlaying) {
				this.isPlaying = false
				this.playSequence()
			}
		}

		if(this.loop) {
			setTimeout(loopHandler, (currentTime - this.ac.currentTime) * 1000.0)
		} else {
			setTimeout(() => {
				this.isPlaying = false
			}, (currentTime - this.ac.currentTime) * 1000)
		}
	}

	start() {
		if(this.steps.length === 0) return
		this.playSequence()
	}

	stop() {
		this.isPlaying = false
		if(this.ac && !this.acInstance) {
			this.ac.close().then(() => {
				this.ac = null
			})
		}
	}
}




/*

XXY Oscilloscope

version 1.0, April 2017
by Neil Thapen
venuspatrol.nfshost.com


Modified and embedded with permission as XXY into XYscope.js 2025
cc teddavis.org / FFD8


Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

*/

var XXY_AudioSystem =
{
	init : function (bufferSize, xyInstance)
	{
		window.AudioContext = window.AudioContext||window.webkitAudioContext;
		

		this.ac = new window.AudioContext();
		this.ac.destination.channelCount = this.ac.destination.maxChannelCount;
		this.sampleRate = this.ac.sampleRate;
		this.bufferSize = bufferSize;
		this.timePerSample = 1/this.sampleRate;
		this.oldXSamples = new Float32Array(this.bufferSize);
		this.oldYSamples = new Float32Array(this.bufferSize);
		this.smoothedXSamples = new Float32Array(XXY_Filter.nSmoothedSamples);
		this.smoothedYSamples = new Float32Array(XXY_Filter.nSmoothedSamples);

		this.xy = xyInstance;
	},

	startSound() {
		this.ac = this.xy.ac;
		this.oscillatorNode = this.xy.oscillatorNode;

		this.audioVolumeNode = this.ac.createGain();

		this.scopeNode = this.ac.createScriptProcessor(this.bufferSize, this.ac.destination.maxChannelCount, this.ac.destination.maxChannelCount);
		this.scopeNode.onaudioprocess = XXY_doScriptProcessor;

		// Connect the oscillatorNode to the scopeNode
		this.oscillatorNode.connect(this.scopeNode);

		// Connect the scopeNode to the audioVolumeNode and then to destination
		this.scopeNode.connect(this.audioVolumeNode);
		this.audioVolumeNode.connect(this.ac.destination);
	},

}

var XXY_Filter =
{
	lanczosTweak : 1.5,

	init : function(bufferSize, a, steps)
	{
		this.bufferSize = bufferSize;
		this.a = a;
		this.steps = steps;
		this.radius = a * steps;
		this.nSmoothedSamples = this.bufferSize*this.steps + 1;
		this.allSamples = new Float32Array(2*this.bufferSize);

		this.createLanczosKernel();
	},


	generateSmoothedSamples : function (oldSamples, samples, smoothedSamples)
	{
		//this.createLanczosKernel();
		var bufferSize = this.bufferSize;
		var allSamples = this.allSamples;
		var nSmoothedSamples = this.nSmoothedSamples;
		var a = this.a;
		var steps = this.steps;
		var K = this.K;

		for (var i=0; i<bufferSize; i++)
		{
			allSamples[i] = oldSamples[i];
			allSamples[bufferSize+i] = samples[i];
		}

		/*for (var s= -a+1; s<a; s++)
		{
			for (var r=0; r<steps; r++)
			{
				if (r==0 && !(s==0)) continue;
				var kernelPosition = -r+s*steps;
				if (kernelPosition<0) k = K[-kernelPosition];
				else k = K[kernelPosition];

				var i = r;
				var pStart = bufferSize - 2*a + s;
				var pEnd = pStart + bufferSize;
				for (var p=pStart; p<pEnd; p++)
				{
					smoothedSamples[i] += k * allSamples[p];
					i += steps;
				}
			}
		}*/

		var pStart = bufferSize - 2*a;
		var pEnd = pStart + bufferSize;
		var i = 0;
		for (var position=pStart; position<pEnd; position++)
		{
			smoothedSamples[i] = allSamples[position];
			i += 1;
			for (var r=1; r<steps; r++)
			{
				var smoothedSample = 0;
				for (var s= -a+1; s<a; s++)
				{
					var sample = allSamples[position+s];
					var kernelPosition = -r+s*steps;
					if (kernelPosition<0) smoothedSample += sample * K[-kernelPosition];
					else smoothedSample += sample * K[kernelPosition];
				}
				smoothedSamples[i] = smoothedSample;
				i += 1;
			}
		}

		smoothedSamples[nSmoothedSamples-1] = allSamples[2*bufferSize-2*a];
	},

	createLanczosKernel : function ()
	{
		this.K = new Float32Array(this.radius);
		this.K[0] = 1;
		for (var i =1; i<this.radius; i++)
		{
			var piX = (Math.PI * i) / this.steps;
			var sinc = Math.sin(piX)/piX;
			var window = this.a * Math.sin(piX/this.a) / piX;
			this.K[i] = sinc*Math.pow(window, this.lanczosTweak);
		}
	}
}

var XXY_UI =
{
	sidebarWidth : 0,

	init : function()
	{
		var kHzText = (XXY_AudioSystem.sampleRate/1000).toFixed(1)+"kHz";
		// document.getElementById("samplerate").innerHTML=kHzText;
		// mainGain.oninput();
		// trigger.oninput();
		// this.xInput = document.getElementById("xInput");
		// this.yInput = document.getElementById("yInput");
		// this.xInput.value = XXY_controls.xExpression;
		// this.yInput.value = XXY_controls.yExpression;
	},

	compile : function() //doesn't compile anything anymore
	{
		XXY_controls.xExpression = this.xInput.value;
		XXY_controls.yExpression = this.yInput.value;
	}
}

var XXY_Render =
{
	debug : 0,
	failed : false,

	init : function()
	{
		this.crtCanvas = document.getElementById("crtCanvas");
		this.onResize();
		window.onresize = this.onResize;
		if (!this.supportsWebGl)
		{
			console.log("webgl not found"); 
			XXY_Render.failed = true;
			return;
		}
		window.gl = this.crtCanvas.getContext("webgl", {preserveDrawingBuffer: true, alpha: false} );
		gl.viewport(0, 0, this.crtCanvas.width, this.crtCanvas.height);
		gl.enable(gl.BLEND);
		gl.blendEquation( gl.FUNC_ADD );
		gl.clearColor(0.0, 0.0, 0.0, 1.0);
		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.colorMask(true, true, true, true);

		var ext1 = gl.getExtension('OES_texture_float');
		var ext2 = gl.getExtension('OES_texture_float_linear');
		//this.ext = gl.getExtension('OES_texture_half_float');
		//this.ext2 = gl.getExtension('OES_texture_half_float_linear');
		if (!ext1 || !ext2)
		{
			console.log("OES_texture_float extension not found"); 
			XXY_Render.failed = true;
			return;
		}

		this.fadeAmount = 0.2*XXY_AudioSystem.bufferSize/512;
		this.fullScreenQuad = new Float32Array([
			-1, 1, 1, 1,  1,-1,  // Triangle 1
			-1, 1, 1,-1, -1,-1   // Triangle 2
			]);

		this.simpleShader = this.createShader(this.shader_vertex, this.shader_fragment);
		this.simpleShader.vertexPosition = gl.getAttribLocation(this.simpleShader, "vertexPosition");
		this.simpleShader.colour = gl.getUniformLocation(this.simpleShader, "colour");

		this.lineShader = this.createShader(this.shader_gaussianVertex, this.shader_gaussianFragment);
		this.lineShader.aStart = gl.getAttribLocation(this.lineShader, "aStart");
		this.lineShader.aEnd = gl.getAttribLocation(this.lineShader, "aEnd");
		this.lineShader.aIdx = gl.getAttribLocation(this.lineShader, "aIdx");
		this.lineShader.uGain = gl.getUniformLocation(this.lineShader, "uGain");
		this.lineShader.uSize = gl.getUniformLocation(this.lineShader, "uSize");
		this.lineShader.uInvert = gl.getUniformLocation(this.lineShader, "uInvert");
		this.lineShader.uIntensity = gl.getUniformLocation(this.lineShader, "uIntensity");
		this.lineShader.uNEdges = gl.getUniformLocation(this.lineShader, "uNEdges");
		this.lineShader.uFadeAmount = gl.getUniformLocation(this.lineShader, "uFadeAmount");
		this.lineShader.uScreen = gl.getUniformLocation(this.lineShader, "uScreen");

		this.outputShader = this.createShader(this.shader_outputVertex,this.shader_outputFragment);
		this.outputShader.aPos = gl.getAttribLocation(this.outputShader, "aPos");
		this.outputShader.uTexture0 = gl.getUniformLocation(this.outputShader, "uTexture0");
		this.outputShader.uTexture1 = gl.getUniformLocation(this.outputShader, "uTexture1");
		this.outputShader.uTexture2 = gl.getUniformLocation(this.outputShader, "uTexture2");
		this.outputShader.uTexture3 = gl.getUniformLocation(this.outputShader, "uTexture3");
		this.outputShader.uExposure = gl.getUniformLocation(this.outputShader, "uExposure");
		this.outputShader.uColour = gl.getUniformLocation(this.outputShader, "uColour");
		this.outputShader.uResizeForCanvas = gl.getUniformLocation(this.outputShader, "uResizeForCanvas");
		this.outputShader.graticuleLight = gl.getUniformLocation(this.outputShader, "graticuleLight");

		this.texturedShader = this.createShader(this.shader_texturedVertexWithResize, this.shader_texturedFragment);
		this.texturedShader.aPos = gl.getAttribLocation(this.texturedShader, "aPos");
		this.texturedShader.uTexture0 = gl.getUniformLocation(this.texturedShader, "uTexture0");
		this.texturedShader.uResizeForCanvas = gl.getUniformLocation(this.texturedShader, "uResizeForCanvas");

		this.blurShader = this.createShader(this.shader_texturedVertex, this.shader_blurFragment);
		this.blurShader.aPos = gl.getAttribLocation(this.blurShader, "aPos");
		this.blurShader.uTexture0 = gl.getUniformLocation(this.blurShader, "uTexture0");
		this.blurShader.uOffset = gl.getUniformLocation(this.blurShader, "uOffset");

		this.vertexBuffer = gl.createBuffer();
		this.setupTextures();
	},

	admitFailure : function()
	{
		// canvasFailure.innerHTML="&nbsp;&nbsp;sorry, it's not working"
		console.log('error with oscilloscope.js render')
	},

	setupArrays : function(nPoints)
	{
		this.nPoints = nPoints;
		this.nEdges = this.nPoints-1;

		this.quadIndexBuffer = gl.createBuffer();
		var indices = new Float32Array(4*this.nEdges);
		for (var i=0; i<indices.length; i++)
		{
			indices[i] = i;
		}
		gl.bindBuffer(gl.ARRAY_BUFFER, this.quadIndexBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, indices, gl.STATIC_DRAW);
		gl.bindBuffer(gl.ARRAY_BUFFER, null);

		this.vertexIndexBuffer = gl.createBuffer();
		var len = this.nEdges * 2 * 3,
		indices = new Uint16Array(len);
		for (var i = 0, pos = 0; i < len;)
		{
			indices[i++] = pos;
			indices[i++] = pos + 2;
			indices[i++] = pos + 1;
			indices[i++] = pos + 1;
			indices[i++] = pos + 2;
			indices[i++] = pos + 3;
			pos += 4;
		}
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.vertexIndexBuffer);
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);


		this.scratchVertices = new Float32Array(8*nPoints);
	},

	setupTextures : function()
	{
		this.frameBuffer = gl.createFramebuffer();
		this.lineTexture = this.makeTexture(1024, 1024);
		this.onResize();
		this.blur1Texture = this.makeTexture(256,256);
		this.blur2Texture = this.makeTexture(256, 256);
		this.blur3Texture = this.makeTexture(32, 32);
		this.blur4Texture = this.makeTexture(32, 32);
		this.screenTexture = this.loadTexture(this.noiseImg);

		// test floating point textures working
		this.activateTargetTexture(this.lineTexture);
		if (gl.FRAMEBUFFER_COMPLETE != gl.checkFramebufferStatus(gl.FRAMEBUFFER)) XXY_Render.failed=true;
		// console.log(gl.checkFramebufferStatus(gl.FRAMEBUFFER), gl.FRAMEBUFFER_COMPLETE, this.frameBuffer);
	},

	onResize : function()
	{
		var windowWidth = Math.max(document.documentElement.clientWidth, window.innerWidth || 0)
		var windowHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0)
		// var canvasSize = Math.min(windowHeight-21, windowWidth-XXY_UI.sidebarWidth-70);
		var canvasSize = Math.min(windowHeight, windowWidth);
		XXY_Render.crtCanvas.width = canvasSize;
		XXY_Render.crtCanvas.height = canvasSize;
		if (XXY_Render.lineTexture)
		{
			var renderSize = Math.min(canvasSize, 1024);
			// console.log(renderSize)
			XXY_Render.lineTexture.width = renderSize;
			XXY_Render.lineTexture.height = renderSize;
		}

	},

	drawLineTexture : function(xPoints, yPoints)
	{
		this.fadeAmount = Math.pow(0.5, XXY_controls.persistence)*0.2*XXY_AudioSystem.bufferSize/512 ;
		this.activateTargetTexture(this.lineTexture);
		this.fade();
		//gl.clear(gl.COLOR_BUFFER_BIT);
		this.drawLine(xPoints, yPoints);
		gl.bindTexture(gl.TEXTURE_2D, this.targetTexture);
		gl.generateMipmap(gl.TEXTURE_2D);
	},

	drawCRT : function()
	{
		this.setNormalBlending();

		this.activateTargetTexture(this.blur1Texture);
		this.setShader(this.texturedShader);
		gl.uniform1f(this.texturedShader.uResizeForCanvas, this.lineTexture.width/1024);
		this.drawTexture(this.lineTexture);

		//horizontal blur 256x256
		this.activateTargetTexture(this.blur2Texture);
		this.setShader(this.blurShader);
		gl.uniform2fv(this.blurShader.uOffset, [1.0/256.0, 0.0]);
		this.drawTexture(this.blur1Texture);

		//vertical blur 256x256
		this.activateTargetTexture(this.blur1Texture);
		//this.setShader(this.blurShader);
		gl.uniform2fv(this.blurShader.uOffset, [0.0, 1.0/256.0]);
		this.drawTexture(this.blur2Texture);

		//preserve blur1 for later
		this.activateTargetTexture(this.blur3Texture);
		this.setShader(this.texturedShader);
		gl.uniform1f(this.texturedShader.uResizeForCanvas, 1.0);
		this.drawTexture(this.blur1Texture);

		//horizontal blur 64x64
		this.activateTargetTexture(this.blur4Texture);
		this.setShader(this.blurShader);
		gl.uniform2fv(this.blurShader.uOffset, [1.0/32.0, 1.0/60.0]);
		this.drawTexture(this.blur3Texture);

		//vertical blur 64x64
		this.activateTargetTexture(this.blur3Texture);
		//this.setShader(this.blurShader);
		gl.uniform2fv(this.blurShader.uOffset, [-1.0/60.0, 1.0/32.0]);
		this.drawTexture(this.blur4Texture);

		this.activateTargetTexture(null);
		this.setShader(this.outputShader);
		var brightness = Math.pow(2, XXY_controls.exposureStops-2.0);
		//if (XXY_controls.disableFilter) brightness *= XXY_Filter.steps;
		gl.uniform1f(this.outputShader.uExposure, brightness);
		gl.uniform1f(this.outputShader.uResizeForCanvas, this.lineTexture.width/1024);
		var colour = this.getColourFromHue(XXY_controls.hue);
		gl.uniform3fv(this.outputShader.uColour, colour);
		if (XXY_controls.light) gl.uniform1f(this.outputShader.graticuleLight, 0.15);
			else gl.uniform1f(this.outputShader.graticuleLight, 0.0);
		this.drawTexture(this.lineTexture, this.blur1Texture, this.blur3Texture, this.screenTexture);
	},

	getColourFromHue : function(hue)
	{
		var alpha = (hue/120.0) % 1.0;
		var start = Math.sqrt(1.0-alpha);
		var end = Math.sqrt(alpha);
		var colour;
		if (hue<120) colour = [start, end, 0.0];
		else if (hue<240) colour = [0.0, start, end];
		else colour = [end, 0.0, start];
		return colour;
	},

	activateTargetTexture : function(texture)
	{
		if (texture)
		{
			gl.bindFramebuffer(gl.FRAMEBUFFER, this.frameBuffer);
			gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
			gl.viewport(0, 0, texture.width, texture.height);
		}
		else
		{
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);
			gl.viewport(0, 0, this.crtCanvas.width, this.crtCanvas.height);
		}
		this.targetTexture = texture;
	},

	setShader : function(program)
	{
		this.program = program;
		gl.useProgram(program);
	},

	drawTexture : function(texture0, texture1, texture2, texture3)
	{
		//gl.useProgram(this.program);
		gl.enableVertexAttribArray(this.program.aPos);

		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, texture0);
		gl.uniform1i(this.program.uTexture0, 0);

		if (texture1)
		{
			gl.activeTexture(gl.TEXTURE1);
			gl.bindTexture(gl.TEXTURE_2D, texture1);
			gl.uniform1i(this.program.uTexture1, 1);
		}

		if (texture2)
		{
			gl.activeTexture(gl.TEXTURE2);
			gl.bindTexture(gl.TEXTURE_2D, texture2);
			gl.uniform1i(this.program.uTexture2, 2);
		}

		if (texture3)
		{
			gl.activeTexture(gl.TEXTURE3);
			gl.bindTexture(gl.TEXTURE_2D, texture3);
			gl.uniform1i(this.program.uTexture3, 3);
		}

		gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, this.fullScreenQuad, gl.STATIC_DRAW);
		gl.vertexAttribPointer(this.program.aPos, 2, gl.FLOAT, false, 0, 0);
		gl.bindBuffer(gl.ARRAY_BUFFER, null);

		gl.drawArrays(gl.TRIANGLES, 0, 6);
		gl.disableVertexAttribArray(this.program.aPos);

		if (this.targetTexture)
		{
			gl.bindTexture(gl.TEXTURE_2D, this.targetTexture);
			gl.generateMipmap(gl.TEXTURE_2D);
		}
	},

	drawLine : function(xPoints, yPoints)
	{
		this.setAdditiveBlending();
		var scopeHolder = document.getElementById('scope-holder')
		var p5Canvas = document.querySelector('.p5Canvas')
		var aspectScl = scopeHolder.offsetHeight / scopeHolder.offsetWidth
		// console.log([this.crtCanvas.width,this.crtCanvas.height, scopeHolder.offsetHeight, scopeHolder.offsetWidth])
		// console.log(document.querySelector('.p5Canvas').offsetWidth)

		var scratchVertices = this.scratchVertices;
		//this.totalLength = 0;
		var nPoints = xPoints.length;
		for (var i=0; i<nPoints; i++)
		{
			var p = i*8;
			scratchVertices[p]=scratchVertices[p+2]=scratchVertices[p+4]=scratchVertices[p+6]=xPoints[i]*aspectScl;
			scratchVertices[p+1]=scratchVertices[p+3]=scratchVertices[p+5]=scratchVertices[p+7]=yPoints[i];
			/*if (i>0)
			{
				var xDelta = xPoints[i]-xPoints[i-1];
				if (xDelta<0) xDelta = -xDelta;
				var yDelta = yPoints[i]-yPoints[i-1];
				if (yDelta<0) yDelta = -yDelta;
				this.totalLength += xDelta + yDelta;
			}*/
		}

		gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, scratchVertices, gl.STATIC_DRAW);
		gl.bindBuffer(gl.ARRAY_BUFFER, null);

		var program = this.lineShader;
		gl.useProgram(program);
		gl.enableVertexAttribArray(program.aStart);
		gl.enableVertexAttribArray(program.aEnd);
		gl.enableVertexAttribArray(program.aIdx);

		gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
		gl.vertexAttribPointer(program.aStart, 2, gl.FLOAT, false, 0, 0);
		gl.vertexAttribPointer(program.aEnd, 2, gl.FLOAT, false, 0, 8*4);
		gl.bindBuffer(gl.ARRAY_BUFFER, this.quadIndexBuffer);
		gl.vertexAttribPointer(program.aIdx, 1, gl.FLOAT, false, 0, 0);

		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this.screenTexture);
		gl.uniform1i(program.uScreen, 0);

		gl.uniform1f(program.uSize, XXY_controls.thickness);
		gl.uniform1f(program.uGain, Math.pow(2.0,XXY_controls.mainGain)*480/512);
		if (XXY_controls.invertXY) gl.uniform1f(program.uInvert, -1.0);
		else gl.uniform1f(program.uInvert, 1.0);
		if (XXY_controls.disableFilter) gl.uniform1f(program.uIntensity, 0.005*(XXY_Filter.steps+1.5));
		// +1.5 needed above for some reason for the brightness to match
		else gl.uniform1f(program.uIntensity, 0.005);
		gl.uniform1f(program.uFadeAmount, this.fadeAmount);
		gl.uniform1f(program.uNEdges, this.nEdges);

		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.vertexIndexBuffer);
		var nEdgesThisTime = (xPoints.length-1);

		/*if (this.totalLength > 300)
		{
			nEdgesThisTime *= 300/this.totalLength;
			nEdgesThisTime = Math.floor(nEdgesThisTime);
		}*/

		gl.drawElements(gl.TRIANGLES, nEdgesThisTime * 6, gl.UNSIGNED_SHORT, 0);

		gl.disableVertexAttribArray(program.aStart);
		gl.disableVertexAttribArray(program.aEnd);
		gl.disableVertexAttribArray(program.aIdx);
	},

	fade : function(alpha)
	{
		this.setNormalBlending();

		var program = this.simpleShader;
		gl.useProgram(program);
		gl.enableVertexAttribArray(program.vertexPosition);
		gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, this.fullScreenQuad, gl.STATIC_DRAW);
		gl.vertexAttribPointer(program.vertexPosition, 2, gl.FLOAT, false, 0, 0);
		gl.bindBuffer(gl.ARRAY_BUFFER, null);
		gl.uniform4fv(program.colour, [0.0, 0.0, 0.0, this.fadeAmount]);
		gl.drawArrays(gl.TRIANGLES, 0, 6);
		gl.disableVertexAttribArray(program.vertexPosition);
	},

	loadTexture : function(fileName)
	{
		var texture = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, texture);
		// Fill with grey pixel, as placeholder until loaded
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
			 new Uint8Array([128, 128, 128, 255]));
		// Asynchronously load an image
		var image = new Image();
		image.src = fileName;
		image.addEventListener('load', function()
		{
			// Now that the image has loaded copy it to the texture.
			gl.bindTexture(gl.TEXTURE_2D, texture);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			//gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
			gl.generateMipmap(gl.TEXTURE_2D);
			//hardcoded:
			texture.width = texture.height = 512;
			XXY_Render.fillBlueChannel(texture);
			if (XXY_controls.grid) XXY_Render.drawGrid(texture);
		});
		return texture;
	},

	fillBlueChannel : function(texture)
	{
		this.activateTargetTexture(texture);
		gl.colorMask(false, false, true, true);
		this.setNormalBlending();

		var program = this.simpleShader;
		gl.useProgram(program);
		gl.enableVertexAttribArray(program.vertexPosition);
		gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, this.fullScreenQuad, gl.STATIC_DRAW);
		gl.vertexAttribPointer(program.vertexPosition, 2, gl.FLOAT, false, 0, 0);
		gl.bindBuffer(gl.ARRAY_BUFFER, null);
		gl.uniform4fv(program.colour, [0.0, 0.0, 1.0, 1.0]);
		gl.drawArrays(gl.TRIANGLES, 0, 6);
		gl.disableVertexAttribArray(program.vertexPosition);
		gl.colorMask(true, true, true, true);
	},

	drawGrid : function(texture)
	{
		this.activateTargetTexture(texture);
		this.setNormalBlending();
		this.setShader(this.simpleShader);

		gl.colorMask(true, false, true, true);

		var data = [];

		for (var i=0; i<11; i++)
		{
			var step = 48;
			var s = i*step;
			data.splice(0,0, 0, s, 10*step, s);
			data.splice(0,0, s, 0, s, 10*step);
			if (i!=0 && i!=10)
			{
				for (var j=0; j<51; j++)
				{
					t = j*step/5;
					if (i!=5)
					{
						data.splice(0,0, t, s-2, t, s+1);
						data.splice(0,0, s-2, t, s+1, t);
					}
					else
					{
						data.splice(0,0, t, s-5, t, s+4);
						data.splice(0,0, s-5, t, s+4, t);
					}
				}
			}
		}

		for (var j=0; j<51; j++)
		{
			var t = j*step/5;
			if (t%5 == 0) continue;
			data.splice(0,0, t-2, 2.5*step, t+2, 2.5*step);
			data.splice(0,0, t-2, 7.5*step, t+2, 7.5*step);
		}


		var vertices = new Float32Array(data);
		for (var i=0; i<data.length; i++)
		{
			vertices[i]=(vertices[i]+256-step*5)/256-1;
		}


		gl.enableVertexAttribArray(this.program.vertexPosition);
		gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
		gl.vertexAttribPointer(this.program.vertexPosition, 2, gl.FLOAT, false, 0, 0);
		gl.bindBuffer(gl.ARRAY_BUFFER, null);
		gl.uniform4fv(this.program.colour, [0.01, 0.1, 0.01, 1.0]);

		gl.lineWidth(1.0);
		gl.drawArrays(gl.LINES, 0, vertices.length/2);

		gl.bindTexture(gl.TEXTURE_2D, this.targetTexture);
		gl.generateMipmap(gl.TEXTURE_2D);
		gl.colorMask(true, true, true, true);
	},

	makeTexture : function(width, height)
	{
		var texture = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.FLOAT, null);
		// gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, XXY_Render.ext.HALF_FLOAT_OES, null);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		//gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.generateMipmap(gl.TEXTURE_2D);
		gl.bindTexture(gl.TEXTURE_2D, null);
		texture.width = width;
		texture.height = height;
		return texture;
	},

	/*xactivateTargetTexture : function(ctx, texture)
	{
		gl.bindXXY_Renderbuffer(gl.RENDERBUFFER, ctx.renderBuffer);
		gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, ctx.frameBuffer.width, ctx.frameBuffer.height);

		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
		gl.framebufferXXY_Renderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, ctx.renderBuffer);
assert(GL_FRAMEBUFFER_COMPLETE == glCheckFramebufferStatus(GL_FRAMEBUFFER))
		gl.bindTexture(gl.TEXTURE_2D, null);
		gl.bindXXY_Renderbuffer(gl.RENDERBUFFER, null);
	},*/

	drawSimpleLine : function(xSamples, ySamples, colour)
	{
		var nVertices = xSamples.length;
		var vertices = new Float32Array(2*nVertices);
		for (var i=0; i<nVertices; i++)
		{
			vertices[2*i] = xSamples[i];
			vertices[2*i+1] = ySamples[i];
		}

		this.setAdditiveBlending();

		var program = this.simpleShader;
		gl.useProgram(program);
		gl.enableVertexAttribArray(program.vertexPosition);
		gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
		gl.vertexAttribPointer(program.vertexPosition, 2, gl.FLOAT, false, 0, 0);
		gl.bindBuffer(gl.ARRAY_BUFFER, null);
		if (colour=="green") gl.uniform4fv(program.colour, [0.01, 0.1, 0.01, 1.0]);
		else if (colour == "red") gl.uniform4fv(program.colour, [0.1, 0.01, 0.01, 1.0]);

		gl.lineWidth(3.0);
		gl.drawArrays(gl.LINE_STRIP, 0, nVertices);
	},

	setAdditiveBlending : function()
	{
		//gl.blendEquation( gl.FUNC_ADD );
		gl.blendFunc(gl.ONE, gl.ONE);
	},

	setNormalBlending : function()
	{
		//gl.blendEquation( gl.FUNC_ADD );
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
	},

	createShader : function(vsTag, fsTag)
	{
		var vsSource = vsTag//document.getElementById(vsTag).firstChild.nodeValue;
		var fsSource = fsTag//document.getElementById(fsTag).firstChild.nodeValue;

		var vs = gl.createShader(gl.VERTEX_SHADER);
		gl.shaderSource(vs, vsSource);
		gl.compileShader(vs);
		if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS))
		{
			var infoLog = gl.getShaderInfoLog(vs);
			gl.deleteShader(vs);
			throw new Error('createShader, vertex shader compilation:\n' + infoLog);
		}

		var fs = gl.createShader(gl.FRAGMENT_SHADER);
		gl.shaderSource(fs, fsSource);
		gl.compileShader(fs);
		if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS))
		{
			var infoLog = gl.getShaderInfoLog(fs);
			gl.deleteShader(vs);
			gl.deleteShader(fs);
			throw new Error('createShader, fragment shader compilation:\n' + infoLog);
		}

		var program = gl.createProgram();

		gl.attachShader(program, vs);
		gl.deleteShader(vs);

		gl.attachShader(program, fs);
		gl.deleteShader(fs);

		gl.linkProgram(program);

		if (!gl.getProgramParameter(program, gl.LINK_STATUS))
		{
			var infoLog = gl.getProgramInfoLog(program);
			gl.deleteProgram(program);
			throw new Error('createShader, linking:\n' + infoLog);
		}

		return program;
	},

	supportsWebGl : function()
	{
		// from https://github.com/Modernizr/Modernizr/blob/master/feature-detects/webgl.js
		var canvas = document.createElement('canvas'),
			supports = 'probablySupportsContext' in canvas ? 'probablySupportsContext' : 'supportsContext';
		if (supports in canvas)
		{
			return canvas[supports]('webgl') || canvas[supports]('experimental-webgl');
		}
		return 'WebGLXXY_RenderingContext' in window;
	},

	noiseImg : `data:image/jpeg;base64,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`,

	shader_vertex : `attribute vec2 vertexPosition;
	void main()
	{
		gl_Position = vec4(vertexPosition, 0.0, 1.0);
	}`,

	shader_fragment : `precision highp float;
	uniform vec4 colour;
	void main()
	{
		gl_FragColor = colour;
	}`,

	shader_gaussianVertex : `#define EPS 1E-6
	uniform float uInvert;
	uniform float uSize;
	uniform float uNEdges;
	uniform float uFadeAmount;
	uniform float uIntensity;
	uniform float uGain;
	attribute vec2 aStart, aEnd;
	attribute float aIdx;
	varying vec4 uvl;
	varying vec2 vTexCoord;
	varying float vLen;
	varying float vSize;
	void main () {
		float tang;
		vec2 current;
		// All points in quad contain the same data:
		// segment start point and segment end point.
		// We determine point position using its index.
		float idx = mod(aIdx,4.0);

		// "dir" vector is storing the normalized difference
		// between end and start
		vec2 dir = (aEnd-aStart)*uGain;
		uvl.z = length(dir);

		if (uvl.z > EPS)
		{
			dir = dir / uvl.z;
			vSize = 0.006/pow(uvl.z,0.08);
		}
		else
		{
		// If the segment is too short, just draw a square
			dir = vec2(1.0, 0.0);
			vSize = 0.006/pow(EPS,0.08);
		}

		vSize = uSize;
		vec2 norm = vec2(-dir.y, dir.x);

		if (idx >= 2.0) {
			current = aEnd*uGain;
			tang = 1.0;
			uvl.x = -vSize;
		} else {
			current = aStart*uGain;
			tang = -1.0;
			uvl.x = uvl.z + vSize;
		}
		// "side" corresponds to shift to the "right" or "left"
		float side = (mod(idx, 2.0)-0.5)*2.0;
		uvl.y = side * vSize;

		uvl.w = uIntensity*mix(1.0-uFadeAmount, 1.0, floor(aIdx / 4.0 + 0.5)/uNEdges);

		vec4 pos = vec4((current+(tang*dir+norm*side)*vSize)*uInvert,0.0,1.0);
		gl_Position = pos;
		vTexCoord = 0.5*pos.xy+0.5;
		//float seed = floor(aIdx/4.0);
		//seed = mod(sin(seed*seed), 7.0);
		//if (mod(seed/2.0, 1.0)<0.5) gl_Position = vec4(10.0);
	}`,

	shader_gaussianFragment : `#define EPS 1E-6
	#define TAU 6.283185307179586
	#define TAUR 2.5066282746310002
	#define SQRT2 1.4142135623730951
	precision highp float;
	uniform float uSize;
	uniform float uIntensity;
	uniform sampler2D uScreen;
	varying float vSize;
	varying vec4 uvl;
	varying vec2 vTexCoord;

	// A standard gaussian function, used for weighting samples
	float gaussian(float x, float sigma)
	{
	  return exp(-(x * x) / (2.0 * sigma * sigma)) / (TAUR * sigma);
	}

	// This approximates the error function, needed for the gaussian integral
	float erf(float x)
	{
	  float s = sign(x), a = abs(x);
	  x = 1.0 + (0.278393 + (0.230389 + 0.078108 * (a * a)) * a) * a;
	  x *= x;
	  return s - s / (x * x);
	}

	void main (void)
	{
		float len = uvl.z;
		vec2 xy = uvl.xy;
		float brightness;

		float sigma = vSize/5.0;
		if (len < EPS)
		{
		// If the beam segment is too short, just calculate intensity at the position.
			brightness = gaussian(length(xy), sigma);
		}
		else
		{
		// Otherwise, use analytical integral for accumulated intensity.
			brightness = erf(xy.x/SQRT2/sigma) - erf((xy.x-len)/SQRT2/sigma);
			brightness *= exp(-xy.y*xy.y/(2.0*sigma*sigma))/2.0/len;
		}

		brightness *= uvl.w;
		gl_FragColor = 2.0 * texture2D(uScreen, vTexCoord) * brightness * 1.0;
		gl_FragColor.a = 1.0;
	}`,

	shader_texturedVertex : `precision highp float;
	attribute vec2 aPos;
	varying vec2 vTexCoord;
	void main (void)
	{
		gl_Position = vec4(aPos, 0.0, 1.0);
		vTexCoord = (0.5*aPos+0.5);
	}`,

	shader_texturedVertexWithResize : `precision highp float;
	attribute vec2 aPos;
	varying vec2 vTexCoord;
	uniform float uResizeForCanvas;
	void main (void)
	{
		gl_Position = vec4(aPos, 0.0, 1.0);
		vTexCoord = (0.5*aPos+0.5)*uResizeForCanvas;
	}`, 

	shader_texturedFragment : `precision highp float;
	uniform sampler2D uTexture0;
	varying vec2 vTexCoord;
	void main (void)
	{
		gl_FragColor = texture2D(uTexture0, vTexCoord);
		gl_FragColor.a= 1.0;
	}`,
	
	shader_blurFragment : `precision highp float;
	uniform sampler2D uTexture0;
	uniform vec2 uOffset;
	varying vec2 vTexCoord;
	void main (void)
	{
		vec4 sum = vec4(0.0);
		sum += texture2D(uTexture0, vTexCoord - uOffset*8.0) * 0.000078;
		sum += texture2D(uTexture0, vTexCoord - uOffset*7.0) * 0.000489;
		sum += texture2D(uTexture0, vTexCoord - uOffset*6.0) * 0.002403;
		sum += texture2D(uTexture0, vTexCoord - uOffset*5.0) * 0.009245;
		sum += texture2D(uTexture0, vTexCoord - uOffset*4.0) * 0.027835;
		sum += texture2D(uTexture0, vTexCoord - uOffset*3.0) * 0.065592;
		sum += texture2D(uTexture0, vTexCoord - uOffset*2.0) * 0.12098;
		sum += texture2D(uTexture0, vTexCoord - uOffset*1.0) * 0.17467;
		sum += texture2D(uTexture0, vTexCoord + uOffset*0.0) * 0.19742;
		sum += texture2D(uTexture0, vTexCoord + uOffset*1.0) * 0.17467;
		sum += texture2D(uTexture0, vTexCoord + uOffset*2.0) * 0.12098;
		sum += texture2D(uTexture0, vTexCoord + uOffset*3.0) * 0.065592;
		sum += texture2D(uTexture0, vTexCoord + uOffset*4.0) * 0.027835;
		sum += texture2D(uTexture0, vTexCoord + uOffset*5.0) * 0.009245;
		sum += texture2D(uTexture0, vTexCoord + uOffset*6.0) * 0.002403;
		sum += texture2D(uTexture0, vTexCoord + uOffset*7.0) * 0.000489;
		sum += texture2D(uTexture0, vTexCoord + uOffset*8.0) * 0.000078;
		gl_FragColor = sum;
	}`,

	shader_outputVertex : `precision highp float;
	attribute vec2 aPos;
	varying vec2 vTexCoord;
	varying vec2 vTexCoordCanvas;
	uniform float uResizeForCanvas;
	void main (void)
	{
		gl_Position = vec4(aPos, 0.0, 1.0);
		vTexCoord = (0.5*aPos+0.5);
		vTexCoordCanvas = vTexCoord*uResizeForCanvas;
	}`,

	shader_outputFragment : `precision highp float;
	uniform sampler2D uTexture0; //line
	uniform sampler2D uTexture1; //tight glow
	uniform sampler2D uTexture2; //big glow
	uniform sampler2D uTexture3; //screen
	uniform float uExposure;
	uniform float graticuleLight;
	uniform vec3 uColour;
	varying vec2 vTexCoord;
	varying vec2 vTexCoordCanvas;
	void main (void)
	{
		vec4 line = texture2D(uTexture0, vTexCoordCanvas);
		// r components have grid; g components do not.
		vec4 screen = texture2D(uTexture3, vTexCoord);
		vec4 tightGlow = texture2D(uTexture1, vTexCoord);
		vec4 scatter = texture2D(uTexture2, vTexCoord)+0.35;
		float light = line.r + 1.5*screen.g*screen.g*tightGlow.r;
		light += 0.4*scatter.g * (2.0+1.0*screen.g + 0.5*screen.r);
		float tlight = 1.0-pow(2.0, -uExposure*light);
		float tlight2 = tlight*tlight*tlight;
		gl_FragColor.rgb = mix(uColour, vec3(1.0), 0.3+tlight2*tlight2*0.5)*tlight;
		gl_FragColor.rgb = mix(gl_FragColor.rgb, (vec3(0.7)+0.3*uColour)*screen.b, graticuleLight);
		//gl_FragColor.rgb += 0.4*(vec3(0.7)+0.3*uColour)*screen.b;
		gl_FragColor.a= 0.5;
	}`

}



function XXY_doScriptProcessor(event)
{
	var xSamples = new Float32Array(512);
	var ySamples = new Float32Array(512);
	var sweepPosition = -1;
	var belowTrigger = false;
	var channelLeft = XXY_AudioSystem.xy.channels.left < XXY_AudioSystem.xy.channelCount ? XXY_AudioSystem.xy.channels.left : 0
	var channelRight = XXY_AudioSystem.xy.channels.right < XXY_AudioSystem.xy.channelCount ? XXY_AudioSystem.xy.channels.right : 1
	var xSamplesRaw = event.inputBuffer.getChannelData(channelLeft);
	var ySamplesRaw = event.inputBuffer.getChannelData(channelRight);
	var xOut = event.outputBuffer.getChannelData(channelLeft);
	var yOut = event.outputBuffer.getChannelData(channelRight);

	var length = xSamplesRaw.length;
	for (var i=0; i<length; i++)
	{
		xSamples[i] = xSamplesRaw[i];// + (Math.random()-0.5)*XXY_controls.noise/2000;
		ySamples[i] = ySamplesRaw[i];// + (Math.random()-0.5)*XXY_controls.noise/2000;
	}

	if (XXY_controls.sweepOn && XXY_controls.disableFilter)
	{
		var gain = Math.pow(2.0,XXY_controls.mainGain);
		var sweepMinTime = XXY_controls.sweepMsDiv*10/1000;
		var triggerValue = XXY_controls.sweepTriggerValue/gain;
		for (var i=0; i<length; i++)
		{
			sweepPosition += 2*XXY_AudioSystem.timePerSample/sweepMinTime;
			if (sweepPosition > 1.1 && belowTrigger && ySamples[i]>=triggerValue)
						{
							if (i==0) sweepPosition = -1; //don't bother to calculate
							else
							{
								var delta = (ySamples[i]-triggerValue)/(ySamples[i]-ySamples[i-1]);
								sweepPosition =-1 + delta*2*XXY_AudioSystem.timePerSample/sweepMinTime;
							}
						}
			xSamples[i] = sweepPosition / gain;
			belowTrigger = ySamples[i]<triggerValue;
		}
	}

	if (!XXY_controls.freezeImage)
	{
		if (!XXY_controls.disableFilter)
		{
			XXY_Filter.generateSmoothedSamples(XXY_AudioSystem.oldYSamples, ySamples, XXY_AudioSystem.smoothedYSamples);
			if (!XXY_controls.sweepOn) XXY_Filter.generateSmoothedSamples(XXY_AudioSystem.oldXSamples, xSamples, XXY_AudioSystem.smoothedXSamples);
			else
			{
					var xS = XXY_AudioSystem.smoothedXSamples;
					var yS = XXY_AudioSystem.smoothedYSamples;
					var gain = Math.pow(2.0,XXY_controls.mainGain);
					var sweepMinTime = XXY_controls.sweepMsDiv*10/1000;
					var triggerValue = XXY_controls.sweepTriggerValue/gain;
					var smoothedLength = XXY_AudioSystem.smoothedYSamples.length;
					var timeIncrement = 2*XXY_AudioSystem.timePerSample/(sweepMinTime*XXY_Filter.steps);
					for (var i=0; i<smoothedLength; i++)
					{
							sweepPosition += timeIncrement;
							if (sweepPosition > 1.1 && belowTrigger && yS[i]>=triggerValue)
									sweepPosition =-1;
							xS[i] = sweepPosition / gain;
							belowTrigger = yS[i]<triggerValue;
					}
			}
			if (!XXY_controls.swapXY) XXY_Render.drawLineTexture(XXY_AudioSystem.smoothedXSamples, XXY_AudioSystem.smoothedYSamples);
			else XXY_Render.drawLineTexture(XXY_AudioSystem.smoothedYSamples, XXY_AudioSystem.smoothedXSamples);
		}
		else
		{
			if (!XXY_controls.swapXY) XXY_Render.drawLineTexture(xSamples, ySamples);
			else XXY_Render.drawLineTexture(ySamples, xSamples);
		}
	}

	for (var i = 0; i<length; i++)
	{
		XXY_AudioSystem.oldXSamples[i] = xSamples[i];
		XXY_AudioSystem.oldYSamples[i] = ySamples[i];
		xOut[i] = xSamplesRaw[i];
		yOut[i] = ySamplesRaw[i];
	}

	XXY_AudioSystem.audioVolumeNode.gain.value = XXY_controls.audioVolume;
}

function XXY_drawCRTFrame(timeStamp)
{
	XXY_Render.drawCRT();
	requestAnimationFrame(XXY_drawCRTFrame);
}

XXY_did_init = false; 
function XXY_check_init(xyInstance){
	if(XXY_did_init) return; 
		XXY_did_init = true; 
		XXY_Filter.init(512, 8, 6);
		XXY_AudioSystem.init(512, xyInstance);
		XXY_UI.init();
		XXY_Render.init();
	if (XXY_Render.failed)
	{
		XXY_Render.admitFailure();
	}
	else
	{
		clearInterval(xyInstance.checkInterval) // clear attempt to connect
		XXY_Render.setupArrays(XXY_Filter.nSmoothedSamples);
		XXY_AudioSystem.startSound();
		requestAnimationFrame(XXY_drawCRTFrame);
	}
}



//XXY_Filter.init(1024, 8, 6);
//XXY_AudioSystem.init(1024);
//var xSamples = new Float32Array(1024);
//var ySamples = new Float32Array(1024);

var XXY_controls = {
	swapXY : false,
	light : false,
	sweepOn : false,
	sweepMsDiv : 1,
	sweepTriggerValue : 0,
	signalGeneratorOn : false,
	mainGain : 1.1,
	thickness: 0.01,
	exposureStops : -.2,
	persistence : 0,
	audioVolume : 0,
	hue : 120,
	freezeImage: true, // ** make true by default unless visible
	disableFilter: false,
	aValue : 1.0,
	aExponent : 0.0,
	bValue : 1.0,
	bExponent :0.0,
	invertXY : false,
	grid : false,
}