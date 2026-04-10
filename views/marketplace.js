const renderMarketplace = (plugins) => {
    const categories = ['Todos', ...new Set(plugins.map(p => p.category))];

    return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>StunBot | Marketplace</title>
        <link rel="stylesheet" href="https://use.fontawesome.com/releases/v6.4.0/css/all.css">
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=JetBrains+Mono&display=swap" rel="stylesheet">
        <script src="https://js.tebex.io/"></script>
        <style>
            :root { --bg: #030712; --card: #0f172a; --primary: #38bdf8; --success: #10b981; --error: #ef4444; --border: rgba(255, 255, 255, 0.05); }
            body { font-family: 'Inter', sans-serif; background: var(--bg); color: white; margin: 0; background-image: radial-gradient(circle at 50% -20%, #1e293b, var(--bg)); min-height: 100vh; display: flex; flex-direction: column; }
            
            .nav-header { padding: 15px 40px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); background: rgba(3, 7, 18, 0.5); backdrop-filter: blur(10px); position: sticky; top: 0; z-index: 100; box-sizing: border-box; }
            .logo { font-weight: 800; font-size: 1.1rem; letter-spacing: -1px; color: white; text-decoration: none; }

            .container { max-width: 1200px; margin: 0 auto; padding: 40px 20px; width: 100%; box-sizing: border-box; }
            h1 { font-size: 2.2rem; font-weight: 800; letter-spacing: -1px; margin-bottom: 30px; text-align: center; }

            /* --- CONTROLES (BÚSQUEDA Y ORDEN) --- */
            .controls-wrapper {
                display: flex; gap: 15px; margin-bottom: 25px; background: rgba(255,255,255,0.02);
                padding: 12px; border-radius: 16px; border: 1px solid var(--border); align-items: center;
            }
            .search-box { flex: 1; position: relative; }
            .search-box i { position: absolute; left: 15px; top: 50%; transform: translateY(-50%); color: var(--primary); }
            .search-box input { 
                width: 100%; padding: 12px 15px 12px 45px; border-radius: 10px; border: 1px solid var(--border); 
                background: #0a0f1a; color: white; outline: none; transition: 0.3s; box-sizing: border-box; 
            }
            .sort-box select { width: 100%; padding: 12px; border-radius: 10px; border: 1px solid var(--border); background: #0a0f1a; color: white; cursor: pointer; outline: none; }

            /* --- FILTROS --- */
            .filter-wrapper { margin-bottom: 40px; text-align: center; }
            .filter-bar { 
                display: flex; justify-content: center; gap: 8px; flex-wrap: wrap; 
                overflow: hidden; max-height: none; transition: max-height 0.4s ease; 
            }
            .filter-btn { background: rgba(255,255,255,0.05); color: #94a3b8; border: 1px solid var(--border); padding: 8px 16px; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 0.8rem; transition: 0.3s; }
            .filter-btn.active { background: var(--primary); color: #030712; border-color: var(--primary); }
            .show-more-cats { display: none; background: none; border: none; color: var(--primary); font-weight: 800; font-size: 0.7rem; cursor: pointer; margin-top: 15px; text-transform: uppercase; }

            /* --- GRID --- */
            .plugin-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 25px; }
            .plugin-card { background: var(--card); border: 1px solid var(--border); border-radius: 24px; padding: 30px; text-align: left; display: flex; flex-direction: column; transition: 0.3s; position: relative; }
            .plugin-card:hover { border-color: var(--primary); transform: translateY(-5px); }

            /* Requerimientos */
            .req-info { position: absolute; top: 15px; right: 15px; color: #4b5563; cursor: help; font-size: 1.1rem; }
            .req-tooltip { visibility: hidden; width: 180px; background: #1e293b; color: #fff; text-align: left; border-radius: 12px; padding: 12px; position: absolute; z-index: 10; top: 35px; right: 0; opacity: 0; transition: 0.3s; font-size: 0.7rem; border: 1px solid var(--primary); box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
            .req-info:hover .req-tooltip { visibility: visible; opacity: 1; }

            .plugin-name { font-size: 1.25rem; font-weight: 700; margin: 15px 0 10px 0; color: white; }
            .plugin-desc { font-size: 0.85rem; color: #94a3b8; margin-bottom: 20px; flex-grow: 1; line-height: 1.5; }
            .btn-group { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 15px; }
            .btn-buy { background: white; color: black; border: none; padding: 10px; border-radius: 8px; font-weight: 800; cursor: pointer; font-size: 0.8rem; text-decoration: none; text-align: center; }
            .btn-preview { background: rgba(255,255,255,0.05); color: white; border: 1px solid rgba(255,255,255,0.1); padding: 10px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 0.8rem; }
            .btn-preview:hover { background: var(--primary); color: white; }

            /* --- RESPONSIVE ADAPTATIONS --- */
            @media (max-width: 768px) {
                .nav-header { padding: 15px 20px; }
                .logo span { display: none; }
                .controls-wrapper { flex-direction: column; gap: 10px; }
                .sort-box { width: 100%; }
                .filter-bar { max-height: 95px; justify-content: center; }
                .filter-bar.expanded { max-height: 1000px; }
                .show-more-cats { display: inline-block; }
                .plugin-grid { grid-template-columns: 1fr; }
                .btn-group { grid-template-columns: 1fr; }
            }

            /* --- CHAT MODAL --- */
            .chat-modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 2000; justify-content: center; align-items: center; backdrop-filter: blur(5px); }
            .chat-window { width: 95%; max-width: 400px; height: 85vh; background: #0b141a; border-radius: 20px; display: flex; flex-direction: column; overflow: hidden; border: 1px solid #202c33; }
            .chat-body { flex: 1; padding: 15px; overflow-y: auto; background-color: #0b141a; background-image: url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png'); background-blend-mode: overlay; display: flex; flex-direction: column; gap: 8px; }
            .msg { max-width: 85%; padding: 8px 12px; border-radius: 10px; font-size: 0.85rem; line-height: 1.4; word-wrap: break-word; }
            .msg.sent { background: #005c4b; align-self: flex-end; color: white; }
            .msg.received { background: #202c33; align-self: flex-start; color: white; }
            .suggestions { display: flex; gap: 8px; padding: 10px; background: #111b21; overflow-x: auto; border-bottom: 1px solid #202c33; min-height: 50px; align-items: center; }
            .sugg-chip { background: rgba(56, 189, 248, 0.1); color: var(--primary); border: 1px solid rgba(56, 189, 248, 0.2); padding: 6px 12px; border-radius: 15px; font-size: 0.7rem; font-weight: 700; cursor: pointer; white-space: nowrap; }

            .lock-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: var(--bg); z-index: 500; display: flex; justify-content: center; align-items: center; }
        </style>
    </head>
    <body>
        <div id="lockOverlay" class="lock-overlay">
            <div style="background:var(--card); padding:40px; border-radius:30px; border:1px solid var(--border); text-align:center; width:90%; max-width:400px;">
                <i class="fas fa-key" style="font-size:2rem; color:var(--primary); margin-bottom:15px;"></i>
                <h2 style="margin: 0; color: white; font-size: 1.5rem;">Acceso Privado</h2>
                <input type="text" id="m_key" style="width:100%; padding:15px; border-radius:12px; background:#000; border:1px solid #1e293b; color:white; text-align:center; margin: 20px 0;" placeholder="STUNBOT-XXXX-XXXX">
                <button style="width:100%; background:var(--primary); padding:15px; border:none; border-radius:12px; font-weight:800; cursor:pointer;" onclick="validateForMarket()">DESBLOQUEAR</button>
            </div>
        </div>

        <nav class="nav-header">
            <a href="/stunbot/verify" class="logo"><i class="fas fa-bolt" style="color:var(--primary)"></i> STUNBOT<span>MARKET</span></a>
            <a href="/stunbot/store" style="color:white; text-decoration:none; font-size:0.85rem; font-weight:600;">Tienda</a>
        </nav>

        <div class="container">
            <h1>Extensiones Premium</h1>

            <div class="controls-wrapper">
                <div class="search-box"><i class="fas fa-search"></i><input type="text" id="searchInput" placeholder="Buscar plugin..." oninput="applyFilters()"></div>
                <div class="sort-box">
                    <select id="sortInput" onchange="applyFilters()">
                        <option value="default">Ordenar por...</option>
                        <option value="low">Precio: Menor a Mayor</option>
                        <option value="high">Precio: Mayor a Menor</option>
                    </select>
                </div>
            </div>

            <div class="filter-wrapper">
                <div class="filter-bar" id="filterBar">
                    ${categories.map(cat => `
                        <button class="filter-btn ${cat === 'Todos' ? 'active' : ''}" data-category="${cat}" onclick="setCategory('${cat}', this)">
                            ${cat}
                        </button>
                    `).join('')}
                </div>
                <button class="show-more-cats" id="toggleCatsBtn" onclick="toggleCategories()">Ver todas las categorías <i class="fas fa-chevron-down"></i></button>
            </div>

            <div class="plugin-grid" id="pluginGrid"></div>
        </div>

        <div id="chatModal" class="chat-modal" onclick="if(event.target == this) closeChat()">
            <div class="chat-window">
                <div class="chat-header" style="background:#202c33; padding:15px; display:flex; align-items:center; gap:10px;">
                    <img src="https://ui-avatars.com/api/?name=Stun+Bot&background=38bdf8&color=fff" style="width:35px; border-radius:50%;">
                    <div><div style="font-weight:700; font-size:0.9rem; color:white;" id="chatName">Bot</div><div style="font-size:0.7rem; color:var(--success);">en línea</div></div>
                </div>
                <div class="suggestions" id="chatSuggestions"></div>
                <div class="chat-body" id="chatBody"></div>
                <div style="padding:15px; background:#202c33;"><input type="text" id="chatInput" style="width:100%; background:#2a3942; border:none; padding:12px; border-radius:8px; color:white;" placeholder="Toca una sugerencia..." readonly></div>
            </div>
        </div>

        <script>
            const allPlugins = ${JSON.stringify(plugins)};
            let currentCategory = 'Todos';

            function toggleCategories() {
                const bar = document.getElementById('filterBar');
                const btn = document.getElementById('toggleCatsBtn');
                const isExpanded = bar.classList.toggle('expanded');
                btn.innerHTML = isExpanded ? 'Ver menos <i class="fas fa-chevron-up"></i>' : 'Ver todas las categorías <i class="fas fa-chevron-down"></i>';
            }

            function setCategory(cat, btn) {
                currentCategory = cat;
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                applyFilters();
            }

            function applyFilters() {
                const searchTerm = document.getElementById('searchInput').value.toLowerCase();
                const sortOrder = document.getElementById('sortInput').value;
                let filtered = allPlugins.filter(p => (currentCategory === 'Todos' || p.category === currentCategory) && (p.name.toLowerCase().includes(searchTerm) || p.desc.toLowerCase().includes(searchTerm)));
                if (sortOrder === 'low') filtered.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
                else if (sortOrder === 'high') filtered.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
                renderGrid(filtered);
            }

            function renderGrid(list) {
                const grid = document.getElementById('pluginGrid');
                if (list.length === 0) { grid.innerHTML = '<div style="grid-column: 1/-1; padding: 50px; color: #4b5563;">No hay resultados.</div>'; return; }
                grid.innerHTML = list.map(p => {
                    const origIndex = allPlugins.findIndex(orig => orig.tebex_id === p.tebex_id);
                    const hasReqs = p.requirements && p.requirements.length > 0;
                    const reqHtml = hasReqs ? '<div class="req-info"><i class="fas fa-circle-question"></i><div class="req-tooltip"><b>Requerimientos:</b><ul style="margin:5px 0;padding-left:15px;">' + p.requirements.map(r => '<li>'+r+'</li>').join('') + '</ul></div></div>' : '';

                    return \`
                        <div class="plugin-card">
                            \${reqHtml}
                            <div style="display:flex; justify-content:space-between; align-items:start;">
                                <div style="color:var(--primary); font-size:1.4rem;"><i class="fas \${p.icon}"></i></div>
                                <span style="font-size:0.6rem; background:rgba(255,255,255,0.05); padding:4px 8px; border-radius:6px; color:var(--primary); border:1px solid rgba(56,189,248,0.2);">
                                    <i class="fas fa-folder-open"></i> plugins/\${p.category}/
                                </span>
                            </div>
                            <div class="plugin-name">\${p.name}</div>
                            <div class="plugin-desc">\${p.desc}</div>
                            <div style="font-family:monospace; font-weight:800; font-size:1.1rem;">$\${p.price} USD</div>
                            <div class="btn-group">
                                <button class="btn-preview" onclick="openPreview(\${origIndex})">VISTA PREVIA</button>
                                <button class="btn-buy" onclick="Tebex.checkout.openPackage(\${p.tebex_id})">ADQUIRIR</button>
                            </div>
                        </div>
                    \`;
                }).join('');
            }

            function openPreview(index) {
                const p = allPlugins[index];
                document.getElementById('chatName').innerText = p.name;
                document.getElementById('chatModal').style.display = 'flex';
                document.getElementById('chatBody').innerHTML = '<div class="msg received">¡Hola! Soy <b>' + p.name + '</b>. Prueba mis comandos.</div>';
                
                let suggHtml = '';
                (p.preview.suggestions || []).forEach(s => {
                    suggHtml += '<div class="sugg-chip" onclick="autoSend(' + index + ', \\'' + s + '\\')">' + s + '</div>';
                });
                document.getElementById('chatSuggestions').innerHTML = suggHtml;
            }

            function closeChat() { document.getElementById('chatModal').style.display = 'none'; }

            function autoSend(index, text) {
                const p = allPlugins[index];
                const body = document.getElementById('chatBody');
                body.innerHTML += '<div class="msg sent">' + text + '</div>';
                body.scrollTop = body.scrollHeight;
                setTimeout(() => {
                    const resp = p.preview.responses[text];
                    if (resp) {
                        if (typeof resp === 'string') body.innerHTML += '<div class="msg received">' + resp.replace(/\\n/g, '<br>') + '</div>';
                        else {
                            if (resp.text) body.innerHTML += '<div class="msg received">' + resp.text.replace(/\\n/g, '<br>') + '</div>';
                            if (resp.image) body.innerHTML += '<div class="msg received" style="background:transparent;padding:0"><img src="' + resp.image + '" style="width:160px; border-radius:10px; display:block;"></div>';
                        }
                    } else { body.innerHTML += '<div class="msg received">⚠️ No disponible.</div>'; }
                    body.scrollTop = body.scrollHeight;
                }, 600);
            }

            async function validateForMarket() {
                const key = document.getElementById('m_key').value;
                if(!key) return;
                const res = await fetch('/stunbot/verify', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ license_key: key }) });
                const data = await res.json();
                if(data.valid) document.getElementById('lockOverlay').style.display = 'none';
                else alert('Licencia inválida.');
            }

            renderGrid(allPlugins);
        </script>
    </body>
    </html>
    `;
};
module.exports = { renderMarketplace };