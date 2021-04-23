// p5.glitch v0.1.3
// cc teddavis.org 2021

class Glitch{
	constructor(instance){
		if(instance !== undefined) this.p5 = instance;
		else this.p5 = p5.instance;
		this.mode = 'image';
		this.width = 1;
		this.height = 1;
		this.image = this.p5.createImage(1, 1);
		this.bytes = [];
		this.bytesGlitched = [];
		this.hex = [];
		this.hexGlitched = [];
		this.base64 = '';
		this.base64Glitched = '';
		this.base64Type = '';
		this.limitStart = 0.2;
		this.limitStop = 1;
		this.fileType = 'image/jpeg';
		this.fileQuality = 1.0;
		this.fileFormat = 'jpeg';
		this.types = [];
		this.initTypes();
		this.initBase64();
		this.errorOut = true;
		this.debugOut = false;
	}


	/* BINARY DATA FUNCTIONS */
	// load bytes by passing filepath string or p5.js loadBytes object. optional callback when ready
	loadBytes(bytes, callback){
		this.debugMsg('p5.glitch - loadBytes()...');
		if(typeof bytes === 'string'){
			this.p5.loadBytes(bytes, loadedBytes => {
				this.parseBytes(loadedBytes.bytes, callback);
			}, function(){this.errorMsg('p5.glitch - error loading bytes');}.bind(this));
		}else if(typeof bytes === 'object' && bytes.hasOwnProperty('bytes') && bytes.bytes.length > 0){
			this.parseBytes(bytes.bytes, callback);
		}else if(typeof bytes === 'object' && bytes.constructor.name == 'Uint8Array' && bytes.length > 0){
			this.parseBytes(bytes, callback);
		}else if(bytes instanceof Array && bytes.length > 0){
			this.parseBytes(bytes, callback);
		}else{
			this.errorMsg('p5.glitch - error loading bytes');
		}
	}

	// handle loadBytes()
	parseBytes(bytes, callback){
		this.debugMsg('p5.glitch - parseBytes()...');
		this.mode = 'binary';
		this.bytes = bytes;
		this.bytesGlitched = this.bytes;
		this.debugMsg('p5.glitch - binary loaded - bytes.length: ' + this.bytes.length);
		if(typeof callback == 'function' && callback !== undefined){
			callback();
		}
	}

	// save binary file from glitched bytes, use filename with same extension as loadBytes()
	// https://github.com/sindresorhus/file-type for example files
	saveBytes(fileName = 'p5.glitch'){
		if(this.mode === 'binary'){
			this.debugMsg('p5.glitch - saveBytes()...');
			var a = document.createElement("a");
			document.body.appendChild(a);
			a.style = "display: none";

			if(fileName === 'p5.glitch'){
				fileName = fileName + '_' + this.timeStamp();
				this.debugMsg('p5.glitch - saving unknown datatype, use saveBytes(filename.xxx) with file extension');
			}

			let blob = new Blob([this.bytesGlitched], {type: "octet/stream"});
			let blobURL = window.URL.createObjectURL(blob);
			a.href = blobURL;
			a.download = fileName;
			a.click();
			window.URL.revokeObjectURL(blobURL);
			this.debugMsg('p5.glitch - binary downloaded');
		}
	}



	/* IMAGE FUNCTIONS */

	// create array of available in-browser image glitching types, glitch.types
	// available types check inspired from https://output.jsbin.com/davemir
	initTypes(){
		const tests = [
			"image/png",
			"image/jpeg",
			"image/jpg",
			"image/webp",
			"image/ico",
			"image/bmp",
			"image/gif",
			"image/tif",
		];

		let types = [];
		let tempCanvas = document.createElement("canvas");
		tests.forEach((type) => {
			const url = tempCanvas.toDataURL(type);
		 	let supported = url.startsWith(`data:${type}`);
			if(supported){
				types.push(type);
			}
		});
		this.types = types;
		tempCanvas.remove();
		return types;
	}

	// set loaded image type for different types of glitch (glitch.types = browser compatibility)
	loadType(newType){
		if(newType.indexOf('/') === -1){
			newType = 'image/' + newType;
		}
		if(newType === 'image/jpg'){
			newType = 'image/jpeg';
		}
		if(this.types.indexOf(newType) === -1){
			this.errorMsg('p5.glitch - '+newType+' is not supported in this browser');
		}
		this.fileType = newType;
		this.debugMsg('p5.glitch - loadType: '+this.fileType);

	}

	// set loaded image quality (only relevant for jpeg or webp)
	loadQuality(newQuality){
		this.fileQuality = this.p5.constrain(newQuality, 0, 1);
		this.debugMsg('p5.glitch - loadQuality: '+this.fileQuality);
	}

