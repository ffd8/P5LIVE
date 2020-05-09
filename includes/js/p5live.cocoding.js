// collection of JS functions for P5LIVE COCODING

function setupMidi(idIn, idOut) {
	let midiMsg = {};
	WebMidi.enable(function(err) {
		if(err) {
			console.log("WebMidi could not be enabled.", err);
		}

		// Print to console available MIDI in/out id/names
		WebMidi.inputs.forEach(function(element, c) {
			print("in  \[" + c + "\] " + element.name);
		});
		WebMidi.outputs.forEach(function(element, c) {
			print("out \[" + c + "\] " + element.name);
		});

		// assign in channel:
		if(typeof idIn === 'number') {
			midiInput = WebMidi.inputs[idIn];
		} else {
			midiInput = WebMidi.getInputByName(idIn);
		}

		if(typeof idOut === 'number') {
			midiOutput = WebMidi.outputs[idOut];
		} else {
			midiOutput - WebMidi.getOutputByName(idOut);
		}

		midiInput.addListener('midimessage', 'all', function(e) {
			midiMsg = {};
			midiMsg.data = e.data;
			midiMsg.timestamp = e.timestamp;
			midiMsg.start = new Date().getTime(); // to debug latency
		});

		// noteOn
		midiInput.addListener('noteon', "all", function(e) {
			let note = {
				type: 'noteon'
			};
			note.channel = e.channel;
			note.number = e.note.number;
			note.name = e.note.name;
			note.octave = e.note.octave;
			note.velocity = floor(127 * e.velocity);

			midiMsg.note = note;
			parseMidi(midiMsg);
		});

		// noteOff
		midiInput.addListener('noteoff', "all", function(e) {
			let note = {
				type: 'noteoff'
			};
			note.channel = e.channel;
			note.number = e.note.number;
			note.name = e.note.name;
			note.octave = e.note.octave;
			note.velocity = 0;

			midiMsg.note = note;
			parseMidi(midiMsg);
		});

		// pitchBend
		midiInput.addListener('pitchbend', "all", function(e) {
			let pitch = {
				type: 'pitchbend'
			};
			pitch.channel = e.channel;
			pitch.value = floor(127 * e.value);

			midiMsg.pitch = pitch;
			parseMidi(midiMsg);
		});

		// controlChange
		midiInput.addListener('controlchange', "all", function(e) {
			let control = {
				type: 'controlchange'
			};
			control.channel = e.channel;
			control.controllerNumber = e.controller.number;
			control.controllerName = e.controller.name;
			control.value = e.value

			midiMsg.control = control;
			parseMidi(midiMsg);
		});

	});
}