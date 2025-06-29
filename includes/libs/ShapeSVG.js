// Converted from processing to p5.js
// Copyright (c) 2025 irenelfeng
// https://github.com/processing/processing4/blob/main/core/src/processing/core/PShapeSVG.java
// https://www.perplexity.ai/search/can-you-rewrite-this-pshapesvg-rIK.abgqRmeZqof1.DLK7A

p5.prototype.loadSVG = async function (path) {
  // TODO: consider await / async without using .then syntax
  let thing = fetch(path)
    .then((response) => {
      if (!response.ok) {
        p5._friendlyFileLoadError(0, path);
        throw new Error("No File found at " + path);
      }

      return response.text();
    })
    .then((svgText) => {
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgText, "image/svg+xml");
      return new ShapeSVG(svgDoc.documentElement);
    });
  return await thing;
}

class ShapeSVG {
  constructor(svgElement, parent = null) {
    this.parent = parent;
    this.children = [];
    this.name = svgElement.id || '';
    this.matrix = new p5.Matrix();
    this.styles = {};
    this.pathData = null;
    this.type = null;
    this.svgElement = svgElement;
    this.style = true;
    this.vertices = [];
    this.vertexCodes = [];
    this.close = false;
    // vertexCodes can have a different length than vertices (less)
    // ex: M0,0 C1,1 2,2 3,3 
    // has a length of 4 vertices but 2 vertex codes (M and C)

    // Parse attributes
    this._parseAttributes(svgElement);

    // Parse children recursively
    Array.from(svgElement.children).forEach(child => {

      this.children.push(new ShapeSVG(child, this));
    });
  }

  // doesn't really work 
  toString() {
    return this.svgElement;
  }

  /**
   * Like getFamily() in PShape. 
   * @returns {string} The type of the shape (e.g., 'path', 'primitive', 'group')
   */
  getType() {
    return this.type;
  }

  _parseAttributes(element) {
    // Basic style attributes
    this.styles = {
      fill: element.getAttribute('fill') || 'black',
      stroke: element.getAttribute('stroke') || 'none',
      strokeWidth: parseFloat(element.getAttribute('stroke-width')) || 0
    };

    // Transformation matrix
    const transform = element.getAttribute('transform');
    if (transform) this.matrix = this._parseTransform(transform);

    // Path data (for <path>, <rect>, etc.)
    switch (element.tagName.toLowerCase()) {
      case 'path':
        this.pathData = element.getAttribute('d');
        // adds vertices 
        this._parsePath(this.pathData);
        this.type = 'path';
        break;
      case 'rect':
        this._createRectPath(element);
        this.type = 'primitive';
        break;
      case 'circle':
        this._createCirclePath(element);
        this.type = 'primitive';
        break;
      case 'ellipse':
        this._createEllipsePath(element);
        this.type = 'primitive';
        break;
      case 'g':
        this.type = 'group';
        break;
    }
  }

  _parseTransform(transformStr) {
    // Simple matrix parser (handles matrix(a,b,c,d,e,f))
    const matrix = new p5.Matrix();
    const matches = transformStr.match(/matrix\(([\d\s.,-]+)\)/i);
    if (matches) {
      const [a, b, c, d, e, f] = matches[1].split(/[\s,]+/).map(parseFloat);
      matrix.set(a, b, c, d, e, f);
    }
    return matrix;
  }

