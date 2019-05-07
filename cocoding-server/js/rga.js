// -*- mode: javascript; js-indent-level: 2 -*-
//
// rga.js - An implementation of the Replicated Growable Array (RGA) given in
// "A comprehensive study of Convergent and Commutative Replicated Data Types"
// by Marc Shapiro, Nuno Preguiça, Carlos Baquero, Marek Zawirski, page 34.

"use strict";

var MAX_REPLICA_ID_BITS = 16;

// An RGA is a replicated string.
function RGA(id, history, queue) {
  // Each replica has an ID. These must be unique, mainly because the RGA
  // assigns a unique "timestamp" to every edit (insert or delete of an element).
  // Those edit-ids are used in conflict resolution, and the replica's .id field
  // is used to make sure the timestamps are really unique.
  if (typeof id !== "number" || (id | 0) !== id || id < 0 || id >= (1 << MAX_REPLICA_ID_BITS))
    throw new TypeError("RGA constructor: first argument is not a valid id");
  this.id = id;

  // For debug log readability, an even-more-unique ID is handy.
  this._idForLogging = RGA._nextIdForLogging++;

  // The string is stored as a linked list of characters, like a string of
  // beads, only instead of beads they're called "nodes".  The leftmost node
  // does not have a character on it; it's just a placeholder.  Since each node
  // contains a strong reference (the `.next` field) to the next node, the only
  // node we really need a reference to is `this.left`. From here, we can use
  // the `.next` fields to walk the whole rest of the string.
  this.left = {
    next: undefined,  // Each node has a reference to the next node (undefined if no next node).
    timestamp: -1,    // Unique timestamp when this node was created.
    chr: undefined,   // The character.
    removed: false    // True if anyone has deleted this character.
  };

  // We need to find nodes quickly by their timestamp, so keep a table.
  this._index = new Map([[this.left.timestamp, this.left]]);

  // This is for assigning a unique timestamp to each new character
  // the user types in.
  this._nextTimestamp = id;

  // The rest of this stuff is necessary in order to forward change events
  // around. When this RGA is tied to other RGAs, they'll grab the `.downstream`
  // method and use it as a callback.
  this._subscribers = [];
  this._queue = queue || RGA._browserQueue;
  this._onDestroy = [];
  var self = this;
  this.downstream = function (sender, op) {
    self._downstream(sender, op);
  };
  this.downstream._id = id;

  // OK! `this` is now complete and ready for data. If we're joining an
  // existing server, some edits have already happened. So we begin by
  // replaying the whole history so far (if any).
  if (history !== undefined) {
    for (var i = 0; i < history.length; i++)
      this._downstream(this.downstream, history[i]);
  }
}

RGA._nextIdForLogging = 100;
RGA._logging = false;

RGA._browserQueue = {
  defer: function (cb) { setTimeout(cb, 0); }
};

