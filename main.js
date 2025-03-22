// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75, window.innerWidth / window.innerHeight, 0.1, 1000
);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Starfield background
const starsGeometry = new THREE.BufferGeometry();
const starsMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.05 });
const starsVertices = [];
for (let i = 0; i < 10000; i++) {
  starsVertices.push(
    (Math.random() - 0.5) * 2000,
    (Math.random() - 0.5) * 2000,
    (Math.random() - 0.5) * 2000
  );
}
starsGeometry.setAttribute(
  'position',
  new THREE.Float32BufferAttribute(starsVertices, 3)
);
scene.add(new THREE.Points(starsGeometry, starsMaterial));

// Lighting
scene.add(new THREE.AmbientLight(0x404040));
scene.add(new THREE.PointLight(0xffffff, 1.5, 1000));

// Containers for solar system bodies
const celestialBodies = {};
const orbits = {};
const moons = {}; // { planetName: { moonName: THREE.Mesh } }
const moonOrbits = {}; // { planetName: { moonName: { orbit: THREE.Line, angle, speed, a, e } } }

/* 
  Define orbit data with real astronomical parameters scaled so that Earth's
  semi-major axis is 10 units.
  a: semi-major axis, e: eccentricity, size: relative size.
*/
const orbitData = {
  mercury: { a: 3.87, e: 0.2056, size: 0.38, color: 0xaaaaaa, orbitColor: 0x444444 },
  venus:   { a: 7.23, e: 0.0068, size: 0.95, color: 0xd6bb87, orbitColor: 0x444444 },
  earth:   { a: 10,   e: 0.0167, size: 1,    color: 0x2233ff, orbitColor: 0x444444 },
  mars:    { a: 15.24, e: 0.0934, size: 0.53, color: 0xaa4444, orbitColor: 0x444444 },
  jupiter: { a: 52.03, e: 0.0489, size: 11.2, color: 0xd8ca9d, orbitColor: 0x444444 },
  saturn:  { a: 95.7,  e: 0.0565, size: 9.45, color: 0xf0e2a9, orbitColor: 0x444444 },
  uranus:  { a: 191.9, e: 0.0457, size: 4.0,  color: 0xaaaaff, orbitColor: 0x444444 },
  neptune: { a: 300.7, e: 0.0113, size: 3.88, color: 0x5555ff, orbitColor: 0x444444 }
};

// Moon data: { a: semi-major axis (scaled), e: eccentricity, size: relative size, color }
const moonData = {
  earth: {
    moon: { a: 1.2, e: 0.0549, size: 0.27, color: 0xaaaaaa, orbitColor: 0x555555 }
  },
  mars: {
    phobos: { a: 0.3, e: 0.0151, size: 0.02, color: 0x8c5523, orbitColor: 0x555555 },
    deimos: { a: 0.7, e: 0.0002, size: 0.01, color: 0x8c5523, orbitColor: 0x555555 }
  },
  jupiter: {
    io: { a: 1.4, e: 0.0041, size: 0.29, color: 0xffff99, orbitColor: 0x555555 },
    europa: { a: 2.2, e: 0.0094, size: 0.25, color: 0xcccccc, orbitColor: 0x555555 },
    ganymede: { a: 3.6, e: 0.0013, size: 0.41, color: 0x999999, orbitColor: 0x555555 },
    callisto: { a: 6.3, e: 0.0074, size: 0.38, color: 0x666666, orbitColor: 0x555555 }
  },
  saturn: {
    titan: { a: 4.1, e: 0.0288, size: 0.40, color: 0xffcc66, orbitColor: 0x555555 }
  },
  uranus: {
    titania: { a: 1.5, e: 0.0011, size: 0.12, color: 0x99ccff, orbitColor: 0x555555 }
  },
  neptune: {
    triton: { a: 1.2, e: 0.000016, size: 0.21, color: 0x66ccff, orbitColor: 0x555555 }
  }
};

// Create the Sun
const sun = new THREE.Mesh(
  new THREE.SphereGeometry(2.5, 32, 32),
  new THREE.MeshBasicMaterial({ color: 0xffff00 })
);
scene.add(sun);
celestialBodies.sun = sun;