  /**
   * helper function that loads the path buffer and adds some | to it 
   * @param {string} pathData
   * @returns {string} pathBuffer 
   */
  _loadPathBuffer(pathData) {
    let pathBuffer = '';
    if (!pathData || pathData.trim().length === 0) return;
    const pathDataChars = pathData.split('');

    let LexState = {
      AFTER_CMD: 0,
      NEUTRAL: 1,
      INTEGER: 2,
      DECIMAL: 3, // 
      EXP_HEAD: 4, // svgs denote exponents with 'e'
      EXP_TAIL: 5 //
    };
    let lexState = LexState.NEUTRAL;

    for (const element of pathDataChars) {
      let c = element;

      if (lexState === LexState.AFTER_CMD) {
        pathBuffer += '|';
        lexState = LexState.NEUTRAL;
      }

      if (c >= '0' && c <= '9') {
        if (lexState === LexState.NEUTRAL) {
          lexState = LexState.INTEGER;
        } else if (lexState === LexState.EXP_HEAD) {
          lexState = LexState.EXP_TAIL;
        }
        pathBuffer += c;
        continue;
      } else if (c === '-') {
        if (lexState === LexState.NEUTRAL) {
          lexState = LexState.INTEGER;
        } else if (lexState === LexState.EXP_HEAD) {
          lexState = LexState.EXP_TAIL;
        } else {
          pathBuffer += '|';
          lexState = LexState.INTEGER;
        }
        pathBuffer += '-';
        continue;
      } else if (c === '.') {
        if (lexState === LexState.DECIMAL || lexState === LexState.EXP_HEAD || lexState === LexState.EXP_TAIL) {
          pathBuffer += '|';
        }
        pathBuffer += '.';
        lexState = LexState.DECIMAL;
        continue;
      } else if (c === 'e' || c === 'E') {
        pathBuffer += 'e';
        lexState = LexState.EXP_HEAD;
        continue;
      }

      if (lexState !== LexState.NEUTRAL) {
        pathBuffer += '|';
        lexState = LexState.NEUTRAL;
      }

      if (c !== ',') {
        pathBuffer += c;
      }

      if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z')) {
        lexState = LexState.AFTER_CMD;
      }
    }
    return pathBuffer;
  }

  // TODO: fix this, it's not working for remembering curve vertices 
  _parsePath(pathData) {
    // Tokenize by | and whitespace
    const pathBuffer = this._loadPathBuffer(pathData);
    const pathTokens = pathBuffer.split(/[\|\s]+/).filter(Boolean);

    // Now process tokens as in the Java code
    let cx = 0, cy = 0, movetoX = 0, movetoY = 0;

    let i = 0, implicitCommand = null, prevCurve = false;
    let ctrlX = 0, ctrlY = 0; // idk why i'm not using these, debug later


    while (i < pathTokens.length) {
      let c = pathTokens[i][0];

      if ((c >= '0' && c <= '9') || c === '-' || c === '.') {
        c = implicitCommand;
        i--;
      } else {
        implicitCommand = c;
      }
      switch (c) {

        case 'M':
          cx = parseFloat(pathTokens[i + 1]);
          cy = parseFloat(pathTokens[i + 2]);
          movetoX = cx;
          movetoY = cy;
          this.vertices.push([cx, cy]);
          this.vertexCodes.push('M');
          implicitCommand = 'L';
          i += 3;
          break;
        case 'm': // relative move
          cx += parseFloat(pathTokens[i + 1]);
          cy += parseFloat(pathTokens[i + 2]);
          movetoX = cx;
          movetoY = cy;
          this.vertices.push([cx, cy]);
          this.vertexCodes.push('m');
          implicitCommand = 'l';
          i += 3;
          break;
        case 'L':
          cx = parseFloat(pathTokens[i + 1]);
          cy = parseFloat(pathTokens[i + 2]);
          this.vertices.push([cx, cy]);
          this.vertexCodes.push('L');
          i += 3;
          break;
        case 'l':
          cx += parseFloat(pathTokens[i + 1]);
          cy += parseFloat(pathTokens[i + 2]);
          this.vertices.push([cx, cy]);
          this.vertexCodes.push('l');
          i += 3;
          break;
        case 'C': {
          // Cubic Bezier curve
          const x1 = parseFloat(pathTokens[i + 1]);
          const y1 = parseFloat(pathTokens[i + 2]);
          const x2 = parseFloat(pathTokens[i + 3]);
          const y2 = parseFloat(pathTokens[i + 4]);
          cx = parseFloat(pathTokens[i + 5]);
          cy = parseFloat(pathTokens[i + 6]);
          this.vertices.push([x1, y1]);
          this.vertices.push([x2, y2]);
          this.vertices.push([cx, cy]);
          this.vertexCodes.push('C');
          i += 7;
          break;
        }
        case 'c': {
          // Cubic Bezier curve (relative)
          const x1c = cx + parseFloat(pathTokens[i + 1]);
          const y1c = cy + parseFloat(pathTokens[i + 2]);
          const x2c = cx + parseFloat(pathTokens[i + 3]);
          const y2c = cy + parseFloat(pathTokens[i + 4]);
          cx += parseFloat(pathTokens[i + 5]);
          cy += parseFloat(pathTokens[i + 6]);
          this.vertices.push([x1c, y1c]);
          this.vertices.push([x2c, y2c]);
          this.vertices.push([cx, cy]);
          this.vertexCodes.push('c');
          i += 7;
          break;
        }
        // TODO (repeat for other commands: H, h, V, v, C, c, S, s, Q, q, T, t, A, a, Z, z)
        //       case 'H': // Horizontal line
        //         const x = type === 'h' ? currentX + args[0] : args[0];
        //         this.vertices.push({ x, y: currentY });
        //         currentX = x;
        //         break;

        //       case 'V': // Vertical line
        //         const y = type === 'v' ? currentY + args[0] : args[0];
        //         this.vertices.push({ x: currentX, y });
        //         currentY = y;
        //         break;
        case 'Z':
        case 'z':
          cx = movetoX;
          cy = movetoY;

          this.vertexCodes.push('Z');
          i++;
          close = true;
          break;
        default:
          throw new Error('shape command not handled: ' + pathTokens[i]);
      }
      // prevCommand = c;
    }

    // return { vertices, vertexCodes };
  }


  // _parsePathData(d) {
  //   const commands = d.match(/[A-Za-z][^A-Za-z]*/g) || [];
  //   let currentX = 0;
  //   let currentY = 0;

  //   commands.forEach(cmd => {
  //     const type = cmd[0];
  //     const args = cmd.slice(1).trim().split(/[\s,]+/).map(parseFloat);

  //     switch (type.toUpperCase()) {
  //       case 'M': // MoveTo
  //       case 'L': // LineTo
  //         for (let i = 0; i < args.length; i += 2) {
  //           const x = type === 'm' ? currentX + args[i] : args[i];
  //           const y = type === 'm' ? currentY + args[i + 1] : args[i + 1];
  //           this.vertices.push({ x, y });
  //           currentX = x;
  //           currentY = y;
  //         }
  //         break;

  //       case 'H': // Horizontal line
  //         const x = type === 'h' ? currentX + args[0] : args[0];
  //         this.vertices.push({ x, y: currentY });
  //         currentX = x;
  //         break;

  //       case 'V': // Vertical line
  //         const y = type === 'v' ? currentY + args[0] : args[0];
  //         this.vertices.push({ x: currentX, y });
  //         currentY = y;
  //         break;

  //       case 'Z': // Close path
  //         if (this.vertices.length > 0) {
  //           this.vertices.push({ ...this.vertices[0] });
  //         }
  //         break;
  //     }
  //   });
  // }

  _createRectPath(element) {
    const x = parseFloat(element.getAttribute('x')) || 0;
    const y = parseFloat(element.getAttribute('y')) || 0;
    const w = parseFloat(element.getAttribute('width')) || 0;
    const h = parseFloat(element.getAttribute('height')) || 0;
    this.pathData = `M${x},${y} h${w} v${h} h-${w} Z`;
  }

  /**
   * displays on canvas
   * @param {Window} g 
   */
  display(g = window) {
    const ctx = g.drawingContext;
    g.push();

    // Apply transformation matrix
    if (this.matrix) {
      g.applyMatrix(
        this.matrix.mat4[0], this.matrix.mat4[1],
        this.matrix.mat4[4], this.matrix.mat4[5],
        this.matrix.mat4[12], this.matrix.mat4[13]
      );
    }

    // Apply styles
    if (this.style) {
      if (this.style) {
        if (this.styles.fill !== "none") {
          ctx.fillStyle = this.styles.fill;
          ctx.fill(new Path2D(this.pathData));
        }

        if (this.styles.stroke !== "none") {
          ctx.strokeStyle = this.styles.stroke;
          ctx.lineWidth = this.styles.strokeWidth;
          ctx.stroke(new Path2D(this.pathData));
        }
      } else {
        // allow styles to be used from graphics
        ctx.fill(new Path2D(this.pathData));
        ctx.stroke(new Path2D(this.pathData));
      }
    }

    // Maybe primitives should be drawn differently? 
    ctx.fill(new Path2D(this.pathData));
    ctx.stroke(new Path2D(this.pathData));

    // Draw children
    this.children.forEach(child => child.display(g));

    g.pop();
  }

  /**
   * Gets child by searching by index (svg id attribute)
   * @param {number} index
   * @returns {ShapeSVG} child
   */
  getChild(index) {
    return this.children[index];
  }

  /**
   * @returns {number} number of SVG children
   */
  getChildCount() {
    return this.children.length;
  }

  /**
   * recursively gets all children
   * @returns {Array<ShapeSVG>} array of all nodes down the tree
   */
  getAllNodes() {
    return this._getAllChildren(this, []);
  }

  /**
   * 
   * @param {ShapeSVG} SVG node
   * @param {Array<ShapeSVG>} array of the rest of the tree
   * @returns 
   */
  _getAllChildren(head, arr) {
    arr.push(head); // add to the front of the array so the root is drawn first
    for (const child of head.children) {
      child._getAllChildren(child,arr); // also add all the children
    }
    return arr;
  }

  /**
    * @returns {number} number of vertices
    */
  getVertexCount() {
    return this.vertices.length;
  }

  getVertexCode(index) {
    this.getVertex(index);
    return this.vertexCodes[index];
  }

  getVertex(index) {
    if (index < 0 || index >= this.getVertexCount()) {
      throw new Error(`Vertex index ${index} out of bounds for vertex length ${this.getVertexCount()}`);
    }
    return this.vertices[index];
  }

  /**
   * Adds a ShapeSVG child to this shape
   * @param {ShapeSVG} shape 
   */
  addChild(shape) {
    shape.parent = this;
    this.children.push(shape);
  }

  /**
   * Disables the style of this shape and all its children
   */
  disableStyle() {
    this.style = false;

    for (const element of this.children) {
      element.disableStyle();
    }
  }

  /**
   * Enables the style of this shape and all its children
   */
  enableStyle() {
    this.style = true;

    for (const element of this.children) {
      element.enableStyle();
    }
  }
  /**
   * Helper function get invert 
   * @param {p5.Vector} p , has an x and y property
   * @returns 
   */
  inverseMatrix(p) {
    if (this.matrix) {
      const inverseCoords = this.matrix.get();
      inverseCoords.invert();  // Double invert from original Java code
      inverseCoords.invert();
      return inverseCoords.mult(p);
    }
  }

  /**
   * 
   * @param {number} x-coord
   * @param {number} y-coord
   * @returns {boolean} true if the point is inside this shape
   */
  contains(x, y) {
    // just monkey-transcribed from PShape java code. dunno what it does
    // https://github.com/processing/processing4/blob/main/core/src/processing/core/PShape.java#L3104
    if (this.getType() === 'path' || this.getType() === 'geometry') {
      let p = { x: x, y: y }; // p is a ray from (0,0) to (x,y)

      // Apply inverse transformation if necessary
      this.inverseMatrix(p);

      let inside = false;

      // Check if the point is inside any triangle formed by the pairwise vertices and the last point 
      // in a vertex of n points, then n-1 


      // https://wrfranklin.org/Research/Short_Notes/pnpoly.html
      for (let i = 0, j = this.getVertexCount() - 1; i < this.getVertexCount(); j = i++) {
        const xi = this.vertices[i][0];
        const yi = this.vertices[i][1];

        const xj = this.vertices[j][0];
        const yj = this.vertices[j][1];
        //console.log(`x_i, y_i ${xi}, ${yi}, j: (${xj}, ${yj}`);

        const yMatch = (yi > p.y) !== (yj > p.y); // cross y test 
        const xIntersect = (xj - xi) * (p.y - yi) / (yj - yi) + xi;

        if (yMatch && p.x < xIntersect) {
          inside = !inside;
        }
      }
      return inside;

    } else if (this.getType() === 'group') {
      for (let i = 0; i < this.getChildCount(); i++) {
        if (this.children[i]?.contains(x, y)) {
          return true;
        }
      }
      return false;

    } else {
      throw new Error('contains() only supported for paths and groups');
    }
  }
}