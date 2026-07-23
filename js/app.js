let BOOKS = [];
let SOURCE_BOOKS = [];
let STATS = {};
let currentBook = null;
let currentCards = [];
let currentCardIndex = 0;
let currentFilter = 'all';
let currentSort = 'date';
let currentSearch = '';

async function init() {
  try {
    const resp = await fetch('data/books.json');
    const data = await resp.json();
    BOOKS = data.analyzed_books || [];
    SOURCE_BOOKS = data.source_books || [];
    STATS = data.stats || {};
    renderStats();
    renderNavStats();
    renderLibrary();
    renderBookshelf();
    document.getElementById('loading').style.opacity = '0';
    setTimeout(() => document.getElementById('loading').style.display = 'none', 500);
  } catch(e) {
    console.error('Failed to load data:', e);
    document.getElementById('loading').innerHTML = '<div class="logo">加载失败</div><p style="color:#a08b76;margin-top:12px">请通过 HTTP 服务器访问</p>';
  }
}

function renderNavStats() {
  const el = document.getElementById('nav-stats');
  el.innerHTML = `<b>${STATS.total_books}</b> 本书 · <b>${STATS.total_words.toLocaleString()}</b> 字 · <b>${STATS.total_reading_hours}</b> 小时`;
}

function renderStats() {
  const bar = document.getElementById('stats-bar');
  const items = [
    { label: '已拆书籍', value: STATS.total_books, unit: '本' },
    { label: '完整产出', value: STATS.complete_books, unit: '本' },
    { label: '精读版总字数', value: STATS.total_words.toLocaleString(), unit: '字' },
    { label: '总阅读时长', value: STATS.total_reading_hours, unit: '小时' },
    { label: 'MP3音频', value: STATS.total_mp3, unit: '个' },
    { label: '知识卡片', value: STATS.total_png, unit: '张' },
  ];
  bar.innerHTML = items.map(it => `
    <div class="stat-card">
      <div class="label">${it.label}</div>
      <div class="value">${it.value}<span class="unit">${it.unit}</span></div>
    </div>
  `).join('');
}

function renderLibrary() {
  let books = [...BOOKS];
  if (currentSearch) {
    const q = currentSearch.toLowerCase();
    books = books.filter(b => b.title.toLowerCase().includes(q));
  }
  if (currentFilter === 'S') books = books.filter(b => b.rating === 'S');
  else if (currentFilter === 'A') books = books.filter(b => b.rating === 'A');
  else if (currentFilter === 'complete') books = books.filter(b => b.is_complete);

  if (currentSort === 'date') books.sort((a,b) => (b.date||'').localeCompare(a.date||''));
  else if (currentSort === 'rating') books.sort((a,b) => (b.score||0) - (a.score||0));
  else if (currentSort === 'words') books.sort((a,b) => (b.word_count||0) - (a.word_count||0));
  else if (currentSort === 'title') books.sort((a,b) => a.title.localeCompare(b.title, 'zh'));

  const grid = document.getElementById('book-grid');
  if (books.length === 0) {
    grid.innerHTML = '<p style="color:#a08b76;text-align:center;padding:60px;grid-column:1/-1">没有找到匹配的书籍</p>';
    return;
  }
  grid.innerHTML = books.map((b, i) => {
    const delivs = [
      b.has_md, b.has_epub, b.has_mp3, b.has_png, b.has_koubo
    ];
    const dots = delivs.map(d => `<div class="deliv-dot ${d?'have':'miss'}"></div>`).join('');
    const wc = b.word_count > 0 ? b.word_count.toLocaleString() + '字' : '—';
    const rt = b.reading_time > 0 ? b.reading_time + '分钟' : '—';
    return `
      <div class="book-card" data-rating="${b.rating||''}" onclick="openDetail(${BOOKS.indexOf(b)})">
        <div class="book-cover">
          ${b.rating ? `<div class="rating-badge">${b.rating}</div>` : ''}
          <div class="title">${b.title}</div>
        </div>
        <div class="book-meta">
          <div class="meta-row">
            <span class="word-count">${wc}</span>
            <span class="time">${rt}</span>
          </div>
          <div class="deliverables">${dots}</div>
        </div>
      </div>
    `;
  }).join('');
}

function renderBookshelf() {
  const container = document.getElementById('bookshelf-content');
  const cats = {};
  SOURCE_BOOKS.forEach(b => {
    if (!cats[b.category]) cats[b.category] = [];
    cats[b.category].push(b);
  });
  let html = '';
  for (const [cat, books] of Object.entries(cats)) {
    html += `<div class="shelf">
      <div class="shelf-title">${cat} <span style="color:#a08b76;font-size:13px;font-weight:400">(${books.length}本)</span></div>
      <div class="shelf-books">`;
    books.forEach(b => {
      html += `<div class="shelf-book ${b.is_analyzed?'analyzed':''}" title="${b.title}">
        <div class="name">${b.title}</div>
        ${b.is_analyzed ? '<div class="tag">已拆</div>' : ''}
      </div>`;
    });
    html += `</div></div>`;
  }
  container.innerHTML = html;
}

