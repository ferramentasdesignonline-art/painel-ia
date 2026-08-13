import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.resolve(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            if (!file.includes('node_modules') && !file.includes('.next') && !file.includes('.git')) {
                results = results.concat(walk(file));
            }
        } else {
            if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.sql')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk(path.resolve(__dirname, '../src'));
files.push(path.resolve(__dirname, '../supabase_init.sql'));

let modifiedCount = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    
    const originalContent = content;
    
    // Replace admins
    content = content.replace(/duo-mkt-concessionaria-admins/g, 'sistema-dash-ia-admins');
    
    // Replace saas tables
    content = content.replace(/duo-mkt-concessionaria-saas_/g, 'sistema-dash-ia_');
    
    if (content !== originalContent) {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`Modified: ${file}`);
        modifiedCount++;
    }
});

console.log(`\nFinished replacing in ${modifiedCount} files.`);
