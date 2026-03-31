import { Bridge, getQuery } from "./bridge.js";
import { getRandomResultMessage } from "./result-messages.js";
import { getTrack } from "./track-data.js";

const Phaser = window.Phaser;
const query = getQuery();
const track = getTrack(query.track, query.seed);
const bridge = new Bridge(query);
const PHYSICS_DT_CAP_MS = 33.333;
const SPEED_SCALE = 1.25;
const PLAYER_SPEED_SCALE = 1.31824;
const PLAYER_TURN_SCALE = 1.25;
const TOP_SPEED_FORWARD = 320 * SPEED_SCALE;
const TOP_SPEED_OFFROAD = 226 * SPEED_SCALE;
const TOP_SPEED_REVERSE = -105 * SPEED_SCALE;
const DISPLAY_TOP_SPEED_KMH = 220;
const CAR_SCALE = 0.765;
const PLAYER_DISPLAY_WIDTH = 41 * CAR_SCALE;
const PLAYER_DISPLAY_HEIGHT = 78 * CAR_SCALE;
const RIVAL_DISPLAY_WIDTH = 40 * CAR_SCALE;
const RIVAL_DISPLAY_HEIGHT = 75 * CAR_SCALE;
const PLAYER_COLLISION_HALF_WIDTH = 11 * CAR_SCALE;
const PLAYER_COLLISION_HALF_LENGTH = 24 * CAR_SCALE;
const RIVAL_COLLISION_HALF_WIDTH = 11 * CAR_SCALE;
const RIVAL_COLLISION_HALF_LENGTH = 23 * CAR_SCALE;
const RIVAL_LANE_CHOICES = [-18, 0, 18];
const RIVAL_LANE_CHANGE_SPEED = 42;
const RIVAL_STRAIGHT_SWAP_MARGIN = 90;
const RIVAL_LANE_SETTLE_EPSILON = 0.35;
const RIVAL_GLOBAL_SPEED_SCALE = 1.1;
const RIVAL_ASSIGNED_SPEED_BOOST = 1.1;
const RIVAL_SPEED_VARIATION_RANGE = 0.1;
const RIVAL_FINISH_CLEARANCE = 160;
const CHECKPOINT_GATE_HALF_WIDTH_RATIO = 0.54;
const CHECKPOINT_DETECTION_RADIUS = PLAYER_COLLISION_HALF_LENGTH + 10;
const RIVAL_COLLISION_PENALTY_MS = 1000;
const RIVAL_COLLISION_SPEED_CAP = 115 * SPEED_SCALE;
const RIVAL_COLLISION_SPEED_RETENTION = 0.6;
const RIVAL_COLLISION_SPEED_FLOOR = 46 * SPEED_SCALE;
const RIVAL_CURVE_LANE_BLEND_START = 0.1;
const RIVAL_CURVE_LANE_BLEND_END = 0.34;
const RIVAL_CURVE_MIN_LANE_SCALE = 0.18;
const OFFROAD_GRIP = 0.59;
const OFFROAD_ACCEL = 542 * SPEED_SCALE;
const OFFROAD_BRAKE = 552 * SPEED_SCALE;
const OFFROAD_DECELERATION_FACTOR = 0.9895;
const RIVAL_CAR_CONFIGS = [
  { startDistance: 110, speed: 224 * SPEED_SCALE, laneOffset: -18, tint: 0x4ec7ff },
  { startDistance: 190, speed: 240 * SPEED_SCALE, laneOffset: 18, tint: 0xffd24a },
  { startDistance: 270, speed: 256 * SPEED_SCALE, laneOffset: -18, tint: 0xff7a59 },
  { startDistance: 350, speed: 272 * SPEED_SCALE, laneOffset: 18, tint: 0x8ce86f },
  { startDistance: 430, speed: 288 * SPEED_SCALE, laneOffset: 0, tint: 0xff69c7 },
];

if (query.embed) {
  document.body.classList.add("embed");
}

const ui = {
  title: document.getElementById("hudTitle"),
  sub: document.getElementById("hudSub"),
  goal: document.getElementById("goalPill"),
  time: document.getElementById("timeValue"),
  speed: document.getElementById("speedValue"),
  checkpoints: document.getElementById("checkpointValue"),
  position: document.getElementById("positionValue"),
  status: document.getElementById("statusTag"),
  message: document.getElementById("messageText"),
  retryBtn: document.getElementById("retryBtn"),
  closeBtn: document.getElementById("closeBtn"),
  resultPopup: document.getElementById("resultPopup"),
  resultPosition: document.getElementById("resultPositionText"),
  resultSub: document.getElementById("resultPositionSub"),
  submitTxBtn: document.getElementById("submitTxBtn"),
};

const inputState = {
  left: false,
  right: false,
  gas: false,
  brake: false,
  inputEnabled: true,
};

const CONTROL_KEYS = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "gas",
  ArrowDown: "brake",
  a: "left",
  d: "right",
  w: "gas",
  s: "brake",
};

function setMessage(text) {
  ui.message.textContent = text;
}

function setStatus(text, color = "#76e59a") {
  ui.status.textContent = text;
  ui.status.style.color = color;
}

function hideResultPopup() {
  ui.resultPopup.classList.remove("visible");
  if (ui.submitTxBtn) {
    ui.submitTxBtn.hidden = true;
    ui.submitTxBtn.disabled = false;
    ui.submitTxBtn.textContent = "Enviar transaccion";
  }
}

function showResultPopup(position, totalRacers, timeSec, message) {
  ui.resultPosition.textContent = `P${position}`;
  ui.resultSub.textContent = `${message} Terminaste ${position} de ${totalRacers} en ${timeSec}s.`;
  ui.resultPopup.classList.add("visible");
}

function setSubmitTxAvailability(enabled, busy = false) {
  if (!ui.submitTxBtn) return;
  ui.submitTxBtn.hidden = !enabled;
  ui.submitTxBtn.disabled = !enabled || busy;
  ui.submitTxBtn.textContent = busy ? "Enviando..." : "Enviar transaccion";
}

function setRetryAvailability(enabled) {
  if (!ui.retryBtn) return;
  ui.retryBtn.disabled = !enabled;
  ui.retryBtn.hidden = !enabled;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function moveToward(value, target, maxDelta) {
  if (Math.abs(target - value) <= maxDelta) {
    return target;
  }
  return value + Math.sign(target - value) * maxDelta;
}

function shuffleArray(values) {
  const copy = values.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const swapIndex = Math.floor(Math.random() * (i + 1));
    const temp = copy[i];
    copy[i] = copy[swapIndex];
    copy[swapIndex] = temp;
  }
  return copy;
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / Math.max(edge1 - edge0, 0.0001), 0, 1);
  return t * t * (3 - 2 * t);
}

function toDisplaySpeed(speedValue) {
  return Math.round(clamp(speedValue / TOP_SPEED_FORWARD, 0, 1) * DISPLAY_TOP_SPEED_KMH);
}

