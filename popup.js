// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
    });
});

// Check if we're on playmobil.com
async function checkPlaymobilTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const isPlaymobil = tab?.url?.includes('playmobil.com');
    
    // Show/hide appropriate content
    document.getElementById('notOnPlaymobil').style.display = isPlaymobil ? 'none' : 'block';
    document.getElementById('mainContent').style.display = isPlaymobil ? 'block' : 'none';
    
    return { isPlaymobil, tab };
}

// Parse article list
function parseArticleList(text) {
    const lines = text.trim().split('\n');
    const articles = [];
    
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue;
        
        let match = trimmed.match(/^(\d+)\s*[;,\s]\s*(\d+)$/);
        if (match) {
            articles.push({ pid: match[1], qty: parseInt(match[2]) });
        } else {
            match = trimmed.match(/^(\d+)$/);
            if (match) {
                articles.push({ pid: match[1], qty: 1 });
            }
        }
    }
    
    return articles;
}

// Show status message
function showStatus(elementId, message, type) {
    const el = document.getElementById(elementId);
    el.textContent = message;
    el.className = 'status ' + type;
}

// Import button click
document.getElementById('btnImport').addEventListener('click', async () => {
    const { isPlaymobil, tab } = await checkPlaymobilTab();
    if (!isPlaymobil) return;
    
    const articleText = document.getElementById('articleList').value;
    const delay = parseInt(document.getElementById('delay').value) || 1500;
    const articles = parseArticleList(articleText);
    
    if (articles.length === 0) {
        showStatus('importStatus', '⚠️ Keine gültigen Artikel gefunden', 'error');
        return;
    }
    
    showStatus('importStatus', `🔄 Starte Import von ${articles.length} Artikeln...`, 'info');
    document.getElementById('btnImport').disabled = true;
    
    try {
        const result = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: importArticles,
            args: [articles, delay]
        });
        
        const { success, errors, available, unavailable, successItems, unavailableItems } = result[0].result;
        
        let message = `✅ ${success} Artikel hinzugefügt`;
        if (unavailable > 0) message += ` | ❌ ${unavailable} nicht verfügbar`;
        if (errors > 0) message += ` | ⚠️ ${errors} Fehler`;
        
        showStatus('importStatus', message, errors > 0 ? 'error' : 'success');
        
        // Show detailed results
        showImportResults(successItems || [], unavailableItems || []);
    } catch (err) {
        showStatus('importStatus', '❌ Fehler: ' + err.message, 'error');
    }
    
    document.getElementById('btnImport').disabled = false;
});

// Store unavailable items for download/open actions
let currentUnavailableItems = [];

// Show import results in UI
function showImportResults(successItems, unavailableItems) {
    const resultsDiv = document.getElementById('importResults');
    const successList = document.getElementById('successList');
    const errorList = document.getElementById('errorList');
    const successItemsUl = document.getElementById('successItems');
    const errorItemsUl = document.getElementById('errorItems');
    
    // Clear previous results
    successItemsUl.innerHTML = '';
    errorItemsUl.innerHTML = '';
    
    // Show success items
    if (successItems.length > 0) {
        successList.style.display = 'block';
        successItems.forEach(item => {
            const li = document.createElement('li');
            li.textContent = `${item.name} (x${item.qty})`;
            successItemsUl.appendChild(li);
        });
    } else {
        successList.style.display = 'none';
    }
    
    // Show unavailable items with links
    if (unavailableItems.length > 0) {
        errorList.style.display = 'block';
        currentUnavailableItems = unavailableItems;
        
        unavailableItems.forEach(pid => {
            const li = document.createElement('li');
            const link = document.createElement('a');
            link.href = `https://playmodb.org/cgi-bin/showpart.pl?partnum=${pid}`;
            link.target = '_blank';
            link.textContent = pid;
            link.title = 'In playmodb.org öffnen';
            li.appendChild(link);
            li.appendChild(document.createTextNode(' – nicht verfügbar'));
            errorItemsUl.appendChild(li);
        });
    } else {
        errorList.style.display = 'none';
        currentUnavailableItems = [];
    }
    
    // Show results container if there's anything to show
    resultsDiv.style.display = (successItems.length > 0 || unavailableItems.length > 0) ? 'block' : 'none';
}

