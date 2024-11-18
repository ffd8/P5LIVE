/*
	audio utils for P5LIVE
*/

class AudioP5{
	constructor(makeGlobal = false){
		this.fft = [],
		this.fftEase = [],
		this.waveform = [],
		this.waveformEase = [],
		this.amp = 0.0,
		this.ampEase = 0.0,
		this.ampL = 0.0,
		this.ampEaseL = 0.0,
		this.ampR = 0.0,
		this.ampEaseR = 0.0,
		this.numBins = 512,
		this.bands = 12
		this.ease = .075
		this.makeGlobal = makeGlobal
	}

	setup(){
		userStartAudio()
		this.mic = new p5.AudioIn()
		this.mic.start()
		this.fftRaw = new p5.FFT(0.75, this.numBins)
		this.fftRaw.setInput(this.mic)

		this.update()
		this.waveformEase = this.waveform
		this.fftEase = this.fft

		return this // can alias as another variable
	}

	update(){
		this.fftRaw.analyze()
		this.amp = this.mic.getLevel() * 1000 // average mixed amplitude
		this.ampEase = ease(this.amp, this.ampEase, this.ease) // smooth 'amp'
		this.ampL = this.mic.amplitude.getLevel(0) * 500 // average left amplitude
		this.ampEaseL = ease(this.ampL, this.ampEaseL, this.ease) // smooth 'ampL'
		this.ampR = this.mic.amplitude.getLevel(1) * 500 // average right amplitude
		this.ampEaseR = ease(this.ampR, this.ampEaseR, this.ease) // smooth 'ampR'
		this.waveform = this.fftRaw.waveform() // array (-1, 1)
		this.fft = this.fftRaw.logAverages(this.fftRaw.getOctaveBands(this.bands)) // array (0, 255)
		
		for(let i=0; i < this.waveformEase.length; i++){
			this.waveformEase[i] = ease(this.waveform[i], this.waveformEase[i], this.ease)
		}
		
		for(let i=0; i < this.fftEase.length; i++){
			this.fftEase[i] = ease(this.fft[i], this.fftEase[i], this.ease)
		}

		if(this.makeGlobal){
			for (const key in this){
				if(key != 'makeGlobal' && key != 'ease'){
					// console.log(key, this[key]);	
					window[key] = this[key];	
				}
			}
		}
	}
}

function setupAudio(makeGlobal = false){
	a5 = new AudioP5(makeGlobal)
	a5.setup()
}

function updateAudio(){
	a5.update()
}