// Create a planet with an elliptical orbit
function createPlanet(name, data) {
  const geometry = new THREE.SphereGeometry(data.size * 0.5, 32, 32);
  const material = new THREE.MeshPhongMaterial({
    color: data.color,
    specular: 0x444444,
    shininess: 30
  });
  const planet = new THREE.Mesh(geometry, material);

  const initialAngle = Math.random() * Math.PI * 2;
  const r = data.a * (1 - data.e * data.e) / (1 + data.e * Math.cos(initialAngle));
  planet.position.set(r * Math.cos(initialAngle), 0, r * Math.sin(initialAngle));
  scene.add(planet);

  const orbitGeometry = new THREE.BufferGeometry();
  const orbitMaterial = new THREE.LineBasicMaterial({ color: data.orbitColor });
  const orbitPoints = [];
  const segments = 128;
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    const rOrbit = data.a * (1 - data.e * data.e) / (1 + data.e * Math.cos(theta));
    orbitPoints.push(rOrbit * Math.cos(theta), 0, rOrbit * Math.sin(theta));
  }
  orbitGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(orbitPoints, 3)
  );
  const orbitLine = new THREE.Line(orbitGeometry, orbitMaterial);
  scene.add(orbitLine);

  const baseSpeed = 0.01;
  const speed = baseSpeed * Math.pow(10 / data.a, 1.5);

  celestialBodies[name] = planet;
  orbits[name] = { orbit: orbitLine, angle: initialAngle, speed: speed, a: data.a, e: data.e };
}

// Create a moon orbiting a planet
function createMoon(planetName, moonName, moonInfo) {
  const planet = celestialBodies[planetName];
  if (!planet) return;

  const geometry = new THREE.SphereGeometry(moonInfo.size * 0.5, 16, 16);
  const material = new THREE.MeshPhongMaterial({
    color: moonInfo.color,
    specular: 0x444444,
    shininess: 20
  });
  const moon = new THREE.Mesh(geometry, material);

  const initialAngle = Math.random() * Math.PI * 2;
  const r = moonInfo.a * (1 - moonInfo.e * moonInfo.e) / (1 + moonInfo.e * Math.cos(initialAngle));
  const offsetX = r * Math.cos(initialAngle);
  const offsetZ = r * Math.sin(initialAngle);
  moon.position.set(
    planet.position.x + offsetX,
    planet.position.y,
    planet.position.z + offsetZ
  );
  scene.add(moon);

  const orbitGeometry = new THREE.BufferGeometry();
  const orbitMaterial = new THREE.LineBasicMaterial({ color: moonInfo.orbitColor });
  const orbitPoints = [];
  const segments = 64;
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    const rOrbit = moonInfo.a * (1 - moonInfo.e * moonInfo.e) / (1 + moonInfo.e * Math.cos(theta));
    orbitPoints.push(rOrbit * Math.cos(theta), 0, rOrbit * Math.sin(theta));
  }
  orbitGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(orbitPoints, 3)
  );
  const orbitLine = new THREE.Line(orbitGeometry, orbitMaterial);
  orbitLine.position.copy(planet.position);
  scene.add(orbitLine);

  const baseSpeed = 0.05;
  const speed = baseSpeed * Math.pow(1 / moonInfo.a, 1.5);

  if (!moons[planetName]) moons[planetName] = {};
  if (!moonOrbits[planetName]) moonOrbits[planetName] = {};
  moons[planetName][moonName] = moon;
  moonOrbits[planetName][moonName] = {
    orbit: orbitLine,
    angle: initialAngle,
    speed: speed,
    a: moonInfo.a,
    e: moonInfo.e
  };
}

// Create all planets and moons
Object.keys(orbitData).forEach(planet => {
  createPlanet(planet, orbitData[planet]);
});
Object.keys(moonData).forEach(planetName => {
  const planetMoons = moonData[planetName];
  Object.keys(planetMoons).forEach(moonName => {
    createMoon(planetName, moonName, planetMoons[moonName]);
  });
});