function formatRacePosition(position, total) {
  return `${position} / ${total}`;
}

function getPenaltyTimeMs(collisionCount) {
  return collisionCount * RIVAL_COLLISION_PENALTY_MS;
}

function normalizeDistance(trackPath, dist) {
  if (!trackPath.isLoop || trackPath.totalLength <= 0) {
    return clamp(dist, 0, trackPath.totalLength);
  }
  const wrapped = dist % trackPath.totalLength;
  return wrapped < 0 ? wrapped + trackPath.totalLength : wrapped;
}

function buildSegments(points, isLoop = false) {
  const segments = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    segments.push({ a, b, len, start: total, end: total + len });
    total += len;
  }

  if (isLoop && points.length > 2) {
    const a = points[points.length - 1];
    const b = points[0];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    segments.push({ a, b, len, start: total, end: total + len });
    total += len;
  }

  return { segments, totalLength: total, isLoop };
}

function getHeadingAtDistance(trackPath, dist) {
  const safeDist = normalizeDistance(trackPath, dist);
  for (const segment of trackPath.segments) {
    if (safeDist <= segment.end) {
      return Math.atan2(segment.b.y - segment.a.y, segment.b.x - segment.a.x);
    }
  }
  const last = trackPath.segments[trackPath.segments.length - 1];
  return Math.atan2(last.b.y - last.a.y, last.b.x - last.a.x);
}

function getSegmentStateAtDistance(trackPath, dist) {
  const safeDist = normalizeDistance(trackPath, dist);
  for (let index = 0; index < trackPath.segments.length; index += 1) {
    const segment = trackPath.segments[index];
    if (safeDist <= segment.end) {
      return {
        segment,
        index,
        distanceToStart: safeDist - segment.start,
        distanceToEnd: segment.end - safeDist,
      };
    }
  }

  const index = trackPath.segments.length - 1;
  const segment = trackPath.segments[index];
  return {
    segment,
    index,
    distanceToStart: segment.len,
    distanceToEnd: 0,
  };
}

function getSmoothHeadingAtDistance(trackPath, dist, sampleWindow = 10) {
  const before = getPointAtDistance(trackPath, dist - sampleWindow);
  const after = getPointAtDistance(trackPath, dist + sampleWindow);
  return Math.atan2(after.y - before.y, after.x - before.x);
}

function getCurveIntensityAtDistance(trackPath, dist, sampleWindow = 18) {
  const before = getSmoothHeadingAtDistance(trackPath, dist - sampleWindow, 8);
  const after = getSmoothHeadingAtDistance(trackPath, dist + sampleWindow, 8);
  return Math.abs(Phaser.Math.Angle.Wrap(after - before));
}

function drawTrackStripe(graphics, center, heading, halfWidth, outerColor, innerColor = null) {
  const normal = heading + Math.PI / 2;
  const cos = Math.cos(normal);
  const sin = Math.sin(normal);
  const startX = center.x - cos * halfWidth;
  const startY = center.y - sin * halfWidth;
  const endX = center.x + cos * halfWidth;
  const endY = center.y + sin * halfWidth;

  graphics.lineStyle(14, outerColor, 1);
  graphics.beginPath();
  graphics.moveTo(startX, startY);
  graphics.lineTo(endX, endY);
  graphics.strokePath();

  if (innerColor !== null) {
    graphics.lineStyle(6, innerColor, 0.95);
    graphics.beginPath();
    graphics.moveTo(startX + cos * 18, startY + sin * 18);
    graphics.lineTo(endX + cos * 18, endY + sin * 18);
    graphics.strokePath();
  }
}

function getGateSegment(center, heading, halfWidth) {
  const normal = heading + Math.PI / 2;
  const cos = Math.cos(normal);
  const sin = Math.sin(normal);
  return {
    startX: center.x - cos * halfWidth,
    startY: center.y - sin * halfWidth,
    endX: center.x + cos * halfWidth,
    endY: center.y + sin * halfWidth,
  };
}

function drawCheckpointGate(graphics, center, heading, halfWidth, passed = false) {
  graphics.clear();
  drawTrackStripe(
    graphics,
    center,
    heading,
    halfWidth,
    passed ? 0x76e59a : 0xffcf4c,
    passed ? 0xb6ffd0 : 0xfff3b0
  );
}

function assetUrl(relativePath) {
  return new URL("../" + relativePath, import.meta.url).href;
}

function getPointAtDistance(trackPath, dist) {
  const safeDist = normalizeDistance(trackPath, dist);
  for (const segment of trackPath.segments) {
    if (safeDist <= segment.end) {
      const t = segment.len === 0 ? 0 : (safeDist - segment.start) / segment.len;
      return {
        x: lerp(segment.a.x, segment.b.x, t),
        y: lerp(segment.a.y, segment.b.y, t),
      };
    }
  }
  const last = trackPath.segments[trackPath.segments.length - 1];
  return { x: last.b.x, y: last.b.y };
}

function getPointAtDistanceExtended(trackPath, dist) {
  if (trackPath.isLoop) {
    return getPointAtDistance(trackPath, dist);
  }
  if (dist <= trackPath.totalLength) {
    return getPointAtDistance(trackPath, dist);
  }

  const last = trackPath.segments[trackPath.segments.length - 1];
  const heading = Math.atan2(last.b.y - last.a.y, last.b.x - last.a.x);
  const overshoot = dist - trackPath.totalLength;
  return {
    x: last.b.x + Math.cos(heading) * overshoot,
    y: last.b.y + Math.sin(heading) * overshoot,
  };
}

function getOffsetPointAtDistance(trackPath, dist, lateralOffset = 0) {
  const point = getPointAtDistanceExtended(trackPath, dist);
  const heading = getHeadingAtDistance(trackPath, dist);
  const normal = heading + Math.PI / 2;
  return {
    x: point.x + Math.cos(normal) * lateralOffset,
    y: point.y + Math.sin(normal) * lateralOffset,
    heading,
  };
}

function getRivalLaneOffsetAtDistance(trackPath, dist, baseLaneOffset) {
  const curveIntensity = getCurveIntensityAtDistance(trackPath, dist, 24);
  const curveBlend = smoothstep(RIVAL_CURVE_LANE_BLEND_START, RIVAL_CURVE_LANE_BLEND_END, curveIntensity);
  const laneScale = lerp(1, RIVAL_CURVE_MIN_LANE_SCALE, curveBlend);
  return baseLaneOffset * laneScale;
}


function pointToSegmentDistanceSquared(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const denom = abx * abx + aby * aby;
  const t = denom === 0 ? 0 : clamp((apx * abx + apy * aby) / denom, 0, 1);
  const cx = ax + abx * t;
  const cy = ay + aby * t;
  return {
    distSq: (px - cx) ** 2 + (py - cy) ** 2,
    t,
    x: cx,
    y: cy,
  };
}

