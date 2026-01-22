
// MicroEarn Ad Integration - WITH AUTO-REFRESH
// Monetag Rewarded Ads + Adsterra Sticky Banner (45s Auto-Refresh)

// ==========================================
// MONETAG SDK READINESS
// ==========================================

let monetagSDKReady = false;

function checkMontagSDK() {
    if (typeof window.show_10496645 === 'function') {
        if (!monetagSDKReady) {
            monetagSDKReady = true;
            console.log("✅ Monetag SDK ready");
            window.dispatchEvent(new Event('monetag-sdk-ready'));
        }
        return true;
    }
    return false;
}

// Check immediately and repeatedly until ready
checkMontagSDK();
const sdkCheck = setInterval(() => {
    if (checkMontagSDK()) clearInterval(sdkCheck);
}, 200);
setTimeout(() => clearInterval(sdkCheck), 10000);

// ==========================================
// REWARDED ADS
// ==========================================

let rewardedAdInProgress = false;

window.showRewardedAdSafe = function () {
    return new Promise((resolve, reject) => {
        if (!monetagSDKReady || typeof window.show_10496645 !== 'function') {
            reject("AD_SDK_NOT_READY");
            return;
        }
        if (rewardedAdInProgress) {
            reject("AD_IN_PROGRESS");
            return;
        }
        rewardedAdInProgress = true;
        window.show_10496645().then(() => {
            rewardedAdInProgress = false;
            resolve(true);
        }).catch((err) => {
            rewardedAdInProgress = false;
            reject("AD_NOT_AVAILABLE");
        });
    });
};

window.showRewardedAd = window.showRewardedAdSafe;

// ==========================================
// STICKY BANNER with AUTO-REFRESH (45s)
// ==========================================

let bannerRefreshInterval = null;
let bannerContainer = null;
let isPageVisible = true;

// Page Visibility API - detect when app goes to background
document.addEventListener('visibilitychange', () => {
    isPageVisible = !document.hidden;

    if (!isPageVisible) {
        console.log("📴 Page hidden - pausing banner refresh");
        stopBannerRefresh();
    } else {
        console.log("📱 Page visible - resuming banner refresh");
        if (bannerContainer && isBannerVisible()) {
            startBannerRefresh();
        }
    }
});

// Check if banner is actually visible on screen
function isBannerVisible() {
    if (!bannerContainer) return false;

    const style = window.getComputedStyle(bannerContainer);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    if (bannerContainer.offsetHeight === 0 || bannerContainer.offsetWidth === 0) return false;

    return true;
}

// Stop banner refresh
function stopBannerRefresh() {
    if (bannerRefreshInterval) {
        clearInterval(bannerRefreshInterval);
        bannerRefreshInterval = null;
        console.log("⏸️ Banner auto-refresh stopped");
    }
}

// Start banner auto-refresh (45 seconds)
function startBannerRefresh() {
    stopBannerRefresh();

    if (!isPageVisible || !bannerContainer) return;

    console.log("▶️ Banner auto-refresh started (45s interval)");

    bannerRefreshInterval = setInterval(() => {
        if (!isPageVisible) {
            console.log("⚠️ Page not visible - skipping refresh");
            stopBannerRefresh();
            return;
        }

        if (!isBannerVisible()) {
            console.log("⚠️ Banner not visible - skipping refresh");
            return;
        }

        console.log("🔄 Auto-refreshing banner ad...");
        refreshBanner();
    }, 45000); // 45 seconds
}

// Refresh banner ad
function refreshBanner() {
    if (!bannerContainer) return;

    const isHomePage = document.getElementById('home-indicator') ||
        window.location.pathname.includes('index.html') ||
        window.location.pathname === '/';

    // Destroy old banner first (safety rule)
    const oldScripts = bannerContainer.querySelectorAll('script');
    oldScripts.forEach(s => s.remove());
    const oldIframes = bannerContainer.querySelectorAll('iframe');
    oldIframes.forEach(i => i.remove());

    // Inject new ad
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

    const scriptInvoke = document.createElement('script');
    scriptInvoke.type = 'text/javascript';
    scriptInvoke.src = 'https://www.highperformanceformat.com/0eaadd2739774196781aff34110701c4/invoke.js';

    bannerContainer.appendChild(scriptConfig);
    bannerContainer.appendChild(scriptInvoke);

    setTimeout(() => {
        const iframe = bannerContainer.querySelector('iframe');
        if (iframe && iframe.offsetWidth > 0) {
            console.log("✅ Banner refreshed successfully");
        } else {
            console.log("⚠️ Banner refresh may have failed");
        }
    }, 2000);
}

