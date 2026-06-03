// Content script for Playmobil Warenkorb-Helfer
// This script runs on playmobil.com pages

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'ping') {
        sendResponse({ status: 'ok' });
    }
    return true;
});

console.log('%c🛒 Warenkorb-Helfer für playmobil.com Extension aktiv', 'color: #667eea; font-weight: bold;');