function openDetail(idx) {
  currentBook = BOOKS[idx];
  if (!currentBook) return;
  const b = currentBook;
  const header = document.getElementById('detail-header');
  header.setAttribute('data-rating', b.rating||'');
  document.getElementById('detail-rating').textContent = b.rating || '—';
  document.getElementById('detail-book-info').innerHTML = `
    <h2>${b.title}</h2>
    <div class="sub">
      ${b.word_count>0?b.word_count.toLocaleString()+'字 · ':''}
      ${b.reading_time>0?b.reading_time+'分钟阅读 · ':''}
      ${b.date?'拆解于 '+b.date:''}
      ${b.orig_words?' · 原书约'+(b.orig_words/10000).toFixed(1)+'万字':''}
      ${b.compression_ratio?' · 压缩比1/'+Math.round(1/b.compression_ratio):''}
    </div>
  `;
  const tabs = document.getElementById('detail-tabs');
  const tabsHtml = [
    { id:'md', label:'精读版', avail: b.has_md },
    { id:'audio', label:'音频', avail: b.has_mp3 },
    { id:'cards', label:'卡片', avail: b.has_png },
    { id:'koubo', label:'口播', avail: b.has_koubo },
  ];
  tabs.innerHTML = tabsHtml.map((t,i) =>
    `<button onclick="switchTab('${t.id}')" id="tab-${t.id}" class="${i===0&&t.avail?'active':''}" ${t.avail?'':'disabled'}>${t.label}${t.avail&&t.id==='audio'&&b.mp3_count>1?' ('+b.mp3_count+')':''}${t.avail&&t.id==='cards'&&b.png_count>0?' ('+b.png_count+')':''}</button>`
  ).join('');
  const firstAvail = tabsHtml.find(t => t.avail);
  if (firstAvail) switchTab(firstAvail.id);
  else document.getElementById('detail-body').innerHTML = '<p style="text-align:center;padding:60px;color:#a08b76">暂无内容</p>';
  document.getElementById('detail-overlay').classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeDetail() {
  document.getElementById('detail-overlay').classList.remove('show');
  document.body.style.overflow = '';
  document.getElementById('reading-progress').style.display = 'none';
  const audio = document.getElementById('detail-audio-el');
  if (audio) audio.pause();
}

function switchTab(tabId) {
  document.querySelectorAll('.detail-tabs button').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('tab-'+tabId);
  if (btn) btn.classList.add('active');
  const body = document.getElementById('detail-body');
  const rp = document.getElementById('reading-progress');
  if (tabId === 'md') {
    rp.style.display = 'block';
    const md = currentBook.md_content || '精读版内容暂未加载';
    body.innerHTML = `<div class="md-reader" id="md-reader">${marked.parse(md)}</div>`;
    body.onscroll = () => {
      const reader = document.getElementById('md-reader');
      if (!reader) return;
      const max = body.scrollHeight - body.clientHeight;
      const pct = max > 0 ? (body.scrollTop / max * 100) : 0;
      document.getElementById('reading-bar').style.width = pct + '%';
    };
  } else if (tabId === 'audio') {
    rp.style.display = 'none';
    body.onscroll = null;
    renderAudio();
  } else if (tabId === 'cards') {
    rp.style.display = 'none';
    body.onscroll = null;
    renderCards();
  } else if (tabId === 'koubo') {
    rp.style.display = 'none';
    body.onscroll = null;
    renderKoubo();
  }
}

function renderAudio() {
  const body = document.getElementById('detail-body');
  const b = currentBook;
  if (!b.mp3_files || b.mp3_files.length === 0) {
    body.innerHTML = '<div style="text-align:center;padding:80px 40px;color:#6d5544"><div style="font-size:48px;margin-bottom:16px">&#127911;</div><p style="font-size:16px;font-weight:500;margin-bottom:8px">音频文件较大</p><p style="font-size:14px;color:#a08b76">云端版暂不提供音频播放，请在本地版收听精读版音频</p><p style="font-size:12px;color:#a08b76;margin-top:12px">本地访问地址：http://localhost:8090</p></div>';
    return;
  }
  let html = '<div class="audio-section"><div class="audio-player">';
  html += `<div class="track-info">
    <div class="icon">&#127925;</div>
    <div>
      <div class="name">${b.title} - 精读版音频</div>
      <div class="duration">${b.mp3_files.length} 个音频文件</div>
    </div>
  </div>`;
  html += `<audio id="detail-audio-el" controls preload="metadata" style="width:100%;margin-top:8px"></audio>`;
  html += '</div>';
  if (b.mp3_files.length > 1) {
    html += '<div class="track-list">';
    b.mp3_files.forEach((f, i) => {
      const name = f.replace(/\.mp3$/,'').replace(/^.*?_/, '');
      html += `<div class="track-item" id="track-${i}" onclick="playTrack(${i})">
        <div class="num">${i+1}</div>
        <div class="name">${name}</div>
      </div>`;
    });
    html += '</div>';
  }
  html += '</div>';
  body.innerHTML = html;
  if (b.mp3_files.length > 0) playTrack(0);
}

function playTrack(idx) {
  const b = currentBook;
  const audio = document.getElementById('detail-audio-el');
  if (!audio || !b.mp3_files[idx]) return;
  audio.src = 'assets/mp3/' + encodeURIComponent(b.mp3_files[idx]);
  audio.play();
  document.querySelectorAll('.track-item').forEach((el, i) => {
    el.classList.toggle('playing', i === idx);
  });
}

function renderCards() {
  const body = document.getElementById('detail-body');
  const b = currentBook;
  if (!b.png_files || b.png_files.length === 0) {
    body.innerHTML = '<p style="text-align:center;padding:60px;color:#a08b76">暂无知识卡片</p>';
    return;
  }
  currentCards = b.png_files;
  body.innerHTML = '<div class="card-gallery">' +
    b.png_files.map((f, i) =>
      `<div class="card-thumb" onclick="openLightbox(${i})">
        <img src="assets/png/${encodeURIComponent(f)}" loading="lazy" alt="卡片${i+1}">
      </div>`
    ).join('') + '</div>';
}

function renderKoubo() {
  const body = document.getElementById('detail-body');
  const b = currentBook;
  if (!b.koubo_content) {
    body.innerHTML = '<p style="text-align:center;padding:60px;color:#a08b76">暂无选题口播文案</p>';
    return;
  }
  body.innerHTML = `<div class="koubo-section" id="koubo-reader">${marked.parse(b.koubo_content)}</div>`;
}

function openLightbox(idx) {
  currentCardIndex = idx;
  const lb = document.getElementById('lightbox');
  const img = document.getElementById('lightbox-img');
  const counter = document.getElementById('lightbox-counter');
  img.src = 'assets/png/' + encodeURIComponent(currentCards[idx]);
  counter.textContent = (idx+1) + ' / ' + currentCards.length;
  lb.classList.add('show');
}

function navCard(dir) {
  currentCardIndex = (currentCardIndex + dir + currentCards.length) % currentCards.length;
  openLightbox(currentCardIndex);
}

document.addEventListener('keydown', (e) => {
  const lb = document.getElementById('lightbox');
  if (lb.classList.contains('show')) {
    if (e.key === 'ArrowLeft') navCard(-1);
    else if (e.key === 'ArrowRight') navCard(1);
    else if (e.key === 'Escape') lb.classList.remove('show');
    return;
  }
  if (e.key === 'Escape') closeDetail();
});

document.getElementById('lightbox').addEventListener('click', (e) => {
  if (e.target.id === 'lightbox') {
    document.getElementById('lightbox').classList.remove('show');
  }
});

document.querySelectorAll('.topbar nav button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.topbar nav button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const view = btn.dataset.view;
    document.getElementById('view-library').style.display = view === 'library' ? '' : 'none';
    document.getElementById('view-bookshelf').style.display = view === 'bookshelf' ? '' : 'none';
  });
});