// Open all unavailable items in playmodb.org
document.getElementById('btnOpenAllUnavailable').addEventListener('click', () => {
    currentUnavailableItems.forEach(pid => {
        chrome.tabs.create({ 
            url: `https://playmodb.org/cgi-bin/showpart.pl?partnum=${pid}`,
            active: false 
        });
    });
});

// Download unavailable items as text file
document.getElementById('btnDownloadUnavailable').addEventListener('click', () => {
    const content = currentUnavailableItems.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nicht-verfuegbare-artikel.txt';
    a.click();
    
    URL.revokeObjectURL(url);
});

// Import function that runs in the page context
async function importArticles(articles, delay) {
    console.log('%c🛒 Playmobil Warenkorb-Helfer (Extension)', 'font-size: 16px; font-weight: bold; color: #667eea;');
    console.log('Artikel zu verarbeiten:', articles.length);
    
    // Phase 1: Check availability
    console.log('\n%c🔍 Phase 1: Prüfe Verfügbarkeit...', 'font-size: 14px; font-weight: bold; color: #667eea;');
    
    const availableArticles = [];
    const unavailableArticles = [];
    
    for (let i = 0; i < articles.length; i++) {
        const article = articles[i];
        console.log(`[${i + 1}/${articles.length}] Prüfe: ${article.pid}`);
        
        try {
            const response = await fetch('/on/demandware.store/Sites-DE-Site/de_DE/SpareParts-Search?q=' + article.pid);
            const html = await response.text();
            
            if (html.includes('spareParts__searchResults') && !html.includes('spareParts__noSearchResults')) {
                let name = article.pid;
                const nameMatch = html.match(/&quot;item_name&quot;\s*:\s*&quot;(.+?)&quot;/);
                if (nameMatch) {
                    name = nameMatch[1]
                        .replace(/&ouml;/g, 'ö').replace(/&auml;/g, 'ä').replace(/&uuml;/g, 'ü')
                        .replace(/&Ouml;/g, 'Ö').replace(/&Auml;/g, 'Ä').replace(/&Uuml;/g, 'Ü')
                        .replace(/&szlig;/g, 'ß').replace(/&amp;/g, '&');
                }
                console.log('%c  ✅ ' + name, 'color: #22c55e;');
                availableArticles.push({ ...article, name });
            } else {
                console.log('%c  ❌ Nicht verfügbar', 'color: #ef4444;');
                unavailableArticles.push(article.pid);
            }
        } catch (err) {
            console.log('%c  ⚠️ Fehler: ' + err.message, 'color: #fbbf24;');
            unavailableArticles.push(article.pid);
        }
        
        await new Promise(r => setTimeout(r, 200));
    }
    
    if (availableArticles.length === 0) {
        console.log('%c\n⚠️ Keine verfügbaren Artikel!', 'color: #fbbf24;');
        return { 
            success: 0, 
            errors: 0, 
            available: 0, 
            unavailable: unavailableArticles.length,
            successItems: [],
            unavailableItems: unavailableArticles
        };
    }
    
    // Phase 2: Add to cart
    console.log('\n%c🛒 Phase 2: Füge zum Warenkorb hinzu...', 'font-size: 14px; font-weight: bold; color: #667eea;');
    
    let success = 0;
    let errors = 0;
    const successfulArticles = [];
    
    for (let i = 0; i < availableArticles.length; i++) {
        const article = availableArticles[i];
        console.log(`[${i + 1}/${availableArticles.length}] ${article.name} (x${article.qty})`);
        
        try {
            const formData = new FormData();
            formData.append('pid', article.pid);
            formData.append('quantity', article.qty);
            
            const response = await fetch('/on/demandware.store/Sites-DE-Site/de_DE/Cart-AddProduct', {
                method: 'POST',
                body: formData,
                credentials: 'include',
                headers: { 'X-Requested-With': 'XMLHttpRequest' }
            });
            
            const data = await response.json();
            
            if (data.error || data.success === false) {
                console.log('%c  ✗ Fehler', 'color: #ef4444;');
                errors++;
            } else {
                console.log('%c  ✓ Hinzugefügt', 'color: #22c55e;');
                success++;
                successfulArticles.push({ pid: article.pid, name: article.name, qty: article.qty });
            }
        } catch (err) {
            console.log('%c  ✗ ' + err.message, 'color: #ef4444;');
            errors++;
        }
        
        if (i < availableArticles.length - 1) {
            await new Promise(r => setTimeout(r, delay));
        }
    }
    
    console.log('\n%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #667eea;');
    console.log(`✅ Hinzugefügt: ${success} | ❌ Nicht verfügbar: ${unavailableArticles.length} | ⚠️ Fehler: ${errors}`);
    console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #667eea;');
    
    if (success > 0) {
        console.log('%c\n💡 Seite aktualisieren um Warenkorb zu sehen!', 'color: #fbbf24;');
    }
    
    return { 
        success, 
        errors, 
        available: availableArticles.length, 
        unavailable: unavailableArticles.length,
        successItems: successfulArticles,
        unavailableItems: unavailableArticles
    };
}

