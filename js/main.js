/* =========================================================
   DELTA — interacciones
   GSAP + ScrollTrigger + Lenis, con mejoras progresivas nativas
   ========================================================= */
(() => {
  'use strict';

  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const imgReady = (img) =>
    !img || img.complete
      ? Promise.resolve()
      : new Promise((r) => {
          img.addEventListener('load', r, { once: true });
          img.addEventListener('error', r, { once: true });
        });

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  const supportsSDA = CSS.supports('(animation-timeline: view()) and (animation-range: entry)');
  let lenis = null;

  /* ---------- Módulos que no dependen de GSAP ---------- */
  initMenu();
  initHotspots();
  initWhyTabs();
  initGallery();
  initFinaleGlow();

  if (!hasGSAP) {
    // Sin librerías de animación: página estática, todo visible.
    root.classList.remove('js', 'is-loading');
    root.classList.add('no-motion');
    initHeroBasic();
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  // En móviles, mostrar/ocultar la barra del navegador no recalcula las animaciones
  ScrollTrigger.config({ ignoreMobileResize: true });
  gsap.defaults({ overwrite: 'auto' });

  /* ---------- Scroll suave ---------- */
  if (!reduce && window.Lenis) {
    lenis = new Lenis({ lerp: 0.085, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }

  const scrollToY = (y) => {
    if (lenis) lenis.scrollTo(y, { duration: 1.4, easing: (t) => 1 - Math.pow(1 - t, 4) });
    else window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
  };
  const scrollToEl = (el) => {
    if (lenis) lenis.scrollTo(el, { duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4) });
    else el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  };

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    const el = id.length > 1 && document.getElementById(id.slice(1));
    if (!el) return;
    e.preventDefault();
    const dlg = a.closest('dialog');
    if (dlg && dlg.open) dlg.close();
    scrollToEl(el);
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
  });

  /* ---------- Utilidades de texto ---------- */
  function splitChars(el) {
    const chars = [];
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.append(' '); return; }
            const w = document.createElement('span');
            w.className = 'w';
            w.setAttribute('aria-hidden', 'true');
            [...part].forEach((ch) => {
              const c = document.createElement('span');
              c.className = 'c';
              c.textContent = ch;
              w.append(c);
              chars.push(c);
            });
            frag.append(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) {
          walk(n);
        }
      });
    };
    walk(el);
    return chars;
  }

  function splitWords(el) {
    const words = [];
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.append(part); return; }
            const s = document.createElement('span');
            s.className = 'cw';
            s.textContent = part;
            frag.append(s);
            words.push(s);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) {
          walk(n);
        }
      });
    };
    walk(el);
    return words;
  }

  function revealHeadings(scope) {
    $$('[data-split]', scope).forEach((el) => {
      el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
      const chars = splitChars(el);
      if (reduce) return;
      gsap.from(chars, {
        yPercent: 118,
        duration: 1.25,
        ease: 'expo.out',
        stagger: 0.022,
        scrollTrigger: { trigger: el, start: 'top 86%' },
      });
    });
  }

  /* =========================================================
     HERO — slider con obturador Δ
     ========================================================= */
  const hero = $('.hero');
  const slides = $$('.hero__slide', hero);
  const captions = $$('.hero__caption', hero);
  const captionsBox = $('.hero__captions', hero);
  const tabs = $$('.hero__tab', hero);
  const pauseBtn = $('.hero__pause', hero);
  const hudVals = $$('[data-hud-i]', hero);
  const frameNum = $('.hud__frame', hero);
  const heroChars = splitChars($('.hero__word', hero));
  const DURATION = 7;

  let current = 0;
  let animating = false;
  let started = false;
  let userPaused = reduce;
  let inView = true;
  let focusIn = false;
  let fillTween = null;
  let kbTween = null;

  function setTri(el, r, rot = 0) {
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const R = Math.max(r, 0.0001) * Math.max(w, h) * 1.5;
    const cx = w * 0.5;
    const cy = h * 0.52;
    const pts = [-90, 30, 150].map((a) => {
      const t = ((a + rot) * Math.PI) / 180;
      return `${(cx + R * Math.cos(t)).toFixed(1)}px ${(cy + R * Math.sin(t)).toFixed(1)}px`;
    });
    el.style.clipPath = `polygon(${pts.join(', ')})`;
  }

  function scramble(el, text) {
    if (reduce) { el.textContent = text; return; }
    const pool = '0123456789/.';
    let i = 0;
    const steps = 9;
    const id = setInterval(() => {
      i++;
      el.textContent = [...text]
        .map((c, k) => (c === ' ' || k < (i / steps) * text.length ? c : pool[(Math.random() * pool.length) | 0]))
        .join('');
      if (i >= steps) { clearInterval(id); el.textContent = text; }
    }, 38);
  }

  function updateHeroUI(n) {
    tabs.forEach((t, i) => {
      t.classList.toggle('is-active', i === n);
      if (i === n) t.setAttribute('aria-current', 'true');
      else t.removeAttribute('aria-current');
      gsap.set($('b', t), { scaleX: i < n ? 1 : 0 });
    });
    captions.forEach((c, i) => c.classList.toggle('is-active', i === n));
    const vals = (slides[n].dataset.hud || '').split('|');
    hudVals.forEach((el, i) => scramble(el, vals[i] || ''));
    frameNum.textContent = `0${n + 1}/0${slides.length}`;
  }

  function kenBurns(slide) {
    if (kbTween) kbTween.kill();
    if (reduce) return;
    kbTween = gsap.to($('img', slide), { scale: 1, duration: DURATION + 2, ease: 'sine.out' });
  }

  function isPaused() {
    return userPaused || !inView || focusIn || document.hidden;
  }

  function runFill() {
    if (fillTween) fillTween.kill();
    const b = $('b', tabs[current]);
    fillTween = gsap.fromTo(
      b,
      { scaleX: 0 },
      { scaleX: 1, duration: DURATION, ease: 'none', paused: isPaused(), onComplete: () => goTo((current + 1) % slides.length) }
    );
  }

  function syncPause() {
    if (!fillTween || !started) return;
    if (isPaused()) fillTween.pause();
    else fillTween.resume();
  }

  function goTo(n, { dir = 1, user = false } = {}) {
    if (animating || n === current) return;
    animating = true;
    const from = slides[current];
    const to = slides[n];
    const toImg = $('img', to);
    if (toImg.loading === 'lazy') toImg.loading = 'eager';
    captionsBox.setAttribute('aria-live', user ? 'polite' : 'off');

    to.classList.add('is-next');
    to.removeAttribute('aria-hidden');
    updateHeroUI(n);
    if (n === 0) tabs.forEach((t) => gsap.set($('b', t), { scaleX: 0 }));

    const finish = () => {
      from.classList.remove('is-active');
      from.setAttribute('aria-hidden', 'true');
      to.classList.remove('is-next');
      to.classList.add('is-active');
      to.style.clipPath = '';
      gsap.set($('img', from), { scale: 1.08 });
      current = n;
      animating = false;
      kenBurns(to);
      runFill();
    };

    if (reduce) {
      gsap.fromTo(to, { opacity: 0 }, { opacity: 1, duration: 0.3, onComplete: () => { gsap.set(to, { clearProps: 'opacity' }); finish(); } });
      return;
    }

    const o = { r: 0 };
    const spin = 70 * dir;
    setTri(to, 0, spin);
    gsap.timeline({ onComplete: finish })
      .to(o, { r: 1, duration: 1.55, ease: 'expo.inOut', onUpdate: () => setTri(to, o.r, spin * (1 - o.r)) }, 0)
      .fromTo(toImg, { scale: 1.42 }, { scale: 1.08, duration: 2.2, ease: 'expo.out' }, 0.2)
      .to($('img', from), { scale: 1.16, duration: 1.55, ease: 'power2.inOut' }, 0);
  }

  function startHero() {
    started = true;
    kenBurns(slides[0]);
    runFill();
  }

  tabs.forEach((t, i) =>
    t.addEventListener('click', () => {
      if (i === current) return;
      goTo(i, { dir: i > current ? 1 : -1, user: true });
    })
  );

  pauseBtn.addEventListener('click', () => {
    userPaused = !userPaused;
    pauseBtn.classList.toggle('is-paused', userPaused);
    pauseBtn.setAttribute('aria-label', userPaused ? 'Reproducir presentación' : 'Pausar presentación');
    syncPause();
  });
  if (reduce) {
    pauseBtn.classList.add('is-paused');
    pauseBtn.setAttribute('aria-label', 'Reproducir presentación');
  }

  hero.addEventListener('focusin', () => { focusIn = true; syncPause(); });
  hero.addEventListener('focusout', (e) => {
    if (!hero.contains(e.relatedTarget)) { focusIn = false; syncPause(); }
  });
  document.addEventListener('visibilitychange', syncPause);

  $('.hero__tabs', hero).addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const d = e.key === 'ArrowRight' ? 1 : -1;
    const n = (current + d + slides.length) % slides.length;
    goTo(n, { dir: d, user: true });
    tabs[n].focus();
  });

  // Deslizar con el dedo
  let swipeX = null;
  hero.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') swipeX = e.clientX; });
  hero.addEventListener('pointerup', (e) => {
    if (swipeX === null) return;
    const dx = e.clientX - swipeX;
    swipeX = null;
    if (Math.abs(dx) < 50) return;
    const d = dx < 0 ? 1 : -1;
    goTo((current + d + slides.length) % slides.length, { dir: d, user: true });
  });

  // Punto AF que sigue al puntero + paralaje leve
  if (finePointer && !reduce) {
    const af = $$('.hud__af i', hero);
    let raf = 0;
    hero.addEventListener('pointermove', (e) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        let best = null;
        let bd = Infinity;
        af.forEach((i) => {
          const r = i.getBoundingClientRect();
          const d = (r.left + r.width / 2 - e.clientX) ** 2 + (r.top + r.height / 2 - e.clientY) ** 2;
          if (d < bd) { bd = d; best = i; }
        });
        af.forEach((i) => i.classList.toggle('is-on', i === best));
        const nx = e.clientX / innerWidth - 0.5;
        const ny = e.clientY / innerHeight - 0.5;
        gsap.to('.hero__slides', { x: nx * -22, y: ny * -14, duration: 1.2, ease: 'power3.out' });
      });
    });
  }

  ScrollTrigger.create({
    trigger: hero,
    start: 'top top',
    end: 'bottom top',
    onToggle: (s) => { inView = s.isActive; syncPause(); },
  });

  if (!reduce) {
    gsap.set('.hero__slides', { scale: 1.05 });
    gsap.to('.hero__slides', {
      yPercent: 16,
      ease: 'none',
      scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true },
    });
    gsap.to(['.hero__content', '.hero__bar'], {
      y: -70,
      opacity: 0,
      ease: 'none',
      scrollTrigger: { trigger: hero, start: 'top top', end: '55% top', scrub: true },
    });
  }
  gsap.set($('img', slides[0]), { scale: 1.08 });

  /* ---------- Loader → apertura del obturador ---------- */
  function introHero() {
    root.classList.remove('is-loading');
    const slide = slides[0];
    if (reduce) {
      if (lenis) lenis.start();
      startHero();
      return;
    }
    const o = { r: 0 };
    setTri(slide, 0, -50);
    gsap.timeline({
      onComplete: () => {
        slide.style.clipPath = '';
        if (lenis) lenis.start();
        ScrollTrigger.refresh();
        startHero();
      },
    })
      .to(o, { r: 1, duration: 1.8, ease: 'expo.inOut', onUpdate: () => setTri(slide, o.r, -50 * (1 - o.r)) }, 0)
      .fromTo($('img', slide), { scale: 1.5 }, { scale: 1.08, duration: 2.6, ease: 'expo.out' }, 0.25)
      .from('.hud__c', { opacity: 0, scale: 1.8, duration: 1, ease: 'expo.out', stagger: 0.06 }, 0.9)
      .from(heroChars, { yPercent: 118, duration: 1.4, ease: 'expo.out', stagger: 0.075 }, 1.0)
      .from(['.hero__eyebrow', '.hero__captions', '.hero__ctas', '.hud-data', '.hero__tabs'], {
        y: 26, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: 0.08,
      }, 1.25)
      .from(['.hud__words li', '.hud__status', '.hud__af i'], { opacity: 0, duration: 0.5, stagger: 0.025 }, 1.4);
  }

  function runLoader() {
    const loader = $('.loader');
    const bars = $$('.loader__bar', loader);
    const pct = $('.loader__pct', loader);
    const line = $('.loader__line i', loader);
    const counter = { v: 0 };
    const render = () => {
      pct.textContent = String(Math.round(counter.v)).padStart(3, '0');
      line.style.transform = `scaleX(${counter.v / 100})`;
    };

    const ready = Promise.race([
      Promise.all([document.fonts ? document.fonts.ready : Promise.resolve(), imgReady($('img', slides[0]))]),
      wait(5000),
    ]);

    if (reduce) {
      ready.then(() => {
        loader.style.display = 'none';
        introHero();
      });
      return;
    }

    // En recargas dentro de la misma sesión el loader es más breve
    let seen = false;
    try {
      seen = sessionStorage.getItem('delta-intro') === '1';
      sessionStorage.setItem('delta-intro', '1');
    } catch (err) { /* almacenamiento no disponible */ }

    gsap.to(bars, { strokeDashoffset: 0, duration: seen ? 0.6 : 1.15, ease: 'power2.inOut', stagger: seen ? 0.06 : 0.14 });
    const crawl = gsap.to(counter, { v: 84, duration: seen ? 0.6 : 2.4, ease: 'power1.out', onUpdate: render });

    Promise.all([ready, wait(seen ? 650 : 1500)]).then(() => {
      crawl.kill();
      gsap.timeline()
        .to(counter, { v: 100, duration: 0.45, ease: 'power2.out', onUpdate: render })
        .to(bars, { fill: 'rgba(236,231,220,1)', duration: 0.35, stagger: 0.06 }, '-=0.15')
        .to('.loader__mark', { scale: 0.55, opacity: 0, duration: 0.55, ease: 'power3.in' }, '+=0.15')
        .to(['.loader__meta', '.loader__line'], { opacity: 0, duration: 0.3 }, '<')
        .add(introHero, '-=0.15')
        .to(loader, { opacity: 0, duration: 0.45, ease: 'power1.out' }, '<')
        .set(loader, { display: 'none' });
    });
  }

  /* =========================================================
     CONCEPTO
     ========================================================= */
  const conceptText = $('[data-words]');
  const conceptWords = splitWords(conceptText);
  if (!reduce) {
    gsap.fromTo(
      conceptWords,
      { opacity: 0.14 },
      {
        opacity: 1,
        ease: 'none',
        stagger: 0.08,
        scrollTrigger: { trigger: conceptText, start: 'top 80%', end: 'bottom 45%', scrub: true },
      }
    );
  }
  $$('[data-fill]').forEach((el) => {
    if (reduce) { el.style.backgroundPosition = '0% 0'; return; }
    gsap.to(el, {
      backgroundPosition: '0% 0',
      ease: 'none',
      scrollTrigger: { trigger: el, start: 'top 90%', end: 'top 50%', scrub: true },
    });
  });

  /* =========================================================
     OBJETO
     ========================================================= */
  const object = $('.object');
  revealHeadings(object);
  if (!reduce) {
    const fig = $('.object__figure', object);
    gsap.fromTo(
      $('.object__img', object),
      { clipPath: 'inset(16% 14% 16% 14% round 10px)' },
      {
        clipPath: 'inset(0% 0% 0% 0% round 6px)',
        duration: 1.6,
        ease: 'expo.inOut',
        scrollTrigger: { trigger: fig, start: 'top 82%' },
      }
    );
    gsap.from($('.object__img img', object), {
      scale: 1.25, duration: 2, ease: 'expo.out', scrollTrigger: { trigger: fig, start: 'top 82%' },
    });
    gsap.from($$('.hotspot', object), {
      scale: 0, duration: 0.8, ease: 'back.out(2.2)', stagger: 0.09, delay: 0.9,
      scrollTrigger: { trigger: fig, start: 'top 82%' },
    });
    gsap.from($$('.specs-list li', object), {
      x: 40, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.08,
      scrollTrigger: { trigger: '.specs-list', start: 'top 85%' },
    });

    if (finePointer) {
      fig.addEventListener('pointermove', (e) => {
        const r = fig.getBoundingClientRect();
        const nx = (e.clientX - r.left) / r.width - 0.5;
        const ny = (e.clientY - r.top) / r.height - 0.5;
        gsap.to(fig, { rotationY: nx * 7, rotationX: ny * -6, transformPerspective: 1400, duration: 0.9, ease: 'power3.out' });
      });
      fig.addEventListener('pointerleave', () => gsap.to(fig, { rotationY: 0, rotationX: 0, duration: 1.2, ease: 'power3.out' }));
    }
  }

  /* =========================================================
     Secciones fijadas (orden de página)
     ========================================================= */
  const mm = gsap.matchMedia();

  // Las secciones "fijadas" usan position: sticky (CSS); GSAP solo lee el progreso.
  // Sin pins no hay estados que se corrompan al cambiar el tamaño de la ventana.

  // ATRIBUTOS — recorrido horizontal
  mm.add('(min-width: 900px) and (prefers-reduced-motion: no-preference)', () => {
    const sec = $('.attrs');
    const pin = $('.attrs__pin', sec);
    const track = $('.attrs__track', sec);
    const meter = $('.attrs__meter i', sec);
    const dist = () => Math.max(0, track.scrollWidth - document.documentElement.clientWidth);
    const setHeight = () => { sec.style.height = `${pin.offsetHeight + dist()}px`; };
    setHeight();
    ScrollTrigger.addEventListener('refreshInit', setHeight);

    const tween = gsap.to(track, {
      x: () => -dist(),
      ease: 'none',
      scrollTrigger: {
        trigger: sec,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.8,
        invalidateOnRefresh: true,
        onUpdate: (s) => gsap.set(meter, { scaleX: s.progress }),
      },
    });

    $$('.attr__media img', track).forEach((img) => {
      gsap.fromTo(img, { xPercent: -7 }, {
        xPercent: 7,
        ease: 'none',
        scrollTrigger: { trigger: img.parentElement, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true },
      });
    });
    $$('.attr__title', track).forEach((t) => {
      gsap.from(t, {
        yPercent: 60,
        opacity: 0,
        ease: 'none',
        scrollTrigger: { trigger: t, containerAnimation: tween, start: 'left 92%', end: 'left 55%', scrub: true },
      });
    });

    return () => {
      ScrollTrigger.removeEventListener('refreshInit', setHeight);
      sec.style.height = '';
    };
  });

  // SECUENCIA DE USO — la vista lateral se despliega con el scroll
  const seq = $('.seq');
  const sideTl = (() => {
    const seat = $('.side__seat', seq);
    const legL = $('.side__leg--l', seq);
    const legR = $('.side__leg--r', seq);
    const legC = $('.side__leg--c', seq);
    const shadow = $('.side__shadow', seq);
    const dim = $('.side__dim', seq);
    const dimLine = $('.side__dimline', seq);

    gsap.set(seat, { y: 172 });
    gsap.set(legL, { rotation: -90, transformOrigin: '50% 0%' });
    gsap.set(legR, { rotation: 90, transformOrigin: '50% 0%' });
    gsap.set(legC, { scaleY: 0.04, transformOrigin: '50% 0%' });
    gsap.set(shadow, { transformOrigin: '50% 50%' });
    gsap.set(dim, { opacity: 0 });
    gsap.set(dimLine, { strokeDasharray: 1, strokeDashoffset: 1 });

    // Un segundo por paso: Tomar · Desplegar · Apoyar · Listo
    return gsap.timeline({ paused: true, defaults: { ease: 'none' } })
      .to(seat, { y: -40, duration: 1, ease: 'power1.inOut' }, 0)
      .to(shadow, { scaleX: 0.7, opacity: 0.35, duration: 1 }, 0)
      .to(legL, { rotation: 33, duration: 1, ease: 'power2.inOut' }, 1)
      .to(legR, { rotation: -33, duration: 1, ease: 'power2.inOut' }, 1)
      .to(legC, { scaleY: 1, duration: 0.8, ease: 'power2.out' }, 1.15)
      .to(seat, { y: 0, duration: 1, ease: 'power2.in' }, 2)
      .to(shadow, { scaleX: 1.5, opacity: 1, duration: 1, ease: 'power2.in' }, 2)
      .to(dim, { opacity: 1, duration: 0.3 }, 3)
      .to(dimLine, { strokeDashoffset: 0, duration: 0.9, ease: 'power2.out' }, 3.05);
  })();
  sideTl.progress(1);

  mm.add('(prefers-reduced-motion: no-preference)', () => {
    const steps = $$('.seq__step', seq);
    const rail = $$('.seq__rail button', seq);
    const line = $('.seq__line i', seq);
    const fnum = $('.seq__fnum', seq);
    const stepTimes = [0.15, 1.6, 2.6, sideTl.duration()];
    let si = -1;

    seq.classList.add('is-live');
    sideTl.progress(0);

    const setStep = (s) => {
      if (s === si) return;
      si = s;
      fnum.textContent = s + 1;
      steps.forEach((el, i) => {
        el.classList.toggle('is-active', i === s);
        el.classList.toggle('is-past', i < s);
      });
      rail.forEach((b, i) => {
        b.classList.toggle('is-active', i === s);
        if (i === s) b.setAttribute('aria-current', 'step');
        else b.removeAttribute('aria-current');
      });
    };
    setStep(0);

    const st = ScrollTrigger.create({
      trigger: seq,
      start: 'top top',
      end: 'bottom bottom',
      animation: sideTl,
      scrub: 0.6,
      onUpdate: (self) => {
        setStep(Math.min(steps.length - 1, Math.floor(self.progress * sideTl.duration())));
        gsap.set(line, { scaleX: self.progress });
      },
    });

    const onRail = (e) => {
      const i = rail.indexOf(e.currentTarget);
      scrollToY(st.start + (st.end - st.start) * (stepTimes[i] / sideTl.duration()));
    };
    rail.forEach((b) => b.addEventListener('click', onRail));

    return () => {
      rail.forEach((b) => b.removeEventListener('click', onRail));
      seq.classList.remove('is-live');
      steps.forEach((el) => el.classList.remove('is-active', 'is-past'));
      sideTl.progress(1);
    };
  });

  /* =========================================================
     FICHA TÉCNICA
     ========================================================= */
  const ficha = $('.ficha');
  revealHeadings(ficha);

  ScrollTrigger.create({
    trigger: '.ficha__top',
    start: 'top 82%',
    once: true,
    onEnter: () => $('.ficha__top').classList.add('is-drawn'),
  });

  $$('[data-count]').forEach((el) => {
    if (reduce) return;
    const end = Number(el.dataset.count);
    const o = { v: 0 };
    el.textContent = '0';
    gsap.to(o, {
      v: end,
      duration: 1.8,
      ease: 'power3.out',
      onUpdate: () => { el.textContent = Math.round(o.v); },
      scrollTrigger: { trigger: el, start: 'top 92%', once: true },
    });
  });

  if (!reduce) {
    gsap.from($$('.specs > div', ficha), {
      y: 24, opacity: 0, duration: 0.9, ease: 'expo.out', stagger: 0.06,
      scrollTrigger: { trigger: '.specs', start: 'top 88%' },
    });
  }

  /* =========================================================
     POR QUÉ DELTA
     ========================================================= */
  const why = $('.why');
  revealHeadings(why);
  ScrollTrigger.create({
    trigger: '.why__diagram',
    start: 'top 78%',
    once: true,
    onEnter: () => $('.why__diagram').classList.add('is-drawn'),
  });
  if (!reduce) {
    gsap.from($$('.why__vertex i', why), {
      scale: 0, duration: 0.9, ease: 'back.out(2.4)', stagger: 0.18, delay: 0.6,
      scrollTrigger: { trigger: '.why__diagram', start: 'top 78%' },
    });
    gsap.from(['.why__spokes', '.why__inner', '.why__center'], {
      opacity: 0, duration: 1.2, ease: 'power2.out', delay: 1.1,
      scrollTrigger: { trigger: '.why__diagram', start: 'top 78%' },
    });
  }

  // MÁS CERCA DE LO ESENCIAL — el encuadre se abre
  mm.add('(prefers-reduced-motion: no-preference)', () => {
    const sec = $('.essence');
    const frame = $('.essence__frame', sec);
    const spans = $$('.essence__line span', sec);
    gsap.timeline({
      scrollTrigger: { trigger: sec, start: 'top top', end: 'bottom bottom', scrub: 0.8 },
    })
      .fromTo(frame, { clipPath: 'inset(25% 33% 25% 33% round 8px)' }, { clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'power2.inOut' }, 0)
      .fromTo($('img', frame), { scale: 1.5 }, { scale: 1, ease: 'power2.inOut' }, 0)
      .fromTo(spans[0], { xPercent: 0 }, { xPercent: -26, ease: 'none' }, 0)
      .fromTo(spans[1], { xPercent: 0 }, { xPercent: 20, ease: 'none' }, 0);
  });

  /* =========================================================
     PROCESO + CIERRE
     ========================================================= */
  revealHeadings($('.process'));
  revealHeadings($('.finale'));
  if (!reduce) {
    gsap.from('.finale__logo', {
      y: 60, scale: 0.85, opacity: 0, duration: 1.8, ease: 'expo.out',
      scrollTrigger: { trigger: '.finale', start: 'top 70%' },
    });
    gsap.from($$('.swatches li'), {
      yPercent: 30, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.07,
      scrollTrigger: { trigger: '.swatches', start: 'top 88%' },
    });
  }

  /* =========================================================
     Navegación: tema por sección, ocultar al bajar, enlace activo
     ========================================================= */
  const nav = $('.nav');
  const navLinks = $$('.nav__links a');
  $$('main > section[data-theme], footer[data-theme]').forEach((sec) => {
    ScrollTrigger.create({
      trigger: sec,
      start: 'top 36px',
      end: 'bottom 36px',
      onToggle: (self) => {
        if (self.isActive) nav.dataset.theme = sec.dataset.theme;
      },
    });
  });
  navLinks.forEach((a) => {
    const sec = document.getElementById(a.getAttribute('href').slice(1));
    if (!sec) return;
    ScrollTrigger.create({
      trigger: sec,
      start: 'top 50%',
      end: 'bottom 50%',
      onToggle: (self) => a.classList.toggle('is-current', self.isActive),
    });
  });

  let lastY = 0;
  const onScroll = (y) => {
    nav.classList.toggle('is-scrolled', y > 30);
    const delta = y - lastY;
    if (Math.abs(delta) > 4) {
      nav.classList.toggle('is-hidden', delta > 0 && y > innerHeight * 0.7);
    }
    lastY = y;
  };
  if (lenis) lenis.on('scroll', ({ scroll }) => onScroll(scroll));
  else addEventListener('scroll', () => onScroll(scrollY), { passive: true });
  nav.addEventListener('focusin', () => nav.classList.remove('is-hidden'));

  /* =========================================================
     Mejoras globales
     ========================================================= */
  // Revelados y paralaje sin scroll-driven animations nativas
  if (!supportsSDA && !reduce) {
    root.classList.add('no-sda');
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      }),
      { rootMargin: '0px 0px -8% 0px' }
    );
    $$('.reveal').forEach((el) => io.observe(el));
    $$('.parallax > img').forEach((img) => {
      gsap.fromTo(img, { yPercent: -7, scale: 1.16 }, {
        yPercent: 7,
        ease: 'none',
        scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
      });
    });
  }

  // Barra de progreso de lectura (fallback)
  if (!CSS.supports('animation-timeline: scroll()') && !reduce) {
    const bar = $('.progress');
    ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (s) => gsap.set(bar, { scaleX: s.progress }) });
  }

  // Cinta "Secuencia de uso": responde a la velocidad del scroll
  const bandAnims = $$('.band__track').flatMap((t) => (t.getAnimations ? t.getAnimations() : []));
  if (lenis && bandAnims.length) {
    lenis.on('scroll', ({ velocity }) => {
      const v = Math.max(-5, Math.min(5, velocity * 0.12));
      const rate = (1 + Math.abs(v)) * (v < -0.05 ? -1 : 1);
      bandAnims.forEach((a) => { a.playbackRate = rate; });
    });
  }

  // Retícula de enfoque
  if (finePointer && !reduce) {
    const cur = $('.cursor');
    const label = $('.cursor__label', cur);
    let x = -100, y = -100, tx = -100, ty = -100;
    root.classList.add('has-cursor');
    addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      tx = e.clientX;
      ty = e.clientY;
      cur.classList.remove('is-out');
    }, { passive: true });
    document.documentElement.addEventListener('mouseleave', () => cur.classList.add('is-out'));
    gsap.ticker.add(() => {
      x += (tx - x) * 0.22;
      y += (ty - y) * 0.22;
      cur.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    });
    document.addEventListener('pointerover', (e) => {
      const t = e.target.closest('a, button, [data-cursor], .gallery__track');
      cur.classList.toggle('is-hover', !!t);
      const l = (t && t.dataset.cursor) || '';
      label.textContent = l;
      cur.classList.toggle('has-label', !!l);
    });
    addEventListener('pointerdown', () => cur.classList.add('is-down'));
    addEventListener('pointerup', () => cur.classList.remove('is-down'));

    // Botones magnéticos
    $$('.btn, .round, .hero__pause').forEach((el) => {
      const k = 0.3;
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        gsap.to(el, {
          x: (e.clientX - (r.left + r.width / 2)) * k,
          y: (e.clientY - (r.top + r.height / 2)) * k,
          duration: 0.5,
          ease: 'power3.out',
        });
      });
      el.addEventListener('pointerleave', () => gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.4)' }));
    });
  }

  /* ---------- Arranque ---------- */
  ScrollTrigger.sort();
  // Las tipografías web cambian la altura del texto: se recalculan las posiciones al cargarlas
  let fontTimer = 0;
  const refreshSoon = () => {
    clearTimeout(fontTimer);
    fontTimer = setTimeout(() => ScrollTrigger.refresh(), 120);
  };
  if (document.fonts) {
    document.fonts.ready.then(refreshSoon);
    document.fonts.addEventListener('loadingdone', refreshSoon);
  }
  addEventListener('load', refreshSoon);
  runLoader();

  /* =========================================================
     Módulos sin GSAP
     ========================================================= */
  function initMenu() {
    const menu = $('#menu');
    const toggle = $('.nav__toggle');
    if (!menu || !toggle || typeof menu.showModal !== 'function') return;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.addEventListener('click', () => {
      menu.showModal();
      toggle.setAttribute('aria-expanded', 'true');
      if (lenis) lenis.stop();
    });
    $('.menu__close', menu).addEventListener('click', () => menu.close());
    menu.addEventListener('close', () => {
      toggle.setAttribute('aria-expanded', 'false');
      if (lenis) lenis.start();
    });
  }

  function initHotspots() {
    const spots = $$('.hotspot');
    const list = $('.specs-list');
    if (!list) return;
    const items = $$('li', list);
    let pinned = null;
    const activate = (i) => {
      spots.forEach((s, k) => s.classList.toggle('is-active', k === i));
      items.forEach((l, k) => l.classList.toggle('is-active', k === i));
      list.classList.toggle('has-active', i !== null);
    };
    items.forEach((l, i) => {
      const p = $('p', l);
      p.id = `spec-${i}`;
      if (spots[i]) spots[i].setAttribute('aria-describedby', p.id);
      l.addEventListener('mouseenter', () => activate(i));
      l.addEventListener('mouseleave', () => activate(pinned));
    });
    spots.forEach((s, i) => {
      s.addEventListener('mouseenter', () => activate(i));
      s.addEventListener('mouseleave', () => activate(pinned));
      s.addEventListener('focus', () => activate(i));
      s.addEventListener('blur', () => activate(pinned));
      s.addEventListener('click', () => {
        pinned = pinned === i ? null : i;
        activate(pinned);
      });
    });
  }

  function initWhyTabs() {
    const tabsW = $$('.why__vertex');
    const panels = $$('.why__panel');
    if (!tabsW.length) return;
    const select = (i, focus) => {
      tabsW.forEach((t, k) => {
        t.setAttribute('aria-selected', String(k === i));
        t.tabIndex = k === i ? 0 : -1;
      });
      panels.forEach((p, k) => {
        p.hidden = k !== i;
        p.classList.toggle('is-active', k === i);
      });
      if (focus) tabsW[i].focus();
    };
    tabsW.forEach((t, i) => {
      t.addEventListener('click', () => select(i));
      t.addEventListener('keydown', (e) => {
        const n = tabsW.length;
        let j = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % n;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + n) % n;
        if (e.key === 'Home') j = 0;
        if (e.key === 'End') j = n - 1;
        if (j === null) return;
        e.preventDefault();
        select(j, true);
      });
    });
  }

  function initGallery() {
    const track = $('.gallery__track');
    if (!track) return;
    const items = $$('.gallery__item', track);
    const step = () => {
      const a = items[0].getBoundingClientRect();
      const b = items[1].getBoundingClientRect();
      return b.left - a.left;
    };
    $$('.gallery__nav button').forEach((b) =>
      b.addEventListener('click', () => {
        track.scrollBy({ left: step() * Number(b.dataset.dir), behavior: reduce ? 'auto' : 'smooth' });
      })
    );

    let down = false, moved = false, startX = 0, startLeft = 0;
    track.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      down = true;
      moved = false;
      startX = e.clientX;
      startLeft = track.scrollLeft;
    });
    addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - startX;
      if (!moved && Math.abs(dx) > 5) { moved = true; track.classList.add('is-dragging'); }
      if (moved) track.scrollLeft = startLeft - dx;
    });
    addEventListener('pointerup', () => {
      if (!down) return;
      down = false;
      if (!moved) return;
      const left = track.scrollLeft;
      track.classList.remove('is-dragging');
      // Reubica en la etapa más cercana al soltar
      const center = left + track.clientWidth / 2;
      let best = items[0];
      let bd = Infinity;
      items.forEach((it) => {
        const c = it.offsetLeft + it.offsetWidth / 2;
        if (Math.abs(c - center) < bd) { bd = Math.abs(c - center); best = it; }
      });
      track.scrollLeft = left;
      track.scrollTo({ left: best.offsetLeft + best.offsetWidth / 2 - track.clientWidth / 2, behavior: reduce ? 'auto' : 'smooth' });
    });
    track.addEventListener('click', (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);
  }

  function initFinaleGlow() {
    const fin = $('.finale');
    if (!fin || !finePointer) return;
    fin.addEventListener('pointermove', (e) => {
      const r = fin.getBoundingClientRect();
      fin.style.setProperty('--mx', `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`);
      fin.style.setProperty('--my', `${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`);
    });
  }

  function initHeroBasic() {
    const hs = $$('.hero__slide');
    const caps = $$('.hero__caption');
    const tb = $$('.hero__tab');
    tb.forEach((t, i) =>
      t.addEventListener('click', () => {
        hs.forEach((s, k) => {
          s.classList.toggle('is-active', k === i);
          if (k === i) s.removeAttribute('aria-hidden');
          else s.setAttribute('aria-hidden', 'true');
        });
        caps.forEach((c, k) => c.classList.toggle('is-active', k === i));
        tb.forEach((x, k) => x.classList.toggle('is-active', k === i));
      })
    );
    const p = $('.hero__pause');
    if (p) p.hidden = true;
  }
})();
