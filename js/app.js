// ===== State =====
let BOOKS=[],SOURCE_BOOKS=[],STATS={},QUOTES=[],GRAPH=[],KNOWLEDGE_CARDS=[];
let currentBook=null,currentCards=[],currentCardIndex=0;
let currentView='library',currentFilter='all',currentSort='recent',currentSearch='';
let currentQuoteFilter='all',currentQuoteSearch='';
let currentCardFilter='all';
let currentKCardFilter='all',currentKCardSearch='';
let charts={};
let mdFontSize=parseInt(localStorage.getItem('zeyan_md_fontsize'))||15;

// ===== Browse History (localStorage) =====
const HISTORY_KEY='zeyan_browse_history';
const SCROLL_KEY='zeyan_scroll_pos';

function getHistory(){
  try{return JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');}catch(e){return[];}
}

function addToHistory(title){
  let hist=getHistory().filter(t=>t!==title);
  hist.unshift(title);
  if(hist.length>100)hist=hist.slice(0,100);
  localStorage.setItem(HISTORY_KEY,JSON.stringify(hist));
}

function saveScrollPos(title,tab,pos){
  const key=SCROLL_KEY+'_'+title+'_'+tab;
  try{localStorage.setItem(key,String(pos));}catch(e){}
}

function getScrollPos(title,tab){
  const key=SCROLL_KEY+'_'+title+'_'+tab;
  return parseInt(localStorage.getItem(key)||'0')||0;
}

function hasBeenRead(title){
  return getHistory().includes(title);
}

// ===== Init =====
async function init(){
  try{
    const [booksResp,quotesResp,graphResp,cardsResp]=await Promise.all([
      fetch('data/books.json'),fetch('data/quotes.json'),fetch('data/graph_data.json'),fetch('data/knowledge_cards.json')
    ]);
    const booksData=await booksResp.json();
    BOOKS=booksData.analyzed_books||[];
    SOURCE_BOOKS=booksData.source_books||[];
    STATS=booksData.stats||{};

    try{const qd=await quotesResp.json();QUOTES=qd.quotes||[];}catch(e){QUOTES=[];}
    try{const gd=await graphResp.json();GRAPH=gd;}catch(e){GRAPH={nodes:[],links:[]};}
    try{const cd=await cardsResp.json();KNOWLEDGE_CARDS=cd.cards||[];}catch(e){KNOWLEDGE_CARDS=[];}

    document.getElementById('loading').style.opacity='0';
    setTimeout(()=>{
      document.getElementById('loading').style.display='none';
      document.getElementById('app').style.display='block';
      renderView('library');
      
      // Check URL hash for reader mode (e-reader bookmark support)
      if(location.hash.startsWith('#reader=')){
        const title=decodeURIComponent(location.hash.slice(8));
        setTimeout(()=>{
          const book=BOOKS.find(b=>b.title===title);
          if(book){
            currentBook=book;
            enterReaderMode();
          }
        },500);
      }
    },300);
  }catch(e){
    console.error('Init error:',e);
    document.getElementById('loading').innerHTML='<div class="logo" style="color:#c0392b">加载失败</div><p style="color:#a08b76;margin-top:12px">请通过 HTTP 服务器访问</p>';
  }
}

// ===== Navigation =====
function renderView(view){
  currentView=view;
  document.querySelectorAll('.nav-tabs button,.bottom-nav button').forEach(b=>{
    b.classList.toggle('active',b.dataset.view===view);
  });
  const main=document.getElementById('main');
  main.innerHTML='';
  main.classList.add('fade-in');
  setTimeout(()=>main.classList.remove('fade-in'),300);

  switch(view){
    case'library':renderLibrary();break;
    case'shelf':renderShelf();break;
    case'cards':renderCardWall();break;
    case'kcards':renderKnowledgeCards();break;
    case'quotes':renderQuotes();break;
    case'graph':renderGraph();break;
    case'dashboard':renderDashboard();break;
  }
}

document.querySelectorAll('.nav-tabs button,.bottom-nav button').forEach(b=>{
  b.addEventListener('click',()=>renderView(b.dataset.view));
});

// ===== View: Library =====
function renderLibrary(){
  const main=document.getElementById('main');

  // Stats bar
  let statsHTML='<div class="stats-bar">';
  const s=STATS;
  statsHTML+=`<div class="stat-item"><div class="stat-num">${BOOKS.length}</div><div class="stat-label">已拆书籍</div></div>`;
  statsHTML+=`<div class="stat-item"><div class="stat-num">${s.complete_books||0}</div><div class="stat-label">完整产出</div></div>`;
  statsHTML+=`<div class="stat-num" style="display:none">${s.total_words||0}</div>`;
  statsHTML+=`<div class="stat-item"><div class="stat-num">${((s.total_words||0)/10000).toFixed(1)}万</div><div class="stat-label">精读总字数</div></div>`;
  statsHTML+=`<div class="stat-item"><div class="stat-num">${(s.total_reading_hours||0).toFixed(1)}h</div><div class="stat-label">阅读时长</div></div>`;
  statsHTML+=`<div class="stat-item"><div class="stat-num">${s.total_png||0}</div><div class="stat-label">知识卡片</div></div>`;
  statsHTML+=`<div class="stat-item"><div class="stat-num">${s.total_mp3||0}</div><div class="stat-label">音频</div></div>`;
  statsHTML+='</div>';

  // Controls
  let controlsHTML='<div class="controls-bar">';
  controlsHTML+='<input type="text" class="search-box" id="lib-search" placeholder="搜索书名...">';
  controlsHTML+='<div class="filter-chips">';
  controlsHTML+='<button class="chip active" data-filter="all">全部</button>';
  controlsHTML+='<button class="chip" data-filter="S">S级</button>';
  controlsHTML+='<button class="chip" data-filter="A">A级</button>';
  controlsHTML+='<button class="chip" data-filter="complete">完整产出</button>';
  // 类目筛选（按书籍category字段动态生成）
  const cats=[...new Set(BOOKS.map(b=>b.category).filter(Boolean))];
  cats.forEach(c=>{controlsHTML+=`<button class="chip" data-filter="cat:${c}">${c}</button>`;});
  controlsHTML+='</div>';
  controlsHTML+='<select class="sort-select" id="lib-sort">';
  controlsHTML+='<option value="recent">最近浏览</option>';
  controlsHTML+='<option value="date">按日期</option>';
  controlsHTML+='<option value="rating">按评级</option>';
  controlsHTML+='<option value="words">按字数</option>';
  controlsHTML+='<option value="title">按书名</option>';
  controlsHTML+='</select></div>';

  main.innerHTML=statsHTML+controlsHTML+'<div class="book-grid" id="book-grid"></div>';

  // Bind events
  document.getElementById('lib-search').addEventListener('input',e=>{currentSearch=e.target.value;renderBookGrid();});
  document.querySelectorAll('.filter-chips .chip').forEach(c=>{
    c.addEventListener('click',()=>{
      document.querySelectorAll('.filter-chips .chip').forEach(x=>x.classList.remove('active'));
      c.classList.add('active');
      currentFilter=c.dataset.filter;
      renderBookGrid();
    });
  });
  document.getElementById('lib-sort').addEventListener('change',e=>{currentSort=e.target.value;renderBookGrid();});

  renderBookGrid();
}

function renderBookGrid(){
  let books=[...BOOKS];
  // Filter
  if(currentFilter==='S')books=books.filter(b=>b.rating==='S');
  else if(currentFilter==='A')books=books.filter(b=>b.rating==='A');
  else if(currentFilter==='complete')books=books.filter(b=>b.is_complete);
  else if(currentFilter.startsWith('cat:'))books=books.filter(b=>(b.category||'')===currentFilter.slice(4));
  // Search
  if(currentSearch){
    const q=currentSearch.toLowerCase();
    books=books.filter(b=>b.title.toLowerCase().includes(q));
  }
  // Sort
  if(currentSort==='recent'){
    const hist=getHistory();
    books.sort((a,b)=>{
      const ai=hist.indexOf(a.title),bi=hist.indexOf(b.title);
      if(ai===-1&&bi===-1)return (b.date||'').localeCompare(a.date||'');
      if(ai===-1)return 1;
      if(bi===-1)return-1;
      return ai-bi;
    });
  }else if(currentSort==='rating')books.sort((a,b)=>(b.rating||'')<(a.rating||'')?1:-1);
  else if(currentSort==='words')books.sort((a,b)=>(b.word_count||0)-(a.word_count||0));
  else if(currentSort==='title')books.sort((a,b)=>a.title.localeCompare(b.title,'zh'));
  else books.sort((a,b)=>(b.date||'').localeCompare(a.date||''));

  const grid=document.getElementById('book-grid');
  if(!grid)return;
  if(books.length===0){grid.innerHTML='<p style="grid-column:1/-1;text-align:center;padding:40px;color:#a08b76">未找到匹配的书籍</p>';return;}

  const hist=getHistory();
  grid.innerHTML=books.map(b=>{
    const dots=['md','epub','mp3','png','koubo'].map(k=>`<span class="${b['has_'+k]?'on':''}"></span>`).join('');
    const ratingClass=b.rating?`rating-${b.rating}`:'';
    const isRead=hist.includes(b.title);
    const readBadge=isRead?'<div class="read-badge">已读</div>':'';
    return `<div class="book-card ${isRead?'read':''}" onclick="openDetail('${b.title.replace(/'/g,"\\'")}')">
      <div class="book-cover">
        <div class="book-cover-text">${b.title}</div>
        ${b.rating?`<div class="book-rating ${ratingClass}">${b.rating}</div>`:''}
        ${readBadge}
      </div>
      <div class="book-info">
        <div class="book-title">${b.title}</div>
        <div class="book-meta">${b.category?`<span class="book-cat">${b.category}</span>`:''}${b.word_count?b.word_count+'字':''}${b.reading_time?' · '+b.reading_time+'min':''}</div>
        <div class="book-dots">${dots}</div>
      </div>
    </div>`;
  }).join('');
}

// ===== View: Shelf =====
function renderShelf(){
  const main=document.getElementById('main');
  const categories={};
  SOURCE_BOOKS.forEach(b=>{
    const cat=b.category||'其他';
    if(!categories[cat])categories[cat]=[];
    categories[cat].push(b);
  });

  let html='<div class="shelf-section">';
  html+=`<div class="stats-bar" style="margin:12px 0">
    <div class="stat-item"><div class="stat-num">${SOURCE_BOOKS.length}</div><div class="stat-label">源书总数</div></div>
    <div class="stat-item"><div class="stat-num">${BOOKS.length}</div><div class="stat-label">已拆解</div></div>
    <div class="stat-item"><div class="stat-num">${SOURCE_BOOKS.length-BOOKS.length}</div><div class="stat-label">待拆解</div></div>
    <div class="stat-item"><div class="stat-num">${Object.keys(categories).length}</div><div class="stat-label">分类</div></div>
  </div>`;

  const analyzedTitles=new Set(BOOKS.map(b=>b.title));

  for(const[cat,books]of Object.entries(categories)){
    html+=`<div class="shelf-category">
      <div class="shelf-cat-title">${cat} (${books.length})</div>
      <div class="shelf-list">`;
    books.sort((a,b)=>a.title.localeCompare(b.title,'zh'));
    books.forEach(b=>{
      const isAnalyzed=analyzedTitles.has(b.title);
      html+=`<div class="shelf-item ${isAnalyzed?'analyzed':''}" ${isAnalyzed?`onclick="openDetail('${b.title.replace(/'/g,"\\'")}')"`:''}>${b.title}${isAnalyzed?' <span style="color:#c8965a;font-size:10px">已拆</span>':''}</div>`;
    });
    html+='</div></div>';
  }
  html+='</div>';
  main.innerHTML=html;
}