// --- Asteroid Belt Setup ---
const asteroidBeltRadius = 40;
const numberOfAsteroids = 4100;
const asteroidPositions = new Float32Array(numberOfAsteroids * 3);
const asteroidAngles = new Float32Array(numberOfAsteroids);
const asteroidDistances = new Float32Array(numberOfAsteroids);
for (let i = 0; i < numberOfAsteroids; i++) {
  const angle = Math.random() * Math.PI * 2;
  asteroidAngles[i] = angle;
  const distance = asteroidBeltRadius + (Math.random() * 10 - 5);
  asteroidDistances[i] = distance;
  asteroidPositions[i * 3] = distance * Math.cos(angle);
  asteroidPositions[i * 3 + 1] = Math.random() * 5 - 2.5;
  asteroidPositions[i * 3 + 2] = distance * Math.sin(angle);
}
const asteroidGeometry = new THREE.BufferGeometry();
asteroidGeometry.setAttribute('position', new THREE.BufferAttribute(asteroidPositions, 3));
const asteroidMaterial = new THREE.PointsMaterial({ color: 0xaaaaaa, size: 0.1 });
const asteroidBelt = new THREE.Points(asteroidGeometry, asteroidMaterial);
scene.add(asteroidBelt);

// Trajectory line and simulation control variables
let trajectoryLine;
let animationId;
let simRunning = true;
let simSpeed = 1;
let currentView = "heliocentric";
let scale = 1;

// Set initial camera position
camera.position.set(0, 30, 50);
camera.lookAt(new THREE.Vector3(0, 0, 0));

// Basic orbit controls (mouse drag & zoom)
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };
document.addEventListener('mousedown', e => {
  isDragging = true;
  previousMousePosition = { x: e.clientX, y: e.clientY };
});
document.addEventListener('mouseup', () => { isDragging = false; });
document.addEventListener('mousemove', e => {
  if (!isDragging) return;
  const deltaMove = { x: e.clientX - previousMousePosition.x, y: e.clientY - previousMousePosition.y };
  if (currentView !== "spacecraft") {
    camera.position.x += deltaMove.x * 0.05;
    camera.position.y -= deltaMove.y * 0.05;
    camera.lookAt(new THREE.Vector3(0, 0, 0));
  }
  previousMousePosition = { x: e.clientX, y: e.clientY };
});
document.addEventListener('wheel', e => {
  const zoomFactor = e.deltaY * 0.001;
  camera.position.multiplyScalar(1 + zoomFactor);
  if (camera.position.length() < 5) camera.position.normalize().multiplyScalar(5);
  if (camera.position.length() > 500) camera.position.normalize().multiplyScalar(500);
});

// UI Controls
document.getElementById('scale').addEventListener('input', function() {
  scale = parseFloat(this.value);
  document.getElementById('scale-value').textContent = scale.toFixed(1) + 'x';
  Object.keys(orbitData).forEach(planet => {
    const data = orbitData[planet];
    const planetObj = celestialBodies[planet];
    const orbitObj = orbits[planet].orbit;
    planetObj.scale.set(scale, scale, scale);
    const orbitPoints = [];
    const segments = 128;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const rOrbit = data.a * (1 - data.e * data.e) / (1 + data.e * Math.cos(theta));
      orbitPoints.push(rOrbit * Math.cos(theta), 0, rOrbit * Math.sin(theta));
    }
    orbitObj.geometry.dispose();
    orbitObj.geometry = new THREE.BufferGeometry();
    orbitObj.geometry.setAttribute('position', new THREE.Float32BufferAttribute(orbitPoints, 3));
  });
  Object.keys(moonData).forEach(planetName => {
    const planetMoons = moonData[planetName];
    Object.keys(planetMoons).forEach(moonName => {
      const moonInfo = planetMoons[moonName];
      const moonObj = moons[planetName][moonName];
      const orbitObj = moonOrbits[planetName][moonName].orbit;
      moonObj.scale.set(scale, scale, scale);
      const orbitPoints = [];
      const segments = 64;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const rOrbit = moonInfo.a * (1 - moonInfo.e * moonInfo.e) / (1 + moonInfo.e * Math.cos(theta));
        orbitPoints.push(rOrbit * Math.cos(theta), 0, rOrbit * Math.sin(theta));
      }
      orbitObj.geometry.dispose();
      orbitObj.geometry = new THREE.BufferGeometry();
      orbitObj.geometry.setAttribute('position', new THREE.Float32BufferAttribute(orbitPoints, 3));
    });
  });
});

