// BMWalker.js
// Biological Motion 'Walker' library for JavaScript.

// LICENSE
// Attribution-NonCommercial-ShareAlike 4.0 International
// Copyright (c) 2022 Tetsunori Nakayama(https://twitter.com/tetunori_lego)
//   and Nikolaus Troje(https://www.biomotionlab.ca/niko-troje/).
// For commercial use, please contact us.

// This library is based on the results of BioMotion Lab's researches in York University.
// See the URL below in detail.
// https://www.biomotionlab.ca/

const BMW_TYPE_HUMAN = 0;
const BMW_TYPE_CAT = 1;
const BMW_TYPE_PIGEON = 2;
const BMW_TYPE_BOX = 3; // (for debug)

class BMWalker {
  // Constructor
  constructor(type = BMW_TYPE_HUMAN) {
    // External variables
    // Boundary values
    this.maxSpeed = 2.0;
    this.minSpeed = -2.0;
    this.maxBodyStructure = 6.0; // Type A
    this.minBodyStructure = -6.0; // Type B
    this.maxWeight = 6.0; // Heavy
    this.minWeight = -6.0; // Light
    this.maxNervousness = 6.0; // Nervous
    this.minNervousness = -6.0; // Relaxed
    this.maxHappiness = 6.0; // Happy
    this.minHappiness = -6.0; // Sad

    // Internal variables
    this.type = type;

    this.tm = new BMWTimer();
    this.starttime = this.tm.getTimer();

    this.mtrx = new BMWMatrix();

    // Walker Parameters
    this.speed = 1.0;
    this.bodyStructure = 0;
    this.weight = 0;
    this.nervousness = 0;
    this.happiness = 0;

    // Camera Parameters
    this.azimuth = 0; // rad
    this.angularVelocity = 0; // rad/sec
    this.elevation = 0; // rad
    this.roll = 0; // rad

    // Translation Parameters
    this.flagTranslation = false;
    this.translation_pos = 0;

    this.walker_size = 10;

    // 35 is the exactly correct ratio but need offsetY in this case.
    this.walkerHeightRatio = 40;
    //graphical stuff
    this.motion_vertical_scale = 1;
    this.motion_horizontal_scale = 1;
    this.structure_vertical_scale = 1;
    this.structure_horizontal_scale = 1;

    // Each data
    const walkerData = new BMWData();
    this.meanwalker = walkerData.meanwalker;
    this.bodyStructureaxis = walkerData.bodyStructureaxis;
    this.weightaxis = walkerData.weightaxis;
    this.nervousaxis = walkerData.nervousaxis;
    this.happyaxis = walkerData.happyaxis;

    //camera variables
    this.camera_distance = 1000;

    this.walker_rot_xaxis = 0;
    this.walker_rot_yaxis = 0;
    this.walker_rot_zaxis = 0;

    this.walker_translation_speed = 0;

    this.walkerxmin = 0;
    this.walkerymin = 0;
    this.walkerzmin = 0;
    this.walkerxmax = 0;
    this.walkerymax = 0;
    this.walkerzmax = 0;
    this.walkerxoff = 0;
    this.walkeryoff = 0;
    this.walkerzoff = 0;
    this.walkersizefactor = 0;

    this.axisrot = 0;
    this.nummarkers = 0;

    this.markers = [];

    this.init();
  }

  // API: Get markers
  getMarkers(walkerHeight, tmsec = undefined) {
    const markers = []; // return value

    this.walker_size = walkerHeight / this.walkerHeightRatio;

    if (tmsec === undefined) {
      tmsec = this.tm.getTimer() - this.starttime;
    }
    // console.log(tmsec);

    let i = 0;
    let walkertime = 0;

    if (this.speed != 0) {
      walkertime = this.calcTime(tmsec);
      //console.log(walkertime)
    }

    // Translation calculation
    if (this.flagTranslation) {
      this.translation_pos = Math.round((this.getTranslationSpeed() * 120 * tmsec) / 1000);
    } else {
      this.translation_pos = 0;
    }

    // Calculate marker positions
    for (i = 0; i < this.nummarkers * 3 + 1; i++) {
      this.markers[i] = this.sample(i, walkertime, true);
    }

    let matrix = this.mtrx.rotateaxis(
      -this.axisrot,
      this.walker_rot_xaxis,
      this.walker_rot_yaxis,
      this.walker_rot_zaxis
    );

    matrix = this.mtrx.multmatrix(this.mtrx.translate(this.translation_pos, 0, 0), matrix);

    const angularVelocity = this.flagTranslation ? 0 : this.angularVelocity;
    matrix = this.mtrx.multmatrix(
      this.mtrx.rotateaxis(this.azimuth + (tmsec * angularVelocity) / 1000, 0, 0, 1),
      matrix
    );

    matrix = this.mtrx.multmatrix(this.mtrx.rotateY(this.elevation), matrix);
    matrix = this.mtrx.multmatrix(this.mtrx.rotateX(this.roll), matrix);

    for (i = 0; i < this.nummarkers; i++) {
      const vector = new Array(4);
      vector[0] = this.markers[i] + this.walkerxoff;
      vector[1] =
        this.markers[i + this.nummarkers] + this.walkeryoff * this.structure_vertical_scale;
      vector[2] = this.markers[i + this.nummarkers * 2] + this.walkerzoff;
      vector[3] = 1;

      const v2 = this.mtrx.multmatrixvector(matrix, vector);
      v2[3] = 1;

      //nudge up
      const pixelsperdegree = 37;
      const xpos = (v2[1] / this.walkersizefactor) * this.walker_size * pixelsperdegree;
      const ypos = -(v2[2] / this.walkersizefactor) * this.walker_size * pixelsperdegree;
      const zpos = (v2[0] / this.walkersizefactor) * this.walker_size * pixelsperdegree;
      // console.log(xpos, ypos, zpos);

      const descs = [
        [
          'Head',
          'Clavicles',
          'L-Shoulder',
          'L-Elbow',
          'L-Hand',
          'R-Shoulder',
          'R-Elbow',
          'R-Hand',
          'Belly',
          'L-Hip',
          'L-Knee',
          'L-Ankle',
          'R-Hip',
          'R-Knee',
          'R-Ankle',
        ],
        [
          // cat
        ],
        [
          'Head-C',
          'Head-R',
          'Head-L',
          'Body-1',
          'Body-2',
          'Body-3',
          'Body-4',
          'R-Foot-Front',
          'R-Foot-Rear',
          'L-Foot-Front',
          'L-Foot-Rear',
        ],
        [
          // box
        ],
      ];
      markers.push({ x: xpos, y: ypos, z: zpos, desc: descs[this.type][i] });
    }

    return markers;
  }

