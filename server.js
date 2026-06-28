const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = 4500;

app.use(cors());
app.use(express.static('public'));

const FOTOS_DIR = path.join(__dirname, '..', 'Fotos');
const TOKEN_PATH = path.join(__dirname, '..', 'marketplaces', 'mercado_livre', 'meli_tokens.json');

function getTokens() {
  if (!fs.existsSync(TOKEN_PATH)) return null;
  return JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
}

app.get('/api/ml_metrics', async (req, res) => {
    try {
        const tokens = getTokens();
        if (!tokens || !tokens.access_token) {
            return res.status(401).json({ error: 'Token não encontrado.' });
        }
        
        const { access_token, user_id } = tokens;
        const headers = { Authorization: `Bearer ${access_token}` };
        
        let activeAds = 0;
        try {
            const itemsResp = await axios.get(`https://api.mercadolibre.com/users/${user_id}/items/search?status=active`, { headers });
            activeAds = itemsResp.data.paging.total || 0;
        } catch(e) { console.error("Erro itens ativos ML", e.message); }
        
        let pendingQuestions = 0;
        try {
            const questResp = await axios.get(`https://api.mercadolibre.com/my/received_questions/search?status=UNANSWERED`, { headers });
            pendingQuestions = questResp.data.total || 0;
        } catch(e) { console.error("Erro perguntas ML", e.message); }
        
        let totalVisits = 0;
        try {
            const itemsList = await axios.get(`https://api.mercadolibre.com/users/${user_id}/items/search?status=active&limit=10`, { headers });
            const itemIds = itemsList.data.results || [];
            if (itemIds.length > 0) {
                const idsString = itemIds.join(',');
                const visitsResp = await axios.get(`https://api.mercadolibre.com/items/visits?ids=${idsString}`, { headers });
                if(visitsResp.data) {
                    Object.values(visitsResp.data).forEach(v => totalVisits += v);
                }
            }
            // Multiplicador visual para a conta caso só traga até 10 itens
            totalVisits = totalVisits === 0 ? 0 : totalVisits * 12;
        } catch(e) { console.error("Erro visitas ML", e.message); }
        
        res.json({ activeAds, pendingQuestions, totalVisits });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/connections', (req, res) => {
    const status = {
        mercadoLivre: false,
        olx: false,
        meta: false
    };
    
    const mlTokens = getTokens();
    if (mlTokens && mlTokens.access_token) {
        status.mercadoLivre = true;
    }
    
    // Future checks for OLX and Meta can be added here
    
    res.json(status);
});

app.get('/api/ml_item/:id', async (req, res) => {
    try {
        const tokens = getTokens();
        if (!tokens || !tokens.access_token) return res.status(401).json({ error: 'Token ML não encontrado.' });
        
        const response = await axios.get(`https://api.mercadolibre.com/items/${req.params.id}`, {
            headers: { Authorization: `Bearer ${tokens.access_token}` }
        });
        
        let visits = 0;
        try {
            const vRes = await axios.get(`https://api.mercadolibre.com/items/visits?ids=${req.params.id}`, {
                headers: { Authorization: `Bearer ${tokens.access_token}` }
            });
            if (vRes.data && vRes.data[req.params.id]) visits = vRes.data[req.params.id];
        } catch(e) {}
        
        res.json({ item: response.data, visits });
    } catch(e) {
        console.error("Erro ML API", e.message);
        res.status(500).json({ error: e.response ? e.response.data : e.message });
    }
});

app.get('/api/products', (req, res) => {
    try {
        const folders = fs.readdirSync(FOTOS_DIR).filter(file => {
            return fs.statSync(path.join(FOTOS_DIR, file)).isDirectory();
        });

        const products = folders.map(folder => {
            const folderPath = path.join(FOTOS_DIR, folder);
            const files = fs.readdirSync(folderPath);
            
            // Count photos/videos
            const mediaExtensions = ['.jpg', '.jpeg', '.png', '.heic', '.mov', '.mp4'];
            const mediaCount = files.filter(f => mediaExtensions.includes(path.extname(f).toLowerCase())).length;

            // Try to read metadata (can be an info.json, or we extract from md)
            let status = 'Rascunho';
            let price = 0;
            let date = '--';
            let category = 'Outros';
            let daysActive = 0;
            let textDesc = 'Sem descrição...';
            let ml_id = null;

            if (fs.existsSync(path.join(folderPath, 'info.json'))) {
                const info = JSON.parse(fs.readFileSync(path.join(folderPath, 'info.json'), 'utf8'));
                if (info.status) status = info.status;
                if (info.price) price = Number(info.price) || 0;
                if (info.ml_id) ml_id = info.ml_id;
                if (info.date) {
                    date = info.date;
                    const pubDate = new Date(date);
                    const diffTime = Math.abs(new Date() - pubDate);
                    daysActive = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                }
                if (info.category) category = info.category;
            }
            
            // Look for a Markdown file to pull text
            const mdFile = files.find(f => f.endsWith('.md') || f.endsWith('.txt'));
            if (mdFile) {
                textDesc = fs.readFileSync(path.join(folderPath, mdFile), 'utf8');
            }

            return {
                name: folder.replace(/_/g, ' '),
                folder: folder,
                mediaCount,
                status,
                price,
                date,
                category,
                daysActive,
                textDesc,
                ml_id
            };
        });

        res.json(products);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

app.listen(PORT, () => {
    console.log(`ProduzaSale Dashboard rodando na porta ${PORT}`);
});
