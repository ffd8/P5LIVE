let points=[];
let bounds;
let gap = 5
let count = 0
let words = ['헤']
let wordcount = 0
let colorRange = 174
let density = 0.01
let wiggle = 400
let font;
let prevWiggle = wiggle, prevDensity = density
// wiggle ranges: 0.5 ~ 400
// let densityVar = 255
// densityVar => density
// density (of points) ranges: 0.8 ~ 0.01
// wiggle responds to mouseX
// densityVar responds to mouseY

function preload() {
	
	font = loadFont("includes/fonts/onJijangkyeong.otf");
}

function setup() {
	createCanvas(windowWidth, windowHeight);
	stroke(0);
	textFont(font);
	renderText(words[wordcount])
}

function draw() {
  //renderText(words[wordcount])
  prevWiggle = wiggle
  prevDensity = density
  
  let mouseXRound10 = Math.round10(map(mouseX, 30, width-30, 0.4, 0.05), -3);
  let mouseYRound10 = Math.round10(map(mouseY, 30, height, 0.5, 300), -3);
  density = mouseXRound10
  wiggle = mouseYRound10 //* atan(frameCount%50)
  
   
  if(density !== prevDensity) {
    renderText(words[wordcount])
  }
  
  
  colorRange = int(
  	map(
	  sin(frameCount/20), 
	  -1, 1, 
	  174, 299)
  	)
 

  textSize(30);
  background(0);
  noStroke()
  let speed = int(tan(mouseY*frameCount/10)+25);
  for (let i = 0; i < speed; i+=1) { 
	if(points.length > 0) {
	  let nPoint = points[(count+i) % points.length];
	  fill(`hsl(${colorRange}, 100%, 80%)`)
	  //fill(255, 0, 255);
	  text(
	    nPoint.num,
        nPoint.x * width / bounds.w + sin(20* nPoint.y / bounds.h + millis() / 1000) * width / wiggle, 
	    nPoint.y * height / bounds.h + cos(40*nPoint.x / bounds.w + millis() / 2000) * height / wiggle
	  )
    count++;
   }
 }
}


// render or reset points
function renderText(word) {
  points = font.textToPoints(word, 100, height-300, 800, {
    sampleFactor: density,
    simplifyThreshold: 0
  });
  bounds = font.textBounds(' '+word+' ', 100, height-300, 800);

  for (let i = 0; i < points.length; i++) {
    points[i].num = i
  }
}

// more than one words in the Array words
function keyPressed() {
  //if (keyCode === LEFT_ARROW) {
  //  points = []
  //  renderText(words[wordcount])
  //  if(wordcount == words.length - 1){
  //    wordcount = 0
  //  } else {
  //    wordcount++
  //  }
  //}
}


// https://developer.mozilla.org/ko/docs/Web/JavaScript/Reference/Global_Objects/Math/floor
// Closure
(function() {
  /**
   * Decimal adjustment of a number.
   *
   * @param {String}  type  The type of adjustment.
   * @param {Number}  value The number.
   * @param {Integer} exp   The exponent (the 10 logarithm of the adjustment base).
   * @returns {Number} The adjusted value.
   */
  function decimalAdjust(type, value, exp) {
    // If the exp is undefined or zero...
    if (typeof exp === 'undefined' || +exp === 0) {
      return Math[type](value);
    }
    value = +value;
    exp = +exp;
    // If the value is not a number or the exp is not an integer...
    if (isNaN(value) || !(typeof exp === 'number' && exp % 1 === 0)) {
      return NaN;
    }
    // Shift
    value = value.toString().split('e');
    value = Math[type](+(value[0] + 'e' + (value[1] ? (+value[1] - exp) : -exp)));
    // Shift back
    value = value.toString().split('e');
    return +(value[0] + 'e' + (value[1] ? (+value[1] + exp) : exp));
  }

  // Decimal round
  if (!Math.round10) {
    Math.round10 = function(value, exp) {
      return decimalAdjust('round', value, exp);
    };
  }
  // Decimal floor
  if (!Math.floor10) {
    Math.floor10 = function(value, exp) {
      return decimalAdjust('floor', value, exp);
    };
  }
  // Decimal ceil
  if (!Math.ceil10) {
    Math.ceil10 = function(value, exp) {
      return decimalAdjust('ceil', value, exp);
    };
  }
})();
