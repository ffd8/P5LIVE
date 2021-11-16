/*
	ace.recoding
	record and playback your live coding process!
	cc teddavis.org 2021

	developed for P5LIVE
	p5live.org / github.com/ffd8/p5live
 */


class Recoding{
	constructor(editorIn, editorOut){
		this.editorIn = editorIn
		this.editorOut = editorOut
		this.session = {
			history: [],
			fileName: 'recoding',
			events: [],
			eventsCur: 0,
			compiles: []
		}
		this.speed = 1.0
		this.loop = false
		this.gaps = false
		this.gapsVal = 0
		this.gapsMax = 5.0
		this.playing = false
		this.recording = false
		this.recordingLock = false
		this.elms = {
			steps: undefined,
			range: undefined,
			bts: {
				record: undefined,
				play: undefined
			}
		}
		this.recordKeystrokeBound = this.recordKeystroke.bind(this)
		this.debug = false
	}

	loadSession(){
		let recodingSession = sessionStorage.getItem('recoding')
		if(recodingSession !== null){
			this.session = JSON.parse(recodingSession)
			this.scrubSet()
			this.session.eventsCur = 0
			recodingToggle()
		}
	}

	recordKeystroke(e) {
		let keyEvent = {
			'd': e,
			't': Date.now()
		}
		this.session.history.push(keyEvent)
		this.scrubSet()
	}


	compile() {
		if(this.debug) console.log('recoding: compile')
			let keyEvent = {
				'e': '*',
				't': Date.now()
			}

		this.session.history.push(keyEvent)
		this.scrubSet()
	}


	captureState() {
		let newLines = this.editorIn.getValue().split('\n')
		let keyEvent = {
			e: 'init',
			d: {
				start: {row: 0, column: 0},
				end: {row: newLines.length, column: newLines[newLines.length-1].length},
				action: 'insert',
				id:0,
				lines: newLines,
			},
			't': Date.now()
		}

		this.session.history.push(keyEvent)
		this.compile()
		this.scrubSet()
	}


	record() {
		if(this.debug) console.log('recoding: record')

		if(!this.recordingLock){
			this.recording = true
			this.scrubLock(true)
			this.captureState()
			this.editorIn.on("change", this.recordKeystrokeBound, false)
		}
	}

	recordLock(lock){
		if(lock){
			this.recordingLock = true
		}else{
			this.recordingLock = false
		}

		if(this.elms.btns.record){
			this.elms.btns.record.disabled = lock
		}
	}

	stop() {
		if(this.debug) console.log('recoding: stop')

		this.recording = false
		this.playing = false
		this.editorIn.off("change", this.recordKeystrokeBound, false)
		this.editorOut.setReadOnly(false)

		if (this.session.events.length > 0) {
			for (let i = 0; i < this.session.events.length; i++) {
				clearTimeout(this.session.events[i])
			}
		}

		if(this.session.history.length > 0){
			this.scrubLock(false)
			sessionStorage.setItem("recoding", JSON.stringify(this.session))
		}
	}

	play() {
		if(this.debug) console.log('recoding: play')

		this.gapsVal = 0
		if(this.session.history.length > 0 && this.session.eventsCur < this.session.history.length){
			this.playing = true
			this.scrubLock(false)
			if(this.session.eventsCur >= this.session.history.length-1){
				this.session.eventsCur = 0
			}
			let startTime = this.session.history[this.session.eventsCur].t

			if (this.session.events.length > 0) {
				for (let i = 0; i < this.session.events.length; i++) {
					clearTimeout(this.session.events[i])
				}
			}

			// only reset if first event
			if(this.session.eventsCur == 0){
				this.editorOut.setValue("")
			}
			this.editorOut.setReadOnly(true)
			this.editorOut.clearSelection()

			for (let i = this.session.eventsCur; i < this.session.history.length; i++) {
				this.createEvent(startTime, i)
			}

			this.recordLock(true)
		}else{
			this.init()
		}
	}

