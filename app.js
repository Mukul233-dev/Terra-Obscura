let globe;
let currentLocation = null;
let isTransitioning = false;
let showingArcs = false;
let filterDrawerOpen = false;
let activeCategory = null;
let hoveredObj = null;
let rotationTimeout = null;
let isUserInteracting = false;

function startRotationTimeout() {
  if (rotationTimeout) clearTimeout(rotationTimeout);
  rotationTimeout = setTimeout(() => {
    if (!isUserInteracting && !currentLocation && !isTransitioning) {
      if (globe && globe.controls()) {
        globe.controls().autoRotate = true;
      }
    }
  }, 10000);
}

function createPin(d) {
  const root = new THREE.Group();
  const color = new THREE.Color(d.color);
  const S = 1.6;

  const pin = new THREE.Group();

  const ringGeo = new THREE.TorusGeometry(0.9 * S, 0.1 * S, 8, 24);
  const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35 });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.04 * S;
  pin.add(ring);

  const needleGeo = new THREE.CylinderGeometry(0.1 * S, 0.06 * S, 3.8 * S, 8);
  const needleMat = new THREE.MeshPhongMaterial({
    color: 0xb8b8c0, specular: 0xffffff, shininess: 220,
    emissive: new THREE.Color(0x3a3a44), emissiveIntensity: 0.25
  });
  const needle = new THREE.Mesh(needleGeo, needleMat);
  needle.position.y = 1.9 * S;
  pin.add(needle);

  const neckGeo = new THREE.CylinderGeometry(0.4 * S, 0.12 * S, 0.7 * S, 10);
  const neckMat = new THREE.MeshPhongMaterial({
    color, emissive: color, emissiveIntensity: 0.12,
    shininess: 90, transparent: true, opacity: 0.85
  });
  const neck = new THREE.Mesh(neckGeo, neckMat);
  neck.position.y = 4.0 * S;
  pin.add(neck);

  const headGeo = new THREE.SphereGeometry(0.9 * S, 20, 20);
  const headMat = new THREE.MeshPhongMaterial({
    color, emissive: color, emissiveIntensity: 0.45,
    shininess: 130, specular: new THREE.Color(0x999999),
    transparent: true, opacity: 0.92
  });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 5.2 * S;
  pin.add(head);

  const hlGeo = new THREE.SphereGeometry(0.25 * S, 10, 10);
  const hlMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 });
  const hl = new THREE.Mesh(hlGeo, hlMat);
  hl.position.set(0.3 * S, 5.75 * S, 0.35 * S);
  pin.add(hl);

  const spriteMat = new THREE.SpriteMaterial({
    map: makeGlowTexture(d.color),
    transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const glow = new THREE.Sprite(spriteMat);
  glow.position.y = 5.2 * S;
  glow.scale.set(5.5 * S, 5.5 * S, 1);
  pin.add(glow);

  pin.rotation.x = Math.PI / 2;
  root.add(pin);
  root.userData = d;
  return root;
}

function extractLocationData(obj) {
  if (!obj) return null;
  if (!obj.isObject3D && obj.name && obj.lat !== undefined) {
    return obj;
  }
  let current = obj;
  while (current) {
    if (current.userData && current.userData.name && current.userData.lat !== undefined) {
      return current.userData;
    }
    current = current.parent;
  }
  return null;
}

function makeGlowTexture(colorStr) {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, colorStr);
  g.addColorStop(0.25, colorStr + '99');
  g.addColorStop(1, 'transparent');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}