function injectStickyAd() {
    if (document.getElementById('adsterra-sticky-container')) {
        console.log("Ad container already exists");
        return;
    }

    const isHomePage = document.getElementById('home-indicator') ||
        window.location.pathname.includes('index.html') ||
        window.location.pathname === '/';

    console.log(`🔄 Injecting sticky banner (Home: ${isHomePage})...`);

    const container = document.createElement('div');
    container.id = 'adsterra-sticky-container';
    bannerContainer = container;

    if (isHomePage) {
        container.style.cssText = `
            position: fixed;
            bottom: -60px;
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
            transition: bottom 0.4s ease-out, opacity 0.3s ease-out;
        `;
    } else {
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

    const scriptInvoke = document.createElement('script');
    scriptInvoke.type = 'text/javascript';
    scriptInvoke.src = 'https://www.highperformanceformat.com/0eaadd2739774196781aff34110701c4/invoke.js';

    container.appendChild(scriptConfig);
    container.appendChild(scriptInvoke);
    document.body.appendChild(container);

    console.log("📦 Ad container added");

    let checkCount = 0;
    const maxChecks = 10;

    const checkAdLoad = setInterval(() => {
        checkCount++;
        const iframe = container.querySelector('iframe');

        console.log(`🔍 Check ${checkCount}: iframe=${!!iframe}, visible=${iframe ? iframe.offsetWidth > 0 : false}`);

        if (iframe && iframe.offsetWidth > 0) {
            clearInterval(checkAdLoad);
            console.log(`✅ Banner loaded (Home: ${isHomePage})`);

            if (isHomePage && sessionStorage.getItem('home-ad-dismissed')) {
                container.style.display = 'none';
                bannerContainer = null;
                return;
            }

            container.style.opacity = '1';
            document.body.style.paddingBottom = "60px";

            if (isHomePage) {
                container.style.bottom = '0';

                setTimeout(() => {
                    const closeBtn = document.createElement('button');
                    closeBtn.innerHTML = '✕';
                    closeBtn.style.cssText = `
                        position: absolute;
                        top: 3px;
                        right: 3px;
                        background: rgba(0,0,0,0.85);
                        color: white;
                        border: none;
                        border-radius: 50%;
                        width: 22px;
                        height: 22px;
                        font-size: 14px;
                        font-weight: bold;
                        cursor: pointer;
                        z-index: 10001;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        padding: 0;
                        line-height: 1;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                    `;
                    closeBtn.onclick = () => {
                        stopBannerRefresh();
                        container.style.opacity = '0';
                        container.style.bottom = '-60px';
                        setTimeout(() => {
                            container.style.display = 'none';
                            document.body.style.paddingBottom = "0";
                            sessionStorage.setItem('home-ad-dismissed', 'true');
                            bannerContainer = null;
                        }, 400);
                    };
                    container.appendChild(closeBtn);
                    console.log("✅ Close button added");
                }, 3000);
            }

            // Start auto-refresh after 5 seconds
            setTimeout(() => {
                if (isBannerVisible()) {
                    startBannerRefresh();
                }
            }, 5000);

        } else if (checkCount >= maxChecks) {
            clearInterval(checkAdLoad);
            console.log("⚠️ Ad failed to load");
            container.style.display = 'none';
            document.body.style.paddingBottom = "0";
            bannerContainer = null;
        }
    }, 500);

    scriptInvoke.addEventListener('error', (err) => {
        console.error("❌ Ad script failed:", err);
        clearInterval(checkAdLoad);
        container.style.display = 'none';
        document.body.style.paddingBottom = "0";
        bannerContainer = null;
    });

    scriptInvoke.addEventListener('load', () => {
        console.log("✅ Ad script loaded");
    });
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    stopBannerRefresh();
    bannerContainer = null;
});

// INSTANT LOADING
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log("DOM loaded, injecting ad...");
        requestAnimationFrame(injectStickyAd);
    });
} else {
    console.log("DOM already loaded, injecting ad...");
    requestAnimationFrame(injectStickyAd);
}
