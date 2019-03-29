"use strict";


const MAX_REPLICA_ID_BITS = 16


// An RGA is a replicated string.
function RGA(id) {
  this.id = id
  this.left = { timestamp: -1, removed: false, chr: "" }
  this.index = new Map([[this.left.timestamp, this.left]])
  this.nextTimestamp = id
  this.subscribers = []
}


RGA.toArray = function (rga) {
  let ary = []
    , curr = rga.left

  while (curr) {
    ary.push(curr)
    curr = curr.next
  }

  return ary
}

RGA.prototype = {
  constructor: RGA

  , subscribe: function (callback) {
    this.subscribers.push(callback)
  }

  , genTimestamp: function () {
    const timestamp = this.nextTimestamp
    this.nextTimestamp += (1 << MAX_REPLICA_ID_BITS)
    return timestamp
  }

  , addRight: function (op) {
    const existingNode = this.index.get(op.t)
    let prev = this.index.get(op.prev)
      , newNode

    if (existingNode) { return }

    while (op.t >= this.nextTimestamp) { this.genTimestamp() }

    while (prev.next && op.t < prev.next.timestamp) { prev = prev.next }

    newNode = {
      next: prev.next,
      timestamp: op.t,
      chr: op.chr,
      removed: false
    }

    prev.next = newNode
    this.index.set(op.t, newNode)

    return newNode
  }

  , remove: function (op) {
    const node = this.index.get(op.t)

    if (node.removed) { return }

    node.removed = true
    return node
  }

  , apply: function(op) {
    return this[op.type].call(this, op)
  }

  , downstream: function (op, originator) {
    const node = this.apply(op)

    if (node) {
      this.subscribers.forEach(sub => {
        if (sub !== originator) { sub.downstream(op) }
      })
    }

    return node
  }

  , history: function () {
    let hist = []
      , prev = this.left
      , curr = prev.next

    while (curr) {
      hist.push({
        type: 'addRight',
        prev: prev.timestamp,
        t: curr.timestamp,
        chr: curr.chr
      });

      if (curr.removed) {
        hist.push({type: 'remove', t: curr.timestamp})
      }

      prev = curr
      curr = curr.next
    }

    return hist
  }
}


function RArray(rga) {
  this.ary = RGA.toArray(rga)
  this.compactedAry = this.ary.filter(({removed}) => { return !removed })
}

RArray.prototype = {
  text: function() {
    return this.compactedAry.map(({chr}) => { return chr }).join('')
  }

  , indexOrPrev: function(node) {
    let idx = this.ary.indexOf(node)

    while (idx >= 0 && node.removed) {
      idx = idx - 1
      node = this.ary[idx]
    }

    return this.compactedAry.indexOf(node)
  }

  , get: function(idx) {
    return this.compactedAry[idx]
  }
}


RGA.AceEditorRGA = function AceEditorRGA(id, editor) {
  let rga = new RGA(id)
    , emitContentChanged = true
    , bufferOperations = false
    , operationsBuffer = []

  editor.$blockScrolling = Infinity

  const {session, selection} = editor
    , Doc = session.doc.constructor

  const contentInserted = (from, change) => {
    const ary = new RArray(rga).compactedAry

    let node = ary[from] || rga.left

    change.forEach(chr => {
      node = rga.downstream({
        type: 'addRight',
        prev: node.timestamp,
        t: rga.genTimestamp(),
        chr: chr
      })
    })
  }

  const contentRemoved = (from, change) => {
    const ary = new RArray(rga).compactedAry

    ary.slice(from, from + change.length).forEach(node => {
      rga.downstream({ type: 'remove', t: node.timestamp })
    })
  }

  const contentChanged = ({ action, start, end, lines }) => {
    if (!emitContentChanged) { return }

    const from = session.doc.positionToIndex(start)
      , change = lines.join("\n").split('')

    if (action === 'insert') {
      contentInserted(from, change)
    } else if (action === 'remove') {
      contentRemoved(from + 1, change)
    }
  }

  let nodeSelection = { startNode: rga.left, endNode: rga.left }
  const cursorChanged = () => {
    if (!emitContentChanged) { return }

    const { start, end } = selection.getRange()
      , rgaAry = new RArray(rga)
      , doc = new Doc(rgaAry.text())
      , startIndex = doc.positionToIndex(start)
      , startNode = rgaAry.get(startIndex)
      , endIndex = doc.positionToIndex(end)
      , endNode = rgaAry.get(endIndex)

    nodeSelection = { startNode: startNode, endNode: endNode }
  }

  const syncEditor = _ => {
    emitContentChanged = false

    try {
      const rgaAry = new RArray(rga)
        , text = rgaAry.text()
        , doc = new Doc(text)
        , { startNode, endNode } = nodeSelection
        , startIndex = rgaAry.indexOrPrev(startNode)
        , endIndex  = rgaAry.indexOrPrev(endNode)
        , rangeStart = doc.indexToPosition(startIndex)
        , rangeEnd = doc.indexToPosition(endIndex)
        , range = { start: rangeStart, end: rangeEnd }

      session.doc.setValue(text)
      selection.setSelectionRange(range)
    } finally {
      emitContentChanged = true
    }
  }

  const flushBuffer = () => {
    this.applyHistory(operationsBuffer)
    bufferOperations = false
    operationsBuffer = []
  }

  const { onCompositionStart, onCompositionEnd } = editor
  editor.onCompositionStart = () => {
    bufferOperations = true
    onCompositionStart.apply(editor, [])
  }

  editor.onCompositionEnd = () => {
    try {
      onCompositionEnd.apply(editor, [])
    } finally {
      setTimeout(flushBuffer, 100)
    }
  }

  // Callbacks
  session.on('change', contentChanged)
  selection.on('changeCursor', cursorChanged)

  // Public interface
  this.applyOperation = (op) => {
    if (bufferOperations) {
      operationsBuffer.push(op)
    } else {
      rga.apply(op)
      syncEditor()
    }
  }

  this.applyHistory = (history) => {
    history.forEach(op => rga.apply(op))
    syncEditor()
  }

  this.subscribe = (sub) => { rga.subscribe(sub) }
}


if (typeof module !== 'undefined') { exports = module.exports = RGA }