	// load image by path or p5.js loaded image (video, capture, image)
	loadImage(img, callback){
		this.debugMsg('p5.glitch - loadImage()...');
		if(typeof img === 'string'){
			this.p5.loadImage(img, im => {
				this.parseImage(im, callback);
			}, function(){this.errorMsg('p5.glitch - error loading image');}.bind(this));
		}else if(img.hasOwnProperty('width') && img.width > 0){
			this.parseImage(img, callback);
		}else{
			this.errorMsg('p5.glitch - error loading image');
		}
	}

	// handle loaded image
	parseImage(img, callback){
		this.debugMsg('p5.glitch - parseImage()...');
		this.mode = 'image';
		let grabimg = img.get();
		let dataimg = grabimg.canvas.toDataURL(this.fileType, this.fileQuality).split(',');
		this.fileFormat = this.fileType.split('/')[1];
		this.base64Type = dataimg[0];
		this.base64 = dataimg[1];
		this.base64Glitched = this.base64;
		this.bytes = this.base64ToBytes(dataimg[1]);
		this.bytesGlitched = this.bytes;
		this.buildImage(this.bytes);
		this.debugMsg('p5.glitch - image loaded - bytes.length: ' + this.bytes.length);
		if(typeof callback == 'function' && callback !== undefined){
			callback();
		}
	}

	// updates width + height for auto scaling image to canvas
	scaleImage(img){
		let scl = 1;
		if(this.p5.height >= this.p5.width || this.p5.abs(this.p5.height - this.p5.width) < 5) {
			scl = this.p5.height / img.height;
		} else {
			scl = this.p5.width / img.width;
		}
		this.width = img.width * scl;
		this.height = img.height * scl;
	}

	// recompile image based on glitched bytes
	buildImage(callback){
		if(this.mode === 'image' && this.base64Type !== '' && this.base64Glitched !== ''){
			this.p5.loadImage(this.base64Type + ', ' + this.base64Glitched, img => {
				this.scaleImage(img);
				this.image = img.get();
				if(typeof callback == 'function' && callback !== undefined){
					callback(img);
				}
			}, function(){this.errorMsg('p5.glitch - error building image');}.bind(this));
		}
	}

	// save recompiled image
	saveImage(fileName = 'p5.glitch'){
		if(this.mode === 'image'){
			this.debugMsg('p5.glitch - saveImage()...');
			if(fileName === 'p5.glitch'){
				fileName = fileName + '_' + this.timeStamp();
			}

			this.image.save(fileName +'.'+ this.fileFormat);
			this.debugMsg('p5.glitch - image downloaded');
		}
	}

	// save recompiled image as copy (safe)
	saveSafe(fileName = 'p5.glitch', fileType = 'png'){
		if(this.mode === 'image'){
			this.debugMsg('p5.glitch - saveSafe()...');
			if(fileName === 'p5.glitch'){
				fileName = fileName + '_' + this.timeStamp();
			}

			if(fileType !== undefined && fileType === 'jpg'){
				fileType = 'jpg';
			}

			let imgSafe = this.image.get();
			imgSafe.save(fileName +'_safe.'+ fileType);
			this.debugMsg('p5.glitch - safe image downloaded');
		}
	}

	// save canvas as png (incase layering multiple glitch states)
	saveCanvas(fileName = 'p5.glitch', fileType = 'png'){
		if(this.mode === 'image'){
			this.debugMsg('p5.glitch - saveCanvas()...');
			if(fileName === 'p5.glitch'){
				fileName = fileName + '_' + this.timeStamp();
			}

			if(fileType !== undefined && fileType === 'jpg'){
				fileType = 'jpg';
			}

			this.p5.save(fileName + '_canvas.' + fileType);
			this.debugMsg('p5.glitch - canvas downloaded');
		}
	}



	/* GLITCH FUNCTIONS */

	// reset glitched bytes/base64 back to original imported
	resetBytes(){
		this.bytesGlitched = this.bytes.slice();
		this.base64Glitched = this.base64;
		this.debugMsg('p5.glitch - resetBytes()');
	}

	// limit glitching to percentage of file
	limitBytes(limitStart = 0.2, limitStop = 1.0){
		this.limitStart = this.p5.constrain(limitStart, 0.0, 1.0);
		this.limitStop = this.p5.constrain(limitStop, this.limitStart, 1.0);
		this.debugMsg('p5.glitch - limitStart: ' + limitStart + '/ limitStop: ' + limitStop);
	}