  // API: Get markers that make up the line.
  getLineMarkers(walkerHeight, tmsec = undefined) {
    const markers = this.getMarkers(walkerHeight, tmsec);
    const lineMarkers = [];
    const idxsArray = [
      [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
        [1, 5],
        [5, 6],
        [6, 7],
        [1, 8],
        [8, 9],
        [9, 10],
        [10, 11],
        [8, 12],
        [12, 13],
        [13, 14],
      ],
      [
        // cat
      ],
      [
        [0, 1],
        [0, 2],
        [3, 5],
        [4, 5],
        [5, 6],
        [7, 8],
        [9, 10],
      ],
      [
        // box
      ],
    ];
    idxsArray[this.type].forEach((idxs) => {
      const i0 = idxs[0];
      const i1 = idxs[1];

      lineMarkers.push([
        { x: markers[i0].x, y: markers[i0].y, z: markers[i0].z, i: i0 },
        { x: markers[i1].x, y: markers[i1].y, z: markers[i1].z, i: i1 },
      ]);
    });

    return lineMarkers;
  }

  // API: Set speed
  setSpeed(speed = 1.0) {
    const freq = this.getFrequency();
    // avoid 0 divisor
    if (speed === 0) {
      speed += 0.001;
    }
    this.speed = this.clamp(this.minSpeed, this.maxSpeed, speed);

    this.init();
    let difffreq = freq / this.getFrequency();
    // avoid 0 divisor
    if (abs(difffreq) < 0.005) {
      difffreq += 0.01;
    }
    const t = this.tm.getTimer();
    this.starttime = t - (t - this.starttime) / difffreq;
    // console.log(freq, difffreq, t, this.starttime);
  }

  // API: Set parameters on walker
  setWalkerParam(bodyStructure, weight, nervousness, happiness) {
    const freq = this.getFrequency();

    // Body Structure Parameter
    if (bodyStructure !== undefined) {
      this.bodyStructure = this.clamp(this.minBodyStructure, this.maxBodyStructure, bodyStructure);
    }

    // Weight Parameter
    if (weight !== undefined) {
      this.weight = this.clamp(this.minWeight, this.maxWeight, weight);
    }

    // Nervousness Parameter
    if (nervousness !== undefined) {
      this.nervousness = this.clamp(this.minNervousness, this.maxNervousness, nervousness);
    }

    // Happiness Parameter
    if (happiness !== undefined) {
      this.happiness = this.clamp(this.minHappiness, this.maxHappiness, happiness);
    }

    this.init();
    let difffreq = freq / this.getFrequency();
    // avoid 0 divisor
    if (abs(difffreq) < 0.005) {
      difffreq += 0.01;
    }
    const t = this.tm.getTimer();
    this.starttime = t - (t - this.starttime) / difffreq;
  }

  // API: Set parameters on camera
  setCameraParam(azimuth, angularVelocity, elevation, roll) {
    // Camera azimuth(rotation) Parameter
    if (azimuth !== undefined) {
      this.azimuth = azimuth;
    }

    // Camera angular velocity(rotation speed) Parameter
    if (angularVelocity !== undefined) {
      this.angularVelocity = angularVelocity;
    }

    // Camera elevation Parameter
    if (elevation !== undefined) {
      this.elevation = elevation;
    }

    // Camera roll Parameter
    if (roll !== undefined) {
      this.roll = roll;
    }
  }

  // API: Set parameters on translation
  setTranslationParam(flagTranslation) {
    if (flagTranslation !== undefined) {
      this.flagTranslation = flagTranslation;
    }
  }

  // API: Reset timer value
  resetTimer() {
    this.starttime = this.tm.getTimer();
    this.init();
  }

  // API: Get loop period in mesec
  getPeriod() {
    return 1000 * this.getFrequency() / 120;
  }
  
  // ----- Internal methods
  clamp(min, max, val) {
    return Math.min(max, Math.max(min, val));
  }

  init() {
    this.nummarkers = (this.meanwalker[this.type].length / 5 - 1) / 3;
    this.markers = new Array(this.nummarkers * 3);
    this.recalc_angle();
    this.calcsize();
    this.walker_translation_speed = this.calcTranslationSpeed();
  }

  recalc_angle() {
    const res = this.mtrx.angleBetween(0, 0, 1, 0, 0, 1);
    this.walker_rot_xaxis = res[0];
    this.walker_rot_yaxis = res[1];
    this.walker_rot_zaxis = res[2];
    this.axisrot = res[3];
  }

  calcsize() {
    let n;

    // Calc min/max of x, y, z.
    for (n = 0; n < this.nummarkers; n++) {
      this.walkerxmin = Math.min(this.walkerxmin, this.meanwalker[this.type][n]);
      this.walkerxmax = Math.max(this.walkerxmax, this.meanwalker[this.type][n]);
    }
    for (n = this.nummarkers; n < this.nummarkers * 2; n++) {
      this.walkerymin = Math.min(this.walkerymin, this.meanwalker[this.type][n]);
      this.walkerymax = Math.max(this.walkerymax, this.meanwalker[this.type][n]);
    }
    for (n = this.nummarkers * 2; n < this.nummarkers * 3; n++) {
      this.walkerzmin = Math.min(this.walkerzmin, this.meanwalker[this.type][n]);
      this.walkerzmax = Math.max(this.walkerzmax, this.meanwalker[this.type][n]);
    }

    // The walker height in mm. Used later on to scale it to the desired size in degrees.
    this.walkersizefactor = this.walkerzmax - this.walkerzmin;

    this.walkerxoff = -(this.walkerxmax + this.walkerxmin) / 2;
    this.walkeryoff = -(this.walkerymax + this.walkerymin) / 2;
    this.walkerzoff = -(this.walkerzmax + this.walkerzmin) / 2;
  } // end of calsize()