function getNearestPointOnPath(trackPath, x, y) {
  let best = {
    distSq: Number.POSITIVE_INFINITY,
    segmentIndex: -1,
    distanceAlong: 0,
    x: 0,
    y: 0,
  };

  trackPath.segments.forEach((segment, index) => {
    const res = pointToSegmentDistanceSquared(x, y, segment.a.x, segment.a.y, segment.b.x, segment.b.y);
    if (res.distSq < best.distSq) {
      best = {
        distSq: res.distSq,
        segmentIndex: index,
        distanceAlong: segment.start + res.t * segment.len,
        x: res.x,
        y: res.y,
      };
    }
  });

  best.distance = Math.sqrt(best.distSq);
  return best;
}

function getSafeDecorationPlacement(trackPath, x, y, minDistance) {
  const roadState = getNearestPointOnPath(trackPath, x, y);
  if (roadState.distance >= minDistance) {
    return { x, y };
  }

  let dx = x - roadState.x;
  let dy = y - roadState.y;
  if (dx * dx + dy * dy < 0.001) {
    const heading = getHeadingAtDistance(trackPath, roadState.distanceAlong);
    dx = Math.cos(heading + Math.PI / 2);
    dy = Math.sin(heading + Math.PI / 2);
  }

  const length = Math.hypot(dx, dy) || 1;
  return {
    x: roadState.x + (dx / length) * minDistance,
    y: roadState.y + (dy / length) * minDistance,
  };
}

function getBounds(points, padding = 240) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs) - padding;
  const minY = Math.min(...ys) - padding;
  const maxX = Math.max(...xs) + padding;
  const maxY = Math.max(...ys) + padding;
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function createLinearRenderPath(points) {
  const path = new Phaser.Curves.Path(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    path.lineTo(points[i].x, points[i].y);
  }
  return path;
}

function buildTrackRenderData(points, isLoop = false) {
  const renderPath = createLinearRenderPath(points);
  if (isLoop && points.length > 2) {
    renderPath.lineTo(points[0].x, points[0].y);
  }
  return {
    renderPath,
    followPath: buildSegments(points, isLoop),
  };
}

function drawRoadLayer(graphics, renderPath, thickness, color, alpha = 1) {
  const radius = thickness * 0.5;
  const sampleCount = Math.max(24, Math.ceil(renderPath.getLength() / 10));
  const points = renderPath.getSpacedPoints(sampleCount);

  graphics.fillStyle(color, alpha);
  points.forEach((point) => {
    graphics.fillCircle(point.x, point.y, radius);
  });
}

function drawDashedCenterLine(graphics, renderPath, dashLength, gapLength, color, alpha = 1) {
  graphics.lineStyle(6, color, alpha);
  const points = renderPath.getPoints(160);

  let carry = 0;
  let drawDash = true;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const segmentLength = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
    let consumed = 0;

    while (consumed < segmentLength) {
      const patternLength = drawDash ? dashLength : gapLength;
      const remainingInPattern = patternLength - carry;
      const step = Math.min(remainingInPattern, segmentLength - consumed);
      const startT = consumed / segmentLength;
      const endT = (consumed + step) / segmentLength;
      const startX = lerp(a.x, b.x, startT);
      const startY = lerp(a.y, b.y, startT);
      const endX = lerp(a.x, b.x, endT);
      const endY = lerp(a.y, b.y, endT);

      if (drawDash) {
        graphics.beginPath();
        graphics.moveTo(startX, startY);
        graphics.lineTo(endX, endY);
        graphics.strokePath();
      }

      consumed += step;
      carry += step;
      if (carry >= patternLength - 0.001) {
        carry = 0;
        drawDash = !drawDash;
      }
    }
  }
}

function getRearWheelAnchors(car, angle) {
  const backwardX = Math.cos(angle) * 18;
  const backwardY = Math.sin(angle) * 18;
  const lateralX = Math.cos(angle + Math.PI / 2) * 11;
  const lateralY = Math.sin(angle + Math.PI / 2) * 11;
  const rearCenter = {
    x: car.x - backwardX,
    y: car.y - backwardY,
  };

  return {
    rearCenter,
    rearLeft: {
      x: rearCenter.x - lateralX,
      y: rearCenter.y - lateralY,
    },
    rearRight: {
      x: rearCenter.x + lateralX,
      y: rearCenter.y + lateralY,
    },
    exhaust: {
      x: rearCenter.x - Math.cos(angle) * 16,
      y: rearCenter.y - Math.sin(angle) * 16,
    },
  };
}

function getCarCollisionState(playerSprite, playerAngle, rivalSprite) {
  const rivalHeading = rivalSprite.rotation - Math.PI / 2;
  const relX = playerSprite.x - rivalSprite.x;
  const relY = playerSprite.y - rivalSprite.y;

  const rivalForwardX = Math.cos(rivalHeading);
  const rivalForwardY = Math.sin(rivalHeading);
  const rivalRightX = Math.cos(rivalHeading + Math.PI / 2);
  const rivalRightY = Math.sin(rivalHeading + Math.PI / 2);

  const playerForwardX = Math.cos(playerAngle);
  const playerForwardY = Math.sin(playerAngle);
  const playerRightX = Math.cos(playerAngle + Math.PI / 2);
  const playerRightY = Math.sin(playerAngle + Math.PI / 2);

  const lateral = relX * rivalRightX + relY * rivalRightY;
  const longitudinal = relX * rivalForwardX + relY * rivalForwardY;

  const projectedHalfWidth =
    Math.abs(playerRightX * rivalRightX + playerRightY * rivalRightY) * PLAYER_COLLISION_HALF_WIDTH +
    Math.abs(playerForwardX * rivalRightX + playerForwardY * rivalRightY) * PLAYER_COLLISION_HALF_LENGTH;

  const projectedHalfLength =
    Math.abs(playerRightX * rivalForwardX + playerRightY * rivalForwardY) * PLAYER_COLLISION_HALF_WIDTH +
    Math.abs(playerForwardX * rivalForwardX + playerForwardY * rivalForwardY) * PLAYER_COLLISION_HALF_LENGTH;

  const limitLateral = RIVAL_COLLISION_HALF_WIDTH + projectedHalfWidth;
  const limitLongitudinal = RIVAL_COLLISION_HALF_LENGTH + projectedHalfLength;
  const overlapLateral = limitLateral - Math.abs(lateral);
  const overlapLongitudinal = limitLongitudinal - Math.abs(longitudinal);
  const colliding = overlapLateral > 0 && overlapLongitudinal > 0;

  return {
    colliding,
    lateral,
    longitudinal,
    overlapLateral,
    overlapLongitudinal,
    rivalHeading,
  };
}

function bindKeyboard() {
  window.addEventListener("keydown", (event) => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    const control = CONTROL_KEYS[key];
    if (!control) return;
    inputState[control] = true;
  });

  window.addEventListener("keyup", (event) => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    const control = CONTROL_KEYS[key];
    if (!control) return;
    inputState[control] = false;
  });
}