RGA.prototype = {
  constructor: RGA,

  _timestamp: function () {
    var t = this._nextTimestamp;
    this._nextTimestamp += (1 << MAX_REPLICA_ID_BITS);
    return t;
  },

  // Apply an operation and broadcast it to other replicas.
  _downstream: function (sender, op) {
    //this._log("replica " + this.id + " received " + JSON.stringify(op) + " from " + sender._id);
    var self = this.downstream;
    this["_downstream_" + op.type].call(this, op);
    var queue = this._queue;
    this._subscribers.forEach(function (callback) {
      if (callback !== sender)
        queue.defer(function () { callback(self, op); });
    });
  },

  // Return an array of ops that builds the entire document.
  history: function () {
    var h = [];
    var prev = this.left;
    var curr = prev.next;
    while (curr !== undefined) {
      h.push({
        type: "addRight",
        prev: prev.timestamp,
        t: curr.timestamp,
        chr: curr.chr
      });
      if (curr.removed)
        h.push({type: "remove", t: curr.timestamp});
      prev = curr;
      curr = curr.next;
    }
    return h;
  },

  addRight: function (prev, chr) {
    var target = this._index.get(prev);
    if (target === undefined)
      throw new Error("insertion point is not in the array");
    if (target.removed)
      throw new Error("insertion point is removed from the array");

    var t = this._timestamp();
    this.downstream(this.downstream, {
      type: "addRight", prev: prev, t: t, chr: chr
    });
    return t;
  },

  _downstream_addRight: function (op) {
    // Any future timestamps we generate must be after timestamps we've
    // observed.
    if (op.t >= this._nextTimestamp) {
      var t = (op.t >>> MAX_REPLICA_ID_BITS) + 1;
      this._nextTimestamp = (t << MAX_REPLICA_ID_BITS) + this.id;
    }

    var pred = this._index.get(op.prev);
    if (pred === undefined)
      throw new Error("downstream: can't add next to unknown element!");
    while (pred.next && op.t < pred.next.timestamp)
      pred = pred.next;

    // Splice a new node into the linked list.
    var node = {
      next: pred.next,
      timestamp: op.t,
      chr: op.chr,
      removed: false
    };
    pred.next = node;
    this._index.set(op.t, node);
  },

  _lookup: function (t) {
    var node = this._index.get(t);
    return node !== undefined && !node.removed;
  },

  remove: function (t) {
    if (!this._lookup(t))
      throw new Error("can't remove node that doesn't exist");
    this.downstream(this.downstream, {type: "remove", t: t});
  },

  _downstream_remove: function (op) {
    var node = this._index.get(op.t);
    if (node === undefined)
      throw new Error("downstream: can't remove unknown element!");
    node.removed = true;
  },

  text: function () {
    var s = "";
    for (var node = this.left.next; node; node = node.next) {
      if (!node.removed)
        s += node.chr;
    }
    return s;
  },

  // Disconnect this RGA from anything it was connected to.
  destroy: function () {
    this._subscribers = undefined;
    for (var i = 0; i < this._onDestroy.length; i++)
      this._onDestroy[i]();
    this._onDestroy = undefined;
  },

  // Returns true if this.destroy() has been called.
  wasDestroyed: function () {
    return this._subscribers === undefined;
  },

  // Add an event listener. An RGA only emits one kind of event: "op".
  on: function (type, callback) {
    if (type === "op")
      this._subscribers.push(callback);
  },

  // Remove an event listener.
  off: function (type, callback) {
    if (type === "op") {
      var i = this._subscribers.indexOf(callback);
      if (i !== -1)
        this._subscribers.splice(i, 1);
    }
  },

  _log: function () {
    if (RGA._logging)
      console.log
        .bind(console, "{" + this.constructor.name + this._idForLogging + "}:")
        .apply(undefined, arguments);
  }
};

// Cause two RGA objects to update each other.
// They must initially contain the same history.
RGA.tie = function tie(a, b) {
  if (JSON.stringify(a.history()) != JSON.stringify(b.history()))
    throw new Error("RGA.tie: arguments must start out already in sync");

  a.on("op", b.downstream);
  b.on("op", a.downstream);

  // If either RGA is destroyed, untie it from the other.
  function untie() {
    if (a !== undefined) {
      a.off("op", b.downstream);
      b.off("op", a.downstream);
      a = b = undefined;
    }
  }
  b._onDestroy.push(untie);
  a._onDestroy.push(untie);
};

