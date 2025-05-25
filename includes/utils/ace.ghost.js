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
		this.showTextTimeout
		this.delay = 10
	}

	showText(message, index){
		if (index < message.length) {
		 	// insert at cursor
			this.editor.session.insert(this.editor.getCursorPosition(), message[index++]);
			// clear selection just in case there was something selected
			this.editor.selection.clearSelection();
			// make sure cursor is visible
			this.editor.renderer.scrollCursorIntoView();

			// adjust delay after typing a space
			// if (/\s/.test(message[index - 1])) delay = 0
			var self = this
			this.showTextTimeout = setTimeout(function () {
				this.showText(message, index);
			}.bind(self), this.delay);
		}else{
			tidyCode(editor);
			let addDelay = false
			if(['globalTop', 'setup', 'globalBottom'].includes(this.que[0].funName) && this.que[0].codeInsert != ''){
				recompile(true);
				addDelay = true
			}

			if(this.que.length > 1){
				this.que.splice(0, 1)

				setTimeout(()=>{
					this.addCode(this.que[0])
				}, addDelay ? 1000:0)
				
			}else{
				this.disableEditor(false)
				if(!settings.cocoding.active){
					localStorage[settings.fileName] = editor.getValue();
				}
				// console.log('snippet added')
				// this.editor.session.$undoManager.markIgnored(this.rev); // mark the new group as ignored
			}
		}
	}

	insertText(txt){
  		// editor.setCursorPosition(pos)
 		// editor.moveCursorTo(pos.row, pos.column); //lineNumber,colNumber
		this.disableEditor(true)
 		this.showText(txt, 0, this.delay)
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

		this.addQue(snippetCode.gt, 'globalTop', 'top');
		this.addQue(snippetCode.s, 'setup', 'bottom');
		this.addQue(snippetCode.dt, 'draw', 'top');
		this.addQue(snippetCode.db, 'draw', 'bottom');
		this.addQue(snippetCode.gb, 'globalBottom', 'bottom');

		// console.log(que)
		this.disableEditor(true)

		// https://github.com/ajaxorg/ace/issues/3743#issuecomment-412334489
		// this.rev = this.editor.session.$undoManager.startNewGroup(); // start new undo group

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
			let placeBreakTop = ''//codePos == 'top' ? '\n' : '\n'
			let placeBreakBottom = codePos == 'bottom' ? '\n' : ''
			
			let tempIndex = this.addPosition(codeBase, funName)
			
			let tempPos = this.editor.session.doc.indexToPosition(tempIndex[placeIndex])
			// console.log(tempPos)
			
			this.editor.moveCursorTo(tempPos.row, tempPos.column); // on demand
			codeInsert = `${placeBreakTop}${codeInsert}${placeBreakBottom}`
		}

		// editor.session.insert(editor.getCursorPosition(), insertCode)
		this.insertText(codeInsert, 10)
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