
// MicroEarn Ad Integration
// Centralized logic for Monetag Rewarded Ads and Adsterra Sticky Banners

// ==========================================
// MONETAG REWARDED ADS
// ==========================================
// Wrapper for Monetag's show_10496645() function
window.showRewardedAd = function () {
    return new Promise((resolve, reject) => {
        console.log("Attempting to show Monetag Rewarded Ad...");

        if (typeof window.show_10496645 === 'function') {
            window.show_10496645().then(() => {
                console.log("Ad completed. Granting reward.");
                resolve(true);
            }).catch((err) => {
                console.error("Ad failed or closed:", err);
                reject("AD_FAILED_OR_CLOSED");
            });
        } else {
            console.error("Monetag SDK not loaded or function show_10496645 not found.");
            // Fallback for testing/debugging? 
            // STRICT RULE: "Rewards must be given ONLY after ad completion callback."
            // So we generally fail here.
            alert("Ad failed to load. Please check your internet connection or try again later.");
            reject("SDK_MISSING");
        }
    });
};

// ==========================================
// ADSTERRA STICKY BANNER
// ==========================================
// Injects the 320x50 iframe at the bottom of the screen
function injectStickyAd() {
    // Avoid duplicate injections
    if (document.getElementById('adsterra-sticky-container')) return;

    // Create container
    const container = document.createElement('div');
    container.id = 'adsterra-sticky-container';
    container.style.cssText = `
        position: fixed;
        bottom: 0;
        left: 50%;
        transform: translateX(-50%);
        width: 320px;
        height: 50px;
        z-index: 9999;
        background: transparent;
        display: flex;
        justify-content: center;
        align-items: center;
        pointer-events: auto; /* Ensure clicks work */
    `;

    // Adsterra Config Script
    const scriptConfig = document.createElement('script');
    scriptConfig.type = 'text/javascript';
    scriptConfig.innerHTML = `
        atOptions = {
            'key' : '0eaadd2739774196781aff34110701c4',
            'format' : 'iframe',
            'height' : 50,
            'width' : 320,
            'params' : {}
        };
    `;

    // Adsterra Invoke Script
    const scriptInvoke = document.createElement('script');
    scriptInvoke.type = 'text/javascript';
    // Standard Adsterra invocation URL for this key type
    scriptInvoke.src = '//www.highperformanceformat.com/0eaadd2739774196781aff34110701c4/invoke.js';

    // Append to container
    container.appendChild(scriptConfig);
    container.appendChild(scriptInvoke);

    // Append to body
    document.body.appendChild(container);

    // Adjust body padding to prevent overlap
    document.body.style.paddingBottom = "60px";
}

// Initialize Sticky Ad on load
document.addEventListener('DOMContentLoaded', () => {
    // Delay slightly to ensure DOM is ready and page layout is settled
    setTimeout(injectStickyAd, 100);
});