// Cause an RGA object to communicate via socket.io to update an RGA object
// tied to the other end of the socket. The two RGA objects must initially
// contain the same history.
RGA.tieToSocket = function tieToSocket(a, s) {
  var a_s = function (sender, op) {
    if (s !== undefined) {
      //a._log("forwarding from RGA " + a.id + " to socket: ", op);
      s.emit("downstream", op);
    }
  };
  a.on("op", a_s);

  var s_a = function (op) {
    if (a !== undefined) {
      //a._log("forwarding from socket to RGA " + a.id + ": ", op);
      a.downstream(a_s, op);
    }
  };
  s.on("downstream", s_a);

  // If the RGA is destroyed or the socket gets disconnected, untie them from
  // one another.  Amazingly, socket.io offers no way to unsubscribe callbacks.
  // To ensure no further events are delievered and no unused GC-edges remain,
  // we null out the variables, and the callbacks above check for this state.
  function untie() {
    if (a !== undefined) {
      //a._log("untying RGA " + a.id + " from socket");
      a.off("op", a_s);
      a = s = a_s = s_a = untie = undefined;
    }
  }
  a._onDestroy.push(untie);
  s.on("disconnect", untie);
};

// Return a delta to turn the string s0 into s1.
// (Helper function used by RGA.AceEditorRGA#_takeUserEdits.)
RGA.diff = function diff(s0, s1) {
  //console.log("diffing", {a: s0, b: s1});

  // Hand-rolled implementation of the Hunt–McIlroy diffing algorithm.
  // I used <http://pynash.org/2013/02/26/diff-in-50-lines/> as a reference.
  function find_longest_common_slice(a, b) {
    var map_of_b = Object.create(null);
    for (var i = 0; i < b.length; i++) {
      var ch = b[i];
      var list = map_of_b[ch];
      if (list)
        list.push(i);
      else
        map_of_b[ch] = [i];
    }

    var result = {
      a_start: 0,
      b_start: 0,
      length: 0
    };

    var runs = Object.create(null);
    for (var i = 0; i < a.length; i++) {
      var new_runs = Object.create(null);
      var matches_in_b = map_of_b[a.charAt(i)];
      if (matches_in_b) {
        for (var match_index = 0; match_index < matches_in_b.length; match_index++) {
          var j = matches_in_b[match_index];
          var k = new_runs[j] = (runs[j - 1] || 0) + 1;
          if (k > result.length) {
            result.a_start = i - k + 1;
            result.b_start = j - k + 1;
            result.length = k;
          }
        }
      }
      runs = new_runs;
    }

    if (a.slice(result.a_start, result.a_start + result.length) !==
        b.slice(result.b_start, result.b_start + result.length)) {
      throw new Error("algorithm failed");
    }
    return result;
  }

  function compare(a, b, start, patch) {
    if (a !== b) {
      var match = find_longest_common_slice(a, b);
      if (match.length === 0) {
        if (a)
          patch.push({delete: a.length});
        if (b)
          patch.push({insert: b});
      } else {
        compare(a.slice(0, match.a_start), b.slice(0, match.b_start), start, patch);
        patch.push({retain: match.length});
        compare(a.slice(match.a_start + match.length),
                b.slice(match.b_start + match.length),
                start + match.a_start + match.length,
                patch);
      }
    }
  }

  var patch = [];
  compare(s0, s1, 0, patch);
  return {ops: patch};
};

// An RGA that has an instance of the Ace editor attached to it.
//
// This function uses the following features of the Ace API:
// - editor.getValue() -> string
// - editor.setValue(str, -1)
// - editor.getSession().on("change", f)
// - editor.getSession().off("change", f)
// - editor.getSession().insert({row: r, column: c}, str)
// - editor.getSession().remove({start: ..., end: ...})
// - editor.getSession().getDocument().getLine(loc.row) -> string
//
RGA.AceEditorRGA = function AceEditorRGA(id, editor, history, queue) {
  RGA.call(this, id, history, queue);
  this.editor = editor;

  // `_lastText` is the text that was in the editor, last we checked.  When a
  // keypress happens and the text in the editor changes, Ace will notify us of
  // the change, but not immediately: instead, it queues an event to fire
  // asynchronously. In fact, at any given point in time we have no way of
  // knowing whether we've been notified of all changes or something's still in
  // flight. The solution is brute force (see takeUserEdits) and requires us to
  // remember the last known in-sync state of the document, hence this
  // variable.
  this._lastText = this.text();

  // The editor must start out in sync with the RGA.
  // (The `-1` here means to place the editor cursor at the start of the document.)
  editor.setValue(this._lastText, -1);

  // The flow of operations is (unavoidably) bidirectional. First, when Ace
  // notifies us of an edit, fold those changes into the RGA.
  var self = this;
  this._changeCallback = function () { self._takeUserEdits() };
  editor.getSession().on("change", this._changeCallback);
  this._onDestroy.push(function () {
    self.editor.getSession().off("change", self._changeCallback);
  });

  // Now for the other direction. Replace the callback that receives changes
  // from other RGAs with a new one that also updates the editor.
  this.downstream = function (source, op) {
    self._customDownstream(source, op);
  };
  this.downstream._id = id;  // for debugging
};