  sample(i, walkertime, includeStructure) {
    let initialpos = this.meanwalker[this.type][i];

    if (includeStructure) {
      if (this.type === BMW_TYPE_HUMAN) {
        initialpos +=
          this.bodyStructureaxis[i] * this.bodyStructure +
          this.weightaxis[i] * this.weight +
          this.nervousaxis[i] * this.nervousness +
          this.happyaxis[i] * this.happiness;
      }

      //invert or scale structure
      if (i >= this.nummarkers * 2 && i < this.nummarkers * 3)
        initialpos *= this.structure_vertical_scale;
      else initialpos *= this.structure_horizontal_scale;
    } else {
      initialpos = 0;
    }

    //motion!
    let motionpos = 0;
    const j = this.nummarkers * 3 + 1;

    if (this.type === BMW_TYPE_HUMAN) {
      const b = this.bodyStructure;
      const w = this.weight;
      const n = this.nervousness;
      const h = this.happiness;
      motionpos =
        (this.meanwalker[this.type][i + j] +
          this.bodyStructureaxis[i + j] * b +
          this.weightaxis[i + j] * w +
          this.nervousaxis[i + j] * n +
          this.happyaxis[i + j] * h) *
          Math.sin(walkertime) +
        (this.meanwalker[this.type][i + j * 2] +
          this.bodyStructureaxis[i + j * 2] * b +
          this.weightaxis[i + j * 2] * w +
          this.nervousaxis[i + j * 2] * n +
          this.happyaxis[i + j * 2] * h) *
          Math.cos(walkertime) +
        (this.meanwalker[this.type][i + j * 3] +
          this.bodyStructureaxis[i + j * 3] * b +
          this.weightaxis[i + j * 3] * w +
          this.nervousaxis[i + j * 3] * n +
          this.happyaxis[i + j * 3] * h) *
          Math.sin(2 * walkertime) +
        (this.meanwalker[this.type][i + j * 4] +
          this.bodyStructureaxis[i + j * 4] * b +
          this.weightaxis[i + j * 4] * w +
          this.nervousaxis[i + j * 4] * n +
          this.happyaxis[i + j * 4] * h) *
          Math.cos(2 * walkertime);
    } else {
      motionpos =
        this.meanwalker[this.type][i + j] * Math.sin(walkertime) +
        this.meanwalker[this.type][i + j * 2] * Math.cos(walkertime) +
        this.meanwalker[this.type][i + j * 3] * Math.sin(2 * walkertime) +
        this.meanwalker[this.type][i + j * 4] * Math.cos(2 * walkertime);
    }

    if (i >= this.nummarkers * 2 && i < this.nummarkers * 3)
      motionpos *= this.motion_vertical_scale;
    else motionpos *= this.motion_horizontal_scale;
    return initialpos + motionpos;
  }

  getFrequency() {
    const i = this.nummarkers * 3;
    let speed = this.meanwalker[this.type][i];

    if (this.type === BMW_TYPE_HUMAN) {
      speed += this.bodyStructure * this.bodyStructureaxis[i];
      speed += this.weight * this.weightaxis[i];
      speed += this.nervousness * this.nervousaxis[i];
      speed += this.happiness * this.happyaxis[i];
    }

    return speed / this.speed;
  }

  calcTranslationSpeed() {
    const i = (this.nummarkers * 3 + 1) * 3 - 1;
    let tspeed = this.meanwalker[this.type][i];

    if (this.type === BMW_TYPE_HUMAN) {
      tspeed += this.bodyStructure * this.bodyStructureaxis[i];
      tspeed += this.weight * this.weightaxis[i];
      tspeed += this.nervousness * this.nervousaxis[i];
      tspeed += this.happiness * this.happyaxis[i];
    }

    return tspeed * 120;
  }

  getTranslationSpeed() {
    return this.speed * (this.walker_translation_speed / 120);
  }

  calcTime(curtime) {
    return ((curtime * 2 * Math.PI) / 1000) * (120 / this.getFrequency());
  }

}

// Simple Timer class
class BMWTimer {
  // Constructor
  constructor() {
    const d = new Date().valueOf();
    this.time = d;
    this.start = d;

    const precision = 10; // 10msec
    setInterval(
      function () {
        this.time += precision;
      }.bind(this),
      precision
    );
  }

  getTimer() {
    return this.time - this.start;
  }
}

//// Matrix calculation
class BMWMatrix {
  constructor() {}

  newMatrix() {
    const m = [new Array(4), new Array(4), new Array(4), new Array(4)];
    return m;
  }

  // Identity matrix
  newIdentMatrix() {
    const m = [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ];
    return m;
  }

  rotateY(angle) {
    const m = [
      [Math.cos(angle), 0, Math.sin(angle), 0],
      [0, 1, 0, 0],
      [-Math.sin(angle), 0, Math.cos(angle), 0],
      [0, 0, 0, 1],
    ];
    return m;
  }

  rotateX(angle) {
    const m = [
      [1, 0, 0, 0],
      [0, Math.cos(angle), -Math.sin(angle), 0],
      [0, Math.sin(angle), Math.cos(angle), 0],
      [0, 0, 0, 1],
    ];
    return m;
  }

  rotateZ(angle) {
    const m = [
      [Math.cos(angle), Math.sin(angle), 0, 0],
      [-Math.sin(angle), Math.cos(angle), 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ];
    return m;
  }

  perspective(zfar) {
    const znear = 1;
    const f = zfar;
    const m = [
      [(zfar + znear) / (znear - zfar), (2 * zfar * znear) / (znear - zfar), 0, 0],
      [0, f, 0, 0],
      [0, 0, f, 0],
      [-1, 0, 0, 0],
    ];
    return m;
  }

  translate(tx, ty, tz) {
    const m = [
      [1, 0, 0, tx],
      [0, 1, 0, ty],
      [0, 0, 1, tz],
      [0, 0, 0, 1],
    ];
    return m;
  }

  rotateaxis(angle, rx, ry, rz) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);