function bindTouchControls() {
  const buttons = document.querySelectorAll(".control-btn");
  buttons.forEach((button) => {
    const control = button.dataset.control;
    const activate = (event) => {
      event.preventDefault();
      if (!inputState.inputEnabled) return;
      inputState[control] = true;
      button.classList.add("active");
    };
    const release = (event) => {
      event.preventDefault();
      inputState[control] = false;
      button.classList.remove("active");
    };

    button.addEventListener("pointerdown", activate);
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("pointerleave", release);
  });
}

class RaceScene extends Phaser.Scene {
  constructor() {
    super("RaceScene");
    this.isLoopTrack = !!track.loop;
    this.totalLaps = Math.max(1, Number(track.laps) || 1);
    this.trackPath = buildSegments(track.path, this.isLoopTrack);
    this.smoothedTrack = buildTrackRenderData(track.path, this.isLoopTrack);
    this.bounds = getBounds(track.path);
    this.raceDistance = this.trackPath.totalLength * this.totalLaps;
    this.car = null;
    this.carState = null;
    this.checkpoints = [];
    this.nextCheckpointIndex = 0;
    this.state = "boot";
    this.timerMs = 0;
    this.countdownRemaining = 3;
    this.countdownEndsAt = 0;
    this.countdownGoEndsAt = 0;
    this.hits = 0;
    this.wasOffroad = false;
    this.readySent = false;
    this.resultSent = false;
    this.overlayText = null;
    this.skidGraphics = null;
    this.lastWheelAnchors = null;
    this.rivals = [];
    this.lastRivalCollisionAt = 0;
    this.collisionCount = 0;
    this.playerRaceProgress = 0;
    this.playerPosition = 1;
    this.finalPosition = null;
    this.currentLap = 1;
    this.finishGate = null;
    this.finishGateArmed = false;
    this.lastFinishTriggerAt = 0;
    this.totalRacers = RIVAL_CAR_CONFIGS.length + 1;
    this.lastResultMessage = "";
    this.lastResultPayload = null;
  }

  preload() {
    const img = (key, relativePath) => this.load.image(key, assetUrl(relativePath));
    img("car_track", "car_optimized.png");
    img("tree_large", "assets_v1/props/tree_large.png");
    img("tree_small", "assets_v1/props/tree_small.png");
    img("tree_green_small", "assets_v1/props/tree_green_small.png");
    img("barrier_white_race", "assets_v1/props/barrier_white_race.png");
    img("barrier_red_race", "assets_v1/props/barrier_red_race.png");
    img("tribune_overhang_striped", "assets_v1/props/tribune_overhang_striped.png");
    img("tribune_full", "assets_v1/props/tribune_full.png");
    img("tent_red", "assets_v1/props/tent_red.png");
    img("tent_blue", "assets_v1/props/tent_blue.png");
    img("lights", "assets_v1/props/lights.png");
    img("tires_white", "assets_v1/props/tires_white.png");
    img("barrel_red_top", "assets_v1/props/barrel_red_top.png");
    img("cone_straight", "assets_v1/props/cone_straight.png");
    img("light_yellow", "assets_v1/props/light_yellow.png");
    img("fence_yellow", "assets_v1/props/fence_yellow.png");
  }

  create() {
    this.cameras.main.setBackgroundColor("#0a141e");
    this.cameras.main.setBounds(this.bounds.x, this.bounds.y, this.bounds.width, this.bounds.height);
    this.physics.world.setBounds(this.bounds.x, this.bounds.y, this.bounds.width, this.bounds.height);

    ui.title.textContent = track.name;
    ui.sub.textContent = `${track.theme.replace(/_/g, " ")} - Car #${query.car || "-"}${this.isLoopTrack ? ` - ${this.totalLaps} laps` : ""}`;
    ui.goal.textContent = `Goal ${query.limit}s - ${this.isLoopTrack ? `${this.totalLaps} laps - ` : ""}Par ${track.parTime}s`;

    this.createBackdrop();
    this.createRoad();
    this.createDecorations();
    this.createMarkers();
    this.createCar();
    this.createRivals();
    this.createParticles();
    this.createOverlay();
    this.setupCheckpoints();
    this.restartRace();

    if (!this.readySent) {
      bridge.sendReady(track);
      this.readySent = true;
    }

    bridge.onReset = () => this.restartRace();
    bridge.onStart = () => this.restartRace(true);
    bridge.onInput = (enabled) => {
      inputState.inputEnabled = enabled;
      if (!enabled) {
        inputState.left = false;
        inputState.right = false;
        inputState.gas = false;
        inputState.brake = false;
      }
    };

    setRetryAvailability(false);
    setSubmitTxAvailability(false);

    ui.retryBtn.addEventListener("click", () => {
      if (ui.retryBtn.disabled) return;
      this.restartRace();
    });
    const requestSubmitTx = (event) => {
      event?.preventDefault?.();
      if (!this.lastResultPayload || ui.submitTxBtn.disabled) return;
      setSubmitTxAvailability(true, true);
      setMessage("Solicitando firma de la transaccion en el juego...");
      bridge.sendSubmit(this.lastResultPayload);
    };
    ui.submitTxBtn?.addEventListener("click", requestSubmitTx);
    ui.submitTxBtn?.addEventListener("pointerup", requestSubmitTx);
    ui.closeBtn.addEventListener("click", () => {
      bridge.sendClose();
      window.close();
    });

    setMessage(this.isLoopTrack ? `Listo para ${this.totalLaps} vueltas. 3, 2, 1...` : "Listo para probar la primera pista Phaser. 3, 2, 1...");
    setStatus("COUNTDOWN", "#ffcf4c");
  }

  createBackdrop() {
    const g = this.add.graphics();
    g.fillStyle(0x103523, 1);
    g.fillRect(this.bounds.x - 320, this.bounds.y - 320, this.bounds.width + 640, this.bounds.height + 640);

    const accents = this.add.graphics();
    accents.fillStyle(0x163d2f, 0.18);
    for (let i = 0; i < 24; i += 1) {
      accents.fillCircle(
        Phaser.Math.Between(this.bounds.x - 40, this.bounds.x + this.bounds.width + 40),
        Phaser.Math.Between(this.bounds.y - 40, this.bounds.y + this.bounds.height + 40),
        Phaser.Math.Between(12, 28)
      );
    }
  }

  createRoad() {
    const road = this.add.graphics();
    drawRoadLayer(road, this.smoothedTrack.renderPath, track.roadWidth + 34, 0xe6edf5, 0.92);
    drawRoadLayer(road, this.smoothedTrack.renderPath, track.roadWidth + 14, 0x233546, 0.88);
    drawRoadLayer(road, this.smoothedTrack.renderPath, track.roadWidth, 0x454c55, 1);
    drawRoadLayer(road, this.smoothedTrack.renderPath, track.roadWidth - 28, 0x505962, 0.45);

    const centerLine = this.add.graphics();
    drawDashedCenterLine(centerLine, this.smoothedTrack.renderPath, 54, 34, 0xffd65f, 0.96);
  }

