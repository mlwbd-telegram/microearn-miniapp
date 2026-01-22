
// MicroEarn Ad Integration - FIXED VERSION
// Centralized logic for Monetag Rewarded Ads and Adsterra Sticky Banners

// ==========================================
// MONETAG SDK READINESS CHECK
// ==========================================

let monetagSDKReady = false;
let sdkCheckInterval = null;

// Check if Monetag SDK is loaded and ready
function checkMontagSDK() {
    if (typeof window.show_10496645 === 'function') {
        monetagSDKReady = true;
        console.log("✅ Monetag SDK ready");
        if (sdkCheckInterval) {
            clearInterval(sdkCheckInterval);
            sdkCheckInterval = null;
        }
        // Notify pages that SDK is ready
        window.dispatchEvent(new Event('monetag-sdk-ready'));
        return true;
    }
    return false;
}

// Start checking for SDK on load
document.addEventListener('DOMContentLoaded', () => {
    // Check immediately
    if (!checkMontagSDK()) {
        // If not ready, check every 500ms for up to 10 seconds
        let attempts = 0;
        sdkCheckInterval = setInterval(() => {
            attempts++;
            if (checkMontagSDK() || attempts > 20) {
                if (sdkCheckInterval) {
                    clearInterval(sdkCheckInterval);
                    sdkCheckInterval = null;
                }
                if (!monetagSDKReady) {
                    console.warn("⚠️ Monetag SDK did not load after 10 seconds");
                }
            }
        }, 500);
    }
});

// ==========================================
// MONETAG REWARDED ADS
// ==========================================

// Separate lock for rewarded ads (used by Watch Ads page)
let rewardedAdInProgress = false;

// Safe wrapper for Monetag's show_10496645() function
window.showRewardedAdSafe = function () {
    return new Promise((resolve, reject) => {
        // Check if SDK is ready
        if (!monetagSDKReady || typeof window.show_10496645 !== 'function') {
            console.error("Monetag SDK not ready");
            reject("AD_SDK_NOT_READY");
            return;
        }

        // Check if another ad is in progress
        if (rewardedAdInProgress) {
            console.warn("Rewarded ad already in progress");
            reject("AD_IN_PROGRESS");
            return;
        }

        console.log("Starting rewarded ad...");
        rewardedAdInProgress = true;

        window.show_10496645().then(() => {
            console.log("✅ Rewarded ad completed");
            rewardedAdInProgress = false;
            resolve(true);
        }).catch((err) => {
            console.error("❌ Rewarded ad failed:", err);
            rewardedAdInProgress = false;
            reject("AD_NOT_AVAILABLE");
        });
    });
};

// Alias for backward compatibility
window.showRewardedAd = window.showRewardedAdSafe;

// ==========================================
// ADSTERRA STICKY BANNER
// ==========================================

function injectStickyAd() {
    // Avoid duplicate injections
    if (document.getElementById('adsterra-sticky-container')) return;

    console.log("Injecting Adsterra sticky banner...");

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
        opacity: 0;
        transition: opacity 0.3s ease-out;
    `;

    // Config script
    const scriptConfig = document.createElement('script');
    scriptConfig.type = 'text/javascript';
    scriptConfig.textContent = `
        atOptions = {
            'key': '0eaadd2739774196781aff34110701c4',
            'format': 'iframe',
            'height': 50,
            'width': 320,
            'params': {}
        };
    `;

    // Invoke script
    const scriptInvoke = document.createElement('script');
    scriptInvoke.type = 'text/javascript';
    scriptInvoke.src = 'https://www.highperformanceformat.com/0eaadd2739774196781aff34110701c4/invoke.js';

    container.appendChild(scriptConfig);
    container.appendChild(scriptInvoke);
    document.body.appendChild(container);

    // Check if ad loaded after 3 seconds
    setTimeout(() => {
        const iframe = container.querySelector('iframe');
        if (iframe && iframe.offsetHeight > 0) {
            // Ad loaded successfully - show it
            console.log("✅ Sticky banner loaded");
            container.style.opacity = '1';
            document.body.style.paddingBottom = "60px";
        } else {
            // Ad failed to load - hide completely
            console.log("⚠️ Sticky banner failed to load - hiding");
            container.style.display = 'none';
            document.body.style.paddingBottom = "0";
        }
    }, 3000);

    // Handle script load errors
    scriptInvoke.addEventListener('error', () => {
        console.error("Adsterra script failed to load");
        container.style.display = 'none';
    });
}

// Initialize sticky ad after DOM loads
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(injectStickyAd, 200);
});
