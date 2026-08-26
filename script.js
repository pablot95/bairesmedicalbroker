const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}
if (typeof gsap === 'undefined') {
  document.querySelectorAll('[data-animate]').forEach(el => { el.style.opacity = 1; el.style.transform = 'none'; });
}
if (typeof ScrollTrigger !== 'undefined') {
  window.addEventListener('load', () => ScrollTrigger.refresh());
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => ScrollTrigger.refresh()).catch(() => {});
  }
}

function initWspFloat() {
  const btn = document.getElementById('wsp-float');
  if (!btn) return;
  window.addEventListener('scroll', () => {
    if (window.scrollY > 600) btn.classList.add('visible'); else btn.classList.remove('visible');
  }, { passive: true });
}

function initNav() {
  const toggle = document.getElementById('menuToggle');
  const nav = document.getElementById('mainNav');
  const closeBtn = document.getElementById('navClose');
  if (!toggle || !nav) return;
  let bd = document.querySelector('.nav-backdrop');
  if (!bd) { bd = document.createElement('div'); bd.className = 'nav-backdrop'; (nav.closest('.site-header') || document.body).appendChild(bd); }
  const close = () => {
    nav.classList.remove('open'); bd.classList.remove('open'); nav.setAttribute('inert', '');
    toggle.setAttribute('aria-expanded', 'false'); document.body.classList.remove('no-scroll');
  };
  const open = () => {
    nav.classList.add('open'); bd.classList.add('open'); nav.removeAttribute('inert');
    toggle.setAttribute('aria-expanded', 'true'); document.body.classList.add('no-scroll');
    nav.querySelector('a')?.focus();
  };
  toggle.addEventListener('click', () => (nav.classList.contains('open') ? close() : open()));
  closeBtn?.addEventListener('click', () => { close(); toggle.focus(); });
  bd.addEventListener('click', close);
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', close));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && nav.classList.contains('open')) { close(); toggle.focus(); } });
  const mq = window.matchMedia('(min-width: 1041px)');
  const syncInert = () => { if (mq.matches) nav.removeAttribute('inert'); else if (!nav.classList.contains('open')) nav.setAttribute('inert', ''); };
  mq.addEventListener('change', syncInert);
  syncInert();
}

function initReveals() {
  const items = document.querySelectorAll('[data-animate]');
  if (!items.length) return;
  document.querySelectorAll('[data-animate-stagger]').forEach(parent => {
    parent.querySelectorAll('[data-animate]').forEach((el, i) => {
      el.style.transitionDelay = `${Math.min(i * 0.12, 0.72)}s`;
    });
  });
  if (!('IntersectionObserver' in window) || reduceMotion) {
    items.forEach(el => el.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('in'); io.unobserve(entry.target); }
    });
  }, { threshold: 0, rootMargin: '0px 0px -7% 0px' });
  items.forEach(el => io.observe(el));

  let queued = false;
  const sweep = () => {
    queued = false;
    let pending = 0;
    items.forEach(el => {
      if (el.classList.contains('in')) return;
      const r = el.getBoundingClientRect();
      if (r.bottom > 0 && r.top < window.innerHeight) { el.classList.add('in'); io.unobserve(el); }
      else pending++;
    });
    if (!pending) {
      window.removeEventListener('scroll', queueSweep);
      window.removeEventListener('resize', queueSweep);
    }
  };
  const queueSweep = () => { if (!queued) { queued = true; requestAnimationFrame(sweep); } };
  window.addEventListener('load', queueSweep);
  window.addEventListener('scroll', queueSweep, { passive: true });
  window.addEventListener('resize', queueSweep, { passive: true });
}

function initHero() {
  if (typeof gsap === 'undefined' || reduceMotion) return;
  gsap.from('.hero-form-card', { y: 28, opacity: 0, duration: .9, delay: .25, ease: 'power3.out' });
}