  createDecorations() {
    const layer = this.add.layer();
    track.decorations.forEach((decor) => {
      const image = this.add.image(0, 0, decor.texture);
      image.setScale(decor.scale || 1);
      image.setAngle(decor.angle || 0);
      const minDistance =
        track.roadWidth * 0.52 +
        Math.max(image.displayWidth, image.displayHeight) * 0.34 +
        (decor.trackPadding || 0);
      const safePos = getSafeDecorationPlacement(this.trackPath, decor.x, decor.y, minDistance);
      image.setPosition(safePos.x, safePos.y);
      layer.add(image);
    });
  }

  createMarkers() {
    const startPos = track.path[0];
    const startHeading = getHeadingAtDistance(this.trackPath, 10);
    this.finishGate = getGateSegment(startPos, startHeading, track.roadWidth * 0.45);

    const startLine = this.add.graphics();
    if (this.isLoopTrack) {
      drawTrackStripe(startLine, startPos, startHeading, track.roadWidth * 0.45, 0xffffff, 0xffcf4c);
      return;
    }

    const finishPos = track.path[track.path.length - 1];
    const finishHeading = getHeadingAtDistance(this.trackPath, this.trackPath.totalLength - 10);
    drawTrackStripe(startLine, startPos, startHeading, track.roadWidth * 0.45, 0xffcf4c);

    const finishLine = this.add.graphics();
    drawTrackStripe(finishLine, finishPos, finishHeading, track.roadWidth * 0.45, 0xffffff, 0xff5f5f);
  }

  getSpawnState() {
    const spawnDistance = this.isLoopTrack ? 18 : 10;
    const spawnPoint = getPointAtDistance(this.trackPath, spawnDistance);
    const startHeading = getHeadingAtDistance(this.trackPath, spawnDistance);
    return { spawnPoint, startHeading };
  }

  createCar() {
    const { spawnPoint, startHeading } = this.getSpawnState();
    this.car = this.physics.add.image(spawnPoint.x, spawnPoint.y, "car_track");
    this.car.setDepth(10);
    this.car.setCollideWorldBounds(true);
    this.car.setDisplaySize(PLAYER_DISPLAY_WIDTH, PLAYER_DISPLAY_HEIGHT);
    this.car.body.setSize(this.car.displayWidth * 0.52, this.car.displayHeight * 0.74, true);
    this.carState = {
      angle: startHeading,
      speed: 0,
    };

    this.cameras.main.startFollow(this.car, false);
    this.cameras.main.setZoom(query.embed ? 0.62 : 0.76);
  }

  createRivals() {
    this.rivals = RIVAL_CAR_CONFIGS.map((config, index) => {
      const sprite = this.add.image(-1000, -1000, "car_track");
      sprite.setDisplaySize(RIVAL_DISPLAY_WIDTH, RIVAL_DISPLAY_HEIGHT);
      sprite.setDepth(9);
      sprite.setTint(config.tint);
      sprite.setAlpha(0.96);
      const assignedSpeed = config.speed * (track.rivalSpeedScale || 1) * RIVAL_GLOBAL_SPEED_SCALE;
      const boostedSpeed = assignedSpeed * RIVAL_ASSIGNED_SPEED_BOOST;
      return {
        id: `rival_${index}`,
        sprite,
        distance: config.startDistance,
        speed: boostedSpeed,
        baseSpeed: boostedSpeed,
        laneOffset: config.laneOffset,
        targetLaneOffset: config.laneOffset,
        tint: config.tint,
        nextLaneSwapAt: performance.now() + 1100 + index * 600,
        heading: Number.NaN,
        lastX: Number.NaN,
        lastY: Number.NaN,
        active: true,
      };
    });
  }

  assignRivalSpeedProfile() {
    const rivalCount = this.rivals.length;
    if (!rivalCount) return;

    const halfRange = RIVAL_SPEED_VARIATION_RANGE * 0.5;
    const speedScales = rivalCount === 1
      ? [1]
      : Array.from({ length: rivalCount }, (_, index) => {
          const t = index / (rivalCount - 1);
          return 1 - halfRange + t * RIVAL_SPEED_VARIATION_RANGE;
        });

    const shuffledScales = shuffleArray(speedScales);
    this.rivals.forEach((rival, index) => {
      rival.speed = rival.baseSpeed * shuffledScales[index];
    });
  }

  createParticles() {
    this.skidGraphics = this.add.graphics().setDepth(8);
  }

  createOverlay() {
    this.overlayText = this.add.text(track.path[0].x, track.path[0].y - 180, "", {
      fontFamily: "Segoe UI, sans-serif",
      fontSize: "72px",
      fontStyle: "700",
      color: "#ffffff",
      stroke: "#0c1116",
      strokeThickness: 10,
    }).setOrigin(0.5).setDepth(40);
  }

  setupCheckpoints() {
    this.checkpoints = track.checkpointFractions.map((fraction, index) => {
      const distance = this.trackPath.totalLength * fraction;
      const point = getPointAtDistance(this.trackPath, distance);
      const heading = getHeadingAtDistance(this.trackPath, distance);
      const halfWidth = track.roadWidth * CHECKPOINT_GATE_HALF_WIDTH_RATIO;
      const marker = this.add.graphics().setDepth(6);
      drawCheckpointGate(marker, point, heading, halfWidth, false);
      const labelOffset = getGateSegment(point, heading + Math.PI / 2, 38);
      const label = this.add.text(point.x, point.y, `${index + 1}`, {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "18px",
        fontStyle: "700",
        color: "#fff7d6",
      }).setOrigin(0.5).setDepth(7);
      label.setPosition(labelOffset.endX, labelOffset.endY);
      const gate = getGateSegment(point, heading, halfWidth);
      return { point, heading, halfWidth, gate, marker, label, passed: false };
    });
    this.updateProgressHud();
  }

  updateProgressHud() {
    if (this.isLoopTrack) {
      ui.checkpoints.textContent = `L${this.currentLap}/${this.totalLaps} C${this.nextCheckpointIndex}/${this.checkpoints.length}`;
      return;
    }
    ui.checkpoints.textContent = `${this.nextCheckpointIndex} / ${this.checkpoints.length}`;
  }

  resetCheckpointState() {
    this.nextCheckpointIndex = 0;
    this.checkpoints.forEach((checkpoint, index) => {
      checkpoint.passed = false;
      drawCheckpointGate(checkpoint.marker, checkpoint.point, checkpoint.heading, checkpoint.halfWidth, false);
      checkpoint.label.setText(`${index + 1}`);
      checkpoint.label.setColor("#fff7d6");
    });
    this.updateProgressHud();
  }

