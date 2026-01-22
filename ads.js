
// MicroEarn Ad Integration
// Centralized logic for Monetag Rewarded Ads and Adsterra Sticky Banners

// ==========================================
// MONETAG REWARDED ADS
// ==========================================

// Global Lock Variable
let adInProgress = false;

// Safe wrapper for Monetag's show_10496645() function
// Prevents multiple concurrent ad calls and handles failures gracefully
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
                // UX FIX: More specific error message for no ad availability
                reject("AD_NOT_AVAILABLE");
            });
        } else {
            console.error("Monetag SDK missing or not loaded.");
            adInProgress = false;
            // UX FIX: Better error for SDK not loading
            reject("AD_SDK_NOT_READY");
        }
    });
};

// Deprecated: Alias for backward compatibility if needed, but safe version should be used.
window.showRewardedAd = window.showRewardedAdSafe;

// ==========================================
// ADSTERRA STICKY BANNER
// ==========================================
// Injects the 320x50 iframe at the bottom of the screen
// Automatically hides if ad doesn't load within timeout
function injectStickyAd() {
    // Avoid duplicate injections
    if (document.getElementById('adsterra-sticky-container')) return;

    // Create container (initially visible but will hide if no ad loads)
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
        pointer-events: auto;
        opacity: 1;
        transition: opacity 0.3s ease-out;
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
    scriptInvoke.src = '//www.highperformanceformat.com/0eaadd2739774196781aff34110701c4/invoke.js';

    // Append to container
    container.appendChild(scriptConfig);
    container.appendChild(scriptInvoke);

    // Append to body
    document.body.appendChild(container);

    // UX FIX: Check if ad loaded within 3 seconds
    // If no iframe is injected by Adsterra, hide the container
    let adLoadCheckTimeout = setTimeout(() => {
        const adIframe = container.querySelector('iframe');
        if (!adIframe || adIframe.offsetWidth === 0) {
            console.log("Adsterra banner did not load. Hiding container.");
            container.style.opacity = '0';
            setTimeout(() => {
                container.style.display = 'none';
                document.body.style.paddingBottom = "0";
            }, 300); // Wait for fade out
        } else {
            console.log("Adsterra banner loaded successfully.");
            // Ensure body padding is set
            document.body.style.paddingBottom = "60px";
        }
    }, 3000);

    // Also listen for load event on the script to detect early success
    scriptInvoke.addEventListener('load', () => {
        // Give a moment for iframe injection
        setTimeout(() => {
            const adIframe = container.querySelector('iframe');
            if (adIframe && adIframe.offsetWidth > 0) {
                clearTimeout(adLoadCheckTimeout);
                console.log("Adsterra banner confirmed loaded via script onload.");
                document.body.style.paddingBottom = "60px";
            }
        }, 500);
    });

    scriptInvoke.addEventListener('error', () => {
        console.error("Adsterra script failed to load.");
        clearTimeout(adLoadCheckTimeout);
        container.style.display = 'none';
        document.body.style.paddingBottom = "0";
    });
}

// Initialize Sticky Ad on load
document.addEventListener('DOMContentLoaded', () => {
    // Delay slightly to ensure DOM is ready and page layout is settled
    setTimeout(injectStickyAd, 100);
});