function initHeroForm() {
  const form = document.getElementById('heroLeadForm');
  const status = document.getElementById('heroFormStatus');
  const submit = form?.querySelector('button[type="submit"]');
  if (!form || !status || !submit) return;

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!form.reportValidity()) return;

    const originalText = submit.textContent;
    submit.disabled = true;
    submit.textContent = 'Enviando…';
    status.textContent = '';
    status.className = 'hero-form-status';

    try {
      const response = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' }
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.message || 'No pudimos enviar la consulta.');
      form.reset();
      status.textContent = result.message || '¡Listo! Recibimos tus datos y te vamos a contactar.';
      status.classList.add('success');
    } catch (error) {
      status.textContent = `${error.message} También podés escribirnos por WhatsApp.`;
      status.classList.add('error');
    } finally {
      submit.disabled = false;
      submit.textContent = originalText;
    }
  });
}

function initCapitulo() {
  const stage = document.getElementById('capStage');
  const pasos = [...document.querySelectorAll('.cap-paso')];
  const opciones = [...document.querySelectorAll('.opcion')];
  const chat = document.getElementById('capChat');
  if (!stage || !pasos.length) return;

  let actual = -1;
  const aplicar = n => {
    if (n === actual) return;
    actual = n;
    pasos.forEach((p, i) => p.classList.toggle('is-on', i === n));
    opciones.forEach(o => o.classList.toggle('is-out', n >= Number(o.dataset.fuera || 99)));
    chat?.classList.toggle('is-on', n >= pasos.length - 1);
  };
  aplicar(0);

  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined' || reduceMotion) {
    stage.classList.add('is-lista');
    pasos.forEach(p => p.classList.add('is-on'));
    opciones.forEach(o => o.classList.remove('is-out'));
    return;
  }

  ScrollTrigger.create({
    trigger: stage,
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    invalidateOnRefresh: true,
    onUpdate: self => {
      const n = Math.min(pasos.length - 1, Math.max(0, Math.floor(self.progress * pasos.length)));
      aplicar(n);
    },
  });
}

function initConsulta() {
  const form = document.getElementById('consultaForm');
  const msgEl = document.getElementById('salidaMsg');
  const btn = document.getElementById('salidaBtn');
  if (!form || !msgEl || !btn) return;
  const WSP = '5492273470798';
  const base = 'Elegí las tres opciones y acá vas a ver el mensaje que sale.';
  const sel = { quienes: '', zona: '', prioridad: '' };

  const pintar = () => {
    if (!sel.quienes || !sel.zona || !sel.prioridad) {
      msgEl.textContent = base;
      msgEl.classList.add('vacio');
      btn.setAttribute('aria-disabled', 'true');
      btn.href = `https://wa.me/${WSP}`;
      return;
    }
    const msg = `Hola BMB! Quiero asesorarme por una cobertura médica. Se cubren: ${sel.quienes}. Zona: ${sel.zona}. Lo que más me importa: ${sel.prioridad}.`;
    msgEl.textContent = msg;
    msgEl.classList.remove('vacio');
    btn.removeAttribute('aria-disabled');
    btn.href = `https://wa.me/${WSP}?text=${encodeURIComponent(msg)}`;
  };

  form.querySelectorAll('.chip').forEach(chip => {
    chip.setAttribute('role', 'radio');
    chip.setAttribute('aria-checked', 'false');
    chip.addEventListener('click', () => {
      const grupo = chip.dataset.q;
      sel[grupo] = chip.dataset.val;
      form.querySelectorAll(`.chip[data-q="${grupo}"]`).forEach(c => {
        const on = c === chip;
        c.classList.toggle('on', on);
        c.setAttribute('aria-checked', on ? 'true' : 'false');
      });
      pintar();
    });
  });

  msgEl.classList.add('vacio');
  pintar();
}

function initAnclas() {
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      if (!id || id === '#') return;
      const destino = document.querySelector(id);
      if (!destino) return;
      e.preventDefault();
      destino.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initWspFloat();
  initHero();
  initHeroForm();
  initCapitulo();
  initConsulta();
  initAnclas();
  initReveals();
});