	createEvent(starttime, i) {
		let k = this.session.history[i]

		// check previous event for recompile, to leave timing normal
		let kp
		if(i > 0){
			kp = this.session.history[i-1]
		}

		// optionally reduce long pauses....
		if(i > 0 && this.gaps && (kp !==undefined && kp.e !== '*')){
			let offset = this.session.history[i].t-this.session.history[i-1].t
			let gapsMax = parseFloat(this.gapsMax) * 1000
			if(offset > gapsMax){
				this.gapsVal += offset - gapsMax
			}

		}

		let delayTimer = ((this.session.history[i].t-this.gapsVal) - starttime)

		let self = this
		let evt = setTimeout(function(){

			self.editorOut.clearSelection()

			if(k.e === '*'){
				recompile()
			}else if(k.e === 'init'){
            	self.editorOut.setValue('')
	            self.editorOut.session.doc.applyDelta(k.d)
            }else{
				self.editorOut.session.doc.applyDelta(k.d)
			}

			self.session.eventsCur++
			if(self.session.compiles.indexOf(self.session.eventsCur) != -1){
				let rangeIndex = self.session.compiles.indexOf(self.session.eventsCur)
				if(self.elms.range){
					self.elms.range.value = rangeIndex
					self.elms.range._tippy.setContent('Step ' + (parseInt(rangeIndex) + 1) +' of '+ self.session.compiles.length)
				}
				if(self.elms.steps){
					self.elms.steps.innerHTML = (parseInt(rangeIndex) + 1) +'/'+ self.session.compiles.length
				}
			}
			if(self.session.eventsCur >= self.session.history.length){
				self.playing = false
				self.recordLock(false)
				self.session.eventsCur = 0
				if(self.loop){
					let replay = setTimeout(function(){
						self.play()
					}, delayTimer / parseFloat(self.speed))
					self.session.events.push(replay)
				}else{
					recoding.elms.btns.play.innerHTML = icon.play // *** P5LIVE specific
				}
			}

			if (i == self.session.history.length - 1) {
				self.editorOut.setReadOnly(false)
			}

		}, delayTimer / parseFloat(self.speed))

		this.session.events.push(evt)
	}

	scrubSet(){
		// every spot
		// btns.scrub.max = recoding.history.length

		// just compiles
		this.session.compiles = []
		for(let i=0; i < this.session.history.length; i++){
			let k = this.session.history[i]
			if(k.e === '*'){
				this.session.compiles.push(i)
			}
		}
		if(this.elms.range){
			this.elms.range.max = this.session.compiles.length-1
			this.elms.range.value = 0
			if(this.elms.range._tippy)
			this.elms.range._tippy.setContent('Step ' + this.session.compiles.length +' of '+ this.session.compiles.length)
		}

		if(this.elms.steps){
			this.elms.steps.innerHTML = this.session.compiles.length +'/'+ this.session.compiles.length
		}

	}

	scrubStop(){
		this.editorOut.setReadOnly(false)
	}

	// just compile
	scrub(step){
		this.editorOut.setReadOnly(true)
		let curPos = {row:0, column: 0}
		let tempdoc = new Document("")
		let tempDeltas = []
		let loopStep = this.session.compiles[step]
		this.session.eventsCur = loopStep

		for(let i=0; i < loopStep;i++){
			let k = this.session.history[i]
			if(k.e !== '*'){
				if(k.e === 'init'){
	            	tempdoc.setValue('')
		            tempDeltas.push(k.d)
					tempdoc.applyDelta(k.d)
	            }else{
	            	if(k.d.hasOwnProperty('end')){
					 	curPos = k.d.end
					 }
					 tempDeltas.push(k.d)
					 tempdoc.applyDelta(k.d)
	            }
			}
		}

		if(this.elms.range){
			this.elms.range._tippy.setContent('Step ' + (parseInt(step) + 1) +' of '+ this.session.compiles.length)
		}

		if(this.elms.steps){
			this.elms.steps.innerHTML = (parseInt(step) + 1) +'/'+ this.session.compiles.length
		}

		if(tempDeltas.length > 0){
			this.editorOut.setValue(tempdoc.getValue(), 1)
			this.editorOut.moveCursorTo(curPos.row, curPos.column)
		}

		this.recordLock(true)
		if(parseInt(step) === this.session.compiles.length-1){
			this.recordLock(false)
		}

		if(parseInt(step) === 0){
			this.session.eventsCur = 0
		}
	}

	scrubLock(lock){
		if(this.elms.range){
			if(lock){
				this.elms.range.disabled = true
			}else{
				this.elms.range.disabled = false
			}
		}
	}


	init(){
		this.stop()
		this.session.eventsCur = 0
		this.session.events = []
		this.gapsVal = 0
		this.scrubLock(true)
		this.recordLock(false)
	}

	reset(){
		if(this.debug) console.log('recoding: reset')

		sessionStorage.removeItem('recoding')
		this.session.history = []
		this.session.fileName = 'recoding'
		if(this.elms.range){
			this.elms.range.max = 1
			this.elms.range.value = 1
		}
		if(this.elms.steps){
			this.elms.steps.innerHTML = ''
		}
		this.init()
	}

	// function duration(){
	// 	let dur = (recoding.history[recoding.history.length-1].t - recoding.history[0].t)/1000
	// 	console.log(d)
	// }

	setSpeed(speed){
		if(speed > 0){
			this.speed = speed
			if(this.playing){
				this.stop()
				this.play()
			}
		}
	}

	export(){
		if(this.debug) console.log('recoding: save')

		let saveData = {
			app: 'P5LIVE',
			type: 'RECODING',
			filename: this.session.fileName,
			version: currentVersion,
			revision: currentRevision,
			data: this.session.history
		}
		exportJSON(saveData, 'P5L_REC_'+this.session.fileName+'.json')
	}
}