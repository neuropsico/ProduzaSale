let allProducts = [];
let chartInstance = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Theme Logic
    const toggleBtn = document.getElementById('theme-toggle');
    const iconSun = document.getElementById('icon-sun');
    const iconMoon = document.getElementById('icon-moon');
    
    function setTheme(themeName) {
        document.documentElement.setAttribute('data-theme', themeName);
        localStorage.setItem('produzaSaleTheme', themeName);
        if (themeName === 'dark') {
            iconSun.style.display = 'block';
            iconMoon.style.display = 'none';
        } else {
            iconSun.style.display = 'none';
            iconMoon.style.display = 'block';
        }
        if(chartInstance) chartInstance.update();
    }
    
    const savedTheme = localStorage.getItem('produzaSaleTheme') || 'light';
    setTheme(savedTheme);

    toggleBtn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        setTheme(current === 'dark' ? 'light' : 'dark');
    });

    // Login Gatekeeper
    const loginScreen = document.getElementById('login-screen');
    const passInput = document.getElementById('password-input');
    const loginBtn = document.getElementById('login-btn');
    const loginError = document.getElementById('login-error');

    async function hashPassword(str) {
        const buf = await crypto.subtle.digest("SHA-256", new TextEncoder("utf-8").encode(str));
        return Array.prototype.map.call(new Uint8Array(buf), x=>(('00'+x.toString(16)).slice(-2))).join('');
    }

    async function checkLogin() {
        const inputVal = passInput.value;
        const hash = await hashPassword(inputVal);
        loadDashboard(hash, true);
    }
    
    // Check if user is already logged in (15 days persistence)
    const savedToken = localStorage.getItem('produzaSaleToken');
    const savedTokenDate = localStorage.getItem('produzaSaleTokenDate');
    
    if (savedToken && savedTokenDate) {
        const diffDays = Math.floor((new Date() - new Date(savedTokenDate)) / (1000 * 60 * 60 * 24));
        if (diffDays < 15) {
            loadDashboard(savedToken, false);
        }
    }

    loginBtn.addEventListener('click', checkLogin);
    passInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') checkLogin(); });

    async function loadDashboard(hash, fromInput) {
        try {
            const authResponse = await fetch(`${hash}.json`);
            if(!authResponse.ok) throw new Error('Database not found');
            
            // Login Success
            if (fromInput) {
                localStorage.setItem('produzaSaleToken', hash);
                localStorage.setItem('produzaSaleTokenDate', new Date().toISOString());
            }
            
            loginScreen.style.display = 'none';
            
            const response = await fetch('/api/products');
            allProducts = await response.json();
            
            populateCategoryFilter();
            renderDashboard(allProducts);

            // Fetch ML API Metrics
            try {
                const mlRes = await fetch('/api/ml_metrics');
                if(mlRes.ok) {
                    const mlData = await mlRes.json();
                    document.getElementById('ml-visits').textContent = mlData.totalVisits || 0;
                    document.getElementById('ml-active-ads').textContent = mlData.activeAds || 0;
                    document.getElementById('ml-questions').textContent = mlData.pendingQuestions || 0;
                }
            } catch(e) { console.error("Erro ao buscar metricas ML", e); }

            // Fetch API Connections
            try {
                const connRes = await fetch('/api/connections');
                if(connRes.ok) {
                    const connData = await connRes.json();
                    const apiList = document.getElementById('api-status-list');
                    apiList.innerHTML = `
                        <div class="glass" style="padding: 15px; border-left: 4px solid ${connData.mercadoLivre ? '#34c759' : '#ff3b30'}">
                            <strong>Mercado Livre:</strong> ${connData.mercadoLivre ? 'Conectado (Token Ativo)' : 'Desconectado'}
                        </div>
                        <div class="glass" style="padding: 15px; border-left: 4px solid ${connData.olx ? '#34c759' : '#ff9500'}">
                            <strong>OLX:</strong> ${connData.olx ? 'Conectado' : 'Aguardando Configuração'}
                        </div>
                        <div class="glass" style="padding: 15px; border-left: 4px solid ${connData.meta ? '#34c759' : '#ff9500'}">
                            <strong>Facebook Pages (Meta Graph):</strong> ${connData.meta ? 'Conectado' : 'Aguardando Configuração'}
                        </div>
                    `;
                }
            } catch(e) { console.error("Erro conexoes", e); }

            // Event Listeners for Filters
            document.getElementById('filter-status').addEventListener('change', filterData);
            document.getElementById('filter-category').addEventListener('change', filterData);
            
            // Tab Logic
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                    document.querySelectorAll('.tab-pane').forEach(p => p.style.display = 'none');
                    e.target.classList.add('active');
                    document.getElementById(e.target.dataset.target).style.display = 'block';
                });
            });

            document.querySelectorAll('.modal-tab-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    document.querySelectorAll('.modal-tab-btn').forEach(b => b.classList.remove('active'));
                    document.querySelectorAll('.mtab-content').forEach(p => p.style.display = 'none');
                    e.target.classList.add('active');
                    document.getElementById(e.target.dataset.target).style.display = 'block';
                });
            });

            // Modal logic
            document.querySelector('.close-btn').onclick = () => document.getElementById('text-modal').style.display = 'none';
            document.getElementById('copy-btn').onclick = () => {
                navigator.clipboard.writeText(document.getElementById('modal-text').textContent);
                const btn = document.getElementById('copy-btn');
                btn.textContent = 'Copiado!';
                setTimeout(() => btn.textContent = 'Copiar Texto Local', 2000);
            }
        } catch (e) {
            if (fromInput) loginError.style.display = 'block';
            console.error("Erro no login ou carregamento:", e);
        }
    }
});