RGA.AceEditorRGA.prototype = Object.create(RGA.prototype);
Object.assign(RGA.AceEditorRGA.prototype, {
  constructor: RGA.AceEditorRGA,

  // Return the {row, column} coordinates of the character with timestamp t.
  getRowColumnBefore: function (t) {
    if (t === this.left.timestamp)
      throw new Error("no position before the left edge of the document");
    var target = this._index.get(t);
    if (target === undefined)
      throw new Error("timestamp not present in document");
    var r = 0, c = 0;
    for (var node = this.left.next; node != target; node = node.next) {
      if (!node.removed) {
        if (node.chr === "\n") {
          r++;
          c = 0;
        } else {
          c++;
        }
      }
    }
    return {row: r, column: c};
  },

  // Return the coordinates of a hypothetical new character, if you inserted it
  // with timestamp `t`, after the character with timestamp `prev`.
  getRowColumnAfter: function (prev, t) {
    var target = this._index.get(prev);
    if (target === undefined)
      throw new Error("timestamp not present in document");

    var r = 0, c = -1;  // c will be incremented to zero in the first pass through the loop
    function advance(node) {
      if (!node.removed) {
        if (node.chr === "\n") {
          r++;
          c = 0;
        } else {
          c++;
        }
      }
    }

    for (var node = this.left; ; node = node.next) {
      advance(node);
      if (node === target)
        break;
    }
    while (node.next && t < node.next.timestamp) {
      node = node.next;
      advance(node);
    }

    return {row: r, column: c};
  },

  // Throw if the this._lastText and the RGA don't have the same value.
  _assertInSync: function (infodump) {
    var rgaText = this.text();
    if (this._lastText != rgaText) {
      infodump.lastText = this._lastText;
      infodump.rgaText = rgaText;
      console.error(this.id, "lastText and RGA are out of sync", infodump);
      throw new Error("editor and RGA data structure got out of sync");
    }
  },

  // Apply a patch to the RGA only, without touching the editor. The structure
  // of `delta` is the same as a Quill delta, just because it was a JSON patch
  // format I knew about -- we don't actually use any Quill code.
  _applyDelta: function (delta) {
    var source = this.downstream;
    var lastNode = this.left, node = lastNode.next;
    var ops = delta.ops;
    for (var i = 0; i < ops.length; i++) {
      var op = ops[i];
      //this._log("* applying", op);
      if ("retain" in op) {
        for (var j = 0; j < op.retain;) {
          if (!node.removed) {
            lastNode = node;
            j++;
          }
          node = node.next;
        }
      } else if ("delete" in op) {
        for (var j = 0; j < op.delete;) {
          var next = node.next;
          if (!node.removed) {
            lastNode = node;
            j++;
            //this._log("  - removing character:", node.chr);
            this._downstream(source, {type: "remove", t: node.timestamp});
          }
          node = next;
        }
      } else if ("insert" in op) {
        var prev = lastNode.timestamp;
        var str = op.insert;
        for (var j = 0; j < str.length; j++) {
          //this._log("  - inserting character:", str[j]);
          var tnext = this._timestamp();
          this._downstream(source, {type: "addRight", prev: prev, t: tnext, chr: str[j]});
          prev = tnext;
        }
        lastNode = this._index.get(prev);
        node = lastNode.next;
      }
    }
  },

  // Compare current editor value against the last known editor value. Any
  // differences are recent user edits; apply them to the RGA.
  _takeUserEdits: function () {
    var currentText = this.editor.getValue();
    //this._log("_takeUserEdits: <" + this._lastText + "> <" + currentText + ">");
    if (currentText != this._lastText) {
      this._assertInSync({currentEditorState: currentText});

      var changes = RGA.diff(this._lastText, currentText);
      //this._log(changes);
      this._applyDelta(changes);
      var savedLastText = this._lastText;
      this._lastText = currentText;

      this._assertInSync({before: savedLastText, patch: changes});
    }
  },

  // Unsubscribe from the editor's change notifications, call action(), then
  // re-subscribe.
  _withEditorCallbacksDisabled: function(action) {
    this.editor.getSession().off("change", this._changeCallback);
    try {
      action();
    } finally {
      this.editor.getSession().on("change", this._changeCallback);
    }
  },

  // Apply an RGA op to the Ace editor.
  _applyOpToEditor: function (op) {
    var session = this.editor.getSession();
    switch (op.type) {
    case "addRight":
      if (this._index.has(op.t)) {
        // This character was already added.
        throw new Error("bug - message delivered twice to " + this.id + ": ", JSON.stringify(op));
      }

      var loc = this.getRowColumnAfter(op.prev, op.t);
      //this._log("inserting character", op.chr, "at", loc);
      this._withEditorCallbacksDisabled(function () {
        session.insert(loc, op.chr);
      });
      break;

    case "remove":
      //this._log("remove:", op.t, " from:", this);
      if (this._index.get(op.t).removed) {
        // This character has already been removed. Nothing to do.
        break;
      }

      var loc = this.getRowColumnBefore(op.t);
      var removingNewline = session.getDocument().getLine(loc.row).length === loc.column;
      var whatToRemove = {
        start: loc,
        end: removingNewline
          ? {row: loc.row + 1, column: 0}
          : {row: loc.row, column: loc.column + 1}
      };
      //this._log("removing from editor:", whatToRemove);
      this._withEditorCallbacksDisabled(function () {
        session.remove(whatToRemove);
      });
      break;
    }

    this._lastText = this.editor.getValue();
  },

  // Receive an op from a peer RGA or (equivalently) a socket.
  _customDownstream: function (source, op) {
    // Always check for new user edits *before* accepting ops from the internet.
    // That way, _takeUserEdits() knows that all differences between
    // `_lastText` and `editor.getValue()` are the result of new user input.
    this._takeUserEdits();

    // Since applyOpToEditor uses the RGA to look up the location of the
    // inserted/deleted character in the document, and determine whether it has in fact
    // already been inserted/deleted, we have to call that first,
    // before modifying the RGA.
    this._applyOpToEditor(op);  // first update the editor
    this._downstream(source, op);  // then call base-class method to update the RGA

    this._assertInSync({op: op});
  }
});

// Tie an Ace editor to a socket.
RGA.AceEditorRGA.setup = function (editor, socket, queue) {
  var local = undefined;
  socket.on("welcome", function (event) {
    if (local !== undefined) {
      // If the server is restarted, we'll receive a second welcome event.
      // Don't try to keep the old RGA in sync with the new server instance,
      // and *definitely* don't try to tie two RGAs to the same editor!
      local.destroy();
      local = undefined;
    }

    local = new RGA.AceEditorRGA(event.id, editor, event.history, queue);
    RGA.tieToSocket(local, socket);
    editor.focus();
  });
};

if (typeof module !== "undefined")
  exports = module.exports = RGA;