    const len = Math.sqrt(rx * rx + ry * ry + rz * rz);
    rx = rx / len;
    ry = ry / len;
    rz = rz / len;
    const m = [
      [rx * rx * (1 - c) + c, rx * ry * (1 - c) - rz * s, rx * rz * (1 - c) + ry * s, 0],
      [ry * rx * (1 - c) + rz * s, ry * ry * (1 - c) + c, ry * rz * (1 - c) - rx * s, 0],
      [rz * rx * (1 - c) - ry * s, rz * ry * (1 - c) + rx * s, rz * rz * (1 - c) + c, 0],
      [0, 0, 0, 1],
    ];
    return m;
  }

  multmatrix(m1, m2) {
    const m3 = this.newMatrix();
    let r = 0;
    let c = 0;

    for (r = 0; r < 4; r++) {
      for (c = 0; c < 4; c++) {
        m3[r][c] = 0;
      }
    }

    for (r = 0; r < 4; r++) {
      for (c = 0; c < 4; c++) {
        for (let i = 0; i < 4; i++) {
          m3[r][c] += m1[r][i] * m2[i][c];
        }
      }
    }
    return m3;
  }

  multmatrixvector(m, v) {
    const v2 = new Array(4);

    for (let i = 0; i < 4; i++) {
      v2[i] = 0;
    }

    for (let r = 0; r < 4; r++) {
      for (let i = 0; i < 4; i++) {
        v2[r] += m[r][i] * v[i];
      }
    }
    return v2;
  }

  multvectormatrix(v, m) {
    const v2 = new Array(4);

    for (let i = 0; i < 4; i++) {
      v2[i] = 0;
    }

    for (let r = 0; r < 4; r++) {
      for (i = 0; i < 4; i++) {
        v2[r] += m[i][r] * v[i];
      }
    }
    return v2;
  }

  dotProd(x1, y1, z1, x2, y2, z2) {
    return x1 * x2 + y1 * y2 + z1 * z2;
  }

  angleBetween(x1, y1, z1, x2, y2, z2) {
    const axislen1 = Math.sqrt(x1 * x1 + y1 * y1 + z1 * z1);
    const axislen2 = Math.sqrt(x2 * x2 + y2 * y2 + z2 * z2);

    const angle = Math.acos(this.dotProd(x1, y1, z1, x2, y2, z2) / (axislen1 * axislen2));

    if (Math.abs(angle) < 0.0001) return [0, 0, 1, 0];
    if (angle > PI) {
      angle = -(TAU - angle);
    }

    //cross product
    const x3 = y1 * z2 - z1 * y2;
    const y3 = z1 * x2 - x1 * z2;
    const z3 = x1 * y2 - y1 * x2;

    return [x3, y3, z3, angle];
  }
}