// ===== View: Card Wall =====
function renderCardWall(){
  const main=document.getElementById('main');
  const allCards=[];
  BOOKS.forEach(b=>{
    (b.png_files||[]).forEach(f=>{
      allCards.push({file:f,book:b.title,rating:b.rating});
    });
  });

  // Filter chips by book
  const bookNames=['all',...new Set(allCards.map(c=>c.book))];
  let chipsHTML='<div class="controls-bar"><div class="filter-chips">';
  bookNames.forEach((name,i)=>{
    if(i>12)return; // Limit chips
    chipsHTML+=`<button class="chip ${i===0?'active':''}" data-card-filter="${name}">${i===0?'全部':name}</button>`;
  });
  chipsHTML+='</div></div>';

  main.innerHTML=chipsHTML+'<div class="card-wall" id="card-wall-grid"></div>';

  document.querySelectorAll('[data-card-filter]').forEach(c=>{
    c.addEventListener('click',()=>{
      document.querySelectorAll('[data-card-filter]').forEach(x=>x.classList.remove('active'));
      c.classList.add('active');
      currentCardFilter=c.dataset.cardFilter;
      renderCardWallGrid(allCards);
    });
  });

  currentCardFilter='all';
  renderCardWallGrid(allCards);
}

function renderCardWallGrid(allCards){
  let cards=allCards;
  if(currentCardFilter!=='all')cards=cards.filter(c=>c.book===currentCardFilter);
  const grid=document.getElementById('card-wall-grid');
  if(!grid)return;
  if(cards.length===0){grid.innerHTML='<p style="text-align:center;padding:40px;color:#a08b76">暂无卡片</p>';return;}

  grid.innerHTML=cards.map((c,i)=>{
    return `<div class="card-wall-item" onclick="openLightboxFromWall(${i},'${currentCardFilter}')">
      <img src="assets/png/${encodeURIComponent(c.file)}" loading="lazy" alt="${c.book}卡片">
      <div class="card-label">${c.book}</div>
    </div>`;
  }).join('');

  // Store for lightbox
  grid.dataset.cards=JSON.stringify(cards.map(c=>c.file));
}

function openLightboxFromWall(index,filter){
  const grid=document.getElementById('card-wall-grid');
  const files=JSON.parse(grid.dataset.cards||'[]');
  if(files.length===0)return;
  currentCards=files;
  currentCardIndex=Math.max(0,Math.min(index,files.length-1));
  showLightbox();
}

