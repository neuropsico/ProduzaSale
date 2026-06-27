const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const GDRIVE_PATH = '/Users/alexcavalcante/Library/CloudStorage/GoogleDrive-neuropsicobiomed@gmail.com/Meu Drive/PRODUZASALE';
const PUBLIC_DIR = path.join(__dirname, 'public');
const FOTOS_PUBLIC_DIR = path.join(PUBLIC_DIR, 'Fotos');

console.log('Iniciando Sincronização ProduzaSale (GDrive -> Vercel)...');

// 1. Criar pasta pública de Fotos se não existir
if (!fs.existsSync(FOTOS_PUBLIC_DIR)) {
    fs.mkdirSync(FOTOS_PUBLIC_DIR, { recursive: true });
}

// 2. Ler pastas do GDrive
let folders = [];
try {
    folders = fs.readdirSync(GDRIVE_PATH).filter(file => {
        return fs.statSync(path.join(GDRIVE_PATH, file)).isDirectory();
    });
} catch (e) {
    console.error('Erro ao acessar GDrive. Tem certeza que a pasta existe? ' + e.message);
    process.exit(1);
}

const products = [];

folders.forEach(folder => {
    const sourceFolder = path.join(GDRIVE_PATH, folder);
    const destFolder = path.join(FOTOS_PUBLIC_DIR, folder);
    
    if (!fs.existsSync(destFolder)) fs.mkdirSync(destFolder, { recursive: true });

    const files = fs.readdirSync(sourceFolder);
    const mediaExtensions = ['.jpg', '.jpeg', '.png', '.heic', '.mov', '.mp4'];
    let mediaCount = 0;

    let status = 'Rascunho';
    let price = 0;
    let date = '--';
    let category = 'Outros';
    let daysActive = 0;
    let textDesc = 'Sem descrição...';

    files.forEach(f => {
        const sourceFile = path.join(sourceFolder, f);
        const destFile = path.join(destFolder, f);
        
        // Copiar arquivo se não existir
        if (!fs.existsSync(destFile)) {
            fs.copyFileSync(sourceFile, destFile);
        }

        const ext = path.extname(f).toLowerCase();
        if (mediaExtensions.includes(ext)) {
            mediaCount++;
        }

        if (f === 'info.json') {
            try {
                const info = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
                if (info.status) status = info.status;
                if (info.price) price = Number(info.price) || 0;
                if (info.date) {
                    date = info.date;
                    const pubDate = new Date(date);
                    const diffTime = Math.abs(new Date() - pubDate);
                    daysActive = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                }
                if (info.category) category = info.category;
            } catch(e){}
        } else if (ext === '.md' || ext === '.txt') {
            textDesc = fs.readFileSync(sourceFile, 'utf8');
        }
    });

    products.push({
        name: folder.replace(/_/g, ' '),
        folder: folder,
        mediaCount,
        status,
        price,
        date,
        category,
        daysActive,
        textDesc
    });
});

// 3. Gerar hash.json na pasta public para segurança
const crypto = require('crypto');
const secretPassword = '    '; // 4 espaços
const hashFile = crypto.createHash('sha256').update(secretPassword).digest('hex') + '.json';
const dbPath = path.join(PUBLIC_DIR, hashFile);

// Remove old database.json if exists
if (fs.existsSync(path.join(PUBLIC_DIR, 'database.json'))) {
    fs.unlinkSync(path.join(PUBLIC_DIR, 'database.json'));
}

fs.writeFileSync(dbPath, JSON.stringify(products, null, 2));
console.log(`✓ Banco de dados protegido gerado com sucesso: ${products.length} produtos.`);

// 4. Git Push
try {
    console.log('Enviando para o GitHub...');
    execSync('git add .', { stdio: 'inherit' });
    execSync('git commit -m "Auto-sync GDrive to Vercel"', { stdio: 'inherit' });
    execSync('git push origin main', { stdio: 'inherit' });
    console.log('🚀 Sincronização concluída! Vercel atualizará em breve.');
} catch (e) {
    console.log('Aviso Git: ' + e.message);
}
