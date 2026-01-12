/*
	ace.ghost
	insert code snippets like a ghost in the machine!
	cc teddavis.org 2025

	developed for P5LIVE
	p5live.org / github.com/ffd8/p5live
 */

class AceGhost{
	constructor(editor){
		this.que = []
		this.editor = editor
		this.animateTextTimeout
		this.delay = 10
		this.debug = false
	}

	log(txt){
		if(this.debug) console.log(txt)
	}

	async animateText(message, index, cb){
		if (index < message.length) {
		 	// insert at cursor
		 	// console.log(message[index] == '\n')
		 	// if(message[index] == '\n'){
		 	// 	this.editor.insert( "\n")
		 	// }else{
			// 	this.editor.session.insert(this.editor.getCursorPosition(), message[index]);
		 	// }
		 	// index++

		 	this.editor.session.insert(this.editor.getCursorPosition(), message[index++]);
			// clear selection just in case there was something selected
			this.editor.selection.clearSelection();
			// make sure cursor is visible
			this.editor.renderer.scrollCursorIntoView();

			// adjust delay after typing a space
			// if (/\s/.test(message[index - 1])) delay = 0
			var self = this
			this.animateTextTimeout = setTimeout(function () {
				this.animateText(message, index, cb);
			}.bind(self), this.delay);
		}else{

			if(cb){
				cb()
			}
			// tidyCode(editor);
			let addDelay = false
			if(this.que.length > 0 && ['globalTop', 'setup', 'globalBottom'].includes(this.que[0].funName) && this.que[0].codeInsert != ''){
				recompile(true);
				addDelay = true
			}

			if(this.que.length > 1){
				this.que.splice(0, 1)

				setTimeout(()=>{
					// this.setUndoStack()
					// this.getUndoStack()
					this.addCode(this.que[0])
				}, addDelay ? 1000:0)
				
			}else{
				this.disableEditor(false)
				if(!settings.cocoding.active){
					let lf = await p5liveDB.setItem(settings.fileName, editor.getValue())
				}

				this.setUndoStack()
			}
		}
	}

	insertText(txt, cb){
  		// editor.setCursorPosition(pos)
 		// editor.moveCursorTo(pos.row, pos.column); //lineNumber,colNumber
		this.disableEditor(true)
 		this.animateText(txt, 0, cb)
	}

	disableEditor(state){
		if(state){
			this.editor.setReadOnly(true)
			this.editor.container.style.pointerEvents = 'none';
		}else{
			this.editor.setReadOnly(false)
			this.editor.container.style.pointerEvents = 'auto';
		}
	}

	snippetsApply(snippet){
		this.que = []
		let snippetCode = snippet;
		
		let curPos = this.editor.getCursorPosition()
		let curLineText = this.editor.session.getLine(curPos.row);

		let curCode = editor.getValue()
		if(snippetCode.hasOwnProperty('libs')){
			let curLibs = curCode.match(/(?=var|let|const).*(?=loadScripts|libs|scripts).*?(\])/gs)[0]
			let newLibs = curLibs.slice(0, -1) + snippetCode.libs.map(lib => `,\n'${lib}'`).join('') + ',' + curLibs.slice(-1)
			curCode = curCode.replace(curLibs, `\n${newLibs}\n`)
		}

		this.getUndoStack()

		editor.setValue(curCode, 0)

		this.addQue(snippetCode.gt, 'globalTop', 'top');
		this.addQue(snippetCode.s, 'setup', 'bottom');
		this.addQue(snippetCode.dt, 'draw', 'top');
		this.addQue(snippetCode.db, 'draw', 'bottom');
		this.addQue(snippetCode.gb, 'globalBottom', 'bottom');

		// console.log(que)
		this.disableEditor(true)

		setTimeout(()=>{
			this.addCode(this.que[0])
		}, 200)
		
		// return cursor to previous position (** fix if blank line)
		let curLines = this.editor.getValue().split('\n')
		if(curLineText != ''){
			let curRow = curLines.indexOf(curLineText)
			this.editor.moveCursorTo(curRow, curPos.column);
			this.editor.renderer.scrollCursorIntoView({row: curRow, column: curPos.column}, 0.5);
		}		
	}

	getUndoStack(){
		// *** start undostack collecting
		this.log('getUndoStack')
		this.undostackBefore = this.editor.session.$undoManager.$undoStack
		// this.log(this.undostackBefore)
		this.editor.session.$undoManager.reset();
	}

	setUndoStack(){
		// *** end collecting
		this.log('setUndoStack')
		this.undostackAfter = this.editor.session.$undoManager.$undoStack
		// this.log(this.undostackAfter)
		let newStack = [], lastDelta, lastDeltas
		for(let d of this.undostackBefore){
			newStack.push(d)
		}

		let comboStack = []
		for(let deltas of this.undostackAfter){
			for(let d of deltas){
				comboStack.push(d)
				lastDelta = d
			}
			lastDeltas = deltas
		}

		newStack.push(comboStack)
		this.editor.session.$undoManager.$undoStack = newStack
		this.editor.session.$undoManager.$maxRev = newStack.length
		this.editor.session.$undoManager.$rev = newStack.length
		this.editor.session.$undoManager.$lastDelta = lastDelta
		this.editor.session.$undoManager.$lastDeltas = lastDeltas
	}

	addQue(codeInsert, funName, codePos){
		this.que.push({codeInsert, funName, codePos})
	}

	addCode(q){
		// *** dyna add '\n' before top, or after for bottom
		let codeBase = this.editor.getValue();
		
		let codeInsert = q.codeInsert
		let funName = q.funName
		let codePos = q.codePos


		if(funName == 'globalTop'){
			this.editor.moveCursorTo(0, 0); // global top
			codeInsert = `${codeInsert}\n`
		}else if(funName == 'globalBottom'){
			this.editor.moveCursorTo(this.editor.getValue().split('\n').length, 0); // global bottom
			codeInsert = `\n\n${codeInsert}`
		}else{
			let placeIndex = codePos == 'top' ? 0 : 1
			let placeBreakTop = ''//codePos == 'top' ? '' : '\n' // ''//
			let placeBreakBottom = codePos == 'bottom' ? '\n' : ''

			if(funName == 'draw'){
				placeBreakBottom = '\n'
			}
			
			let tempIndex = this.addPosition(codeBase, funName)
			
			let tempPos = this.editor.session.doc.indexToPosition(tempIndex[placeIndex])
			// console.log(tempPos)
			
			this.editor.moveCursorTo(tempPos.row, tempPos.column); // on demand
			codeInsert = `${placeBreakTop} ${codeInsert} ${placeBreakBottom}`
		}

		// editor.session.insert(editor.getCursorPosition(), insertCode)
		this.insertText(codeInsert)
	}

	// grab start/end of function, modded for position only
	// https://stackoverflow.com/a/49240267/10885535
	addPosition(content, functionName) {
		// Find function
		const indexOfFunc = content.indexOf(`function ${functionName}`);

		if (indexOfFunc < 0) {
			return content;
		}

		const openingBrace = content.indexOf('{', indexOfFunc);

		const startPos = openingBrace + 1;
		let endPos = startPos;
		let bracesToBalance = 1;

		while (true) {
			if (content[endPos] === '{') {
				bracesToBalance++;
			} else if (content[endPos] === '}') {
				bracesToBalance--;
				if (bracesToBalance === 0) break;
			}
			endPos++;
		}

		return [startPos+1, endPos];
	}
}