// ===== View: Quotes =====
function renderQuotes(){
  const main=document.getElementById('main');
  const themes=QUOTES.length>0?[...new Set(QUOTES.flatMap(q=>q.tags))]:[];

  let html=`<div class="stats-bar" style="margin:12px 16px">
    <div class="stat-item"><div class="stat-num">${QUOTES.length}</div><div class="stat-label">金句总数</div></div>
    <div class="stat-item"><div class="stat-num">${new Set(QUOTES.map(q=>q.book)).size}</div><div class="stat-label">来源书籍</div></div>
    <div class="stat-item"><div class="stat-num">${themes.length}</div><div class="stat-label">主题分类</div></div>
  </div>`;

  html+='<div class="controls-bar">';
  html+='<input type="text" class="search-box" id="quote-search" placeholder="搜索金句内容...">';
  html+='<div class="filter-chips" id="quote-filter-chips">';
  html+='<button class="chip active" data-quote-filter="all">全部</button>';
  themes.forEach(t=>{html+=`<button class="chip" data-quote-filter="${t}">${t}</button>`;});
  html+='</div></div>';

  html+='<div class="quotes-container" id="quotes-list"></div>';
  main.innerHTML=html;

  document.getElementById('quote-search').addEventListener('input',e=>{currentQuoteSearch=e.target.value;renderQuotesList();});
  document.querySelectorAll('[data-quote-filter]').forEach(c=>{
    c.addEventListener('click',()=>{
      document.querySelectorAll('[data-quote-filter]').forEach(x=>x.classList.remove('active'));
      c.classList.add('active');
      currentQuoteFilter=c.dataset.quoteFilter;
      renderQuotesList();
    });
  });

  currentQuoteFilter='all';
  currentQuoteSearch='';
  renderQuotesList();
}

function renderQuotesList(){
  let quotes=[...QUOTES];
  if(currentQuoteFilter!=='all')quotes=quotes.filter(q=>q.tags.includes(currentQuoteFilter));
  if(currentQuoteSearch){
    const s=currentQuoteSearch.toLowerCase();
    quotes=quotes.filter(q=>q.text.toLowerCase().includes(s)||q.book.toLowerCase().includes(s));
  }

  const list=document.getElementById('quotes-list');
  if(!list)return;
  if(quotes.length===0){list.innerHTML='<p style="text-align:center;padding:40px;color:#a08b76">未找到匹配的金句</p>';return;}

  // Limit to 100 for performance
  const display=quotes.slice(0,100);
  list.innerHTML=display.map((q,i)=>{
    return `<div class="quote-card">
      <div class="quote-text">${escapeHtml(q.text)}</div>
      <div class="quote-meta">
        <div>
          <span class="quote-book" onclick="openDetail('${q.book.replace(/'/g,"\\'")}')">${q.book}</span>
          ${q.rating?`<span class="quote-tag" style="background:var(--gold);color:var(--wood-dark)">${q.rating}</span>`:''}
        </div>
        <div class="quote-tags">${q.tags.map(t=>`<span class="quote-tag">${t}</span>`).join('')}</div>
      </div>
      <button class="quote-copy" onclick="copyQuote(${i})">复制</button>
    </div>`;
  }).join('');

  if(quotes.length>100){
    list.innerHTML+=`<p style="text-align:center;padding:20px;color:#a08b76;font-size:13px">还有 ${quotes.length-100} 条金句，请缩小搜索范围查看更多</p>`;
  }

  list.dataset.quotes=JSON.stringify(display);
}

function copyQuote(index){
  const list=document.getElementById('quotes-list');
  const quotes=JSON.parse(list.dataset.quotes||'[]');
  if(!quotes[index])return;
  const q=quotes[index];
  const text=`${q.text}\n—— ${q.book}`;
  navigator.clipboard.writeText(text).then(()=>{
    const btn=event.target;
    btn.textContent='已复制';
    setTimeout(()=>btn.textContent='复制',2000);
  }).catch(()=>{
    // Fallback
    const ta=document.createElement('textarea');
    ta.value=text;document.body.appendChild(ta);ta.select();
    document.execCommand('copy');document.body.removeChild(ta);
    event.target.textContent='已复制';
    setTimeout(()=>event.target.textContent='复制',2000);
  });
}

// ===== View: Knowledge Graph =====
function renderGraph(){
  const main=document.getElementById('main');
  const nodes=GRAPH.nodes||[];
  const links=GRAPH.links||[];
  const themes=GRAPH.themes||[];
  const themeColors=GRAPH.theme_colors||{};

  let html='<div class="graph-container">';
  html+=`<div class="stats-bar" style="margin:0 0 12px">
    <div class="stat-item"><div class="stat-num">${nodes.length}</div><div class="stat-label">书籍节点</div></div>
    <div class="stat-item"><div class="stat-num">${links.length}</div><div class="stat-label">关联连线</div></div>
    <div class="stat-item"><div class="stat-num">${themes.length}</div><div class="stat-label">主题分类</div></div>
  </div>`;

  html+='<div class="graph-svg-wrap" id="graph-wrap">';
  html+='<div class="graph-info" id="graph-info"></div>';
  html+='<svg class="graph-svg" id="graph-svg" viewBox="0 0 800 600"></svg>';
  html+='</div>';

  html+='<div class="graph-legend">';
  themes.forEach(t=>{
    html+=`<div class="legend-item"><div class="legend-dot" style="background:${themeColors[t]||'#95A5A6'}"></div>${t}</div>`;
  });
  html+='</div>';

  html+='</div>';
  main.innerHTML=html;

  // Render graph
  renderGraphSVG(nodes,links,themeColors);
}