document.getElementById('view-dropdown').addEventListener('change', function() {
  currentView = this.value;
  if (currentView === "heliocentric") {
    gsap.to(camera.position, { 
      x: 0, y: 30, z: 50, duration: 1.5,
      onUpdate: () => { camera.lookAt(new THREE.Vector3(0, 0, 0)); }
    });
  } else if (currentView === "geocentric") {
    const earthPos = celestialBodies.earth.position.clone();
    gsap.to(camera.position, { 
      x: earthPos.x, y: earthPos.y + 5, z: earthPos.z + 10, duration: 1.5,
      onUpdate: () => { camera.lookAt(earthPos); }
    });
  } else {
    const planetPos = celestialBodies[currentView].position.clone();
    gsap.to(camera.position, { 
      x: planetPos.x, y: planetPos.y + 5, z: planetPos.z + 10, duration: 1.5,
      onUpdate: () => { camera.lookAt(planetPos); }
    });
  }
});

document.getElementById('play').addEventListener('click', () => { simRunning = true; });
document.getElementById('pause').addEventListener('click', () => { simRunning = false; });
document.getElementById('rewind').addEventListener('click', () => {
  simSpeed = Math.max(0.1, simSpeed / 2);
  updateSpeedDisplay();
});
document.getElementById('forward').addEventListener('click', () => {
  simSpeed = Math.min(10, simSpeed * 2);
  updateSpeedDisplay();
});
document.getElementById('speed').addEventListener('input', function() {
  simSpeed = parseFloat(this.value);
  updateSpeedDisplay();
});
function updateSpeedDisplay() {
  document.getElementById('speed-value').textContent = simSpeed.toFixed(1) + 'x';
  document.getElementById('speed').value = simSpeed;
}

// Trajectory planning controls
let launchVelocity = 30;
let launchAngle = 0;
document.getElementById('velocity').addEventListener('input', function() {
  launchVelocity = parseInt(this.value);
  document.getElementById('velocity-value').textContent = launchVelocity + ' km/s';
});
document.getElementById('angle').addEventListener('input', function() {
  launchAngle = parseInt(this.value);
  document.getElementById('angle-value').textContent = launchAngle + '°';
});
document.getElementById('plan-trajectory').addEventListener('click', () => {
  planTrajectory(launchVelocity, launchAngle);
});
document.getElementById('clear-trajectory').addEventListener('click', () => {
  clearTrajectory();
});
document.getElementById('load-mission').addEventListener('click', () => {
  const mission = document.getElementById('mission-dropdown').value;
  loadMission(mission);
});

// Fullscreen functionality
document.getElementById('fullscreen-btn').addEventListener('click', toggleFullScreen);
function toggleFullScreen() {
  if (
    !document.fullscreenElement &&
    !document.mozFullScreenElement &&
    !document.webkitFullscreenElement &&
    !document.msFullscreenElement
  ) {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
    } else if (document.documentElement.mozRequestFullScreen) {
      document.documentElement.mozRequestFullScreen();
    } else if (document.documentElement.webkitRequestFullscreen) {
      document.documentElement.webkitRequestFullscreen();
    } else if (document.documentElement.msRequestFullscreen) {
      document.documentElement.msRequestFullscreen();
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
  }
}

// Trajectory planning function
function planTrajectory(velocity, angle) {
  clearTrajectory();
  const points = [];
  const earthPos = celestialBodies.earth.position.clone();
  points.push(earthPos.x, earthPos.y, earthPos.z);
  const radianAngle = (angle * Math.PI) / 180;
  let vx = velocity * Math.cos(radianAngle) * 0.05;
  let vz = velocity * Math.sin(radianAngle) * 0.05;
  let x = earthPos.x, y = 0, z = earthPos.z;
  for (let i = 0; i < 1000; i++) {
    const dx = -x, dz = -z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    const force = distance > 0.1 ? 1 / (distance * distance) : 0;
    const ax = distance > 0.1 ? (dx / distance) * force * 0.1 : 0;
    const az = distance > 0.1 ? (dz / distance) * force * 0.1 : 0;
    vx += ax; vz += az;
    x += vx; z += vz;
    points.push(x, y, z);
  }
  const trajectoryGeometry = new THREE.BufferGeometry();
  trajectoryGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(points, 3)
  );
  const trajectoryMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00 });
  trajectoryLine = new THREE.Line(trajectoryGeometry, trajectoryMaterial);
  scene.add(trajectoryLine);
}