  restartRace(skipCountdown = false) {
    const { spawnPoint, startHeading } = this.getSpawnState();
    this.car.setPosition(spawnPoint.x, spawnPoint.y);
    this.car.setVelocity(0, 0);
    this.carState.angle = startHeading;
    this.carState.speed = 0;
    this.car.setRotation(startHeading + Math.PI / 2);
    this.timerMs = 0;
    this.countdownRemaining = skipCountdown ? 0 : 3;
    this.countdownEndsAt = skipCountdown ? 0 : performance.now() + 3000;
    this.countdownGoEndsAt = skipCountdown ? 0 : this.countdownEndsAt + 350;
    this.state = skipCountdown ? "running" : "countdown";
    this.hits = 0;
    this.wasOffroad = false;
    this.resultSent = false;
    this.nextCheckpointIndex = 0;
    this.lastWheelAnchors = null;
    this.lastRivalCollisionAt = 0;
    this.collisionCount = 0;
    this.playerRaceProgress = 0;
    this.playerPosition = this.totalRacers;
    this.finalPosition = null;
    this.currentLap = 1;
    this.finishGateArmed = false;
    this.lastFinishTriggerAt = 0;
    this.lastResultMessage = this.lastResultMessage || "";
    this.resetCheckpointState();

    ui.time.textContent = "0.00s";
    ui.speed.textContent = "0 km/h";
    ui.position.textContent = formatRacePosition(this.playerPosition, this.totalRacers);
    setRetryAvailability(false);
    setSubmitTxAvailability(false);
    hideResultPopup();
    this.skidGraphics.clear();
    this.resetRivals();
    this.updateOverlay(skipCountdown ? "GO!" : "3");
    setMessage(
      skipCountdown
        ? (this.isLoopTrack ? `Carrera reiniciada. Completa ${this.totalLaps} vueltas.` : "Carrera reiniciada. Ya podes acelerar.")
        : "Nueva salida. Espera el countdown."
    );
    setStatus(skipCountdown ? "RUN" : "COUNTDOWN", skipCountdown ? "#76e59a" : "#ffcf4c");
  }

  resetRivals() {
    this.assignRivalSpeedProfile();
    this.rivals.forEach((rival, index) => {
      rival.distance = RIVAL_CAR_CONFIGS[index].startDistance;
      rival.laneOffset = RIVAL_CAR_CONFIGS[index].laneOffset;
      rival.targetLaneOffset = RIVAL_CAR_CONFIGS[index].laneOffset;
      rival.nextLaneSwapAt = performance.now() + 1000 + index * 450;
      rival.heading = Number.NaN;
      rival.lastX = Number.NaN;
      rival.lastY = Number.NaN;
      rival.active = true;
      this.positionRival(rival, 0, true);
    });
  }

  positionRival(rival, dt = 0, snapRotation = false) {
    const centerTrack = this.smoothedTrack.followPath;
    const visibleDistance = this.isLoopTrack ? normalizeDistance(centerTrack, rival.distance) : rival.distance;
    if (!rival.active || rival.distance < 0) {
      rival.sprite.setVisible(false);
      return;
    }

    if (rival.distance > this.raceDistance + RIVAL_FINISH_CLEARANCE) {
      rival.active = false;
      rival.sprite.setVisible(false);
      return;
    }

    rival.sprite.setVisible(true);
    const laneOffset = getRivalLaneOffsetAtDistance(centerTrack, visibleDistance, rival.laneOffset);
    const point = getOffsetPointAtDistance(centerTrack, visibleDistance, laneOffset);
    rival.sprite.setPosition(point.x, point.y);

    let desiredHeading = point.heading;
    if (Number.isFinite(rival.lastX) && Number.isFinite(rival.lastY)) {
      const dx = point.x - rival.lastX;
      const dy = point.y - rival.lastY;
      if (dx * dx + dy * dy > 0.04) {
        desiredHeading = Math.atan2(dy, dx);
      }
    }

    if (snapRotation || !Number.isFinite(rival.heading) || this.state === "countdown" || this.state === "boot") {
      rival.heading = desiredHeading;
    } else {
      rival.heading = Phaser.Math.Angle.RotateTo(rival.heading, desiredHeading, 5.8 * dt);
    }

    rival.lastX = point.x;
    rival.lastY = point.y;
    rival.sprite.setRotation(rival.heading + Math.PI / 2);
  }

  updateRivals(dt, nowMs) {
    this.rivals.forEach((rival) => {
      if (!rival.active) return;
      const segmentState = getSegmentStateAtDistance(this.smoothedTrack.followPath, rival.distance);
      const isStraightInterior =
        segmentState.distanceToStart >= RIVAL_STRAIGHT_SWAP_MARGIN &&
        segmentState.distanceToEnd >= RIVAL_STRAIGHT_SWAP_MARGIN;

      if (
        nowMs >= rival.nextLaneSwapAt &&
        isStraightInterior &&
        Math.abs(rival.laneOffset - rival.targetLaneOffset) <= RIVAL_LANE_SETTLE_EPSILON
      ) {
        const options = RIVAL_LANE_CHOICES.filter((lane) => lane !== rival.targetLaneOffset);
        rival.targetLaneOffset = options[Math.floor(Math.random() * options.length)];
        rival.nextLaneSwapAt = nowMs + 1800 + Math.random() * 2200;
      } else if (nowMs >= rival.nextLaneSwapAt && !isStraightInterior) {
        rival.nextLaneSwapAt = nowMs + 250;
      }

      rival.laneOffset = moveToward(rival.laneOffset, rival.targetLaneOffset, RIVAL_LANE_CHANGE_SPEED * dt);
      rival.distance += rival.speed * dt;
      this.positionRival(rival, dt);
    });
  }

  resolveRivalBlocking() {
    for (const rival of this.rivals) {
      if (!rival.sprite.visible) continue;

      const collision = getCarCollisionState(this.car, this.carState.angle, rival.sprite);
      if (!collision.colliding) continue;

      const heading = collision.rivalHeading;
      const forwardX = Math.cos(heading);
      const forwardY = Math.sin(heading);
      const rightX = Math.cos(heading + Math.PI / 2);
      const rightY = Math.sin(heading + Math.PI / 2);

      let pushX;
      let pushY;
      let overlap;

      if (collision.overlapLateral < collision.overlapLongitudinal) {
        const side = collision.lateral >= 0 ? 1 : -1;
        pushX = rightX * side;
        pushY = rightY * side;
        overlap = collision.overlapLateral;
      } else {
        const side = collision.longitudinal >= 0 ? 1 : -1;
        pushX = forwardX * side;
        pushY = forwardY * side;
        overlap = collision.overlapLongitudinal;
      }

      this.car.x += pushX * (overlap + 1.5);
      this.car.y += pushY * (overlap + 1.5);
      this.car.body.reset(this.car.x, this.car.y);
      this.carState.speed = Math.min(this.carState.speed, RIVAL_COLLISION_SPEED_CAP);
    }
  }

