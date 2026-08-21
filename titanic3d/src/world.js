/* ============================================================================
   world.js — the North Atlantic: sky, stars, moonless dark, the sea surface,
   funnel smoke and the ice field.

   The ship never moves in world space. It sits at the origin and the ocean and
   the ice are transformed around it (a floating origin), which keeps every
   coordinate small and precise no matter how many miles have been run.
   ========================================================================== */
(function (TT) {
  "use strict";

  const OCEAN_SIZE = 7000;
  const OCEAN_SEG = 150;

  TT.world = {
    posX: 0, posZ: 0,     // ship position on the ocean, metres
    heading: 0,           // radians; 0 = due "north" (+X)
    bergs: [],
    time: 0
  };

  // ------------------------------------------------------------------- sky
  function buildSky(scene) {
    const geo = new THREE.SphereGeometry(5200, 32, 20);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { uHorizon: { value: new THREE.Color(0x0b1526) },
                  uZenith:  { value: new THREE.Color(0x02040a) } },
      vertexShader: `
        varying float vH;
        void main(){
          vH = normalize(position).y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        }`,
      fragmentShader: `
        uniform vec3 uHorizon; uniform vec3 uZenith;
        varying float vH;
        void main(){
          float t = clamp(vH*1.4+0.12, 0.0, 1.0);
          vec3 c = mix(uHorizon, uZenith, pow(t,0.65));
          gl_FragColor = vec4(c,1.0);
        }`
    });
    const m = new THREE.Mesh(geo, mat);
    m.frustumCulled = false;
    scene.add(m);
    return m;
  }

  function buildStars(scene) {
    // 14 April 1912 was a moonless night. The stars were famously brilliant.
    const N = 3800;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const c = new THREE.Color();
    for (let i = 0; i < N; i++) {
      let v;
      do {
        v = new THREE.Vector3(TT.rand(-1, 1), TT.rand(-0.06, 1), TT.rand(-1, 1));
      } while (v.lengthSq() > 1 || v.lengthSq() < 0.05);
      v.normalize().multiplyScalar(4600);
      pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
      const warm = Math.random();
      c.setHSL(warm < 0.75 ? 0.58 : 0.09, 0.25, TT.rand(0.55, 1.0));
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({
      size: 11, sizeAttenuation: true, vertexColors: true,
      transparent: true, opacity: 0.95, depthWrite: false, fog: false
    }));
    pts.frustumCulled = false;
    const grp = new THREE.Group();
    grp.add(pts);
    scene.add(grp);
    return grp;
  }

  // ------------------------------------------------------------------ ocean
  function buildOcean(scene) {
    const geo = new THREE.PlaneGeometry(OCEAN_SIZE, OCEAN_SIZE, OCEAN_SEG, OCEAN_SEG);
    geo.rotateX(-Math.PI / 2);

    const mat = new THREE.ShaderMaterial({
      fog: false,
      uniforms: {
        uTime:    { value: 0 },
        uShipPos: { value: new THREE.Vector2(0, 0) },
        uHeading: { value: 0 },
        uDeep:    { value: new THREE.Color(0x030710) },
        uShallow: { value: new THREE.Color(0x0d2035) },
        uFoam:    { value: new THREE.Color(0x9fc0d8) },
        uCalm:    { value: 1.0 }
      },
      vertexShader: `
        uniform float uTime; uniform vec2 uShipPos; uniform float uHeading;
        uniform float uCalm;
        varying vec3 vW; varying float vHgt; varying vec3 vN;

        vec2 toWorld(vec2 p){
          float c = cos(uHeading), s = sin(uHeading);
          return uShipPos + vec2(c*p.x - s*p.y, s*p.x + c*p.y);
        }
        float wave(vec2 w, float t){
          // A flat calm sea, as it was that night: long, very low swell only.
          float h  = sin(w.x*0.021 + t*0.55) * 0.42;
              h += sin(w.y*0.017 - t*0.41) * 0.36;
              h += sin((w.x+w.y)*0.048 + t*0.95) * 0.16;
              h += sin((w.x-w.y)*0.083 - t*1.31) * 0.075;
          return h * uCalm;
        }
        void main(){
          vec2 w = toWorld(position.xz);
          float h = wave(w, uTime);
          float e = 1.5;
          float hx = wave(w + vec2(e,0.0), uTime);
          float hz = wave(w + vec2(0.0,e), uTime);
          vN = normalize(vec3(-(hx-h)/e, 1.0, -(hz-h)/e));
          vHgt = h;
          vec3 p = position; p.y += h;
          vW = p;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0);
        }`,
      fragmentShader: `
        uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uFoam;
        varying vec3 vW; varying float vHgt; varying vec3 vN;
        void main(){
          float d = length(vW.xz);
          vec3 base = mix(uShallow, uDeep, clamp(d/1400.0, 0.0, 1.0));
          // Starlight scattering off the wave faces.
          float fres = pow(1.0 - abs(normalize(vN).y), 3.0);
          base += vec3(0.10,0.15,0.22) * fres * 2.2;
          base += uFoam * smoothstep(0.55, 0.95, vHgt) * 0.10;
          // Fade into the darkness at the limit of vision.
          float fade = 1.0 - smoothstep(700.0, 3000.0, d);
          gl_FragColor = vec4(mix(uDeep*0.7, base, fade), 1.0);
        }`
    });

    const m = new THREE.Mesh(geo, mat);
    m.frustumCulled = false;
    m.renderOrder = -1;
    scene.add(m);
    return m;
  }

  // --------------------------------------------------------------- icebergs
  function makeBergGeometry(size, seedScale) {
    const geo = new THREE.IcosahedronGeometry(size, 2);
    const p = geo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const n = Math.sin(v.x * 0.7 * seedScale) * Math.cos(v.z * 0.6 * seedScale)
              + Math.sin(v.y * 1.1 * seedScale) * 0.6;
      v.multiplyScalar(1 + n * 0.22);
      v.y *= 1.25;
      // Flatten anything below the waterline into a broad underwater mass.
      if (v.y < 0) { v.y *= 0.55; v.x *= 1.5; v.z *= 1.5; }
      p.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    return geo;
  }

  const bergMatTop = new THREE.MeshLambertMaterial({
    color: 0xdcecf4, flatShading: true, emissive: 0x16242c
  });
  const bergMatWet = new THREE.MeshLambertMaterial({
    color: 0x4d90aa, flatShading: true, transparent: true, opacity: 0.55,
    emissive: 0x0a1a22
  });

  /** Spawn one berg at a world position. `size` is roughly its half-height. */
  TT.spawnBerg = function (wx, wz, size, growler) {
    const g = new THREE.Group();
    const geo = makeBergGeometry(size, TT.rand(0.6, 1.6));
    const top = new THREE.Mesh(geo, bergMatTop);
    g.add(top);
    const wet = new THREE.Mesh(geo, bergMatWet);
    wet.scale.set(1.35, 0.9, 1.35);
    wet.position.y = -size * 0.7;
    g.add(wet);
    g.position.y = -size * 0.30;                 // ~7/8 of its bulk below
    const holder = new THREE.Group();
    holder.add(g);
    holder.rotation.y = TT.rand(0, 6.28);
    const berg = {
      wx, wz, size, growler: !!growler, mesh: holder,
      radius: size * (growler ? 1.3 : 1.6),
      bob: TT.rand(0, 6.28), hit: false, passed: false
    };
    TT.world.bergs.push(berg);
    TT.scene.add(holder);
    return berg;
  };

  /** Seed a field of ice across the ship's path, as reported by the Mesaba. */
  TT.seedIceField = function (aheadFrom, aheadTo, count, spread) {
    for (let i = 0; i < count; i++) {
      const ahead = TT.rand(aheadFrom, aheadTo);
      const lateral = TT.rand(-spread, spread);
      const h = TT.world.heading;
      const wx = TT.world.posX + Math.cos(h) * ahead - Math.sin(h) * lateral;
      const wz = TT.world.posZ + Math.sin(h) * ahead + Math.cos(h) * lateral;
      const growler = Math.random() < 0.45;
      TT.spawnBerg(wx, wz, growler ? TT.rand(3, 8) : TT.rand(14, 34), growler);
    }
  };

  // -------------------------------------------------------------- funnel smoke
  function smokeTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const x = c.getContext("2d");
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,0.65)");
    g.addColorStop(0.5, "rgba(255,255,255,0.20)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    return t;
  }

  function buildSmoke(scene) {
    const N = 340;
    const pos = new Float32Array(N * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      size: 26, sizeAttenuation: true, map: smokeTexture(),
      transparent: true, opacity: 0.30, depthWrite: false,
      color: 0x8d97a8, fog: false
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    scene.add(pts);
    const parts = [];
    for (let i = 0; i < N; i++)
      parts.push({ x: 0, y: -9999, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1 });
    return { pts, parts, geo, next: 0 };
  }

  // ------------------------------------------------------------------ create
  TT.buildWorld = function (scene) {
    TT.sky = buildSky(scene);
    TT.stars = buildStars(scene);
    TT.ocean = buildOcean(scene);
    TT.smoke = buildSmoke(scene);

    scene.add(new THREE.AmbientLight(0x2a3648, 0.62));
    // There was no moon that night, but pure starlight renders as a black
    // rectangle, so she gets just enough key light to read her lines by.
    const moon = new THREE.DirectionalLight(0xbcd0e8, 0.52);
    moon.position.set(-220, 340, 180);
    scene.add(moon);
    TT.moonLight = moon;
    const fill = new THREE.DirectionalLight(0x5a7ba8, 0.20);
    fill.position.set(260, 120, -200);
    scene.add(fill);
    // A soft fill so interiors are never pitch black before the lamps reach them.
    const hemi = new THREE.HemisphereLight(0x40506a, 0x14181f, 0.42);
    scene.add(hemi);
    TT.hemiLight = hemi;
  };

  // ------------------------------------------------------------------ update
  const _tmp = new THREE.Vector3();

  TT.updateWorld = function (dt, speedMS) {
    const w = TT.world;
    w.time += dt;

    // Advance the ship across the ocean.
    w.posX += Math.cos(w.heading) * speedMS * dt;
    w.posZ += Math.sin(w.heading) * speedMS * dt;

    if (TT.ocean) {
      const u = TT.ocean.material.uniforms;
      u.uTime.value = w.time;
      u.uShipPos.value.set(w.posX, w.posZ);
      u.uHeading.value = w.heading;
    }
    if (TT.stars) TT.stars.rotation.y = -w.heading;

    // Re-place every berg relative to the ship.
    const ch = Math.cos(w.heading), sh = Math.sin(w.heading);
    for (let i = w.bergs.length - 1; i >= 0; i--) {
      const b = w.bergs[i];
      const dx = b.wx - w.posX, dz = b.wz - w.posZ;
      const fwd = dx * ch + dz * sh;
      const stb = -dx * sh + dz * ch;
      b.relFwd = fwd; b.relStb = stb;
      b.mesh.position.set(fwd, 0, stb);
      b.bob += dt * 0.6;
      b.mesh.position.y = Math.sin(b.bob) * 0.35;
      // Retire ice that has fallen well astern.
      if (fwd < -900) {
        TT.scene.remove(b.mesh);
        w.bergs.splice(i, 1);
      }
    }
  };

  TT.updateSmoke = function (dt, intensity) {
    const s = TT.smoke;
    if (!s) return;
    const arr = s.geo.attributes.position.array;
    // Emit from each lit funnel.
    if (TT.funnels && intensity > 0.02) {
      for (let f = 0; f < TT.funnels.length; f++) {
        if (TT.funnels[f].userData.dummy) continue;
        if (Math.random() > dt * 22 * intensity) continue;
        const a = TT.funnels[f].userData.smokeAnchor;
        const p = s.parts[s.next];
        s.next = (s.next + 1) % s.parts.length;
        p.x = a.x + TT.rand(-1.2, 1.2);
        p.y = a.y + TT.rand(-1, 1) - TT.WATERLINE_Y + (TT.shipRoot ? TT.shipRoot.position.y + TT.WATERLINE_Y : 0);
        p.z = a.z + TT.rand(-1.2, 1.2);
        p.vx = -TT.nav.state.speedMS * 0.55 + TT.rand(-2, 2);
        p.vy = TT.rand(3.5, 6.5);
        p.vz = TT.rand(-1.6, 1.6);
        p.life = 0;
        p.max = TT.rand(7, 13);
      }
    }
    for (let i = 0; i < s.parts.length; i++) {
      const p = s.parts[i];
      if (p.life >= p.max) { arr[i * 3 + 1] = -9999; continue; }
      p.life += dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.vy *= (1 - dt * 0.35);
      p.vx *= (1 - dt * 0.12);
      arr[i * 3] = p.x; arr[i * 3 + 1] = p.y; arr[i * 3 + 2] = p.z;
    }
    s.geo.attributes.position.needsUpdate = true;
  };

})(window.TT);
