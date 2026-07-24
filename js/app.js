// ===== State =====
let BOOKS=[],SOURCE_BOOKS=[],STATS={},QUOTES=[],GRAPH={};
let currentBook=null,currentCards=[],currentCardIndex=0;
let currentView='library',currentFilter='all',currentSort='date',currentSearch='';
let currentQuoteFilter='all',currentQuoteSearch='';
let currentCardFilter='all';
let charts={};

// ===== Init =====
async function init(){
  try{
    const [booksResp,quotesResp,graphResp]=await Promise.all([
      fetch('data/books.json'),fetch('data/quotes.json'),fetch('data/graph_data.json')
    ]);
    const booksData=await booksResp.json();
    BOOKS=booksData.analyzed_books||[];
    SOURCE_BOOKS=booksData.source_books||[];
    STATS=booksData.stats||{};

    try{const qd=await quotesResp.json();QUOTES=qd.quotes||[];}catch(e){QUOTES=[];}
    try{const gd=await graphResp.json();GRAPH=gd;}catch(e){GRAPH={nodes:[],links:[]};}

    document.getElementById('loading').style.opacity='0';
    setTimeout(()=>{
      document.getElementById('loading').style.display='none';
      document.getElementById('app').style.display='block';
      renderView('library');
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
  controlsHTML+='</div>';
  controlsHTML+='<select class="sort-select" id="lib-sort">';
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
  // Search
  if(currentSearch){
    const q=currentSearch.toLowerCase();
    books=books.filter(b=>b.title.toLowerCase().includes(q));
  }
  // Sort
  if(currentSort==='rating')books.sort((a,b)=>{(b.rating||'')<(a.rating||'')?1:-1});
  else if(currentSort==='words')books.sort((a,b)=>(b.word_count||0)-(a.word_count||0));
  else if(currentSort==='title')books.sort((a,b)=>a.title.localeCompare(b.title,'zh'));
  else books.sort((a,b)=>(b.date||'').localeCompare(a.date||''));

  const grid=document.getElementById('book-grid');
  if(!grid)return;
  if(books.length===0){grid.innerHTML='<p style="grid-column:1/-1;text-align:center;padding:40px;color:#a08b76">未找到匹配的书籍</p>';return;}

  grid.innerHTML=books.map(b=>{
    const dots=['md','epub','mp3','png','koubo'].map(k=>`<span class="${b['has_'+k]?'on':''}"></span>`).join('');
    const ratingClass=b.rating?`rating-${b.rating}`:'';
    return `<div class="book-card" onclick="openDetail('${b.title.replace(/'/g,"\\'")}')">
      <div class="book-cover">
        <div class="book-cover-text">${b.title}</div>
        ${b.rating?`<div class="book-rating ${ratingClass}">${b.rating}</div>`:''}
      </div>
      <div class="book-info">
        <div class="book-title">${b.title}</div>
        <div class="book-meta">${b.word_count?b.word_count+'字':''}${b.reading_time?' · '+b.reading_time+'min':''}</div>
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

  document.getElementById('detail-title').textContent=book.title;

  // Tabs
  const tabs=document.getElementById('detail-tabs');
  let tabsHTML='';
  if(book.md_content)tabsHTML+='<button class="active" data-tab="md">精读版</button>';
  if(book.has_mp3||(book.mp3_files&&book.mp3_files.length>0))tabsHTML+='<button data-tab="audio">音频</button>';
  if(book.png_files&&book.png_files.length>0)tabsHTML+=`<button data-tab="cards">卡片 (${book.png_files.length})</button>`;
  if(book.koubo_content)tabsHTML+='<button data-tab="koubo">口播</button>';
  tabs.innerHTML=tabsHTML;

  // Bind tab events
  tabs.querySelectorAll('button').forEach(b=>{
    b.addEventListener('click',()=>{
      tabs.querySelectorAll('button').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      renderDetailBody(b.dataset.tab);
    });
  });

  // Show overlay
  document.getElementById('detail-overlay').classList.add('show');
  document.body.style.overflow='hidden';

  // Default tab
  const firstTab=tabs.querySelector('button');
  if(firstTab)renderDetailBody(firstTab.dataset.tab);
}

function renderDetailBody(tab){
  const body=document.getElementById('detail-body');
  const b=currentBook;
  if(!b)return;

  if(tab==='md'){
    body.innerHTML='<div class="md-reader">'+marked.parse(b.md_content||'')+'</div>';
    body.scrollTop=0;
  }else if(tab==='audio'){
    renderAudio(body,b);
  }else if(tab==='cards'){
    renderCardGallery(body,b);
  }else if(tab==='koubo'){
    renderKoubo(body,b);
  }
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
  document.getElementById('detail-overlay').classList.remove('show');
  document.body.style.overflow='';
  // Stop audio
  const player=document.getElementById('audio-player');
  if(player){player.pause();player.src='';}
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
