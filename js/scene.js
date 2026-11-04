/* SAKURA N5 – living backgrounds + page transitions
 *
 * <body data-scene="temple">  -> temple at dusk (samurai, torii, castle)
 * <body data-scene="moon">    -> blossom moon (Dashboard + Profile)
 *
 * What moves (only inside the picture itself, nothing is drawn on top of it):
 *   - the samurai's cloak and sword, and the tree branch (temple)
 *   - the blossom branches in front of the moon (moon)
 *   - a few sakura petals drifting from top-right to bottom-left, behind the page
 * One steady breeze drives all of it, so everything leans the same way.
 */
(function () {
  "use strict";

  var doc = document, root = doc.documentElement, body = doc.body;
  var NAME = body.getAttribute("data-scene") === "moon" ? "moon" : "temple";
  var reduce = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  var cs = doc.currentScript;
  var BASE = cs && cs.src ? cs.src.replace(/js\/scene\.js.*$/, "assets/") : "assets/";

  var CFG = {
    temple: {
      img: "temple.webp", mask: "temple-wind.png",
      ax: 0.28, ay: 0.55,
      wind: [2.6, 2.0, 1.5, 52],          // lean, sway, fabric ripple (image px), ripple frequency
      fade: [0.0001, 0.0001, 0.0001, 0.0001],
      petals: ["#ffe3ea", "#f9bfd0", "#f4a3bb"]
    },
    moon: {
      img: "moon.webp", mask: "moon-wind.png",
      ax: 0.7, ay: 0.5,
      wind: [2.6, 2.0, 1.0, 30],
      fade: [0.32, 0.0001, 0.0001, 0.0001],
      petals: ["#ffc9ae", "#ff9fb6", "#d9587a"]
    }
  }[NAME];

  /* ---------- the breeze (shared by the shader and the petals) ---------- */
  function gust(t) {
    // never falls to zero: a constant breeze that swells and eases
    return 0.8 + 0.2 * Math.sin(t * 0.42) + 0.1 * Math.sin(t * 1.07 + 1.7);
  }

  /* ---------- DOM ---------- */
  var scene = doc.createElement("div");
  scene.className = "sk-scene";
  scene.setAttribute("aria-hidden", "true");
  var art = doc.createElement("canvas");
  art.className = "sk-art";
  var pet = doc.createElement("canvas");
  pet.className = "sk-petals";
  scene.appendChild(art);
  scene.appendChild(pet);
  body.insertBefore(scene, body.firstChild);

  var veil = doc.createElement("div");
  veil.className = "sk-veil";
  veil.setAttribute("aria-hidden", "true");
  body.appendChild(veil);

  /* ---------- readiness (used by the page-arrival reveal) ---------- */
  var readyCbs = [], isReady = false;
  function markReady() {
    if (isReady) return;
    isReady = true;
    scene.classList.add("is-ready");
    readyCbs.splice(0).forEach(function (f) { f(); });
  }
  function onReady(f) { isReady ? f() : readyCbs.push(f); }

  /* ---------- WebGL wind-warp ---------- */
  var VERT = "attribute vec2 p;varying vec2 vS;" +
    "void main(){vS=vec2(p.x*.5+.5,.5-p.y*.5);gl_Position=vec4(p,0.,1.);}";

  var FRAG = [
    "precision mediump float;",
    "varying vec2 vS;",
    "uniform sampler2D uTex,uMask;",
    "uniform vec4 uMap,uWind,uFade;",
    "uniform vec2 uImg;",
    "uniform float uT;",
    "void main(){",
    "  vec2 uv=vS*uMap.xy+uMap.zw;",
    "  vec2 m=texture2D(uMask,clamp(uv,0.,1.)).rg;",
    "  float amp=m.r*m.g;",
    "  float t=uT;",
    "  float g=.8+.2*sin(t*.42)+.1*sin(t*1.07+1.7);",
    "  float fl=sin(t*2.1+uv.y*uWind.w*.35+uv.x*7.)*.6+sin(t*3.4-uv.y*uWind.w+uv.x*11.)*.4;",
    "  float dx=(uWind.x*g+uWind.y*fl*g+uWind.z*sin(t*2.6-uv.y*uWind.w))*amp;",
    "  float dy=.45*uWind.y*sin(t*1.6+uv.x*9.+uv.y*4.)*amp;",
    "  vec4 c=texture2D(uTex,clamp(uv+vec2(dx,dy)/uImg,0.,1.));",
    "  float inb=step(0.,uv.x)*step(uv.x,1.)*step(0.,uv.y)*step(uv.y,1.);",
    "  float f=smoothstep(0.,uFade.x,uv.x)*smoothstep(0.,uFade.y,1.-uv.x)*",
    "          smoothstep(0.,uFade.z,uv.y)*smoothstep(0.,uFade.w,1.-uv.y);",
    "  float a=c.a*inb*f;",
    "  gl_FragColor=vec4(c.rgb*a,a);",
    "}"
  ].join("\n");

  function shader(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }

  function texture(gl, unit, image) {
    var t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  function loadImage(src) {
    return new Promise(function (res, rej) {
      var i = new Image();
      i.onload = function () { res(i); };
      i.onerror = rej;
      i.src = src;
    });
  }

  /* How the picture sits on the screen. Returns [scaleX, scaleY, offsetX, offsetY]
     so that  imageUV = screenUV * scale + offset  */
  function layout(rw, rh, iw, ih) {
    var w, h, ox, oy;
    var portrait = rw / rh < 0.9;
    if (NAME === "temple" || portrait) {
      var s = Math.max(rw / iw, rh / ih);
      w = iw * s; h = ih * s;
      // phones: slide the picture so the samurai and torii stay in view
      var ax = (NAME === "temple" && portrait) ? 0.13 : CFG.ax;
      ox = (rw - w) * ax; oy = (rh - h) * CFG.ay;
      return [rw / w, rh / h, -ox / w, -oy / h, 0];
    }
    // moon on a wide screen: tall picture on the right, moon about 45% down
    h = rh * 1.3; w = iw * (h / ih);
    ox = rw - w;
    oy = Math.min(0, Math.max(rh - h, rh * 0.45 - h * 0.448));
    return [rw / w, rh / h, -ox / w, -oy / h, 1];
  }

  function startArt(img, maskImg) {
    var gl = art.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false }) ||
             art.getContext("experimental-webgl", { alpha: true, premultipliedAlpha: true });
    if (!gl) throw new Error("no webgl");

    var prog = gl.createProgram();
    gl.attachShader(prog, shader(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, shader(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error("link failed");
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    texture(gl, 0, img);
    texture(gl, 1, maskImg);

    var U = {};
    ["uTex", "uMask", "uMap", "uWind", "uFade", "uImg", "uT"].forEach(function (n) {
      U[n] = gl.getUniformLocation(prog, n);
    });
    gl.uniform1i(U.uTex, 0);
    gl.uniform1i(U.uMask, 1);
    gl.uniform2f(U.uImg, img.naturalWidth, img.naturalHeight);
    gl.uniform4f.apply(gl, [U.uWind].concat(CFG.wind));
    gl.uniform4f.apply(gl, [U.uFade].concat(CFG.fade));

    function resize() {
      var w = Math.max(1, Math.round(innerWidth)), h = Math.max(1, Math.round(innerHeight));
      art.width = w; art.height = h;            // 1:1 pixels; the pictures are low-res anyway
      gl.viewport(0, 0, w, h);
      var L = layout(w, h, img.naturalWidth, img.naturalHeight);
      gl.uniform4f(U.uMap, L[0], L[1], L[2], L[3]);
      var fade = L[4] ? CFG.fade : [0.0001, 0.0001, 0.0001, 0.0001];
      gl.uniform4f(U.uFade, fade[0], fade[1], fade[2], fade[3]);
    }
    resize();

    return {
      resize: resize,
      draw: function (t) {
        gl.uniform1f(U.uT, t);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
    };
  }

  /* ---------- petals (2D canvas, just a few) ---------- */
  function makePetals(count) {
    var ctx = pet.getContext("2d");
    var W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2), list = [];

    function size() {
      W = innerWidth; H = innerHeight;
      pet.width = Math.round(W * dpr); pet.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function spawn(p, initial) {
      p.s = 5 + Math.random() * 5.5;
      p.vx = -(26 + Math.random() * 34);
      p.vy = 24 + Math.random() * 30;
      p.rot = Math.random() * 6.28; p.vr = (Math.random() - 0.5) * 1.8;
      p.flip = Math.random() * 6.28; p.vf = 1.2 + Math.random() * 1.6;
      p.sw = Math.random() * 6.28; p.sa = 6 + Math.random() * 10;
      p.a = 0.5 + Math.random() * 0.35;
      p.c = CFG.petals[(Math.random() * CFG.petals.length) | 0];
      if (initial) {
        p.x = Math.random() * W * 1.05; p.y = Math.random() * H;
      } else if (Math.random() < W / (W + H)) {
        p.x = W * (0.3 + Math.random() * 0.8); p.y = -20;            // in from the top
      } else {
        p.x = W + 20; p.y = Math.random() * H * 0.5;                 // in from the right
      }
      return p;
    }

    function shape(s) {
      ctx.beginPath();
      ctx.moveTo(0, s);
      ctx.bezierCurveTo(-s * 1.05, s * 0.35, -s * 0.95, -s * 0.8, -s * 0.18, -s);
      ctx.lineTo(0, -s * 0.72);
      ctx.lineTo(s * 0.18, -s);
      ctx.bezierCurveTo(s * 0.95, -s * 0.8, s * 1.05, s * 0.35, 0, s);
      ctx.closePath();
    }

    size();
    for (var i = 0; i < count; i++) list.push(spawn({}, true));

    return {
      resize: size,
      draw: function (t, dt) {
        ctx.clearRect(0, 0, W, H);
        var g = gust(t);
        for (var i = 0; i < list.length; i++) {
          var p = list[i];
          p.x += (p.vx * g + Math.sin(t * 1.3 + p.sw) * p.sa) * dt;
          p.y += (p.vy + Math.cos(t * 1.7 + p.sw) * 8) * dt;
          p.rot += p.vr * dt; p.flip += p.vf * dt;
          if (p.x < -30 || p.y > H + 30) spawn(p, false);
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.scale(0.45 + 0.55 * Math.abs(Math.cos(p.flip)), 1);
          ctx.globalAlpha = p.a;
          var grad = ctx.createLinearGradient(0, p.s, 0, -p.s);
          grad.addColorStop(0, p.c);
          grad.addColorStop(1, "#fff4f7");
          ctx.fillStyle = grad;
          shape(p.s);
          ctx.fill();
          ctx.restore();
        }
      }
    };
  }

  /* ---------- boot ---------- */
  function fallback() {
    // no WebGL (or a blocked texture): show the still picture instead
    scene.classList.add("is-static");
    scene.style.backgroundImage = "url(" + BASE + CFG.img + ")";
    markReady();
  }

  Promise.all([loadImage(BASE + CFG.img), loadImage(BASE + CFG.mask)]).then(function (imgs) {
    var artFx;
    try { artFx = startArt(imgs[0], imgs[1]); } catch (e) { return fallback(); }

    var petals = reduce ? null : makePetals(innerWidth < 700 ? 7 : 12);
    var seed = Math.random() * 40, last = performance.now(), t0 = last, raf = 0;

    function frame(now) {
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!doc.hidden) {
        var t = seed + (now - t0) / 1000;
        artFx.draw(t);
        if (petals) petals.draw(t, dt);
      }
      raf = requestAnimationFrame(frame);
    }

    artFx.draw(seed + 2);                       // first still frame, then fade in
    markReady();
    if (!reduce) raf = requestAnimationFrame(frame);

    var tick;
    addEventListener("resize", function () {
      clearTimeout(tick);
      tick = setTimeout(function () {
        artFx.resize(); if (petals) petals.resize();
        artFx.draw(seed + 2);
      }, 80);
    });
  }).catch(fallback);

  /* ---------- page transitions ---------- */
  // A soft band of dusk sweeps in from the top-right (the way the wind blows),
  // the next page loads underneath it, then the band keeps going to the bottom-left.
  var leaving = false;

  if (root.classList.contains("sk-arriving")) {
    veil.className = "sk-veil is-covered";
    root.classList.remove("sk-arriving");
    var born = performance.now();
    var reveal = function () {
      requestAnimationFrame(function () {
        veil.className = "sk-veil is-uncovering";
      });
    };
    onReady(function () {
      setTimeout(reveal, Math.max(0, 140 - (performance.now() - born)));
    });
    setTimeout(function () { if (!isReady) reveal(); }, 1500);   // never trap the page
  }

  veil.addEventListener("animationend", function () {
    if (veil.classList.contains("is-uncovering")) veil.className = "sk-veil";
  });

  doc.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest ? e.target.closest("a[href]") : null;
    if (!a || leaving) return;
    if ((a.target && a.target !== "_self") || a.hasAttribute("download")) return;
    var u;
    try { u = new URL(a.href, location.href); } catch (err) { return; }
    if (u.origin !== location.origin || !/^https?:$/.test(u.protocol)) return;
    if (u.pathname === location.pathname && u.search === location.search) return;   // same page / #anchor
    e.preventDefault();
    leaving = true;
    try { sessionStorage.setItem("skNav", "1"); } catch (err) {}
    veil.className = "sk-veil is-covering";
    setTimeout(function () { location.href = u.href; }, reduce ? 220 : 560);
  });

  // Back/forward cache: the old page can come back frozen mid-sweep
  addEventListener("pageshow", function (e) {
    if (e.persisted) {
      leaving = false;
      veil.className = "sk-veil is-uncovering";
    }
  });
})();