function renderGraphSVG(nodes,links,themeColors){
  const svg=document.getElementById('graph-svg');
  if(!svg||nodes.length===0)return;

  const W=800,H=600;
  // Initialize node positions in a circle
  const positioned=nodes.map((n,i)=>{
    const angle=(i/nodes.length)*2*Math.PI;
    const r=200;
    return{...n,x:W/2+Math.cos(angle)*r,y:H/2+Math.sin(angle)*r,vx:0,vy:0};
  });

  // Simple force simulation
  for(let iter=0;iter<300;iter++){
    // Repulsion
    for(let i=0;i<positioned.length;i++){
      for(let j=i+1;j<positioned.length;j++){
        const dx=positioned[j].x-positioned[i].x;
        const dy=positioned[j].y-positioned[i].y;
        const dist=Math.sqrt(dx*dx+dy*dy)+0.1;
        const force=3000/(dist*dist);
        positioned[i].vx-=force*dx/dist;
        positioned[i].vy-=force*dy/dist;
        positioned[j].vx+=force*dx/dist;
        positioned[j].vy+=force*dy/dist;
      }
    }
    // Attraction along links
    links.forEach(l=>{
      const s=positioned.find(n=>n.id===l.source);
      const t=positioned.find(n=>n.id===l.target);
      if(!s||!t)return;
      const dx=t.x-s.x,dy=t.y-s.y;
      const dist=Math.sqrt(dx*dx+dy*dy)+0.1;
      const force=(dist-120)*0.03;
      s.vx+=force*dx/dist;s.vy+=force*dy/dist;
      t.vx-=force*dx/dist;t.vy-=force*dy/dist;
    });
    // Center gravity
    positioned.forEach(n=>{
      n.vx+=(W/2-n.x)*0.005;
      n.vy+=(H/2-n.y)*0.005;
    });
    // Apply
    positioned.forEach(n=>{
      n.vx*=0.85;n.vy*=0.85;
      n.x+=n.vx;n.y+=n.vy;
      // Boundaries
      n.x=Math.max(40,Math.min(W-40,n.x));
      n.y=Math.max(30,Math.min(H-30,n.y));
    });
  }

  // Render SVG
  let svgHTML='';

  // Links
  links.forEach(l=>{
    const s=positioned.find(n=>n.id===l.source);
    const t=positioned.find(n=>n.id===l.target);
    if(!s||!t)return;
    const midX=(s.x+t.x)/2,midY=(s.y+t.y)/2;
    const color=l.type==='递进'?'#27AE60':l.type==='同源'?'#E74C3C':l.type==='互补'?'#2E86C1':l.type==='跨域'?'#8E44AD':'#7F8C8D';
    svgHTML+=`<line x1="${s.x}" y1="${s.y}" x2="${t.x}" y2="${t.y}" stroke="${color}" stroke-width="1.5" stroke-opacity="0.4" stroke-dasharray="${l.type==='跨域'?'4,3':''}"/>`;
  });

  // Nodes
  positioned.forEach(n=>{
    const color=n.color||themeColors[n.theme]||'#95A5A6';
    const r=n.rating==='S'?12:n.rating==='A'?10:8;
    svgHTML+=`<g class="graph-node" data-id="${n.id}" style="cursor:pointer">
      <circle cx="${n.x}" cy="${n.y}" r="${r}" fill="${color}" stroke="${n.rating==='S'?'#ffd700':'none'}" stroke-width="${n.rating==='S'?2:0}" opacity="0.85"/>
      <text x="${n.x}" y="${n.y-r-4}" text-anchor="middle" font-size="10" fill="#e8dcc8" font-family="Noto Sans SC,sans-serif" pointer-events="none">${n.title.length>8?n.title.slice(0,7)+'…':n.title}</text>
    </g>`;
  });

  svg.innerHTML=svgHTML;

  // Bind click events
  svg.querySelectorAll('.graph-node').forEach(g=>{
    g.addEventListener('click',()=>{
      const id=g.dataset.id;
      const node=positioned.find(n=>n.id===id);
      if(!node)return;
      const info=document.getElementById('graph-info');
      const related=links.filter(l=>l.source===id||l.target===id);
      let relHTML='';
      related.forEach(l=>{
        const other=l.source===id?l.target:l.source;
        relHTML+=`<div style="margin-top:4px;color:#a08b76;font-size:11px">→ ${other} (${l.type})</div>`;
      });
      info.innerHTML=`<div class="gi-title">${node.title}</div>
        <div style="font-size:11px;color:#a08b76">主题: ${node.theme} | 评级: ${node.rating||'未评'} | ${node.word_count}字</div>
        <div style="margin-top:8px;font-size:11px;color:#d4a574">关联 (${related.length}):</div>
        ${relHTML||'<div style="color:#a08b76;font-size:11px">暂无关联</div>'}`;
      info.classList.add('show');
      // Also open detail on double click
      g.addEventListener('dblclick',()=>openDetail(id));
    });
  });

  // Click background to close info
  svg.addEventListener('click',e=>{
    if(e.target.tagName==='svg'||e.target.tagName==='line'){
      document.getElementById('graph-info').classList.remove('show');
    }
  });
}

// ===== View: Knowledge Cards =====
function renderKnowledgeCards(){
  const main=document.getElementById('main');
  const tags=KNOWLEDGE_CARDS.length>0?[...new Set(KNOWLEDGE_CARDS.flatMap(c=>c.tags))]:[];

  let html=`<div class="stats-bar" style="margin:12px 16px">
    <div class="stat-item"><div class="stat-num">${KNOWLEDGE_CARDS.length}</div><div class="stat-label">知识卡片</div></div>
    <div class="stat-item"><div class="stat-num">${new Set(KNOWLEDGE_CARDS.map(c=>c.book)).size}</div><div class="stat-label">来源书籍</div></div>
    <div class="stat-item"><div class="stat-num">${tags.length}</div><div class="stat-label">主题标签</div></div>
  </div>`;

  html+='<div class="controls-bar">';
  html+='<input type="text" class="search-box" id="kcard-search" placeholder="搜索卡片内容...">';
  html+='<div class="filter-chips" id="kcard-filter-chips">';
  html+='<button class="chip active" data-kcard-filter="all">全部</button>';
  tags.forEach(t=>{html+=`<button class="chip" data-kcard-filter="${t}">${t}</button>`;});
  html+='</div></div>';

  html+='<div class="kcards-container" id="kcards-list"></div>';
  main.innerHTML=html;

  document.getElementById('kcard-search').addEventListener('input',e=>{currentKCardSearch=e.target.value;renderKCardsList();});
  document.querySelectorAll('[data-kcard-filter]').forEach(c=>{
    c.addEventListener('click',()=>{
      document.querySelectorAll('[data-kcard-filter]').forEach(x=>x.classList.remove('active'));
      c.classList.add('active');
      currentKCardFilter=c.dataset.kcardFilter;
      renderKCardsList();
    });
  });

  currentKCardFilter='all';
  currentKCardSearch='';
  renderKCardsList();
}

function renderKCardsList(){
  let cards=[...KNOWLEDGE_CARDS];
  if(currentKCardFilter!=='all')cards=cards.filter(c=>c.tags.includes(currentKCardFilter));
  if(currentKCardSearch){
    const s=currentKCardSearch.toLowerCase();
    cards=cards.filter(c=>
      c.topic.toLowerCase().includes(s)||
      c.hook.toLowerCase().includes(s)||
      c.insight.toLowerCase().includes(s)||
      c.book.toLowerCase().includes(s)||
      c.action.some(a=>a.toLowerCase().includes(s))
    );
  }

  const list=document.getElementById('kcards-list');
  if(!list)return;
  if(cards.length===0){list.innerHTML='<p style="text-align:center;padding:40px;color:#a08b76">未找到匹配的知识卡片</p>';return;}

  // Limit for performance
  const display=cards.slice(0,80);
  list.innerHTML=display.map((c,i)=>{
    const actionsHTML=c.action.map(a=>`<li>${escapeHtml(a)}</li>`).join('');
    return `<div class="kcard">
      <div class="kcard-header">
        <div class="kcard-topic">${escapeHtml(c.topic)}</div>
        <div class="kcard-tags">${c.tags.map(t=>`<span class="kcard-tag">${t}</span>`).join('')}</div>
      </div>
      <div class="kcard-section">
        <div class="kcard-label kcard-hook-label">钩子</div>
        <div class="kcard-hook">${escapeHtml(c.hook)}</div>
      </div>
      <div class="kcard-section">
        <div class="kcard-label kcard-insight-label">洞见</div>
        <div class="kcard-insight">${escapeHtml(c.insight)}</div>
      </div>
      <div class="kcard-section">
        <div class="kcard-label kcard-action-label">行动</div>
        <ul class="kcard-actions">${actionsHTML}</ul>
      </div>
      <div class="kcard-footer">
        <span class="kcard-book" onclick="openDetail('${c.book.replace(/'/g,"\\'")}')">${escapeHtml(c.book)}</span>
        ${c.rating?`<span class="kcard-rating">${c.rating}</span>`:''}
        <button class="kcard-copy" onclick="copyKCard(${i})">复制卡片</button>
      </div>
    </div>`;
  }).join('');

  if(cards.length>80){
    list.innerHTML+=`<p style="text-align:center;padding:20px;color:#a08b76;font-size:13px">还有 ${cards.length-80} 张卡片，请缩小搜索范围</p>`;
  }

  list.dataset.cards=JSON.stringify(display);
}

