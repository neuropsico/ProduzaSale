const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 4500;

app.use(cors());
app.use(express.static('public'));

const FOTOS_DIR = path.join(__dirname, '..', 'Fotos');

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

            if (fs.existsSync(path.join(folderPath, 'info.json'))) {
                const info = JSON.parse(fs.readFileSync(path.join(folderPath, 'info.json'), 'utf8'));
                if (info.status) status = info.status;
                if (info.price) price = Number(info.price) || 0;
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
                textDesc
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
