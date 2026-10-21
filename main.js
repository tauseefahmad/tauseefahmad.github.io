document.documentElement.classList.add('js');

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Theme toggle ---------- */
(() => {
  const root = document.documentElement;
  const isDark = () =>
    root.dataset.theme ? root.dataset.theme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.querySelector('.theme-toggle').addEventListener('click', () => {
    root.dataset.theme = isDark() ? 'light' : 'dark';
    try { localStorage.setItem('theme', root.dataset.theme); } catch (e) { /* storage blocked: fine */ }
  });
})();

/* ---------- Nav: border on scroll, active section ---------- */
(() => {
  const nav = document.querySelector('.nav');
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const links = new Map([...document.querySelectorAll('.nav-links a')].map((a) => [a.hash.slice(1), a]));
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        links.forEach((a) => a.classList.remove('active'));
        links.get(e.target.id)?.classList.add('active');
      }
    }
  }, { rootMargin: '-45% 0px -50% 0px' });
  links.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
})();

/* ---------- Reveal on scroll ---------- */
(() => {
  const items = document.querySelectorAll('.reveal');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }
  }, { threshold: 0.12 });
  items.forEach((el) => io.observe(el));
})();

/* ---------- Avatar: tilts toward the pointer ---------- */
(() => {
  const avatar = document.querySelector('[data-avatar]');
  const hero = document.querySelector('.hero');
  if (!avatar || reduceMotion || !window.matchMedia('(pointer: fine)').matches) return;
  let frame = 0;
  hero.addEventListener('pointermove', (e) => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const r = avatar.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / window.innerWidth;
      const dy = (e.clientY - (r.top + r.height / 2)) / window.innerHeight;
      avatar.style.transform = `perspective(500px) rotateY(${dx * 40}deg) rotateX(${-dy * 40}deg) scale(1.03)`;
    });
  });
  hero.addEventListener('pointerleave', () => { avatar.style.transform = ''; });
})();

/* ---------- Terminal replay (real output of the order-data-pipeline CLI) ---------- */
(() => {
  const term = document.querySelector('[data-terminal]');
  const out = term.querySelector('code');
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const script = [
    { cmd: 'orderpipe generate data/orders.csv --orders 2000' },
    { out: '<span class="t-dim">wrote 5173 rows to data/orders.csv</span>' },
    { cmd: 'orderpipe run data/orders.csv' },
    { out: 'orders.csv: run 1 <span class="t-ok">succeeded</span> - read 5173, loaded <span class="t-ok">4792</span>,\n  rejected <span class="t-bad">271</span>, duplicates <span class="t-warn">110</span>' },
    { cmd: 'orderpipe run data/orders.csv   <span class="t-dim"># again: idempotent</span>', html: true },
    { out: 'orders.csv: run 2 <span class="t-ok">succeeded</span> - read 5173, loaded <span class="t-ok">4792</span>,\n  rejected <span class="t-bad">271</span>, duplicates <span class="t-warn">110</span>' },
    { cmd: 'orderpipe report rejects --run 1' },
    { out: [
      '<span class="t-dim">reasons                                          rows</span>',
      'customer_email: should match pattern ...          <span class="t-bad">45</span>',
      'order_date: 2099-01-01 is in the future           <span class="t-bad">43</span>',
      "currency: unsupported currency 'EURO'             <span class=\"t-bad\">42</span>",
      'unit_price: Input should be a valid decimal       <span class="t-bad">41</span>',
      'sku: should match pattern ^[A-Z]{3}-\\d{4}$        <span class="t-bad">33</span>',
    ].join('\n') },
    { cmd: 'pytest -q' },
    { out: '<span class="t-ok">31 passed</span> <span class="t-dim">in 0.98s</span>' },
  ];
  const prompt = '<span class="t-prompt">❯</span> ';
  let run = 0;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function play() {
    const id = ++run;
    let html = '';
    const render = (cursor) => { out.innerHTML = html + (cursor ? '<span class="cursor"></span>' : ''); };
    for (const step of script) {
      if (id !== run) return;
      if (step.cmd) {
        const text = step.cmd;
        if (reduceMotion || step.html) {
          html += prompt + '<span class="t-cmd">' + (step.html ? text : esc(text)) + '</span>\n';
          render(true);
          await sleep(reduceMotion ? 0 : 400);
        } else {
          html += prompt;
          for (let i = 1; i <= text.length; i++) {
            if (id !== run) return;
            render(false);
            out.innerHTML = html + '<span class="t-cmd">' + esc(text.slice(0, i)) + '</span><span class="cursor"></span>';
            await sleep(22 + Math.random() * 40);
          }
          html += '<span class="t-cmd">' + esc(text) + '</span>\n';
          await sleep(250);
        }
      } else {
        html += step.out + '\n\n';
        render(true);
        await sleep(reduceMotion ? 0 : 700);
      }
    }
    html += prompt;
    render(true);
  }

  term.querySelector('.term-replay').addEventListener('click', play);
  if ('IntersectionObserver' in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) { play(); io.disconnect(); }
    });
    io.observe(term);
  } else {
    play();
  }
})();