function copyKCard(index){
  const list=document.getElementById('kcards-list');
  const cards=JSON.parse(list.dataset.cards||'[]');
  if(!cards[index])return;
  const c=cards[index];
  let text=`【${c.topic}】\n\n`;
  text+=`📌 钩子\n${c.hook}\n\n`;
  text+=`💡 洞见\n${c.insight}\n\n`;
  text+=`✅ 行动\n`;
  c.action.forEach((a,i)=>{text+=`${i+1}. ${a}\n`;});
  text+=`\n—— 《${c.book}》`;
  navigator.clipboard.writeText(text).then(()=>{
    const btn=event.target;
    btn.textContent='已复制';
    setTimeout(()=>btn.textContent='复制卡片',2000);
  }).catch(()=>{
    const ta=document.createElement('textarea');
    ta.value=text;document.body.appendChild(ta);ta.select();
    document.execCommand('copy');document.body.removeChild(ta);
    event.target.textContent='已复制';
    setTimeout(()=>event.target.textContent='复制卡片',2000);
  });
}

function renderBookKnowledgeCards(body,b){
  const cards=KNOWLEDGE_CARDS.filter(c=>c.book===b.title);
  if(cards.length===0){
    body.innerHTML='<p style="padding:40px;text-align:center;color:#a08b76">暂无知识卡片</p>';
    return;
  }
  let html='<div class="kcards-book-container">';
  cards.forEach((c,i)=>{
    const actionsHTML=c.action.map(a=>`<li>${escapeHtml(a)}</li>`).join('');
    html+=`<div class="kcard">
      <div class="kcard-header">
        <div class="kcard-topic">${escapeHtml(c.topic)}</div>
        <div class="kcard-tags">${c.tags.map(t=>`<span class="kcard-tag">${t}</span>`).join('')}</div>
      </div>
      <div class="kcard-section">
        <div class="kcard-label kcard-hook-label">钩子</div>
        <div class="kcard-hook">${escapeHtml(c.hook)}</div>
      </div>
      <div class="kcard-section">
        <div class="kcard-label kcard-insight-label">洞见</div>
        <div class="kcard-insight">${escapeHtml(c.insight)}</div>
      </div>
      <div class="kcard-section">
        <div class="kcard-label kcard-action-label">行动</div>
        <ul class="kcard-actions">${actionsHTML}</ul>
      </div>
      <button class="kcard-copy" onclick="copyBookKCard('${b.title.replace(/'/g,"\\'")}',${i})">复制卡片</button>
    </div>`;
  });
  html+='</div>';
  body.innerHTML=html;
  body.dataset.kcards=JSON.stringify(cards);
}

function copyBookKCard(bookTitle,index){
  const body=document.getElementById('detail-body');
  const cards=JSON.parse(body.dataset.kcards||'[]');
  if(!cards[index])return;
  const c=cards[index];
  let text=`【${c.topic}】\n\n`;
  text+=`📌 钩子\n${c.hook}\n\n`;
  text+=`💡 洞见\n${c.insight}\n\n`;
  text+=`✅ 行动\n`;
  c.action.forEach((a,i)=>{text+=`${i+1}. ${a}\n`;});
  text+=`\n—— 《${c.book}》`;
  navigator.clipboard.writeText(text).then(()=>{
    event.target.textContent='已复制';
    setTimeout(()=>event.target.textContent='复制卡片',2000);
  }).catch(()=>{
    const ta=document.createElement('textarea');
    ta.value=text;document.body.appendChild(ta);ta.select();
    document.execCommand('copy');document.body.removeChild(ta);
    event.target.textContent='已复制';
    setTimeout(()=>event.target.textContent='复制卡片',2000);
  });
}

// ===== View: Dashboard =====
function renderDashboard(){
  const main=document.getElementById('main');

  // Calculate stats
  const ratingCounts={S:0,A:0,B:0,'':0};
  BOOKS.forEach(b=>{ratingCounts[b.rating||'']=(ratingCounts[b.rating||'']||0)+1;});

  const themeCounts={};
  if(GRAPH.nodes){
    GRAPH.nodes.forEach(n=>{themeCounts[n.theme]=(themeCounts[n.theme]||0)+1;});
  }

  const totalWords=BOOKS.reduce((s,b)=>s+(b.word_count||0),0);
  const totalReading=BOOKS.reduce((s,b)=>s+(b.reading_time||0),0);
  const completeCount=BOOKS.filter(b=>b.is_complete).length;
  const sCount=ratingCounts.S||0;
  const aCount=ratingCounts.A||0;

  let html='<div class="dashboard">';

  // Stat cards
  html+='<div class="dash-cards">';
  html+=`<div class="dash-card"><div class="dc-num">${BOOKS.length}</div><div class="dc-label">已拆书籍</div><div class="dc-sub">完整产出 ${completeCount} 本</div></div>`;
  html+=`<div class="dash-card"><div class="dc-num">${(totalWords/10000).toFixed(1)}万</div><div class="dc-label">精读总字数</div><div class="dc-sub">平均 ${(totalWords/BOOKS.length).toFixed(0)} 字/本</div></div>`;
  html+=`<div class="dash-card"><div class="dc-num">${(totalReading/60).toFixed(1)}h</div><div class="dc-label">总阅读时长</div><div class="dc-sub">平均 ${(totalReading/BOOKS.length).toFixed(0)} 分钟/本</div></div>`;
  html+=`<div class="dash-card"><div class="dc-num">${sCount}</div><div class="dc-label">S级书籍</div><div class="dc-sub">A级 ${aCount} 本</div></div>`;
  html+='</div>';

  // Charts
  html+='<div class="chart-wrap"><div class="chart-title">评级分布</div><div class="chart-canvas-wrap"><canvas id="chart-rating"></canvas></div></div>';
  html+='<div class="chart-wrap"><div class="chart-title">主题分布</div><div class="chart-canvas-wrap"><canvas id="chart-theme"></canvas></div></div>';
  html+='<div class="chart-wrap"><div class="chart-title">精读版字数 TOP 10</div><div class="chart-canvas-wrap" style="height:280px"><canvas id="chart-words"></canvas></div></div>';

  html+='</div>';
  main.innerHTML=html;

  // Render charts
  setTimeout(()=>renderCharts(ratingCounts,themeCounts),100);
}

function renderCharts(ratingCounts,themeCounts){
  const goldColor='#c8965a';
  const colors=['#c8965a','#cd7f32','#a08b76','#6d5544','#d4a574','#8b6914','#5d4434','#3d2b1f','#e8dcc8','#c0392b','#27ae60','#2e86c1','#8e44ad'];

  // Rating distribution
  const ratingCtx=document.getElementById('chart-rating');
  if(ratingCtx){
    charts.rating=new Chart(ratingCtx,{
      type:'doughnut',
      data:{
        labels:['S级','A级','其他/未评'],
        datasets:[{
          data:[ratingCounts.S||0,ratingCounts.A||0,ratingCounts['']||0+ratingCounts.B||0],
          backgroundColor:[goldColor,'#cd7f32','#a08b76'],
          borderWidth:0
        }]
      },
      options:{
        responsive:true,maintainAspectRatio:false,
        plugins:{legend:{position:'right',labels:{color:'#e8dcc8',font:{size:12}}}}
      }
    });
  }

  // Theme distribution
  const themeCtx=document.getElementById('chart-theme');
  if(themeCtx){
    const sortedThemes=Object.entries(themeCounts).sort((a,b)=>b[1]-a[1]);
    charts.theme=new Chart(themeCtx,{
      type:'bar',
      data:{
        labels:sortedThemes.map(t=>t[0]),
        datasets:[{
          data:sortedThemes.map(t=>t[1]),
          backgroundColor:sortedThemes.map((t,i)=>colors[i%colors.length]),
          borderRadius:4
        }]
      },
      options:{
        responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:false}},
        scales:{
          x:{ticks:{color:'#a08b76',font:{size:10}},grid:{display:false}},
          y:{ticks:{color:'#a08b76',font:{size:11}},grid:{color:'rgba(200,150,90,0.1)'}}
        }
      }
    });
  }

  // Word count top 10
  const wordsCtx=document.getElementById('chart-words');
  if(wordsCtx){
    const top10=[...BOOKS].sort((a,b)=>(b.word_count||0)-(a.word_count||0)).slice(0,10);
    charts.words=new Chart(wordsCtx,{
      type:'bar',
      data:{
        labels:top10.map(b=>b.title.length>8?b.title.slice(0,7)+'…':b.title),
        datasets:[{
          data:top10.map(b=>b.word_count||0),
          backgroundColor:goldColor,
          borderRadius:4
        }]
      },
      options:{
        indexAxis:'y',
        responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:false}},
        scales:{
          x:{ticks:{color:'#a08b76',font:{size:10}},grid:{color:'rgba(200,150,90,0.1)'}},
          y:{ticks:{color:'#e8dcc8',font:{size:10}},grid:{display:false}}
        }
      }
    });
  }
}