	// handle new limit
	parseLimit(newLimit){
		if(newLimit !== undefined && newLimit instanceof Array){
			if(newLimit.length === 1){
				this.limitBytes(newLimit[0]);
			}else if(newLimit.length === 2){
				this.limitBytes(newLimit[0], newLimit[1]);
			}
		}
	}

	// set single byte of whole image to random value
	randomByte(bytePos){
		bytePos = this.parsePosition(bytePos);
		let newData = this.bytesGlitched.slice();

		newData[bytePos] = this.parseByte(random(255));

		this.updateBytes(newData);
	}

	// set x (byteCount) bytes within pre-set limits to random or newValue
	randomBytes(byteCount, replaceVal){
		let newData = this.bytesGlitched.slice();

		if(byteCount === undefined){
			byteCount = 1;
		}

		for(let i = 0; i < byteCount; i++) {
			if(replaceVal !== undefined){
				replaceVal = this.parseByte(replaceVal);
			}else{
				replaceVal = this.parseByte(this.p5.random(255));
			}
			let randomPos = this.p5.floor(this.p5.random(newData.length * this.limitStart, newData.length * this.limitStop));
			newData[randomPos] = replaceVal;
		}

		this.updateBytes(newData);
	}

	// replace single byte with new value (accepts HEX position and value)
	replaceByte(bytePos, replaceVal){
		let newData = this.bytesGlitched.slice();

		bytePos = this.parsePosition(bytePos);
		newData[bytePos] = this.parseByte(replaceVal);

		this.updateBytes(newData);
	}

	// find and replace bytes within pre-set limits (accepts HEX values)
	replaceBytes(findVal, replaceVal){
		let newData = this.bytesGlitched.slice();

		findVal = this.parseByte(findVal);
		replaceVal = this.parseByte(replaceVal);

		let iStart = this.p5.floor(newData.length * this.limitStart);
		let iStop = this.p5.floor(newData.length * this.limitStop);
		for(let i = iStart; i < iStop; i++){
			if(newData[i] === findVal){
				newData[i] = replaceVal;
			}
		}

		this.updateBytes(newData);
	}

	// find + replace contents based on hex values
	replaceHex(findVal, replaceVal){
		let newData = this.bytesGlitched.slice();
		let hex = this.bytesToHex(newData);

		if(typeof findVal === 'string' && typeof replaceVal === 'string'){
			hex = hex.split(findVal).join(replaceVal);
		}

		this.updateBytes(this.hexToBytes(hex));
	}

	// find and replace bytes within pre-set limits (accepts HEX values)
	swapBytes(aByte, bByte){
		let newData = this.bytesGlitched.slice();

		aByte = this.parseByte(aByte);
		bByte = this.parseByte(bByte);

		let iStart = this.p5.floor(newData.length * this.limitStart);
		let iStop = this.p5.floor(newData.length * this.limitStop);
		for(let i = iStart; i < iStop; i++){
			if(newData[i] === aByte){
				newData[i] = bByte;
			}else if(newData[i] === bByte){
				newData[i] = aByte;
			}
		}

		this.updateBytes(newData);
	}

	// handle changes
	updateBytes(newBytes = this.bytes){
		this.base64Glitched = this.bytesToBase64(newBytes.slice());
		this.bytesGlitched = newBytes.slice();
	}

	// eval new byte position
	parsePosition(newPos, bytes){
		if(typeof newPos === 'string'){
			newPos = parseInt(newPos, 16);
		}

		let bytesLength = this.bytesGlitched.length;
		if(bytes !== undefined && bytes instanceof Array && bytes.length > 0){
			bytesLength = bytes.length;
		}

		newPos = this.p5.floor(this.p5.constrain(newPos, 0, bytesLength));
		return newPos;
	}

	// eval new byte value
	parseByte(newVal){
		if(typeof newVal === 'string'){
			newVal = parseInt(newVal, 16);
		}else if(!isNaN(newVal)){
			newVal = this.p5.floor(this.p5.constrain(newVal, 0, 255));
		}
		return newVal;
	}



	/* META FUNCTIONS */

	// hard (nearest neighbor) pixels, optionally scale canvas (only use in setup)
	pixelate(newDensity = 1){
		newDensity = this.p5.constrain(newDensity, 0.0, this.p5.displayDensity());
		this.p5.pixelDensity(newDensity);
		document.body.style.imageRendering = "pixelated";
		this.p5.noSmooth();
		this.debugMsg('p5.glitch - pixelate density: ' + newDensity);
	}

	// toggle errors in console
	errors(mode){
		if(typeof mode == 'boolean'){
			this.errorOut = mode;
		}else{
			this.errorMsg('p5.glitch - errors() use true/false');
			return false;
		}

		if(!this.errorOut){
			window.addEventListener('error', function(){return true;});
		}else{
			window.removeEventListener('error', function(){return true;});
		}

		this.debugMsg('p5.glitch - errors: ' + this.errorOut);
	}