/* ---------- FAIR checker: same 8 checks as FairnessEvaluator.java ---------- */
(() => {
  const form = document.querySelector('.demo-form');
  if (!form) return;
  const DOI = /^10\.\d{4,9}\/\S+$/;
  const HANDLE = /^hdl:\S+\/\S+$/;
  const OPEN_FORMATS = new Set(['text/csv', 'text/plain', 'text/tab-separated-values', 'application/json',
    'application/xml', 'application/vnd.apache.parquet', 'application/x-netcdf', 'application/x-hdf5',
    'image/tiff', 'image/png']);
  const LICENSES = new Set(['CC0-1.0', 'CC-BY-4.0', 'CC-BY-SA-4.0', 'ODbL-1.0', 'PDDL-1.0', 'MIT', 'Apache-2.0']);

  const presets = {
    messy: { identifier: '', description: 'Raw exports.', keywords: 'lab', accessUrl: 'http://lab-share.local/exports',
      format: 'application/vnd.ms-excel', license: '', creator: 'Demo Biochemistry Lab' },
    fair: { identifier: '10.5072/demo.soil.2023',
      description: 'Amplicon sequencing counts from 120 soil cores along the Lower Rhine, with depth, pH and GPS per core.',
      keywords: 'soil, microbiome, sequencing', accessUrl: 'https://example.org/data/soil-2023',
      format: 'text/csv', license: 'CC-BY-4.0', creator: 'Demo Lab for Environmental Genomics' },
  };

  const ring = document.querySelector('.ring-value');
  const scoreEl = document.querySelector('[data-score]');
  const list = document.querySelector('[data-checks]');
  const C = 2 * Math.PI * 52;
  let shown = 0;

  function evaluate(v) {
    const id = v.identifier.trim();
    const url = v.accessUrl.trim().toLowerCase();
    const keywords = new Set(v.keywords.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean));
    return [
      ['F', 'Persistent identifier', DOI.test(id) || HANDLE.test(id), 'Register a DOI (10.xxxx/…) or handle (hdl:…).'],
      ['F', 'Rich description', v.description.trim().length >= 50, 'Describe the data in at least 50 characters.'],
      ['F', 'Keywords', keywords.size >= 3, 'Add at least 3 keywords.'],
      ['A', 'Standard protocol', url.startsWith('https://') || url.startsWith('http://'), 'Give an http(s) access URL.'],
      ['A', 'Encrypted transport', url.startsWith('https://'), 'Serve the access URL over HTTPS.'],
      ['I', 'Open file format', OPEN_FORMATS.has(v.format.trim().toLowerCase()), 'Use an open format, e.g. text/csv.'],
      ['R', 'Reuse license', LICENSES.has(v.license.trim()), 'Attach an open license, e.g. CC-BY-4.0.'],
      ['R', 'Provenance', v.creator.trim() !== '', 'Name the creator or institution.'],
    ];
  }

  function animateNumber(to) {
    const from = shown;
    shown = to;
    if (reduceMotion) { scoreEl.textContent = to; return; }
    const start = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - start) / 500);
      scoreEl.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function update() {
    const values = Object.fromEntries(new FormData(form));
    const checks = evaluate(values);
    const passed = checks.filter((c) => c[2]).length;
    const score = Math.round((100 * passed) / checks.length);
    ring.style.strokeDashoffset = String(C * (1 - score / 100));
    ring.style.stroke = score >= 75 ? 'var(--good)' : score >= 50 ? 'var(--warn)' : 'var(--bad)';
    animateNumber(score);
    list.innerHTML = checks.map(([p, name, ok, hint]) => `
      <li class="${ok ? 'pass' : 'fail'}">
        <span class="ico" aria-label="${ok ? 'passed' : 'failed'}">${ok ? '✓' : '✗'}</span>
        <span><span class="p">${p}</span>${name}</span>
        ${ok ? '' : `<span class="hint">${hint}</span>`}
      </li>`).join('');
  }

  function load(name) {
    for (const [k, v] of Object.entries(presets[name])) form.elements[k].value = v;
    update();
  }

  form.addEventListener('input', update);
  document.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => load(b.dataset.preset)));
  load('messy');
})();

/* ---------- Copy e-mail ---------- */
(() => {
  const toast = document.querySelector('.toast');
  document.querySelectorAll('[data-copy]').forEach((btn) => btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
      toast.textContent = 'E-mail copied';
    } catch (e) {
      toast.textContent = btn.dataset.copy;
    }
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 1800);
  }));
})();