function initGlobe() {
  const el = document.getElementById('globe-viewport');
  const visibleLocations = getFilteredLocations();

  globe = Globe({
    antialias: true, alpha: true,
    waitForGlobeReady: true, animateIn: false
  })(el)
    .globeImageUrl('//unpkg.com/three-globe/example/img/earth-night.jpg')
    .bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png')
    .backgroundImageUrl('//unpkg.com/three-globe/example/img/night-sky.png')
    .backgroundColor('rgba(0,0,0,0)')
    .atmosphereColor('#2c4060')
    .atmosphereAltitude(0.22)
    .showGraticules(false)
    .showAtmosphere(true)


    .ringsData(visibleLocations)
    .ringLat(d => d.lat).ringLng(d => d.lng)
    .ringColor(d => () => d.color)
    .ringMaxRadius(2.8)
    .ringPropagationSpeed(1.2)
    .ringRepeatPeriod(2200)


    .arcsData([])
    .arcStartLat(d => d.startLat).arcStartLng(d => d.startLng)
    .arcEndLat(d => d.endLat).arcEndLng(d => d.endLng)
    .arcColor(() => ['rgba(212,170,60,0.12)', 'rgba(212,170,60,0.30)'])
    .arcAltitudeAutoScale(0.3)
    .arcStroke(0.25)
    .arcDashLength(0.5).arcDashGap(0.25)
    .arcDashAnimateTime(3200)


    .objectsData(visibleLocations)
    .objectLat(d => d.lat).objectLng(d => d.lng)
    .objectAltitude(0.01)
    .objectThreeObject(d => createPin(d))
    .objectFacesSurface(true)
    .onObjectClick((obj, ev, coords) => {
      let loc = extractLocationData(obj);
      if (!loc && coords) {
        loc = LOCATIONS.find(l =>
          Math.abs(l.lat - coords.lat) < 0.05 && Math.abs(l.lng - coords.lng) < 0.05
        );
      }
      if (loc) selectLocation(loc);
    })
    .onObjectHover(obj => {
      document.body.style.cursor = obj ? 'pointer' : 'default';
      handlePinHover(obj);
    })


    .htmlElementsData(visibleLocations)
    .htmlLat(d => d.lat).htmlLng(d => d.lng)
    .htmlAltitude(0.22)
    .htmlElement(d => {
      const el = document.createElement('div');
      el.className = 'globe-label';
      el.innerHTML = `<span class="marker-name">${d.name}</span>`;
      el.addEventListener('click', e => { e.stopPropagation(); selectLocation(d); });
      return el;
    })

    .labelsData([])


    .onGlobeClick(({ lat, lng }) => {
      let nearest = null, minD = Infinity;
      getFilteredLocations().forEach(loc => {
        const d = Math.hypot(loc.lat - lat, loc.lng - lng);
        if (d < minD) { minD = d; nearest = loc; }
      });
      if (nearest && minD < 3.5) selectLocation(nearest);
    })

    .pointOfView({ lat: 28, lng: 38, altitude: 2.4 }, 0);


  const scene = globe.scene();
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const dir = new THREE.DirectionalLight(0xffffff, 0.75);
  dir.position.set(60, 100, 70);
  scene.add(dir);


  const ctrl = globe.controls();
  ctrl.autoRotate = false;
  ctrl.autoRotateSpeed = 0.25;
  ctrl.enableDamping = true;
  ctrl.dampingFactor = 0.055;
  ctrl.minDistance = 130;
  ctrl.maxDistance = 550;

  const pauseRotation = () => {
    isUserInteracting = true;
    ctrl.autoRotate = false;
    if (rotationTimeout) {
      clearTimeout(rotationTimeout);
      rotationTimeout = null;
    }
  };

  const resumeRotation = () => {
    isUserInteracting = false;
    startRotationTimeout();
  };

  el.addEventListener('pointerdown', pauseRotation);

  window.addEventListener('pointerup', () => {
    if (isUserInteracting) {
      resumeRotation();
    }
  });

  el.addEventListener('wheel', () => {
    pauseRotation();
    resumeRotation();
  }, { passive: true });

  ctrl.addEventListener('change', () => {
    const dist = globe.camera().position.length();
    const t = (dist - 130) / (550 - 130);
    const clampedT = Math.max(0, Math.min(1, t));
    ctrl.zoomSpeed = 1.875 - 0.975 * clampedT;
  });


  document.getElementById('ticker-count').textContent = visibleLocations.length;
  startRotationTimeout();
}


function selectLocation(loc) {
  if (isTransitioning || !loc) return;
  isTransitioning = true;
  currentLocation = loc;

  globe.controls().autoRotate = false;
  if (rotationTimeout) clearTimeout(rotationTimeout);

  globe.pointOfView(
    { lat: loc.lat, lng: loc.lng - 5, altitude: 1.5 },
    1400
  );

  const arcs = CONNECTIONS.filter(c => c.fromId === loc.id || c.toId === loc.id);
  globe.arcsData(arcs);

  setTimeout(() => {
    openPanel(loc);
    isTransitioning = false;
  }, 400);
}


function openPanel(loc) {
  const panel = document.getElementById('detail-panel');
  const shade = document.getElementById('panel-shade');

  buildPanel(loc);

  panel.classList.add('open');
  shade.classList.add('open');
}

function closePanel() {
  const panel = document.getElementById('detail-panel');
  const shade = document.getElementById('panel-shade');

  panel.classList.remove('open');
  shade.classList.remove('open');

  currentLocation = null;
  globe.arcsData(showingArcs ? CONNECTIONS : []);

  setTimeout(() => {
    globe.pointOfView({ altitude: 2.4 }, 1100);
    startRotationTimeout();
  }, 250);
}

