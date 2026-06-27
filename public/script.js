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

    function checkLogin() {
        if (passInput.value === '    ') {
            loginScreen.style.display = 'none';
            loadDashboard();
        } else {
            loginError.style.display = 'block';
        }
    }
    
    loginBtn.addEventListener('click', checkLogin);
    passInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') checkLogin(); });

    async function loadDashboard() {
        try {
            const response = await fetch('database.json');
            if(!response.ok) throw new Error('Database not found');
            allProducts = await response.json();
            
            populateCategoryFilter();
            renderDashboard(allProducts);

            // Event Listeners for Filters
            document.getElementById('filter-status').addEventListener('change', filterData);
            document.getElementById('filter-category').addEventListener('change', filterData);
            
            // Modal logic
            document.querySelector('.close-btn').onclick = () => document.getElementById('text-modal').style.display = 'none';
            document.getElementById('copy-btn').onclick = () => {
                navigator.clipboard.writeText(document.getElementById('modal-text').textContent);
                const btn = document.getElementById('copy-btn');
                btn.textContent = 'Copiado!';
                setTimeout(() => btn.textContent = 'Copiar Texto', 2000);
            }
        } catch (e) {
            console.error("Erro:", e);
            document.getElementById('products-grid').innerHTML = '<p style="text-align:center; padding: 20px;">Nenhum produto encontrado. Rode o script de sincronização primeiro!</p>';
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
