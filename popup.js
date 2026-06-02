// Tab switching
function switchToTab(tabName) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector(`.tab[data-tab="${tabName}"]`)?.classList.add('active');
    document.getElementById('tab-' + tabName)?.classList.add('active');
}

document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        switchToTab(tabName);
        // Save active tab to storage
        chrome.storage.local.set({ activeTab: tabName });
    });
});

// Restore last active tab on popup open
chrome.storage.local.get('activeTab', ({ activeTab }) => {
    if (activeTab) {
        switchToTab(activeTab);
    }
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
    
    document.getElementById('btnImport').disabled = true;
    const statusEl = document.getElementById('importStatus');
    
    const successItems = [];
    const unavailableItems = [];
    let addedCount = 0;
    let errorCount = 0;
    
    // Phase 1: Check availability
    statusEl.innerHTML = `<span style="color: #60a5fa;">🔍 Prüfe Verfügbarkeit: 0/${articles.length}...</span>`;
    statusEl.style.display = 'block';
    
    const availableArticles = [];
    
    for (let i = 0; i < articles.length; i++) {
        const article = articles[i];
        statusEl.innerHTML = `<span style="color: #60a5fa;">🔍 Prüfe: ${article.pid} (${i + 1}/${articles.length})</span>`;
        
        try {
            const result = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: async (pid) => {
                    const response = await fetch('/on/demandware.store/Sites-DE-Site/de_DE/SpareParts-Search?q=' + pid);
                    const html = await response.text();
                    
                    if (html.includes('spareParts__searchResults') && !html.includes('spareParts__noSearchResults')) {
                        let name = pid;
                        const nameMatch = html.match(/&quot;item_name&quot;\s*:\s*&quot;(.+?)&quot;/);
                        if (nameMatch) {
                            name = nameMatch[1]
                                .replace(/&ouml;/g, 'ö').replace(/&auml;/g, 'ä').replace(/&uuml;/g, 'ü')
                                .replace(/&Ouml;/g, 'Ö').replace(/&Auml;/g, 'Ä').replace(/&Uuml;/g, 'Ü')
                                .replace(/&szlig;/g, 'ß').replace(/&amp;/g, '&');
                        }
                        return { available: true, name };
                    }
                    return { available: false };
                },
                args: [article.pid]
            });
            
            const { available, name } = result[0].result;
            if (available) {
                availableArticles.push({ ...article, name });
            } else {
                unavailableItems.push(article.pid);
            }
        } catch (err) {
            unavailableItems.push(article.pid);
        }
        
        await new Promise(r => setTimeout(r, 200));
    }
    
    if (availableArticles.length === 0) {
        statusEl.innerHTML = `<span style="color: #fbbf24;">⚠️ Keine verfügbaren Artikel gefunden</span>`;
        showImportResults([], unavailableItems);
        document.getElementById('btnImport').disabled = false;
        return;
    }
    
    // Phase 2: Add to cart
    statusEl.innerHTML = `<span style="color: #60a5fa;">🛒 Füge hinzu: 0/${availableArticles.length}...</span>`;
    
    for (let i = 0; i < availableArticles.length; i++) {
        const article = availableArticles[i];
        statusEl.innerHTML = `<span style="color: #60a5fa;">🛒 ${article.name} (${i + 1}/${availableArticles.length})</span>`;
        
        try {
            const result = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: async (pid, qty) => {
                    const formData = new FormData();
                    formData.append('pid', pid);
                    formData.append('quantity', qty);
                    
                    const response = await fetch('/on/demandware.store/Sites-DE-Site/de_DE/Cart-AddProduct', {
                        method: 'POST',
                        body: formData,
                        credentials: 'include',
                        headers: { 'X-Requested-With': 'XMLHttpRequest' }
                    });
                    
                    const data = await response.json();
                    return !data.error && data.success !== false;
                },
                args: [article.pid, article.qty]
            });
            
            if (result[0].result) {
                addedCount++;
                successItems.push({ pid: article.pid, name: article.name, qty: article.qty });
            } else {
                errorCount++;
            }
        } catch (err) {
            errorCount++;
        }
        
        if (i < availableArticles.length - 1) {
            await new Promise(r => setTimeout(r, delay));
        }
    }
    
    // Final status
    let message = `✅ ${addedCount} Artikel hinzugefügt`;
    if (unavailableItems.length > 0) message += ` | ❌ ${unavailableItems.length} nicht verfügbar`;
    if (errorCount > 0) message += ` | ⚠️ ${errorCount} Fehler`;
    
    statusEl.innerHTML = `<span style="color: ${errorCount > 0 ? '#fbbf24' : '#22c55e'};">${message}</span>`;
    
    showImportResults(successItems, unavailableItems);
    
    // Show "Go to cart" button if items were added
    if (addedCount > 0) {
        document.getElementById('goToCartContainer').style.display = 'block';
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
            
            // Produktnummer als Text
            const pidSpan = document.createElement('span');
            pidSpan.textContent = pid;
            li.appendChild(pidSpan);
            
            // Separator
            li.appendChild(document.createTextNode(' – '));
            
            // Link zu playmodb
            const playmodbLink = document.createElement('a');
            playmodbLink.href = `https://playmodb.org/cgi-bin/showpart.pl?partnum=${pid}`;
            playmodbLink.target = '_blank';
            playmodbLink.textContent = 'playmodb';
            playmodbLink.title = 'In playmodb.org öffnen';
            li.appendChild(playmodbLink);
            
            // Separator
            li.appendChild(document.createTextNode(' | '));
            
            // Link zu pm.com
            const pmLink = document.createElement('a');
            pmLink.href = `https://www.playmobil.com/de-de/beschreibung/${pid}.html`;
            pmLink.target = '_blank';
            pmLink.textContent = 'pm.com';
            pmLink.title = 'Auf playmobil.com öffnen';
            li.appendChild(pmLink);
            
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

// Open all unavailable items on playmobil.com
document.getElementById('btnOpenAllPmCom').addEventListener('click', () => {
    currentUnavailableItems.forEach(pid => {
        chrome.tabs.create({ 
            url: `https://www.playmobil.com/de-de/beschreibung/${pid}.html`,
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

// Clear cart button click
document.getElementById('btnClearCart').addEventListener('click', async () => {
    const { isPlaymobil, tab } = await checkPlaymobilTab();
    if (!isPlaymobil) return;
    
    // Check if on cart page
    if (!tab.url.includes('/warenkorb')) {
        document.getElementById('clearStatus').innerHTML = '<span style="color: #fbbf24;">⚠️ Bitte zuerst zur <a href="https://www.playmobil.com/de-de/warenkorb/" target="_blank" style="color: #60a5fa; text-decoration: underline;">Warenkorb-Seite</a> wechseln</span>';
        document.getElementById('clearStatus').style.display = 'block';
        return;
    }
    
    document.getElementById('btnClearCart').disabled = true;
    const statusEl = document.getElementById('clearStatus');
    
    try {
        // First get the count of items
        const countResult = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => document.querySelectorAll('.js-removeProductLineItem').length
        });
        
        const total = countResult[0].result;
        
        if (total === 0) {
            showStatus('clearStatus', '⚠️ Warenkorb ist bereits leer', 'info');
            document.getElementById('btnClearCart').disabled = false;
            return;
        }
        
        // Show initial progress
        statusEl.innerHTML = `<span style="color: #60a5fa;">🔄 0/${total} Artikel entfernt...</span>`;
        statusEl.style.display = 'block';
        
        // Delete items one by one with progress updates
        let removed = 0;
        let retries = 0;
        
        for (let i = 0; i < total; i++) {
            const deleteResult = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    const btn = document.querySelector('.js-removeProductLineItem');
                    if (!btn) return { found: false };
                    const pid = btn.closest('.js-cartProduct')?.dataset.pid || '?';
                    const countBefore = document.querySelectorAll('.js-removeProductLineItem').length;
                    btn.click();
                    return { found: true, pid, countBefore };
                }
            });
            
            const { found, pid, countBefore } = deleteResult[0].result;
            if (!found) break;
            
            // Wait for deletion
            await new Promise(r => setTimeout(r, 1500));
            
            // Check if successful
            const checkResult = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => document.querySelectorAll('.js-removeProductLineItem').length
            });
            
            const countAfter = checkResult[0].result;
            
            if (countAfter < countBefore) {
                removed++;
                statusEl.innerHTML = `<span style="color: #60a5fa;">🔄 ${removed}/${total} Artikel entfernt... (${pid})</span>`;
            } else {
                // Rate limit - wait and retry
                retries++;
                statusEl.innerHTML = `<span style="color: #fbbf24;">⏳ Rate Limit - warte... (${removed}/${total})</span>`;
                await new Promise(r => setTimeout(r, 3000));
                i--; // Retry
            }
        }
        
        if (removed > 0) {
            statusEl.innerHTML = `<span style="color: #22c55e;">✅ ${removed} von ${total} Artikeln entfernt</span>`;
        } else {
            statusEl.innerHTML = `<span style="color: #ef4444;">❌ Keine Artikel entfernt</span>`;
        }
    } catch (err) {
        showStatus('clearStatus', '❌ Fehler: ' + err.message, 'error');
    }
    
    document.getElementById('btnClearCart').disabled = false;
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