function getHeroImageUrl(loc) {
  if (window.SITE_IMAGES && window.SITE_IMAGES[loc.id]) {
    return window.SITE_IMAGES[loc.id];
  }
  const nameWords = loc.name.split(' ');
  const specificName = nameWords[nameWords.length - 1].replace(/[^a-zA-Z]/g, '').toLowerCase();
  const categoryKeywords = loc.category.toLowerCase().replace(/ /g, ',');
  const tagKeyword = loc.tags && loc.tags[0] ? loc.tags[0].toLowerCase().replace(/ /g, ',') : '';
  return `https://loremflickr.com/600/300/ancient,history,${specificName},${categoryKeywords},${tagKeyword}`;
}

function buildPanel(loc) {
  const scroll = document.getElementById('panel-scroll');

  const tagsHTML = loc.tags.map(t => `<span class="panel-tag">#${t}</span>`).join('');

  const topicsHTML = loc.connectedTopics.map(t =>
    `<span class="topic-chip">${t}</span>`
  ).join('');

  const relatedHTML = loc.connections.map(cid => {
    const c = LOCATIONS.find(l => l.id === cid);
    if (!c) return '';
    return `
      <div class="related-card" data-id="${c.id}">
        <div class="related-color" style="background:${c.color};color:${c.color}"></div>
        <div class="related-info">
          <div class="related-name">${c.name}</div>
          <div class="related-detail">${c.region} · ${c.era}</div>
        </div>
        <div class="related-arrow">→</div>
      </div>`;
  }).join('');

  const imgUrl = getHeroImageUrl(loc);

  scroll.innerHTML = `
    <div class="panel-hero">
      <img class="panel-hero-bg" src="${imgUrl}" alt="${loc.name}" loading="lazy">
      <div class="panel-hero-gradient"></div>
      <div class="panel-hero-accent" style="background:linear-gradient(90deg,${loc.color}00,${loc.color},${loc.color}00)"></div>
      <button class="panel-close" id="panel-close-btn" aria-label="Close">✕</button>
    </div>

    <div class="panel-body">
      <div class="panel-category">
        <span class="panel-category-dot" style="background:${loc.color}"></span>
        ${loc.category}
      </div>
      <div class="panel-meta">${loc.era} · ${loc.region}</div>
      <h2 class="panel-title">${loc.name}</h2>
      <p class="panel-subtitle">${loc.subtitle}</p>

      <div class="panel-tags">${tagsHTML}</div>

      <div class="panel-section">
        <div class="section-header">
          <div class="section-icon">◉</div>
          <span class="section-label">Archive Entry</span>
          <div class="section-line"></div>
        </div>
        <p class="section-text">${loc.description}</p>
      </div>

      <div class="panel-section">
        <div class="section-header">
          <div class="section-icon">✦</div>
          <span class="section-label">Lore &amp; Legend</span>
          <div class="section-line"></div>
        </div>
        <div class="lore-block">
          <p class="section-text">${loc.lore}</p>
        </div>
      </div>

      <div class="panel-section">
        <div class="section-header">
          <div class="section-icon">?</div>
          <span class="section-label">Unsolved</span>
          <div class="section-line"></div>
        </div>
        <div class="mystery-block">
          <p class="section-text">${loc.mystery}</p>
        </div>
      </div>

      <div class="panel-section">
        <div class="section-header">
          <div class="section-icon">◈</div>
          <span class="section-label">Connected Topics</span>
          <div class="section-line"></div>
        </div>
        <div class="topics-grid">${topicsHTML}</div>
      </div>

      <div class="panel-section">
        <div class="section-header">
          <div class="section-icon">↗</div>
          <span class="section-label">Related Discoveries</span>
          <div class="section-line"></div>
        </div>
        <div class="related-grid">${relatedHTML}</div>
      </div>
    </div>
  `;

  scroll.scrollTop = 0;


  document.getElementById('panel-close-btn').addEventListener('click', closePanel);

  scroll.querySelectorAll('.related-card').forEach(card => {
    card.addEventListener('click', () => {
      const target = LOCATIONS.find(l => l.id === card.dataset.id);
      if (target) {
        scroll.scrollTop = 0;
        selectLocation(target);
      }
    });
  });
}


function handlePinHover(obj) {
  const tt = document.getElementById('hover-tooltip');
  if (!obj) {
    tt.classList.remove('visible');
    hoveredObj = null;
    return;
  }

  const d = extractLocationData(obj);
  if (!d || !d.name) { tt.classList.remove('visible'); return; }

  hoveredObj = d;
  tt.innerHTML = `${d.name}<span class="tt-era">${d.era} · ${d.region}</span>`;
  tt.classList.add('visible');
}

document.addEventListener('mousemove', e => {
  const tt = document.getElementById('hover-tooltip');
  if (!tt || !tt.classList.contains('visible')) return;
  tt.style.left = (e.clientX + 16) + 'px';
  tt.style.top = (e.clientY - 10) + 'px';
});