	// if errors() active, log messages
	errorMsg(msg){
		if(this.errorOut || this.debugOut){
			console.log(msg);
		}
	}

	// toggle debug info
	debug(mode = true){
		this.debugOut = mode;

		if(this.debugOut){
			this.debugMsg('p5.glitch - debug: ' + this.debugOut);
			this.debugMsg('p5.glitch - available image types:\n' + this.types.join(', '));
		}
	}

	// if debug active, log messages
	debugMsg(msg){
		if(this.debugOut){
			console.log(msg);
		}
	}

	// custom timestamp for exporting
	timeStamp(){
		let d = new Date();
		d.setTime( d.getTime() - new Date().getTimezoneOffset()*60*1000 );
		let ts = d.toISOString().replace(/[^0-9]/g, '').slice(0, -3);
		return ts;
	}



	/* BYTES/BASE64/HEX FUNCTIONS */

	// https://gist.github.com/enepomnyaschih/72c423f727d395eeaa09697058238727
	initBase64(){
		this.base64abc = [
			"A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
			"N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
			"a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m",
			"n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",
			"0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "+", "/"
		];

		this.base64codes = [
			255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
			255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
			255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 62, 255, 255, 255, 63,
			52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 255, 255, 255, 0, 255, 255,
			255, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
			15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 255, 255, 255, 255, 255,
			255, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40,
			41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51
		];
	}

	getBase64Code(charCode) {
		if(charCode > this.base64codes.length) {
			throw new Error("Unable to parse base64 string.");
		}
		const code = this.base64codes[charCode];
		if(code === 255) {
			throw new Error("Unable to parse base64 string.");
		}
		return code;
	}

	bytesToBase64(bytes) {
		let result = '',
			i, l = bytes.length;
		for(i = 2; i < l; i += 3) {
			result += this.base64abc[bytes[i - 2] >> 2];
			result += this.base64abc[((bytes[i - 2] & 0x03) << 4) | (bytes[i - 1] >> 4)];
			result += this.base64abc[((bytes[i - 1] & 0x0F) << 2) | (bytes[i] >> 6)];
			result += this.base64abc[bytes[i] & 0x3F];
		}
		if(i === l + 1) { // 1 octet yet to write
			result += this.base64abc[bytes[i - 2] >> 2];
			result += this.base64abc[(bytes[i - 2] & 0x03) << 4];
			result += "==";
		}
		if(i === l) { // 2 octets yet to write
			result += this.base64abc[bytes[i - 2] >> 2];
			result += this.base64abc[((bytes[i - 2] & 0x03) << 4) | (bytes[i - 1] >> 4)];
			result += this.base64abc[(bytes[i - 1] & 0x0F) << 2];
			result += "=";
		}
		return result;
	}

	base64ToBytes(str) {
		if(str.length % 4 !== 0) {
			throw new Error("Unable to parse base64 string.");
		}
		const index = str.indexOf("=");
		if(index !== -1 && index < str.length - 2) {
			throw new Error("Unable to parse base64 string.");
		}
		let missingOctets = str.endsWith("==") ? 2 : str.endsWith("=") ? 1 : 0,
			n = str.length,
			result = new Uint8Array(3 * (n / 4)),
			buffer;
		for(let i = 0, j = 0; i < n; i += 4, j += 3) {
			buffer =
				this.getBase64Code(str.charCodeAt(i)) << 18 |
				this.getBase64Code(str.charCodeAt(i + 1)) << 12 |
				this.getBase64Code(str.charCodeAt(i + 2)) << 6 |
				this.getBase64Code(str.charCodeAt(i + 3));
			result[j] = buffer >> 16;
			result[j + 1] = (buffer >> 8) & 0xFF;
			result[j + 2] = buffer & 0xFF;
		}
		return result.subarray(0, result.length - missingOctets);
	}


	// https://stackoverflow.com/a/34356351/10885535
	// Convert a hex string to a byte array
	hexToBytes(hex) {
		for (var bytes = [], c = 0; c < hex.length; c += 2) {
			bytes.push(parseInt(hex.substr(c, 2), 16));
		}
		return bytes;
	}

	// Convert a byte array to a hex string
	bytesToHex(bytes) {
		for (var hex = [], i = 0; i < bytes.length; i++) {
			var current = bytes[i] < 0 ? bytes[i] + 256 : bytes[i];
			hex.push((current >>> 4).toString(16));
			hex.push((current & 0xF).toString(16));
		}
		return hex.join("");
	}
}