  handleRivalCollisions(nowMs) {
    if (this.state !== "running") return;
    if (nowMs - this.lastRivalCollisionAt < 500) return;

    for (const rival of this.rivals) {
      if (!rival.sprite.visible) continue;
      const collision = getCarCollisionState(this.car, this.carState.angle, rival.sprite);
      if (!collision.colliding) continue;

      this.lastRivalCollisionAt = nowMs;
      this.collisionCount += 1;
      this.hits += 1;
      this.carState.speed = Math.max(this.carState.speed * RIVAL_COLLISION_SPEED_RETENTION, RIVAL_COLLISION_SPEED_FLOOR);
      this.carState.angle += (this.car.x < rival.sprite.x ? -0.12 : 0.12);
      setMessage(`Choque con un rival. Penalidad +${(RIVAL_COLLISION_PENALTY_MS / 1000).toFixed(2)}s. Total penalidad: ${(getPenaltyTimeMs(this.collisionCount) / 1000).toFixed(2)}s.`);
      break;
    }
  }

  updateOverlay(text) {
    this.overlayText.setText(text);
    this.overlayText.setAlpha(text ? 1 : 0);
    if (text) {
      this.overlayText.setPosition(this.car.x, this.car.y - 180);
    }
  }

  updateCheckpoints() {
    const checkpoint = this.checkpoints[this.nextCheckpointIndex];
    if (!checkpoint) return;
    const hit = pointToSegmentDistanceSquared(
      this.car.x,
      this.car.y,
      checkpoint.gate.startX,
      checkpoint.gate.startY,
      checkpoint.gate.endX,
      checkpoint.gate.endY
    );
    if (Math.sqrt(hit.distSq) <= CHECKPOINT_DETECTION_RADIUS) {
      checkpoint.passed = true;
      drawCheckpointGate(checkpoint.marker, checkpoint.point, checkpoint.heading, checkpoint.halfWidth, true);
      checkpoint.label.setText("OK");
      checkpoint.label.setColor("#b6ffd0");
      this.nextCheckpointIndex += 1;
      this.updateProgressHud();
      if (this.isLoopTrack && this.nextCheckpointIndex >= this.checkpoints.length) {
        setMessage(`Checkpoints completos. Cierra la vuelta ${this.currentLap}/${this.totalLaps} en la linea de meta.`);
      } else {
        setMessage(`Checkpoint ${this.nextCheckpointIndex} confirmado.`);
      }
    }
  }

  updateRacePosition(playerProgress = this.playerRaceProgress) {
    const normalizedPlayerProgress = clamp(playerProgress, 0, this.raceDistance + RIVAL_FINISH_CLEARANCE);
    this.playerRaceProgress = normalizedPlayerProgress;

    let place = 1;
    for (const rival of this.rivals) {
      const rivalProgress = clamp(rival.distance, 0, this.raceDistance + RIVAL_FINISH_CLEARANCE);
      if (rivalProgress > normalizedPlayerProgress + 1) {
        place += 1;
      }
    }

    this.playerPosition = place;
    ui.position.textContent = formatRacePosition(this.finalPosition ?? this.playerPosition, this.totalRacers);
  }

  handleFinish(nowMs) {
    if (this.nextCheckpointIndex < this.checkpoints.length) return;

    if (this.isLoopTrack) {
      const finishHit = pointToSegmentDistanceSquared(
        this.car.x,
        this.car.y,
        this.finishGate.startX,
        this.finishGate.startY,
        this.finishGate.endX,
        this.finishGate.endY
      );

      if (Math.sqrt(finishHit.distSq) > CHECKPOINT_DETECTION_RADIUS * 1.4) {
        this.finishGateArmed = true;
        return;
      }

      if (!this.finishGateArmed || nowMs - this.lastFinishTriggerAt < 900) return;

      this.lastFinishTriggerAt = nowMs;
      this.finishGateArmed = false;

      if (this.currentLap < this.totalLaps) {
        const completedLap = this.currentLap;
        this.currentLap += 1;
        this.playerRaceProgress = completedLap * this.trackPath.totalLength;
        this.resetCheckpointState();
        this.updateRacePosition(this.playerRaceProgress);
        setMessage(`Vuelta ${completedLap}/${this.totalLaps} completada. Empieza la vuelta ${this.currentLap}.`);
        return;
      }

      this.updateRacePosition(this.raceDistance);
    } else {
      const finish = track.path[track.path.length - 1];
      const dist = Phaser.Math.Distance.Between(this.car.x, this.car.y, finish.x, finish.y);
      if (dist > track.roadWidth * 0.44) return;
      this.updateRacePosition(this.trackPath.totalLength);
    }

    this.finalPosition = this.playerPosition;
    const effectiveTimeSec = Number(((this.timerMs + getPenaltyTimeMs(this.collisionCount)) / 1000).toFixed(2));
    const passedLimit = effectiveTimeSec <= query.limit;
    const resultMessage = getRandomResultMessage(this.finalPosition, this.totalRacers, this.lastResultMessage);
    this.lastResultMessage = resultMessage;
    this.lastResultPayload = {
      trackId: track.id,
      timeSec: effectiveTimeSec,
      hits: this.hits,
      checkpoints: this.checkpoints.length * this.totalLaps,
      position: this.finalPosition,
    };

    this.state = "finished";
    setStatus(passedLimit ? "FINISH" : "FAIL", passedLimit ? "#76e59a" : "#ff8f8f");
    ui.position.textContent = formatRacePosition(this.finalPosition, this.totalRacers);
    setMessage(
      passedLimit
        ? `Carrera completada en ${effectiveTimeSec}s${this.collisionCount ? ` con ${this.collisionCount}s de penalidad` : ""}. Presiona Enviar transaccion para continuar.`
        : `Tiempo final ${effectiveTimeSec}s. Necesitas ${query.limit}s o menos para desbloquear Run Race. Presiona Retry.`
    );
    this.updateOverlay("FINISH");
    showResultPopup(this.finalPosition, this.totalRacers, effectiveTimeSec, resultMessage);
    setRetryAvailability(!passedLimit);
    setSubmitTxAvailability(passedLimit);

    if (!this.resultSent) {
      this.resultSent = true;
      bridge.sendDone(this.lastResultPayload);
      if (query.embed && passedLimit) {
        [250, 750].forEach((delay) => {
          window.setTimeout(() => bridge.sendDone(this.lastResultPayload), delay);
        });
      }
    }
  }