// ===== Detail Overlay =====
function openDetail(title){
  const book=BOOKS.find(b=>b.title===title);
  if(!book)return;
  currentBook=book;

  // Record browse history
  addToHistory(title);

  document.getElementById('detail-title').textContent=book.title;

  // Tabs - add knowledge cards tab if available
  const tabs=document.getElementById('detail-tabs');
  let tabsHTML='';
  if(book.md_content)tabsHTML+='<button class="active" data-tab="md">精读版</button>';
  if(book.has_mp3||(book.mp3_files&&book.mp3_files.length>0))tabsHTML+='<button data-tab="audio">音频</button>';
  if(book.png_files&&book.png_files.length>0)tabsHTML+=`<button data-tab="cards">卡片 (${book.png_files.length})</button>`;
  // Check if this book has knowledge cards
  const bookKCards=KNOWLEDGE_CARDS.filter(c=>c.book===title);
  if(bookKCards.length>0)tabsHTML+=`<button data-tab="kcards">知识卡 (${bookKCards.length})</button>`;
  if(book.koubo_content)tabsHTML+='<button data-tab="koubo">口播</button>';
  tabs.innerHTML=tabsHTML;

  // Bind tab events
  tabs.querySelectorAll('button').forEach(b=>{
    b.addEventListener('click',()=>{
      // Save scroll pos of current tab before switching
      const body=document.getElementById('detail-body');
      if(currentBook&&currentTab){
        saveScrollPos(currentBook.title,currentTab,body.scrollTop);
      }
      tabs.querySelectorAll('button').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      currentTab=b.dataset.tab;
      renderDetailBody(b.dataset.tab);
    });
  });

  // Show overlay
  document.getElementById('detail-overlay').classList.add('show');
  document.body.style.overflow='hidden';

  // Default tab
  const firstTab=tabs.querySelector('button');
  if(firstTab){
    currentTab=firstTab.dataset.tab;
    renderDetailBody(firstTab.dataset.tab);
  }
}

let currentTab='md';

function renderDetailBody(tab){
  const body=document.getElementById('detail-body');
  const b=currentBook;
  if(!b)return;

  if(tab==='md'){
    let toolbar='<div class="md-toolbar">';
    toolbar+='<button class="md-tool-btn" onclick="generateLongImage()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>下载长图</button>';
    toolbar+='<button class="md-tool-btn" onclick="enterReaderMode()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>翻书模式</button>';
    toolbar+='<div class="md-font-ctrl"><button class="md-tool-btn md-font-btn" onclick="adjustMdFont(-1)" title="缩小字号">A-</button><button class="md-tool-btn md-font-btn" onclick="adjustMdFont(1)" title="放大字号">A+</button></div>';
    toolbar+='</div>';
    body.innerHTML=toolbar+'<div class="md-reader" id="md-reader-content">'+marked.parse(b.md_content||'')+'</div>';
    // Apply saved font size
    const reader=document.getElementById('md-reader-content');
    if(reader)reader.style.fontSize=mdFontSize+'px';
    // Restore scroll position
    const savedPos=getScrollPos(b.title,'md');
    if(savedPos>0){
      body.scrollTop=0;
      setTimeout(()=>{body.scrollTop=savedPos;},100);
    }else{
      body.scrollTop=0;
    }
    // Track scroll to save position
    body.onscroll=()=>{
      if(currentBook&&currentTab==='md'){
        saveScrollPos(currentBook.title,'md',body.scrollTop);
      }
    };
  }else if(tab==='audio'){
    renderAudio(body,b);
  }else if(tab==='cards'){
    renderCardGallery(body,b);
  }else if(tab==='kcards'){
    renderBookKnowledgeCards(body,b);
  }else if(tab==='koubo'){
    renderKoubo(body,b);
  }
}

function adjustMdFont(delta){
  mdFontSize=Math.max(12,Math.min(24,mdFontSize+delta));
  localStorage.setItem('zeyan_md_fontsize',String(mdFontSize));
  const reader=document.getElementById('md-reader-content');
  if(reader)reader.style.fontSize=mdFontSize+'px';
}

function renderAudio(body,b){
  const mp3s=b.mp3_files||[];
  if(mp3s.length===0){
    body.innerHTML='<div class="audio-note"><div class="an-text">音频文件较大<br>请在本地版收听<br><br>本地地址: localhost:8899</div></div>';
    return;
  }
  let html='<div class="audio-section">';
  html+='<div class="audio-player"><audio id="audio-player" controls></audio><div class="ap-title" id="audio-title"></div></div>';
  html+='<div class="audio-list">';
  mp3s.forEach((f,i)=>{
    html+=`<div class="audio-item ${i===0?'playing':''}" onclick="playAudio(${i})" data-file="${encodeURIComponent(f)}">${f.replace(/\.mp3$/,'')}</div>`;
  });
  html+='</div></div>';
  body.innerHTML=html;
  if(mp3s.length>0)playAudio(0);
}

function playAudio(index){
  const b=currentBook;
  const mp3s=b.mp3_files||[];
  if(!mp3s[index])return;
  const player=document.getElementById('audio-player');
  const title=document.getElementById('audio-title');
  if(player){
    player.src='assets/mp3/'+encodeURIComponent(mp3s[index]);
    player.play();
  }
  if(title)title.textContent=mp3s[index].replace(/\.mp3$/,'');
  document.querySelectorAll('.audio-item').forEach((el,i)=>{
    el.classList.toggle('playing',i===index);
  });
}

function renderCardGallery(body,b){
  const cards=b.png_files||[];
  let html='<div class="card-gallery">';
  cards.forEach((f,i)=>{
    html+=`<div class="card-gallery-item" onclick="openLightbox(${i})"><img src="assets/png/${encodeURIComponent(f)}" loading="lazy" alt="卡片${i+1}"></div>`;
  });
  html+='</div>';
  body.innerHTML=html;
  currentCards=cards;
}

function renderKoubo(body,b){
  const content=b.koubo_content||'';
  if(!content){body.innerHTML='<p style="padding:40px;text-align:center;color:#a08b76">暂无口播文案</p>';return;}
  body.innerHTML='<div class="koubo-section">'+marked.parse(content)+'</div>';
}