// Walker data class
class BMWData {
  // Constructor
  constructor() {
    this.meanwalker = new Array(4);
    this.meanwalker[0] = new Array(
      -10.7519,
      -3.7275,
      -16.4667,
      -65.2177,
      44.6613,
      -16.4667,
      -65.2177,
      44.6613,
      17.761,
      15.8663,
      74.7274,
      -52.4475,
      15.8663,
      74.7274,
      -52.4475,
      0.0,
      0.0,
      183.8203,
      220.4787,
      251.0134,
      -183.8203,
      -220.4787,
      -251.0134,
      0.0,
      94.4979,
      72.718,
      50.9486,
      -94.4979,
      -72.718,
      -50.9486,
      1640.6199,
      1366.6743,
      1402.3211,
      1130.6523,
      907.4477,
      1402.3211,
      1130.6523,
      907.4477,
      1015.0295,
      909.5169,
      524.1089,
      162.3379,
      909.5169,
      524.1089,
      162.3379,
      126.0309,
      -0.0,
      -0.0,
      6.0119,
      18.6533,
      35.1689,
      -6.0119,
      -18.6533,
      -35.1689,
      -0.0,
      0.8558,
      -66.76,
      -0.0014,
      -0.8558,
      66.76,
      0.0014,
      16.7455,
      13.6539,
      14.4562,
      18.2079,
      12.2518,
      14.4562,
      18.2079,
      12.2518,
      11.0806,
      12.7013,
      -11.6385,
      -16.84,
      12.7013,
      -11.6385,
      -16.84,
      -0.0,
      -0.0,
      -2.7469,
      -4.1204,
      3.9073,
      2.7469,
      4.1204,
      -3.9073,
      -0.0,
      6.0561,
      -1.1494,
      -54.9132,
      -6.0561,
      1.1494,
      54.9132,
      1.0,
      0.0,
      0.0,
      -10.5991,
      -81.6328,
      -188.0212,
      10.5991,
      81.6328,
      188.0212,
      0.0,
      7.5198,
      147.7088,
      322.4646,
      -7.5198,
      -147.7088,
      -322.4646,
      5.1627,
      -0.3989,
      0.6821,
      -22.7247,
      -2.6726,
      0.6821,
      -22.7247,
      -2.6726,
      -4.8763,
      -0.3846,
      -5.4519,
      3.1093,
      -0.3846,
      -5.4519,
      3.1093,
      0.0,
      0.0,
      -5.0298,
      5.4083,
      -48.329,
      5.0298,
      -5.4083,
      48.329,
      0.0,
      2.1644,
      21.0489,
      -38.6506,
      -2.1644,
      -21.0489,
      38.6506,
      11.3014,
      5.0464,
      9.7195,
      9.2152,
      4.2044,
      0.0865,
      9.2152,
      4.2044,
      0.0865,
      14.0191,
      14.2109,
      24.09,
      -51.2215,
      14.2109,
      24.09,
      -51.2215,
      -0.0,
      -0.0,
      0.4097,
      -2.1377,
      -0.1669,
      -0.4097,
      2.1377,
      0.1669,
      0.0,
      0.1281,
      3.4136,
      1.5014,
      -0.1281,
      -3.4136,
      -1.5014,
      -2.7192,
      -3.0021,
      -3.5202,
      -5.4154,
      -11.7893,
      -3.5202,
      -5.4154,
      -11.7893,
      -3.3653,
      -4.2122,
      -13.3553,
      29.5052,
      -4.2122,
      -13.3553,
      29.5052,
      0.0,
      -0.7778,
      0.1821,
      -0.2669,
      -1.4476,
      -2.3384,
      -0.2669,
      -1.4476,
      -2.3384,
      0.3083,
      -0.6448,
      -31.9081,
      10.0433,
      -0.6448,
      -31.9081,
      10.0433,
      0.0,
      0.0,
      -0.4651,
      -1.0106,
      -3.2205,
      0.4651,
      1.0106,
      3.2205,
      0.0,
      -0.6521,
      -5.3993,
      -2.6593,
      0.6521,
      5.3993,
      2.6593,
      -20.8947,
      -20.894,
      -20.466,
      -13.9663,
      3.7265,
      -20.466,
      -13.9663,
      3.7265,
      -20.8148,
      -19.3607,
      -12.4748,
      -12.1435,
      -19.3607,
      -12.4748,
      -12.1435,
      0.0
    );

    this.meanwalker[1] = new Array(
      89.06,
      84.511,
      58.347,
      107.5,
      91.942,
      -97.154,
      -111.97,
      -62.801,
      -85.688,
      178.5,
      19.219,
      -169.54,
      89.06,
      84.511,
      58.347,
      -97.154,
      -111.97,
      -62.801,
      0,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      -151.01,
      -135.72,
      -79.481,
      -31.315,
      -0.3025,
      -150.59,
      -103.72,
      -71.968,
      2.4855,
      -58.722,
      3.4155,
      11.404,
      -151.01,
      -135.72,
      -79.481,
      -150.59,
      -103.72,
      -71.968,
      70.857,
      22.689,
      7.547,
      8.046,
      2.845,
      3.135,
      -33.592,
      -25.853,
      -17.601,
      -1.558,
      0.714,
      2.456,
      -0.235,
      -22.689,
      -7.547,
      -8.046,
      33.592,
      25.853,
      17.601,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      -3.413,
      -4.884,
      -2.216,
      4.898,
      5.943,
      -6.651,
      -2.041,
      -2.663,
      0.849,
      -1.312,
      1.877,
      4.495,
      3.413,
      4.884,
      2.216,
      6.651,
      2.041,
      2.663,
      10,
      80.946,
      73.03,
      32.385,
      8.504,
      0.598,
      75.381,
      44.785,
      26.443,
      0.168,
      -1.295,
      -0.564,
      -0.877,
      -80.946,
      -73.03,
      -32.385,
      -75.381,
      -44.785,
      -26.443,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0.859,
      -1.711,
      -13.161,
      3.015,
      0.926,
      -2,
      -14.766,
      -0.345,
      1.165,
      0.045,
      0.287,
      -0.131,
      -0.859,
      1.711,
      13.161,
      2,
      14.766,
      0.345,
      0,
      -21.478,
      -16.859,
      0.445,
      2.55,
      3.536,
      -14.571,
      -8.079,
      -0.346,
      3.344,
      1.847,
      3.655,
      2.393,
      -21.478,
      -16.859,
      0.445,
      -14.571,
      -8.079,
      -0.346,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      -0.833,
      -3.858,
      -2.506,
      -5.752,
      -4.966,
      1.416,
      7.193,
      -1.683,
      3.183,
      -6.335,
      -4.296,
      -2.479,
      -0.833,
      -3.858,
      -2.506,
      1.416,
      7.193,
      -1.683,
      0,
      11.453,
      3.75,
      7.972,
      0.411,
      -0.879,
      -13.512,
      -4.831,
      -6.61,
      -0.98,
      0.53,
      -0.472,
      0.296,
      11.453,
      3.75,
      7.972,
      -13.512,
      -4.831,
      -6.61,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      -1.338,
      -0.565,
      -1.681,
      -2.684,
      -2.563,
      -2.135,
      -3.581,
      -0.781,
      -3.581,
      2.57,
      -0.821,
      -1.336,
      -1.338,
      -0.565,
      -1.681,
      -2.135,
      -3.581,
      -0.781,
      0
    );

    //PIGEON
    this.meanwalker[2] = new Array(
      151.657,
      115.513,
      115.086,
      -88.932,
      -86.731,
      -96.055,
      -133.994,
      35.441,
      -31.254,
      20.839,
      -38.143,
      7.032,
      -14.763,
      25.09,
      -7.464,
      19.885,
      -0.817,
      -8.057,
      -34.126,
      -26.043,
      30.752,
      17.119,
      630.364,
      640.531,
      632.458,
      503.034,
      500.521,
      413.254,
      386.095,
      201.538,
      207.795,
      203.2,
      212.428,
      76.605,
      1.492,
      -0.25,
      0.884,
      -2.951,
      -2.031,
      -2.721,
      -3.035,
      -13.878,
      -3.316,
      6.666,
      -2.975,
      11.736,
      12.495,
      13.266,
      30.328,
      29.865,
      22.389,
      21.325,
      0.187,
      -2.308,
      -1.926,
      -2.688,
      -6.074,
      -4.869,
      -5.643,
      0.033,
      -2.564,
      -0.709,
      0.186,
      15.934,
      23.516,
      -19.227,
      -27.16,
      7.0,
      -9.244,
      -9.56,
      -8.903,
      -10.146,
      -3.777,
      -6.76,
      -7.923,
      -85.578,
      -81.723,
      83.983,
      78.686,
      -4.506,
      -4.109,
      -4.019,
      26.619,
      26.032,
      23.463,
      30.543,
      8.056,
      12.008,
      -4.475,
      -3.718,
      2.695,
      2.125,
      2.364,
      -0.841,
      -1.929,
      -1.361,
      -1.599,
      -5.546,
      4.879,
      6.195,
      -8.376,
      5.0, // 0.0,
      17.762,
      17.735,
      17.988,
      4.712,
      4.973,
      3.588,
      3.269,
      -37.828,
      -35.062,
      -32.137,
      -28.162,
      -3.754,
      -3.432,
      -3.292,
      3.336,
      3.396,
      2.936,
      3.579,
      3.051,
      4.664,
      0.794,
      -0.237,
      0.341,
      0.317,
      0.439,
      2.164,
      1.998,
      2.146,
      2.515,
      -8.291,
      5.109,
      -9.628,
      4.401,
      0.0,
      -27.856,
      -28.388,
      -27.729,
      3.179,
      3.154,
      3.018,
      3.191,
      4.862,
      -0.595,
      6.625,
      3.26,
      1.78,
      2.198,
      2.305,
      -0.528,
      -0.863,
      -0.495,
      -0.66,
      0.514,
      6.33,
      0.775,
      -5.592,
      1.852,
      1.557,
      1.186,
      -3.337,
      -3.079,
      -3.304,
      -3.315,
      -10.877,
      -13.295,
      -11.179,
      -12.343,
      0.0
    );

    //BOX
    this.meanwalker[3] = new Array(
      -200,
      200,
      200,
      -200,
      -200,
      200,
      200,
      -200,
      -200,
      -200,
      200,
      200,
      -200,
      -200,
      200,
      200,
      200,
      200,
      200,
      200,
      -200,
      -200,
      -200,
      -200,
      1,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0
    );

    //other walker specific arrays
    this.bodyStructureaxis = new Array(
      10.8623,
      3.8778,
      3.9664,
      3.8558,
      2.2025,
      3.9664,
      3.8558,
      2.2025,
      -1.9171,
      -2.884,
      -7.7102,
      -5.2328,
      -2.884,
      -7.7102,
      -5.2328,
      0.0,
      0.0,
      2.335,
      5.3521,
      0.897,
      -2.335,
      -5.3521,
      -0.897,
      0.0,
      -4.9207,
      6.1326,
      4.9029,
      4.9207,
      -6.1326,
      -4.9029,
      0.5983,
      -0.8202,
      1.1016,
      2.7433,
      -0.9544,
      1.1016,
      2.7433,
      -0.9544,
      -4.0702,
      -4.5316,
      -1.9174,
      -2.6875,
      -4.5316,
      -1.9174,
      -2.6875,
      -0.8901,
      -0.0,
      -0.0,
      1.3052,
      0.6971,
      -0.5275,
      -1.3052,
      -0.6971,
      0.5275,
      -0.0,
      0.0486,
      1.8272,
      -0.0034,
      -0.0486,
      -1.8272,
      0.0034,
      5.0182,
      3.2044,
      3.5502,
      1.8061,
      -1.3632,
      3.5502,
      1.8061,
      -1.3632,
      -0.1622,
      -1.5986,
      -2.2538,
      0.1693,
      -1.5986,
      -2.2538,
      0.1693,
      -0.0,
      -0.0,
      -1.4349,
      -1.3394,
      -2.9479,
      1.4349,
      1.3394,
      2.9479,
      0.0,
      -1.7222,
      -2.5603,
      -0.7401,
      1.7222,
      2.5603,
      0.7401,
      0.0342,
      0.0,
      0.0,
      0.509,
      10.8093,
      17.5971,
      -0.509,
      -10.8093,
      -17.5971,
      -0.0,
      -0.7687,
      -3.2834,
      -4.1064,
      0.7687,
      3.2834,
      4.1064,
      3.0012,
      0.9954,
      1.0585,
      -0.9536,
      -2.2088,
      1.0585,
      -0.9536,
      -2.2088,
      -0.6656,
      -1.0927,
      -0.3564,
      -0.253,
      -1.0927,
      -0.3564,
      -0.253,
      0.0,
      0.0,
      -1.6205,
      -4.6884,
      -1.35,
      1.6205,
      4.6884,
      1.35,
      0.0,
      -0.242,
      -2.6187,
      -1.3141,
      0.242,
      2.6187,
      1.3141,
      0.3489,
      0.8606,
      -0.4585,
      -0.2759,
      -0.3201,
      -0.6678,
      -0.2759,
      -0.3201,
      -0.6678,
      -1.627,
      -1.4933,
      2.1374,
      1.3728,
      -1.4933,
      2.1374,
      1.3728,
      -0.0,
      -0.0,
      -0.004,
      -0.0821,
      0.3376,
      0.004,
      0.0821,
      -0.3376,
      -0.0,
      0.0052,
      1.3024,
      0.4057,
      -0.0052,
      -1.3024,
      -0.4057,
      -0.1864,
      -0.1545,
      -0.3366,
      -0.1,
      0.2178,
      -0.3366,
      -0.1,
      0.2178,
      -0.1611,
      -0.2455,
      1.9566,
      1.057,
      -0.2455,
      1.9566,
      1.057,
      0.0,
      0.7592,
      0.3554,
      0.3536,
      -0.4256,
      1.0514,
      0.3536,
      -0.4256,
      1.0514,
      -0.248,
      -0.4293,
      1.1763,
      -0.2402,
      -0.4293,
      1.1763,
      -0.2402,
      -0.0,
      -0.0,
      0.0164,
      1.3395,
      0.9135,
      -0.0164,
      -1.3395,
      -0.9135,
      -0.0,
      0.0097,
      -0.2799,
      0.8892,
      -0.0097,
      0.2799,
      -0.8892,
      -0.7663,
      -0.5586,
      -0.6315,
      -1.7429,
      -3.04,
      -0.6315,
      -1.7429,
      -3.04,
      -0.8024,
      -0.8807,
      -1.5672,
      -0.3387,
      -0.8807,
      -1.5672,
      -0.3387,
      0.0
    );

    this.weightaxis = new Array(
      6.973,
      1.7219,
      1.8664,
      3.6496,
      1.494,
      1.8664,
      3.6496,
      1.494,
      -4.5746,
      -4.5191,
      -4.7568,
      0.083,
      -4.5191,
      -4.7568,
      0.083,
      0.0,
      0.0,
      4.7193,
      9.7397,
      6.5968,
      -4.7193,
      -9.7397,
      -6.5968,
      0.0,
      -0.908,
      6.7928,
      4.662,
      0.908,
      -6.7928,
      -4.662,
      0.6928,
      -0.4293,
      -1.076,
      -0.5851,
      -8.5329,
      -1.076,
      -0.5851,
      -8.5329,
      2.0151,
      1.0205,
      2.1133,
      -1.6364,
      1.0205,
      2.1133,
      -1.6364,
      1.6544,
      -0.0,
      -0.0,
      0.8349,
      1.4477,
      2.3256,
      -0.8349,
      -1.4477,
      -2.3256,
      -0.0,
      -0.266,
      -0.0705,
      0.0047,
      0.266,
      0.0705,
      -0.0047,
      5.032,
      3.6561,
      3.8121,
      2.4318,
      -0.6998,
      3.8121,
      2.4318,
      -0.6998,
      1.1141,
      -0.3861,
      -3.9991,
      0.0932,
      -0.3861,
      -3.9991,
      0.0932,
      -0.0,
      -0.0,
      -1.087,
      -1.0509,
      -1.3231,
      1.087,
      1.0509,
      1.3231,
      0.0,
      -1.3526,
      -1.8515,
      -0.4634,
      1.3526,
      1.8515,
      0.4634,
      0.025,
      0.0,
      0.0,
      -1.1266,
      13.0445,
      27.9505,
      1.1266,
      -13.0445,
      -27.9505,
      -0.0,
      -1.7115,
      -6.304,
      -6.5835,
      1.7115,
      6.304,
      6.5835,
      3.0768,
      0.6769,
      0.5214,
      0.0959,
      -1.0736,
      0.5214,
      0.0959,
      -1.0736,
      -1.2313,
      -2.1019,
      -1.3776,
      0.8722,
      -2.1019,
      -1.3776,
      0.8722,
      -0.0,
      -0.0,
      -1.7648,
      -5.9763,
      3.0221,
      1.7648,
      5.9763,
      -3.0221,
      -0.0,
      -0.8134,
      -1.7552,
      0.9137,
      0.8134,
      1.7552,
      -0.9137,
      -0.1108,
      0.8746,
      -0.1604,
      0.1366,
      0.202,
      -1.6243,
      0.1366,
      0.202,
      -1.6243,
      -1.2071,
      -1.131,
      1.3775,
      0.889,
      -1.131,
      1.3775,
      0.889,
      -0.0,
      0.0,
      0.0204,
      -0.6587,
      0.0087,
      -0.0204,
      0.6587,
      -0.0087,
      -0.0,
      0.0023,
      2.6989,
      -0.3197,
      -0.0023,
      -2.6989,
      0.3197,
      0.6256,
      0.7438,
      0.6187,
      0.6658,
      0.051,
      0.6187,
      0.6658,
      0.051,
      0.7575,
      0.6524,
      1.6058,
      0.3235,
      0.6524,
      1.6058,
      0.3235,
      0.0,
      0.1745,
      -0.1345,
      -0.3261,
      -0.4966,
      2.1891,
      -0.3261,
      -0.4966,
      2.1891,
      -0.2848,
      -0.5012,
      0.1651,
      -0.829,
      -0.5012,
      0.1651,
      -0.829,
      -0.0,
      -0.0,
      -0.027,
      0.8621,
      1.0861,
      0.027,
      -0.8621,
      -1.0861,
      0.0,
      0.0661,
      -1.6331,
      0.4103,
      -0.0661,
      1.6331,
      -0.4103,
      -0.3379,
      -0.2144,
      -0.4283,
      -2.6192,
      -6.2112,
      -0.4283,
      -2.6192,
      -6.2112,
      -0.3549,
      -0.3261,
      -1.4313,
      -0.746,
      -0.3261,
      -1.4313,
      -0.746,
      0.0
    );

    this.nervousaxis = new Array(
      -1.0613,
      -0.821,
      -1.8043,
      -0.5157,
      2.1642,
      -1.8043,
      -0.5157,
      2.1642,
      5.2605,
      4.5031,
      -2.39,
      -3.1998,
      4.5031,
      -2.39,
      -3.1998,
      0.0,
      0.0,
      -3.4102,
      -8.8182,
      -7.2103,
      3.4102,
      8.8182,
      7.2103,
      0.0,
      -5.8844,
      -1.4642,
      -1.1988,
      5.8844,
      1.4642,
      1.1988,
      -0.3916,
      0.8593,
      2.6226,
      0.9413,
      3.8563,
      2.6226,
      0.9413,
      3.8563,
      -1.4308,
      -1.0478,
      -0.1072,
      1.2633,
      -1.0478,
      -0.1072,
      1.2633,
      -2.0459,
      0.0,
      0.0,
      0.6851,
      -1.1212,
      -2.9323,
      -0.6851,
      1.1212,
      2.9323,
      0.0,
      0.4078,
      0.8162,
      -0.0105,
      -0.4078,
      -0.8162,
      0.0105,
      -1.131,
      -1.2276,
      -0.885,
      -1.5478,
      -1.9061,
      -0.885,
      -1.5478,
      -1.9061,
      -1.837,
      -1.5449,
      1.8035,
      -0.5713,
      -1.5449,
      1.8035,
      -0.5713,
      0.0,
      0.0,
      -0.2618,
      -0.2242,
      -1.2652,
      0.2618,
      0.2242,
      1.2652,
      0.0,
      -0.1118,
      -0.5967,
      -0.5518,
      0.1118,
      0.5967,
      0.5518,
      0.0098,
      0.0,
      0.0,
      1.4701,
      -2.2455,
      -8.0535,
      -1.4701,
      2.2455,
      8.0535,
      0.0,
      0.3476,
      7.0096,
      9.1967,
      -0.3476,
      -7.0096,
      -9.1967,
      -0.8198,
      -0.2844,
      -0.3269,
      -0.0582,
      1.6457,
      -0.3269,
      -0.0582,
      1.6457,
      0.0296,
      0.6243,
      0.9555,
      -1.4787,
      0.6243,
      0.9555,
      -1.4787,
      0.0,
      0.0,
      0.9737,
      1.7411,
      -2.7311,
      -0.9737,
      -1.7411,
      2.7311,
      0.0,
      0.8674,
      -0.9704,
      -2.3,
      -0.8674,
      0.9704,
      2.3,
      0.6398,
      0.4121,
      0.4235,
      0.5171,
      -0.1811,
      0.2407,
      0.5171,
      -0.1811,
      0.2407,
      -0.1691,
      -0.2593,
      0.9991,
      -0.0256,
      -0.2593,
      0.9991,
      -0.0256,
      -0.0,
      -0.0,
      -0.0541,
      0.456,
      -0.1225,
      0.0541,
      -0.456,
      0.1225,
      -0.0,
      0.0223,
      -1.7969,
      1.084,
      -0.0223,
      1.7969,
      -1.084,
      -0.0926,
      -0.0788,
      0.0659,
      0.585,
      1.1687,
      0.0659,
      0.585,
      1.1687,
      -0.1082,
      -0.1027,
      0.7602,
      1.2296,
      -0.1027,
      0.7602,
      1.2296,
      0.0,
      0.6338,
      0.4057,
      0.7086,
      0.7916,
      -0.505,
      0.7086,
      0.7916,
      -0.505,
      0.0052,
      0.0977,
      1.0338,
      0.6793,
      0.0977,
      1.0338,
      0.6793,
      0.0,
      0.0,
      0.0979,
      0.3352,
      -0.0231,
      -0.0979,
      -0.3352,
      0.0231,
      0.0,
      -0.0186,
      1.3285,
      -0.1588,
      0.0186,
      -1.3285,
      0.1588,
      -1.6219,
      -1.5165,
      -1.5348,
      -0.8587,
      0.4141,
      -1.5348,
      -0.8587,
      0.4141,
      -1.6525,
      -1.7025,
      -0.6022,
      0.6399,
      -1.7025,
      -0.6022,
      0.6399,
      0.0
    );

    this.happyaxis = new Array(
      -8.6794,
      -1.7747,
      -1.5481,
      4.31,
      6.9911,
      -1.5481,
      4.31,
      6.9911,
      3.1253,
      2.5996,
      -2.806,
      -4.9278,
      2.5996,
      -2.806,
      -4.9278,
      0.0,
      0.0,
      0.962,
      2.0038,
      -2.0868,
      -0.962,
      -2.0038,
      2.0868,
      0.0,
      -0.9153,
      0.6929,
      0.8262,
      0.9153,
      -0.6929,
      -0.8262,
      -0.5683,
      -2.8263,
      0.6213,
      1.5682,
      8.4073,
      0.6213,
      1.5682,
      8.4073,
      -5.6247,
      -5.2527,
      -1.6787,
      -0.5363,
      -5.2527,
      -1.6787,
      -0.5363,
      -1.5082,
      -0.0,
      -0.0,
      0.1326,
      0.0334,
      -1.2031,
      -0.1326,
      -0.0334,
      1.2031,
      -0.0,
      -0.0166,
      1.402,
      -0.0094,
      0.0166,
      -1.402,
      0.0094,
      -1.8669,
      -1.0253,
      -1.2861,
      0.692,
      2.3059,
      -1.2861,
      0.692,
      2.3059,
      0.7367,
      1.1667,
      0.9416,
      0.7376,
      1.1667,
      0.9416,
      0.7376,
      0.0,
      0.0,
      0.9646,
      1.7762,
      1.7615,
      -0.9646,
      -1.7762,
      -1.7615,
      0.0,
      0.0193,
      0.2822,
      -0.9076,
      -0.0193,
      -0.2822,
      0.9076,
      -0.0079,
      0.0,
      0.0,
      0.0118,
      -14.4016,
      -31.9493,
      -0.0118,
      14.4016,
      31.9493,
      0.0,
      1.5234,
      8.486,
      10.9683,
      -1.5234,
      -8.486,
      -10.9683,
      1.1512,
      0.2682,
      0.824,
      -3.3852,
      -3.056,
      0.824,
      -3.3852,
      -3.056,
      -0.0806,
      0.6421,
      0.6678,
      0.588,
      0.6421,
      0.6678,
      0.588,
      -0.0,
      -0.0,
      -1.2401,
      -0.6639,
      -12.6719,
      1.2401,
      0.6639,
      12.6719,
      -0.0,
      1.287,
      0.509,
      -1.4226,
      -1.287,
      -0.509,
      1.4226,
      0.4348,
      0.0625,
      0.7678,
      0.512,
      0.0455,
      1.0448,
      0.512,
      0.0455,
      1.0448,
      0.7228,
      0.7156,
      0.7774,
      -1.725,
      0.7156,
      0.7774,
      -1.725,
      -0.0,
      -0.0,
      0.1379,
      -0.5607,
      0.1023,
      -0.1379,
      0.5607,
      -0.1023,
      0.0,
      0.0211,
      -0.3209,
      -0.1831,
      -0.0211,
      0.3209,
      0.1831,
      -1.31,
      -1.3459,
      -1.5276,
      -2.2644,
      -2.1648,
      -1.5276,
      -2.2644,
      -2.1648,
      -1.2943,
      -1.2589,
      -0.9913,
      0.4115,
      -1.2589,
      -0.9913,
      0.4115,
      0.0,
      0.1264,
      0.1792,
      0.1448,
      -0.8062,
      -2.4713,
      0.1448,
      -0.8062,
      -2.4713,
      0.0947,
      0.1504,
      -0.1653,
      0.3469,
      0.1504,
      -0.1653,
      0.3469,
      0.0,
      -0.0,
      -0.1554,
      -0.1843,
      -1.0699,
      0.1554,
      0.1843,
      1.0699,
      -0.0,
      -0.0887,
      0.5868,
      0.6541,
      0.0887,
      -0.5868,
      -0.6541,
      -2.398,
      -2.3095,
      -2.0347,
      0.5274,
      6.2302,
      -2.0347,
      0.5274,
      6.2302,
      -2.2071,
      -2.223,
      -0.5295,
      -0.113,
      -2.223,
      -0.5295,
      -0.113,
      0.0
    );
  }
}
