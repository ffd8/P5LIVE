let libs = [ 'https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.17.0/matter.min.js', 'includes/libs/matter.js']

var Engine = Matter.Engine,
    Render = Matter.Render,
    World = Matter.World,
    Body = Matter.Body,
    Bodies = Matter.Bodies,
    Composite = Matter.Composite,
    Composites = Matter.Composites,
    Constraint = Matter.Constraint,
    Mouse = Matter.Mouse,
    Events = Matter.Events,
    MouseConstraint = Matter.MouseConstraint,
    Runner = Matter.Runner;
    
var engine = Engine.create();
var runner = Runner.create();
var world = engine.world;
var mConstraint;
var event;
var boxes= []; 
var circles = [];
var canvas; 
var topCircle, groundMiddle;

function setup() {
  canvas = createCanvas(windowWidth, windowHeight);
  rectMode(CENTER);
  background(255, 255, 0);

  // create boundary blocks
  
  // OPTION apply gravity or static?
  // topCircle = Bodies.circle(width/4, 100, width/4, {isStatic: true});
  topCircle = Bodies.circle(width/4, 100, width/4);

  groundMiddle = Bodies.rectangle(width/4+50, height/2, width/3+20, 30, {isStatic: true, angle: Math.PI * 0.06});
  var groundBottom = Bodies.rectangle(width/2, height, width/2+100, 80, {isStatic: true}), counter= -1;

  // add static bodies to the world
  Composite.add(world, [topCircle, groundBottom, groundMiddle]);
  Runner.run(runner, engine);

  //mouse
  var canvasMouse = Mouse.create(canvas.elt);
  canvasMouse.pixelRatio = pixelDensity();
  var options = {
    mouse: canvasMouse,
  }
  mConstraint = MouseConstraint.create(engine, options)
  Composite.add(world, [canvasMouse, mConstraint])
  
  // middle ------
  for(let i = 0; i < 5; i++){
    const w = 20
    // let b = new Box(70 + i*w*3, height/2, w, w, true)
    // boxes.push(b)
  }
  
   // bottom ㄴ
  const startX = width/2 + random(40)
  // add horizontal boxes
  // add bodies
  for (let i = 0; i < 6; i++) {
    const w = 30
    let b = new Box(startX + (w*i), height-(w*2), w, w)
    boxes.push(b)
  }

  // add vertical boxes
  for (let i = 0; i < 4; i++) {
    const w = 30
    const startY = height/2 + 20
    let b = new Box(startX, startY + (w*i), w, w)
    boxes.push(b)
  }
}

function draw() {
  background(0, 70);

  noStroke()
  // fill(map(sin(frameCount/10),-1, 1, 0, 255), 
  //     map(sin(frameCount/100),1, -1, 0, 255), 
  //     map(tan(frameCount/20),-10, 10, 0, 255)
  // )
  push()
  translate(groundMiddle.position.x, groundMiddle.position.y)
  rotate(groundMiddle.angle)
  rect(0, 0, width/3+20, 30)
  pop()

  ellipse(topCircle.position.x, topCircle.position.y, width/4)
  
   for (let i = 0; i < boxes.length; i++) {
    boxes[i].show()
  }
  for (let i = 0; i < circles.length; i++) {
    circles[i].show()
  }
  if(frameCount%50===0){
    const c = new Circle(groundMiddle.position.x +90, groundMiddle.position.y+10, random(10, 30))
    circles.push(c)
  }
}

function keyPressed() {
  const size = map(sin(frameCount), -1, 1, 20, 40)
  console.log("hello?")         
  circles.push(new Circle(mouseX, mouseY, size))

} 
 
class Box {
  constructor(x, y, w, h, fixed) {
    const option = {
      friction: 1, 
      restitution: 0.5,
      isStatic: fixed ? true : false
    }
    this.body = Bodies.rectangle(x, y, w, h, option)
    this.w = w;
    this.h = h;
    Composite.add(world, this.body)
  }

  show() {
    var pos = this.body.position
    var angle = this.body.angle;
    push() 
    translate(pos.x, pos.y)
    // rotate(this.angle);
    rect(0, 0, this.w, this.h)

    pop()
  }


}

class Circle {
  constructor(x, y, r) {
    const option = {
      friction: 0.3, 
      density: 0.1,
    }
    this.body = Bodies.circle(x, y, r, option)
    this.r = r;
    Composite.add(world, this.body)
  }

  show() {
    var pos = this.body.position
    var angle = this.body.angle;
    push() 
    translate(pos.x, pos.y)
    // rotate(this.angle);
    ellipse(0, 0, this.r)

    pop()
  }


}
