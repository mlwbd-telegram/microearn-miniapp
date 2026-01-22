
// MicroEarn Ad Integration - OPTIMIZED VERSION
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

// PERFORMANCE FIX: Delayed SDK check (lazy loading)
document.addEventListener('DOMContentLoaded', () => {
    // Wait 1.5 seconds before checking SDK (let UI load first)
    setTimeout(() => {
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
    }, 1500); // Lazy load delay
});

// ==========================================
// MONETAG REWARDED ADS
// ==========================================

// Separate lock for rewarded ads (used by Watch Ads page)
let rewardedAdInProgress = false;

// Safe wrapper for Monetag's show_10496645() function
window.showRewardedAdSafe = function () {
    return new Promise((resolve, reject) => {
        // PERFORMANCE FIX: Check SDK readiness BEFORE attempting
        if (!monetagSDKReady || typeof window.show_10496645 !== 'function') {
            console.error("Monetag SDK not ready");
            reject("AD_SDK_NOT_READY");
            return;
        }

        // PERFORMANCE FIX: Only one ad at a time
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

function injectStickyAd(options = {}) {
    const isHomePage = options.isHomePage || false;

    // Avoid duplicate injections
    if (document.getElementById('adsterra-sticky-container')) return;

    console.log(`Injecting Adsterra sticky banner (Home: ${isHomePage})...`);

    // Create container - HOME SCREEN: hidden by default with no reserved space
    const container = document.createElement('div');
    container.id = 'adsterra-sticky-container';

    if (isHomePage) {
        // HOME SCREEN: Start completely hidden, no space reserved
        container.style.cssText = `
            position: fixed;
            bottom: 0;
            left: 50%;
            transform: translateX(-50%);
            width: 320px;
            height: 0;
            z-index: 9999;
            background: transparent;
            display: none;
            opacity: 0;
            transition: opacity 0.3s ease-out, height 0.3s ease-out;
        `;
    } else {
        // OTHER PAGES: Standard behavior
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
    }

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

    // PERFORMANCE FIX: Hard timeout at 3 seconds
    const adLoadTimeout = setTimeout(() => {
        const iframe = container.querySelector('iframe');
        if (iframe && iframe.offsetHeight > 0) {
            // Ad loaded successfully
            console.log("✅ Sticky banner loaded");

            if (isHomePage) {
                // HOME SCREEN: Check if user dismissed it before
                if (sessionStorage.getItem('home-ad-dismissed')) {
                    container.style.display = 'none';
                    return;
                }

                // Show with proper height
                container.style.display = 'flex';
                container.style.height = '50px'; // Ad height
                container.style.opacity = '1';
                document.body.style.paddingBottom = "60px";

                // Add close button (HOME ONLY)
                const closeBtn = document.createElement('button');
                closeBtn.innerHTML = '✕';
                closeBtn.style.cssText = `
                    position: absolute;
                    top: 2px;
                    right: 2px;
                    background: rgba(0,0,0,0.7);
                    color: white;
                    border: none;
                    border-radius: 50%;
                    width: 20px;
                    height: 20px;
                    font-size: 12px;
                    cursor: pointer;
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 0;
                `;
                closeBtn.onclick = () => {
                    container.style.opacity = '0';
                    setTimeout(() => {
                        container.style.display = 'none';
                        container.style.height = '0';
                        document.body.style.paddingBottom = "0";
                        sessionStorage.setItem('home-ad-dismissed', 'true');
                    }, 300);
                };
                container.appendChild(closeBtn);
            } else {
                // OTHER PAGES: Standard show
                container.style.opacity = '1';
                document.body.style.paddingBottom = "60px";
            }
        } else {
            // Ad failed to load - hide completely
            console.log("⚠️ Sticky banner failed to load - hiding");
            container.style.display = 'none';
            container.style.height = '0';
            document.body.style.paddingBottom = "0";
        }
    }, 3000); // Hard timeout

    // Handle script load errors
    scriptInvoke.addEventListener('error', () => {
        console.error("Adsterra script failed to load");
        clearTimeout(adLoadTimeout);
        container.style.display = 'none';
        container.style.height = '0';
    });
}

// Initialize sticky ad after DOM loads with LAZY LOADING
document.addEventListener('DOMContentLoaded', () => {
    // PERFORMANCE FIX: Wait 2 seconds before loading ad (UI priority)
    setTimeout(() => {
        // Detect if this is home page by checking for specific element or URL
        const isHomePage = window.location.pathname.includes('index.html') ||
            window.location.pathname === '/' ||
            document.getElementById('home-indicator'); // You can add this element to index.html

        injectStickyAd({ isHomePage });
    }, 2000); // Lazy load delay for ads
});

// Export for manual calling if needed
window.initStickyAd = injectStickyAd;