// Export button click
document.getElementById('btnExport').addEventListener('click', async () => {
    const { isPlaymobil, tab } = await checkPlaymobilTab();
    if (!isPlaymobil) return;
    
    showStatus('exportStatus', '🔄 Exportiere Warenkorb...', 'info');
    
    try {
        const result = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: exportCart
        });
        
        const { success, data, count } = result[0].result;
        
        if (success && data) {
            document.getElementById('exportedList').value = data;
            document.getElementById('exportResult').style.display = 'block';
            showStatus('exportStatus', `✅ ${count} Artikel exportiert`, 'success');
            
            // Copy to clipboard
            await navigator.clipboard.writeText(data);
        } else {
            showStatus('exportStatus', '⚠️ Warenkorb ist leer oder nicht auf Warenkorb-Seite', 'error');
        }
    } catch (err) {
        showStatus('exportStatus', '❌ Fehler: ' + err.message, 'error');
    }
});

// Export function that runs in the page context
function exportCart() {
    const items = document.querySelectorAll('[data-pid]');
    
    if (items.length === 0) {
        return { success: false, data: null, count: 0 };
    }
    
    const exportLines = [];
    items.forEach(item => {
        const pid = item.dataset.pid;
        const qtySelect = item.querySelector('.js-changeQuantity');
        const qty = qtySelect ? qtySelect.value : '1';
        
        if (pid) {
            exportLines.push(pid + ';' + qty);
        }
    });
    
    const exportText = exportLines.join('\n');
    
    console.log('%c📦 Warenkorb Export', 'font-size: 16px; font-weight: bold; color: #667eea;');
    console.log('Exportiert:', exportLines.length, 'Artikel');
    console.log(exportText);
    
    return { success: true, data: exportText, count: exportLines.length };
}

// Copy export button
document.getElementById('btnCopyExport').addEventListener('click', async () => {
    const text = document.getElementById('exportedList').value;
    await navigator.clipboard.writeText(text);
    document.getElementById('btnCopyExport').textContent = '✓ Kopiert!';
    setTimeout(() => {
        document.getElementById('btnCopyExport').textContent = '📋 Kopieren';
    }, 2000);
});

// Save export to storage
document.getElementById('btnSaveExport').addEventListener('click', async () => {
    const text = document.getElementById('exportedList').value;
    const name = 'Warenkorb ' + new Date().toLocaleDateString('de-DE');
    
    const { savedLists = [] } = await chrome.storage.local.get('savedLists');
    savedLists.unshift({ name, data: text, date: Date.now() });
    
    // Keep only last 10
    if (savedLists.length > 10) savedLists.pop();
    
    await chrome.storage.local.set({ savedLists });
    
    document.getElementById('btnSaveExport').textContent = '✓ Gespeichert!';
    setTimeout(() => {
        document.getElementById('btnSaveExport').textContent = '💾 Speichern';
    }, 2000);
});

// Load saved article list
async function loadSavedList() {
    const { lastArticleList } = await chrome.storage.local.get('lastArticleList');
    if (lastArticleList) {
        document.getElementById('articleList').value = lastArticleList;
    }
}

// Save article list on change
document.getElementById('articleList').addEventListener('input', async (e) => {
    await chrome.storage.local.set({ lastArticleList: e.target.value });
});

// Initialize
checkPlaymobilTab();
loadSavedList();