function clearTrajectory() {
  if (trajectoryLine) {
    scene.remove(trajectoryLine);
    trajectoryLine.geometry.dispose();
    trajectoryLine.material.dispose();
    trajectoryLine = undefined;
  }
}

// Historical mission trajectories
function loadMission(mission) {
  clearTrajectory();
  let points = [];
  const earthPos = celestialBodies.earth.position.clone();
  switch (mission) {
    case "apollo11": {
      const moonPos = new THREE.Vector3(earthPos.x + 12, earthPos.y, earthPos.z);
      const cp = new THREE.Vector3((earthPos.x + moonPos.x) / 2, 15, (earthPos.z + moonPos.z) / 2);
      for (let i = 0; i <= 100; i++) {
        const t = i / 100;
        const x = (1 - t) * (1 - t) * earthPos.x + 2 * (1 - t) * t * cp.x + t * t * moonPos.x;
        const y = (1 - t) * (1 - t) * earthPos.y + 2 * (1 - t) * t * cp.y + t * t * moonPos.y;
        const z = (1 - t) * (1 - t) * earthPos.z + 2 * (1 - t) * t * cp.z + t * t * moonPos.z;
        points.push(x, y, z);
      }
      break;
    }
    case "venera7": {
      const venusPos = celestialBodies.venus ? celestialBodies.venus.position.clone() : new THREE.Vector3(7.23, 0, 0);
      const cp = new THREE.Vector3((earthPos.x + venusPos.x) / 2, 10, (earthPos.z + venusPos.z) / 2);
      for (let i = 0; i <= 100; i++) {
        const t = i / 100;
        const x = (1 - t) * (1 - t) * earthPos.x + 2 * (1 - t) * t * cp.x + t * t * venusPos.x;
        const y = (1 - t) * (1 - t) * earthPos.y + 2 * (1 - t) * t * cp.y + t * t * venusPos.y;
        const z = (1 - t) * (1 - t) * earthPos.z + 2 * (1 - t) * t * cp.z + t * t * venusPos.z;
        points.push(x, y, z);
      }
      break;
    }
    case "apollo13": {
      const moonPos = new THREE.Vector3(earthPos.x + 12, earthPos.y, earthPos.z);
      const cp = new THREE.Vector3((earthPos.x + moonPos.x) / 2, 20, (earthPos.z + moonPos.z) / 2);
      for (let i = 0; i <= 100; i++) {
        const t = i / 100;
        const x = (1 - t) * (1 - t) * earthPos.x + 2 * (1 - t) * t * cp.x + t * t * moonPos.x;
        const y = (1 - t) * (1 - t) * earthPos.y + 2 * (1 - t) * t * cp.y + t * t * moonPos.y;
        const z = (1 - t) * (1 - t) * earthPos.z + 2 * (1 - t) * t * cp.z + t * t * moonPos.z;
        points.push(x, y, z);
      }
      break;
    }
    case "voyager1": {
      const jupiterPos = celestialBodies.jupiter.position.clone();
      for (let i = 0; i <= 50; i++) {
        const t = i / 50;
        const x = earthPos.x + (jupiterPos.x - earthPos.x) * t;
        const z = earthPos.z + (jupiterPos.z - earthPos.z) * t;
        const y = Math.sin(t * Math.PI) * 2;
        points.push(x, y, z);
      }
      for (let i = 0; i <= 20; i++) {
        const t = i / 20;
        const angle = Math.PI * 1.4 + t * Math.PI * 0.6;
        const flybyRadius = 3;
        points.push(
          jupiterPos.x + flybyRadius * Math.cos(angle),
          Math.sin(t * Math.PI) * 1.5,
          jupiterPos.z + flybyRadius * Math.sin(angle)
        );
      }
      for (let i = 0; i <= 30; i++) {
        const t = i / 30;
        const exitVector = new THREE.Vector3(
          jupiterPos.x * 0.2,
          t * 10,
          jupiterPos.z * 0.2
        );
        points.push(
          jupiterPos.x + exitVector.x,
          exitVector.y,
          jupiterPos.z + exitVector.z
        );
      }
      break;
    }
    case "voyager2": {
      const jupiterPos = celestialBodies.jupiter.position.clone();
      const saturnPos = celestialBodies.saturn.position.clone();
      const uranusPos = celestialBodies.uranus.position.clone();
      const neptunePos = celestialBodies.neptune.position.clone();
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        const x = earthPos.x + (jupiterPos.x - earthPos.x) * t;
        const z = earthPos.z + (jupiterPos.z - earthPos.z) * t;
        const y = Math.sin(t * Math.PI) * 1.5;
        points.push(x, y, z);
      }
      for (let i = 0; i <= 15; i++) {
        const t = i / 15;
        const angle = Math.PI * 1.3 + t * Math.PI * 0.7;
        const flybyRadius = 3;
        points.push(
          jupiterPos.x + flybyRadius * Math.cos(angle),
          Math.sin(t * Math.PI) * 1,
          jupiterPos.z + flybyRadius * Math.sin(angle)
        );
      }
      for (let i = 0; i <= 30; i++) {
        const t = i / 30;
        const x = jupiterPos.x + (saturnPos.x - jupiterPos.x) * t;
        const z = jupiterPos.z + (saturnPos.z - jupiterPos.z) * t;
        const y = Math.sin(t * Math.PI * 0.5) * 2;
        points.push(x, y, z);
      }
      for (let i = 0; i <= 15; i++) {
        const t = i / 15;
        const angle = Math.PI * 0.4 + t * Math.PI * 0.7;
        const flybyRadius = 4;
        points.push(
          saturnPos.x + flybyRadius * Math.cos(angle),
          2 - t * 0.5,
          saturnPos.z + flybyRadius * Math.sin(angle)
        );
      }
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        const x = saturnPos.x + (uranusPos.x - saturnPos.x) * t;
        const z = saturnPos.z + (uranusPos.z - saturnPos.z) * t;
        const y = Math.sin(t * Math.PI * 0.3) * 1.5;
        points.push(x, y, z);
      }
      for (let i = 0; i <= 15; i++) {
        const t = i / 15;
        const angle = Math.PI * 0.3 + t * Math.PI * 0.6;
        const flybyRadius = 2;
        points.push(
          uranusPos.x + flybyRadius * Math.cos(angle),
          1.5 - t * 0.5,
          uranusPos.z + flybyRadius * Math.sin(angle)
        );
      }
      for (let i = 0; i <= 30; i++) {
        const t = i / 30;
        const x = uranusPos.x + (neptunePos.x - uranusPos.x) * t;
        const z = uranusPos.z + (neptunePos.z - uranusPos.z) * t;
        const y = Math.sin(t * Math.PI * 0.4) * 2;
        points.push(x, y, z);
      }
      break;
    }
    case "hubble": {
      const orbitRadius = 15;
      for (let i = 0; i <= 100; i++) {
        const theta = (i / 100) * Math.PI * 2;
        const x = earthPos.x + orbitRadius * Math.cos(theta);
        const y = earthPos.y;
        const z = earthPos.z + orbitRadius * Math.sin(theta);
        points.push(x, y, z);
      }
      break;
    }
    case "pathfinder": {
      const marsPos = celestialBodies.mars ? celestialBodies.mars.position.clone() : new THREE.Vector3(15.24, 0, 0);
      const cp = new THREE.Vector3((earthPos.x + marsPos.x)/2, 20, (earthPos.z + marsPos.z)/2);
      for (let i = 0; i <= 100; i++) {
        const t = i / 100;
        const x = (1-t)*(1-t)*earthPos.x + 2*(1-t)*t*cp.x + t*t*marsPos.x;
        const y = (1-t)*(1-t)*earthPos.y + 2*(1-t)*t*cp.y + t*t*marsPos.y;
        const z = (1-t)*(1-t)*earthPos.z + 2*(1-t)*t*cp.z + t*t*marsPos.z;
        points.push(x, y, z);
      }
      break;
    }
    case "cassini": {
      const saturnPos = celestialBodies.saturn ? celestialBodies.saturn.position.clone() : new THREE.Vector3(95.7, 0, 0);
      const cp = new THREE.Vector3((earthPos.x+saturnPos.x)/2, 40, (earthPos.z+saturnPos.z)/2);
      for (let i = 0; i <= 100; i++) {
        const t = i / 100;
        const x = (1-t)*(1-t)*earthPos.x + 2*(1-t)*t*cp.x + t*t*saturnPos.x;
        const y = (1-t)*(1-t)*earthPos.y + 2*(1-t)*t*cp.y + t*t*saturnPos.y;
        const z = (1-t)*(1-t)*earthPos.z + 2*(1-t)*t*cp.z + t*t*saturnPos.z;
        points.push(x, y, z);
      }
      break;
    }
    case "kepler": {
      const target = new THREE.Vector3(20, 0, 20);
      const cp = new THREE.Vector3((earthPos.x+target.x)/2, 30, (earthPos.z+target.z)/2);
      for (let i = 0; i <= 100; i++) {
        const t = i / 100;
        const x = (1-t)*(1-t)*earthPos.x + 2*(1-t)*t*cp.x + t*t*target.x;
        const y = (1-t)*(1-t)*earthPos.y + 2*(1-t)*t*cp.y + t*t*target.y;
        const z = (1-t)*(1-t)*earthPos.z + 2*(1-t)*t*cp.z + t*t*target.z;
        points.push(x, y, z);
      }
      break;
    }
    case "jwst": {
      const target = new THREE.Vector3(20, 0, -20);
      const cp = new THREE.Vector3((earthPos.x+target.x)/2, 30, (earthPos.z+target.z)/2);
      for (let i = 0; i <= 100; i++) {
        const t = i / 100;
        const x = (1-t)*(1-t)*earthPos.x + 2*(1-t)*t*cp.x + t*t*target.x;
        const y = (1-t)*(1-t)*earthPos.y + 2*(1-t)*t*cp.y + t*t*target.y;
        const z = (1-t)*(1-t)*earthPos.z + 2*(1-t)*t*cp.z + t*t*target.z;
        points.push(x, y, z);
      }
      break;
    }
    default:
      clearTrajectory();
      return;
  }
  const trajGeo = new THREE.BufferGeometry();
  trajGeo.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  const trajMat = new THREE.LineBasicMaterial({ color: 0xffffff });
  trajectoryLine = new THREE.Line(trajGeo, trajMat);
  scene.add(trajectoryLine);
  alert(`Mission ${mission} trajectory loaded!`);
}