  update(time, delta) {
    const dt = Math.min(delta, PHYSICS_DT_CAP_MS) / 1000;
    const nowMs = performance.now();

    if (this.state === "countdown") {
      if (nowMs < this.countdownEndsAt) {
        this.countdownRemaining = (this.countdownEndsAt - nowMs) / 1000;
        this.updateOverlay(String(Math.ceil(this.countdownRemaining)));
      } else if (nowMs < this.countdownGoEndsAt) {
        this.updateOverlay("GO!");
      } else {
        this.countdownRemaining = 0;
        this.state = "running";
        this.updateOverlay("");
        setStatus("RUN", "#76e59a");
        setMessage(
          this.isLoopTrack
            ? `Acelera, completa los checkpoints y cierra ${this.totalLaps} vueltas.`
            : "Acelera y completa los checkpoints antes de llegar a meta."
        );
      }
    }

    const roadState = getNearestPointOnPath(this.trackPath, this.car.x, this.car.y);
    const onRoad = roadState.distance <= track.roadWidth * 0.49;
    const roadGrip = onRoad ? 1 : OFFROAD_GRIP;
    const accel = (onRoad ? 920 : OFFROAD_ACCEL) * PLAYER_SPEED_SCALE;
    const brake = (onRoad ? 860 : OFFROAD_BRAKE) * PLAYER_SPEED_SCALE;
    const maxSpeed = (onRoad ? TOP_SPEED_FORWARD : TOP_SPEED_OFFROAD) * PLAYER_SPEED_SCALE;
    const maxReverse = TOP_SPEED_REVERSE * PLAYER_SPEED_SCALE;
    const turnRateBase = (onRoad ? 2.2 : 1.35) * PLAYER_TURN_SCALE * (track.playerTurnScale || 1);
    let turnDirection = 0;

    if (this.state === "running" && inputState.inputEnabled) {
      if (inputState.gas) {
        const throttleRatio = clamp(Math.abs(this.carState.speed) / maxSpeed, 0, 1);
        const throttleForce = accel * (0.42 + (1 - throttleRatio) * 0.92);
        this.carState.speed += throttleForce * dt;
      } else if (inputState.brake) {
        const brakeRatio = clamp(Math.abs(this.carState.speed) / Math.abs(maxReverse), 0, 1);
        const brakeForce = this.carState.speed > 0 ? brake : 240 * (0.6 + brakeRatio);
        this.carState.speed -= brakeForce * dt;
      } else {
        this.carState.speed = Phaser.Math.Linear(this.carState.speed, 0, clamp(4.8 * dt, 0, 1));
      }

      if (Math.abs(this.carState.speed) > 18) {
        turnDirection = (inputState.left ? -1 : 0) + (inputState.right ? 1 : 0);
        const speedFactor = clamp(Math.abs(this.carState.speed) / maxSpeed, 0.18, 1);
        this.carState.angle += turnDirection * turnRateBase * speedFactor * dt;
      }
    } else {
      this.carState.speed = Phaser.Math.Linear(this.carState.speed, 0, clamp(3.6 * dt, 0, 1));
    }

    this.carState.speed = clamp(this.carState.speed, maxReverse, maxSpeed);
    if (!onRoad) {
      this.carState.speed *= OFFROAD_DECELERATION_FACTOR;
    }

    const vx = Math.cos(this.carState.angle) * this.carState.speed * roadGrip;
    const vy = Math.sin(this.carState.angle) * this.carState.speed * roadGrip;
    const speedAbs = Math.abs(this.carState.speed);
    const steerStrength = Math.abs(turnDirection);
    const driftStrength = onRoad ? clamp((speedAbs - 150) / 260, 0, 1) * steerStrength : 0;

    this.car.body.setVelocity(vx, vy);
    this.car.setRotation(this.carState.angle + Math.PI / 2);
    if (this.state === "running") {
      this.updateRivals(dt, nowMs);
    }
    this.handleRivalCollisions(nowMs);
    this.resolveRivalBlocking();
    const playerProgress = this.isLoopTrack
      ? ((this.currentLap - 1) * this.trackPath.totalLength) + roadState.distanceAlong
      : roadState.distanceAlong;
    this.updateRacePosition(playerProgress);

    if (this.state === "running") {
      this.timerMs += delta;
      const effectiveTimeSec = (this.timerMs + getPenaltyTimeMs(this.collisionCount)) / 1000;
      ui.time.textContent = `${effectiveTimeSec.toFixed(2)}s`;
      if (effectiveTimeSec > query.limit) {
        this.state = "timeout";
        setRetryAvailability(true);
        setStatus("TIME", "#ff8f8f");
        setMessage(`Tiempo agotado. Objetivo: ${query.limit}s. Presiona Retry para intentar de nuevo.`);
        this.updateOverlay("TIME");
      } else {
        this.updateCheckpoints();
        this.handleFinish(nowMs);
      }
    }

    if (!onRoad && !this.wasOffroad && Math.abs(this.carState.speed) > 120) {
      this.hits += 1;
      this.wasOffroad = true;
      setMessage(
        this.isLoopTrack
          ? `Saliste de la pista. Recupera traccion y sigue hacia el checkpoint ${Math.min(this.nextCheckpointIndex + 1, this.checkpoints.length)} de la vuelta ${this.currentLap}.`
          : `Saliste de la pista. Recupera traccion y sigue hacia el checkpoint ${Math.min(this.nextCheckpointIndex + 1, this.checkpoints.length)}.`
      );
    } else if (onRoad) {
      this.wasOffroad = false;
    }

    const wheelAnchors = getRearWheelAnchors(this.car, this.carState.angle);

    const isDrifting = this.state === "running" && onRoad && driftStrength > 0.18;
    const isHardBraking = this.state === "running" && onRoad && inputState.brake && speedAbs > 140;

    if ((isDrifting || isHardBraking) && this.lastWheelAnchors) {
      this.skidGraphics.lineStyle(isHardBraking ? 2.6 : 2.1, 0x1f1a1a, isHardBraking ? 0.24 : 0.18);
      this.skidGraphics.beginPath();
      this.skidGraphics.moveTo(this.lastWheelAnchors.rearLeft.x, this.lastWheelAnchors.rearLeft.y);
      this.skidGraphics.lineTo(wheelAnchors.rearLeft.x, wheelAnchors.rearLeft.y);
      this.skidGraphics.moveTo(this.lastWheelAnchors.rearRight.x, this.lastWheelAnchors.rearRight.y);
      this.skidGraphics.lineTo(wheelAnchors.rearRight.x, wheelAnchors.rearRight.y);
      this.skidGraphics.strokePath();
    }

    this.lastWheelAnchors = wheelAnchors;

    ui.speed.textContent = `${toDisplaySpeed(Math.abs(this.carState.speed))} km/h`;
    if (this.state === "running") {
      setStatus("RUN", onRoad ? "#76e59a" : "#ffcf4c");
    }

    if (this.state === "finished" || this.state === "timeout") {
      this.car.body.setVelocity(this.car.body.velocity.x * 0.96, this.car.body.velocity.y * 0.96);
      this.carState.speed *= 0.97;
    }

    if (this.overlayText.alpha > 0) {
      this.overlayText.setPosition(this.car.x, this.car.y - 180);
    }
  }
}

bindKeyboard();
bindTouchControls();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  parent: "game-root",
  backgroundColor: "#09121b",
  pixelArt: true,
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: 0 },
      debug: false,
    },
  },
  render: {
    antialias: false,
    pixelArt: true,
    roundPixels: true,
    powerPreference: "high-performance",
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [RaceScene],
});

window.__MR_PHASER_GAME__ = game;
