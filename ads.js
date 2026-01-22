
// MicroEarn Ad Integration - FIXED ADSTERRA LOADING
// Ads on ALL pages, Home has close button after 3s, slide-in animation

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

// Async SDK check - non-blocking
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
// STICKY BANNER - ALL PAGES with BETTER DETECTION
// ==========================================

function injectStickyAd() {
    // Avoid duplicates
    if (document.getElementById('adsterra-sticky-container')) {
        console.log("Ad container already exists, skipping injection");
        return;
    }

    // Detect home page
    const isHomePage = document.getElementById('home-indicator') ||
        window.location.pathname.includes('index.html') ||
        window.location.pathname === '/';

    console.log(`🔄 Injecting sticky banner (Home: ${isHomePage})...`);

    // Container - hidden until ad loads
    const container = document.createElement('div');
    container.id = 'adsterra-sticky-container';

    if (isHomePage) {
        // HOME: Slide-in animation
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
        // OTHER PAGES: Standard
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

    // Ad config
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

    // Ad script
    const scriptInvoke = document.createElement('script');
    scriptInvoke.type = 'text/javascript';
    scriptInvoke.src = 'https://www.highperformanceformat.com/0eaadd2739774196781aff34110701c4/invoke.js';

    container.appendChild(scriptConfig);
    container.appendChild(scriptInvoke);
    document.body.appendChild(container);

    console.log("📦 Ad container added to DOM");

    // IMPROVED: Check multiple times for ad load
    let checkCount = 0;
    const maxChecks = 10; // Check up to 10 times

    const checkAdLoad = setInterval(() => {
        checkCount++;
        const iframe = container.querySelector('iframe');

        console.log(`🔍 Check ${checkCount}: iframe exists=${!!iframe}, visible=${iframe ? iframe.offsetWidth > 0 : false}`);

        if (iframe && iframe.offsetWidth > 0) {
            clearInterval(checkAdLoad);
            console.log(`✅ Adsterra banner loaded successfully (Home: ${isHomePage})`);

            // Check if user dismissed on home
            if (isHomePage && sessionStorage.getItem('home-ad-dismissed')) {
                console.log("User previously dismissed ad");
                container.style.display = 'none';
                return;
            }

            // Show the ad
            container.style.opacity = '1';
            document.body.style.paddingBottom = "60px";

            if (isHomePage) {
                // Slide in from bottom
                container.style.bottom = '0';

                // Add close button after 3 seconds
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
                        container.style.opacity = '0';
                        container.style.bottom = '-60px';
                        setTimeout(() => {
                            container.style.display = 'none';
                            document.body.style.paddingBottom = "0";
                            sessionStorage.setItem('home-ad-dismissed', 'true');
                        }, 400);
                    };
                    container.appendChild(closeBtn);
                    console.log("✅ Close button added");
                }, 3000);
            }

        } else if (checkCount >= maxChecks) {
            clearInterval(checkAdLoad);
            console.log("⚠️ Ad failed to load after 10 checks, hiding container");
            container.style.display = 'none';
            document.body.style.paddingBottom = "0";
        }
    }, 500); // Check every 500ms

    // Handle script errors
    scriptInvoke.addEventListener('error', (err) => {
        console.error("❌ Adsterra script failed to load:", err);
        clearInterval(checkAdLoad);
        container.style.display = 'none';
        document.body.style.paddingBottom = "0";
    });

    scriptInvoke.addEventListener('load', () => {
        console.log("✅ Adsterra script loaded successfully");
    });
}

// INSTANT LOADING - Run immediately
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log("DOM loaded, injecting ad...");
        requestAnimationFrame(injectStickyAd);
    });
} else {
    console.log("DOM already loaded, injecting ad...");
    requestAnimationFrame(injectStickyAd);
}