// Animation loop
function animate() {
  animationId = requestAnimationFrame(animate);
  if (simRunning) {
    // Update planetary orbits
    Object.keys(orbits).forEach(planet => {
      const orbitInfo = orbits[planet];
      const planetObj = celestialBodies[planet];
      orbitInfo.angle += orbitInfo.speed * simSpeed;
      const r = orbitInfo.a * (1 - orbitInfo.e * orbitInfo.e) / (1 + orbitInfo.e * Math.cos(orbitInfo.angle));
      planetObj.position.set(r * Math.cos(orbitInfo.angle), 0, r * Math.sin(orbitInfo.angle));
    });

    // Update moon orbits
    Object.keys(moonOrbits).forEach(planetName => {
      const planet = celestialBodies[planetName];
      const planetMoons = moonOrbits[planetName];
      Object.keys(planetMoons).forEach(moonName => {
        const moonInfo = planetMoons[moonName];
        const moonObj = moons[planetName][moonName];
        moonInfo.angle += moonInfo.speed * simSpeed;
        const r = moonInfo.a * (1 - moonInfo.e * moonInfo.e) / (1 + moonInfo.e * Math.cos(moonInfo.angle));
        const offsetX = r * Math.cos(moonInfo.angle);
        const offsetZ = r * Math.sin(moonInfo.angle);
        moonObj.position.set(
          planet.position.x + offsetX,
          planet.position.y,
          planet.position.z + offsetZ
        );
        moonInfo.orbit.position.copy(planet.position);
      });
    });

    // Update asteroid positions
    for (let i = 0; i < numberOfAsteroids; i++) {
      asteroidAngles[i] += 0.001 * simSpeed;
      const d = asteroidDistances[i];
      asteroidPositions[i * 3] = d * Math.cos(asteroidAngles[i]);
      asteroidPositions[i * 3 + 2] = d * Math.sin(asteroidAngles[i]);
    }
    asteroidGeometry.attributes.position.needsUpdate = true;
  }
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();