// Close detail
document.getElementById('detail-close').addEventListener('click',closeDetail);
document.getElementById('detail-overlay').addEventListener('click',e=>{
  if(e.target.id==='detail-overlay')closeDetail();
});
function closeDetail(){
  // Save scroll position before closing
  const body=document.getElementById('detail-body');
  if(currentBook&&currentTab){
    saveScrollPos(currentBook.title,currentTab,body.scrollTop);
  }
  body.onscroll=null;
  document.getElementById('detail-overlay').classList.remove('show');
  document.body.style.overflow='';
  // Stop audio
  const player=document.getElementById('audio-player');
  if(player){player.pause();player.src='';}
  // Re-sort library if on recent sort
  if(currentView==='library'&&currentSort==='recent'){
    renderBookGrid();
  }
}

// ===== Lightbox =====
function openLightbox(index){
  if(currentCards.length===0)return;
  currentCardIndex=Math.max(0,Math.min(index,currentCards.length-1));
  showLightbox();
}

function showLightbox(){
  const lb=document.getElementById('lightbox');
  const img=document.getElementById('lightbox-img');
  const counter=document.getElementById('lightbox-counter');
  img.src='assets/png/'+encodeURIComponent(currentCards[currentCardIndex]);
  counter.textContent=`${currentCardIndex+1} / ${currentCards.length}`;
  lb.classList.add('show');
}

document.getElementById('lightbox-close').addEventListener('click',()=>{
  document.getElementById('lightbox').classList.remove('show');
});
document.getElementById('lightbox-prev').addEventListener('click',()=>{
  currentCardIndex=(currentCardIndex-1+currentCards.length)%currentCards.length;
  showLightbox();
});
document.getElementById('lightbox-next').addEventListener('click',()=>{
  currentCardIndex=(currentCardIndex+1)%currentCards.length;
  showLightbox();
});

// Keyboard navigation
document.addEventListener('keydown',e=>{
  const lb=document.getElementById('lightbox');
  if(lb.classList.contains('show')){
    if(e.key==='ArrowLeft')document.getElementById('lightbox-prev').click();
    else if(e.key==='ArrowRight')document.getElementById('lightbox-next').click();
    else if(e.key==='Escape')lb.classList.remove('show');
  }
  const detail=document.getElementById('detail-overlay');
  if(detail.classList.contains('show')&&e.key==='Escape')closeDetail();
});

// Touch swipe for lightbox
let touchStartX=0;
document.getElementById('lightbox').addEventListener('touchstart',e=>{
  touchStartX=e.touches[0].clientX;
});
document.getElementById('lightbox').addEventListener('touchend',e=>{
  const dx=e.changedTouches[0].clientX-touchStartX;
  if(Math.abs(dx)>50){
    if(dx>0)document.getElementById('lightbox-prev').click();
    else document.getElementById('lightbox-next').click();
  }
});

// ===== Utils =====
function escapeHtml(text){
  const div=document.createElement('div');
  div.textContent=text;
  return div.innerHTML;
}

// ===== Long Image Generation =====
async function generateLongImage(){
  const b=currentBook;
  if(!b||!b.md_content){return;}
  
  const gen=document.getElementById('gen-overlay');
  const genText=document.getElementById('gen-text');
  gen.classList.add('show');
  genText.textContent='正在渲染内容...';
  
  try{
    // Ensure fonts are loaded
    if(document.fonts&&document.fonts.ready){await document.fonts.ready;}
    
    // Mobile-optimized: 750px width standard (displays at 375px on phone = 2x)
    // Font sizes calculated so text appears 14-16px on a 375px phone screen
    const IMG_W=750;
    const ratingColor=b.rating==='S'?'#c8965a':b.rating==='A'?'#cd7f32':'#a08b76';
    const today=new Date();
    const dateStr=today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0')+'-'+String(today.getDate()).padStart(2,'0');
    
    // Build the long image template with mobile-optimized typography
    const temp=document.createElement('div');
    temp.id='long-image-temp';
    temp.style.cssText='position:fixed;left:-99999px;top:0;width:'+IMG_W+'px;background:#f5ede0;box-sizing:border-box;font-family:Noto Serif SC,serif;';
    
    let html='<div style="padding:50px 40px 36px;">';
    
    // Header
    html+='<div style="text-align:center;margin-bottom:32px;padding-bottom:22px;border-bottom:2px solid #c8965a;">';
    html+='<div style="font-size:24px;color:#a08b76;letter-spacing:8px;margin-bottom:12px;">ZEYAN · 泽言拆书</div>';
    html+='<div style="font-size:42px;font-weight:700;color:#1a1410;line-height:1.35;margin-bottom:14px;">'+escapeHtml(b.title)+'</div>';
    html+='<div style="display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;">';
    if(b.rating){html+='<span style="background:'+ratingColor+';color:#fff;padding:6px 18px;border-radius:16px;font-size:22px;font-weight:600;">'+b.rating+'级</span>';}
    if(b.word_count){html+='<span style="color:#a08b76;font-size:22px;">'+b.word_count+'字</span>';}
    if(b.reading_time){html+='<span style="color:#a08b76;font-size:22px;">· '+b.reading_time+'分钟</span>';}
    html+='</div></div>';
    
    // Body - rendered MD with mobile-optimized font sizes
    // 30px body text → displays as ~15px on 375px phone screen
    html+='<div class="long-img-body" style="font-size:30px;line-height:1.9;color:#3d2b1f;">';
    html+=marked.parse(b.md_content);
    html+='</div>';
    
    // Footer
    html+='<div style="text-align:center;margin-top:44px;padding-top:22px;border-top:1px solid #d4c4a8;">';
    html+='<div style="font-size:24px;color:#8b6914;font-weight:600;">泽言拆书 · 个人知识管理系统</div>';
    html+='<div style="font-size:20px;color:#a08b76;margin-top:8px;">'+dateStr+' · 精读版</div>';
    html+='</div>';
    
    html+='</div>';
    temp.innerHTML=html;
    document.body.appendChild(temp);
    
    // Apply mobile-optimized styles to MD elements within the long image
    const bodyEl=temp.querySelector('.long-img-body');
    if(bodyEl){
      const style=document.createElement('style');
      style.textContent=`
        .long-img-body h1{font-size:40px;font-weight:700;color:#1a1410;margin-bottom:20px;line-height:1.35;}
        .long-img-body h2{font-size:34px;font-weight:600;color:#8b6914;margin:28px 0 16px;border-bottom:2px solid #c8965a;padding-bottom:8px;}
        .long-img-body h3{font-size:32px;font-weight:600;color:#3d2b1f;margin:24px 0 12px;}
        .long-img-body p{font-size:30px;line-height:1.9;color:#3d2b1f;margin-bottom:18px;text-align:justify;}
        .long-img-body blockquote{border-left:4px solid #c8965a;padding:14px 22px;margin:18px 0;background:#faf6ef;border-radius:0 8px 8px 0;}
        .long-img-body blockquote p{font-size:28px;color:#5d4434;margin:0;line-height:1.85;}
        .long-img-body strong{color:#8b6914;font-weight:600;}
        .long-img-body em{color:#5d4434;font-style:italic;}
        .long-img-body ul,.long-img-body ol{padding-left:28px;margin-bottom:18px;}
        .long-img-body li{font-size:30px;line-height:1.85;color:#3d2b1f;margin-bottom:10px;}
        .long-img-body code{background:#e8dcc8;padding:3px 8px;border-radius:4px;font-size:26px;}
        .long-img-body table{width:100%;border-collapse:collapse;margin:18px 0;font-size:24px;}
        .long-img-body th,.long-img-body td{border:1px solid #d4c4a8;padding:10px 14px;text-align:left;}
        .long-img-body th{background:#faf6ef;font-weight:600;}
        .long-img-body hr{border:none;border-top:2px solid #d4c4a8;margin:28px 0;}
      `;
      temp.appendChild(style);
    }
    
    genText.textContent='正在生成长图...';
    
    // Wait for rendering
    await new Promise(r=>setTimeout(r,200));
    
    const contentHeight=temp.scrollHeight;
    // Scale 2 for crisp text on retina/hi-dpi screens
    const scale=contentHeight>20000?1:contentHeight>10000?1.5:2;
    
    const canvas=await html2canvas(temp,{
      scale:scale,
      useCORS:true,
      backgroundColor:'#f5ede0',
      width:IMG_W,
      windowWidth:IMG_W,
      height:contentHeight,
      logging:false,
    });
    
    document.body.removeChild(temp);
    
    genText.textContent='正在下载...';
    
    // Convert to blob and download
    canvas.toBlob(function(blob){
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');
      a.href=url;
      a.download=b.title+'_精读版.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(()=>URL.revokeObjectURL(url),1000);
      gen.classList.remove('show');
    },'image/png',0.95);
    
  }catch(err){
    console.error('Long image error:',err);
    gen.classList.remove('show');
    alert('长图生成失败: '+err.message);
  }
}