function getFilteredLocations() {
  if (!activeCategory) return LOCATIONS;
  return LOCATIONS.filter(l => l.category === activeCategory);
}

function buildFilterDrawer() {
  const list = document.getElementById('filter-list');
  const categories = [...new Set(LOCATIONS.map(l => l.category))];


  let html = `
    <div class="filter-item active" data-cat="">
      <div class="filter-dot" style="background:var(--c-gold)"></div>
      All Locations
      <span class="filter-count">${LOCATIONS.length}</span>
    </div>`;

  categories.forEach(cat => {
    const color = CATEGORY_COLORS[cat] || '#888';
    const count = LOCATIONS.filter(l => l.category === cat).length;
    html += `
      <div class="filter-item" data-cat="${cat}">
        <div class="filter-dot" style="background:${color}"></div>
        ${cat}
        <span class="filter-count">${count}</span>
      </div>`;
  });

  list.innerHTML = html;

  list.querySelectorAll('.filter-item').forEach(item => {
    item.addEventListener('click', () => {
      const cat = item.dataset.cat;
      activeCategory = cat || null;

      list.querySelectorAll('.filter-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      refreshGlobeData();
    });
  });
}

function refreshGlobeData() {
  const data = getFilteredLocations();
  globe.ringsData(data);
  globe.objectsData(data);
  globe.htmlElementsData(data);
  document.getElementById('ticker-count').textContent = data.length;

  if (showingArcs) {
    const arcData = CONNECTIONS.filter(c => {
      const ids = data.map(d => d.id);
      return ids.includes(c.fromId) && ids.includes(c.toId);
    });
    globe.arcsData(arcData);
  }
}

function toggleFilterDrawer() {
  filterDrawerOpen = !filterDrawerOpen;
  const drawer = document.getElementById('filter-drawer');
  const btn = document.getElementById('btn-filter');
  drawer.classList.toggle('open', filterDrawerOpen);
  btn.classList.toggle('active', filterDrawerOpen);
}


function resetView() {
  closePanel();
  globe.arcsData(showingArcs ? CONNECTIONS : []);
  globe.controls().autoRotate = false;
  globe.pointOfView({ lat: 28, lng: 38, altitude: 2.4 }, 1400);
  startRotationTimeout();
}

function toggleArcs() {
  showingArcs = !showingArcs;
  const btn = document.getElementById('btn-arcs');
  btn.classList.toggle('active', showingArcs);

  if (currentLocation) {
    const arcs = CONNECTIONS.filter(c => c.fromId === currentLocation.id || c.toId === currentLocation.id);
    globe.arcsData(showingArcs ? CONNECTIONS : arcs);
  } else {
    globe.arcsData(showingArcs ? CONNECTIONS : []);
  }
}


function initDust() {
  const canvas = document.getElementById('dust-canvas');
  const ctx = canvas.getContext('2d');
  let w, h;
  const particles = [];
  const COUNT = 60;

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  for (let i = 0; i < COUNT; i++) {
    particles.push({
      x: Math.random() * w,
      y: Math.random() * h,
      r: 0.5 + Math.random() * 1.2,
      dx: (Math.random() - 0.5) * 0.15,
      dy: -0.12 - Math.random() * 0.18,
      alpha: 0.08 + Math.random() * 0.18,
      phase: Math.random() * Math.PI * 2
    });
  }

  function draw(t) {
    ctx.clearRect(0, 0, w, h);
    particles.forEach(p => {
      p.x += p.dx + Math.sin(t * 0.0003 + p.phase) * 0.08;
      p.y += p.dy;
      if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
      if (p.x < -10) p.x = w + 10;
      if (p.x > w + 10) p.x = -10;

      const flicker = 0.7 + 0.3 * Math.sin(t * 0.002 + p.phase);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(212, 180, 100, ${p.alpha * flicker})`;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
}


function bindEvents() {

  document.getElementById('panel-shade').addEventListener('click', closePanel);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (filterDrawerOpen) toggleFilterDrawer();
      else closePanel();
    }
  });

  document.getElementById('btn-reset').addEventListener('click', resetView);
  document.getElementById('btn-arcs').addEventListener('click', toggleArcs);
  document.getElementById('btn-filter').addEventListener('click', toggleFilterDrawer);


  document.querySelector('.nav-brand').addEventListener('click', resetView);


  document.addEventListener('click', e => {
    if (filterDrawerOpen &&
      !e.target.closest('.filter-drawer') &&
      !e.target.closest('#btn-filter')) {
      toggleFilterDrawer();
    }
  });
}


function boot() {
  initGlobe();
  initDust();
  buildFilterDrawer();
  bindEvents();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