function populateCategoryFilter() {
    const categories = [...new Set(allProducts.map(p => p.category))];
    const select = document.getElementById('filter-category');
    categories.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        select.appendChild(opt);
    });
}

function filterData() {
    const status = document.getElementById('filter-status').value;
    const category = document.getElementById('filter-category').value;

    let filtered = allProducts;
    if (status !== 'all') filtered = filtered.filter(p => p.status === status);
    if (category !== 'all') filtered = filtered.filter(p => p.category === category);

    renderDashboard(filtered);
}

function renderDashboard(products) {
    // 1. Calculate KPIs
    const totalItens = products.length;
    let totalValue = 0;
    let soldValue = 0;
    let totalPhotos = 0;
    let drafts = 0;
    let totalDays = 0;
    let activeAdsCount = 0;

    products.forEach(p => {
        totalPhotos += p.mediaCount;
        if (p.status.toLowerCase() === 'vendido') {
            soldValue += p.price;
        } else {
            totalValue += p.price;
        }
        if (p.status.toLowerCase() === 'rascunho') drafts++;
        
        if (p.status.toLowerCase() === 'anunciado') {
            totalDays += p.daysActive;
            activeAdsCount++;
        }
    });

    const ticket = totalItens > 0 ? (totalValue + soldValue) / totalItens : 0;
    const conversion = totalItens > 0 ? (products.filter(p => p.status.toLowerCase() === 'vendido').length / totalItens) * 100 : 0;
    const avgDays = activeAdsCount > 0 ? Math.floor(totalDays / activeAdsCount) : 0;

    // Format currency
    const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

    document.getElementById('kpi-total-itens').textContent = totalItens;
    document.getElementById('kpi-total-value').textContent = BRL.format(totalValue);
    document.getElementById('kpi-ticket').textContent = BRL.format(ticket);
    document.getElementById('kpi-conversion').textContent = conversion.toFixed(1) + '%';
    
    document.getElementById('kpi-sold-value').textContent = BRL.format(soldValue);
    document.getElementById('kpi-avg-days').textContent = avgDays;
    document.getElementById('kpi-drafts').textContent = drafts;
    document.getElementById('kpi-photos').textContent = totalPhotos;

    // 2. Render Cards
    const grid = document.getElementById('products-grid');
    grid.innerHTML = '';
    
    products.forEach(p => {
        const card = document.createElement('div');
        card.className = 'product-card glass';
        
        let statusClass = 'status-Rascunho';
        if (p.status.toLowerCase().includes('anunciado')) statusClass = 'status-Anunciado';
        if (p.status.toLowerCase().includes('vendido')) statusClass = 'status-Vendido';
        if (p.status.toLowerCase().includes('revis')) statusClass = 'status-Revisao';

        card.innerHTML = `
            <div class="card-header">
                <div class="card-title">${p.name}</div>
                <div class="status-badge ${statusClass}">${p.status}</div>
            </div>
            <div class="card-details">
                <div>
                    <span class="info-label">${p.category}</span>
                    <span style="color:#fff">${p.mediaCount} mídias</span>
                </div>
                <div style="text-align: right;">
                    <span class="info-label">${p.daysActive > 0 ? p.daysActive + ' dias' : 'Novo'}</span>
                    <span class="price">${BRL.format(p.price)}</span>
                </div>
            </div>
        `;
        
        card.onclick = () => {
            document.getElementById('modal-title').textContent = p.name;
            document.getElementById('modal-text').textContent = p.textDesc || 'Nenhum texto encontrado neste produto.';
            
            // Reset tabs
            document.querySelectorAll('.modal-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.mtab-content').forEach(p => p.style.display = 'none');
            document.querySelector('.modal-tab-btn[data-target="mtab-local"]').classList.add('active');
            document.getElementById('mtab-local').style.display = 'block';

            // ML API Fetch
            const apiTabBtn = document.getElementById('btn-mtab-api');
            const apiLoading = document.getElementById('api-loading');
            const apiContent = document.getElementById('api-content');
            
            if (p.ml_id) {
                apiTabBtn.style.display = 'inline-block';
                apiLoading.style.display = 'block';
                apiContent.style.display = 'none';
                
                fetch('/api/ml_item/' + p.ml_id)
                    .then(res => res.json())
                    .then(data => {
                        apiLoading.style.display = 'none';
                        apiContent.style.display = 'block';
                        
                        if (data.error) {
                            document.getElementById('api-raw').textContent = JSON.stringify(data.error, null, 2);
                            return;
                        }
                        
                        const item = data.item;
                        document.getElementById('api-status').textContent = item.status;
                        document.getElementById('api-substatus').textContent = (item.sub_status && item.sub_status.length > 0) ? item.sub_status.join(', ') : 'Nenhum';
                        document.getElementById('api-condition').textContent = item.condition;
                        document.getElementById('api-permalink').href = item.permalink;
                        
                        if (item.warnings && item.warnings.length > 0) {
                            document.getElementById('api-warnings').textContent = JSON.stringify(item.warnings, null, 2);
                        } else {
                            document.getElementById('api-warnings').textContent = 'Anúncio sem avisos ou bloqueios.';
                            document.getElementById('api-warnings').style.color = '#34c759';
                            document.getElementById('api-warnings').style.background = 'rgba(52, 199, 89, 0.1)';
                        }
                        
                        document.getElementById('api-raw').textContent = JSON.stringify(item, null, 2);
                        
                        // Metrics
                        document.getElementById('item-visits').textContent = data.visits || 0;
                        document.getElementById('item-sales').textContent = item.sold_quantity || 0;
                    })
                    .catch(err => {
                        apiLoading.textContent = "Erro ao carregar dados da API.";
                    });
            } else {
                apiTabBtn.style.display = 'none'; // Esconde a aba se não tem ID no ML
                document.getElementById('item-visits').textContent = '--';
                document.getElementById('item-sales').textContent = '--';
            }
            
            document.getElementById('text-modal').style.display = 'flex';
        };

        grid.appendChild(card);
    });

    // 3. Render Chart
    renderChart(products);
}

function renderChart(products) {
    const ctx = document.getElementById('mainChart').getContext('2d');
    
    // Group by status
    const statusCounts = { 'Rascunho': 0, 'Anunciado': 0, 'Vendido': 0, 'Revisao': 0 };
    products.forEach(p => {
        Object.keys(statusCounts).forEach(s => {
            if(p.status.toLowerCase().includes(s.toLowerCase())) statusCounts[s]++;
        });
    });

    if(chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(statusCounts),
            datasets: [{
                data: Object.values(statusCounts),
                backgroundColor: [
                    'rgba(255, 255, 255, 0.2)', // Rascunho
                    'rgba(0, 122, 255, 0.5)',   // Anunciado
                    'rgba(52, 199, 89, 0.5)',   // Vendido
                    'rgba(255, 149, 0, 0.5)'    // Revisao
                ],
                borderColor: 'rgba(25, 27, 33, 1)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { color: '#888888', font: {family: 'Inter'} } }
            }
        }
    });
}