// ===== Reader Mode (E-ink Friendly) =====
let readerMode=false;
let readerCurrentPage=0;
let readerTotalPages=1;
let readerFontSize=18;
let readerUIVisible=true;
let readerUITimer=null;

function enterReaderMode(){
  const b=currentBook;
  if(!b||!b.md_content){return;}
  
  // Close detail panel
  closeDetail();
  
  // Show reader overlay
  const overlay=document.getElementById('reader-overlay');
  overlay.classList.add('show');
  document.body.style.overflow='hidden';
  
  // Set title
  document.getElementById('reader-title').textContent=b.title;
  
  // Render content
  const content=document.getElementById('reader-page-content');
  content.innerHTML='<div class="md-reader">'+marked.parse(b.md_content)+'</div>';
  content.style.fontSize=readerFontSize+'px';
  content.style.transform='translateX(0)';
  
  readerMode=true;
  readerCurrentPage=0;
  
  // Calculate pages after content is rendered
  setTimeout(()=>{
    recalcReaderPages();
    updateReaderProgress();
    showReaderUI();
  },200);
  
  // Update URL hash for bookmarking on e-readers
  history.replaceState(null,'','#reader='+encodeURIComponent(b.title));
}

function exitReaderMode(){
  document.getElementById('reader-overlay').classList.remove('show');
  document.body.style.overflow='';
  readerMode=false;
  history.replaceState(null,'',location.pathname);
}

function recalcReaderPages(){
  const content=document.getElementById('reader-page-content');
  const area=document.getElementById('reader-page-area');
  if(!content||!area){return;}
  
  const pageWidth=window.innerWidth;
  const totalWidth=content.scrollWidth;
  readerTotalPages=Math.max(1,Math.ceil(totalWidth/pageWidth));
  
  // Clamp current page
  if(readerCurrentPage>=readerTotalPages){
    readerCurrentPage=readerTotalPages-1;
  }
}

function readerGoToPage(page){
  readerCurrentPage=Math.max(0,Math.min(page,readerTotalPages-1));
  const content=document.getElementById('reader-page-content');
  content.style.transform='translateX(-'+readerCurrentPage*100+'vw)';
  updateReaderProgress();
}

function readerNextPage(){
  if(readerCurrentPage<readerTotalPages-1){
    readerGoToPage(readerCurrentPage+1);
  }
}

function readerPrevPage(){
  if(readerCurrentPage>0){
    readerGoToPage(readerCurrentPage-1);
  }
}

function readerFont(delta){
  readerFontSize=Math.max(14,Math.min(28,readerFontSize+delta*2));
  const content=document.getElementById('reader-page-content');
  content.style.fontSize=readerFontSize+'px';
  // Recalculate pages after font change
  setTimeout(()=>{
    recalcReaderPages();
    readerGoToPage(readerCurrentPage);
  },100);
}

function updateReaderProgress(){
  const info=document.getElementById('reader-page-info');
  const fill=document.getElementById('reader-progress-fill');
  if(info){info.textContent=(readerCurrentPage+1)+' / '+readerTotalPages;}
  if(fill){fill.style.width=((readerCurrentPage+1)/readerTotalPages*100)+'%';}
}

function showReaderUI(){
  const topbar=document.getElementById('reader-topbar');
  const bottombar=document.getElementById('reader-bottombar');
  if(topbar)topbar.classList.remove('hidden');
  if(bottombar)bottombar.classList.remove('hidden');
  readerUIVisible=true;
  
  clearTimeout(readerUITimer);
  readerUITimer=setTimeout(()=>{
    if(readerUIVisible&&readerMode){
      if(topbar)topbar.classList.add('hidden');
      if(bottombar)bottombar.classList.add('hidden');
      readerUIVisible=false;
    }
  },3000);
}

function toggleReaderUI(){
  if(readerUIVisible){
    document.getElementById('reader-topbar').classList.add('hidden');
    document.getElementById('reader-bottombar').classList.add('hidden');
    readerUIVisible=false;
  }else{
    showReaderUI();
  }
}

// Reader tap zones
document.getElementById('reader-tap-left').addEventListener('click',()=>{
  readerPrevPage();
  showReaderUI();
});
document.getElementById('reader-tap-right').addEventListener('click',()=>{
  readerNextPage();
  showReaderUI();
});
document.getElementById('reader-tap-center').addEventListener('click',()=>{
  toggleReaderUI();
});

// Reader keyboard (ArrowLeft/ArrowRight for e-reader physical buttons)
document.addEventListener('keydown',e=>{
  if(!readerMode){return;}
  if(e.key==='ArrowLeft'||e.key==='PageUp'){
    e.preventDefault();
    readerPrevPage();
    showReaderUI();
  }else if(e.key==='ArrowRight'||e.key==='PageDown'||e.key===' '){
    e.preventDefault();
    readerNextPage();
    showReaderUI();
  }else if(e.key==='Escape'){
    exitReaderMode();
  }
});

// Recalculate on resize/rotation
window.addEventListener('resize',()=>{
  if(readerMode){
    recalcReaderPages();
    readerGoToPage(readerCurrentPage);
  }
});

// ===== Password Gate =====
const AUTH_PWD='662213';
const AUTH_KEY='zeyan_auth_ok';

(function(){
  if(sessionStorage.getItem(AUTH_KEY)==='yes'){
    document.getElementById('auth-overlay').classList.add('hidden');
    document.getElementById('loading').style.display='';
    init();
    return;
  }
  const input=document.getElementById('auth-input');
  const btn=document.getElementById('auth-btn');
  const err=document.getElementById('auth-error');
  function tryAuth(){
    if(input.value===AUTH_PWD){
      sessionStorage.setItem(AUTH_KEY,'yes');
      document.getElementById('auth-overlay').classList.add('hidden');
      document.getElementById('loading').style.display='';
      err.textContent='';
      init();
    }else{
      err.textContent='密码错误，请重试';
      input.value='';input.focus();
      input.style.borderColor='#c0392b';
      setTimeout(()=>{input.style.borderColor='';},1500);
    }
  }
  btn.addEventListener('click',tryAuth);
  input.addEventListener('keydown',e=>{if(e.key==='Enter')tryAuth();});
})();
