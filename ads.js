
// MicroEarn Ad Integration
// Centralized logic for Monetag Rewarded Ads and Adsterra Sticky Banners

// ==========================================
// MONETAG REWARDED ADS
// ==========================================

// Global Lock Variable
let adInProgress = false;

// Safe wrapper for Monetag's show_10496645() function
// Prevents multiple concurrent ad calls
window.showRewardedAdSafe = function () {
    return new Promise((resolve, reject) => {
        if (adInProgress) {
            console.warn("Global Ad Lock: Ad already in progress. Ignoring new request.");
            reject("AD_IN_PROGRESS");
            return;
        }

        console.log("Acquiring Ad Lock...");
        adInProgress = true;

        if (typeof window.show_10496645 === 'function') {
            console.log("Calling Monetag show_10496645()...");
            window.show_10496645().then(() => {
                console.log("Ad completed successfully. Releasing lock.");
                adInProgress = false;
                resolve(true); // Verification successful
            }).catch((err) => {
                console.error("Ad failed, closed, or no fill:", err);
                console.log("Releasing lock due to error.");
                adInProgress = false;
                reject("AD_FAILED_OR_CLOSED");
            });
        } else {
            console.error("Monetag SDK missing.");
            adInProgress = false;
            // Fail gracefully
            alert("Ad System not ready. Please wait or reload.");
            reject("SDK_MISSING");
        }
    });
};

// Deprecated: Alias for backward compatibility if needed, but safe version should be used.
window.showRewardedAd = window.showRewardedAdSafe;

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