document.getElementById('search-input').addEventListener('input', (e) => {
  currentSearch = e.target.value;
  renderLibrary();
});

document.querySelectorAll('.filter-chips .chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.filter-chips .chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    currentFilter = chip.dataset.filter;
    renderLibrary();
  });
});

document.getElementById('sort-select').addEventListener('change', (e) => {
  currentSort = e.target.value;
  renderLibrary();
});

// === Password Gate ===
const AUTH_PWD = '662213';
const AUTH_KEY = 'zeyan_auth_ok';

(function() {
  if (sessionStorage.getItem(AUTH_KEY) === 'yes') {
    document.getElementById('auth-overlay').classList.add('hidden');
    document.getElementById('loading').style.display = '';
    init();
    return;
  }
  const input = document.getElementById('auth-input');
  const btn = document.getElementById('auth-btn');
  const err = document.getElementById('auth-error');
  function tryAuth() {
    if (input.value === AUTH_PWD) {
      sessionStorage.setItem(AUTH_KEY, 'yes');
      document.getElementById('auth-overlay').classList.add('hidden');
      document.getElementById('loading').style.display = '';
      err.textContent = '';
      init();
    } else {
      err.textContent = '密码错误，请重试';
      input.value = '';
      input.focus();
      input.style.borderColor = '#c0392b';
      setTimeout(() => { input.style.borderColor = ''; }, 1500);
    }
  }
  btn.addEventListener('click', tryAuth);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') tryAuth(); });
})();
