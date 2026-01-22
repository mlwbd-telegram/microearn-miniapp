
// MicroEarn Ad Integration - FINAL VERSION
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
// STICKY BANNER - ALL PAGES
// ==========================================

function injectStickyAd() {
    // Avoid duplicates
    if (document.getElementById('adsterra-sticky-container')) return;

    // Detect home page
    const isHomePage = document.getElementById('home-indicator') ||
        window.location.pathname.includes('index.html') ||
        window.location.pathname === '/';

    console.log(`Injecting sticky banner (Home: ${isHomePage})...`);

    // Container - hidden until ad loads, NO reserved space
    const container = document.createElement('div');
    container.id = 'adsterra-sticky-container';

    if (isHomePage) {
        // HOME: Slide-in animation from bottom
        container.style.cssText = `
            position: fixed;
            bottom: -60px;
            left: 50%;
            transform: translateX(-50%);
            width: 320px;
            height: 50px;
            z-index: 9999;
            background: transparent;
            display: none;
            opacity: 0;
            transition: bottom 0.4s ease-out, opacity 0.3s ease-out;
        `;
    } else {
        // OTHER PAGES: Standard, hidden until loaded
        container.style.cssText = `
            position: fixed;
            bottom: 0;
            left: 50%;
            transform: translateX(-50%);
            width: 320px;
            height: 50px;
            z-index: 9999;
            background: transparent;
            display: none;
            opacity: 0;
            transition: opacity 0.3s ease-out;
        `;
    }

    // Ad config - async loading
    const scriptConfig = document.createElement('script');
    scriptConfig.type = 'text/javascript';
    scriptConfig.async = true;
    scriptConfig.textContent = `
        atOptions = {
            'key': '0eaadd2739774196781aff34110701c4',
            'format': 'iframe',
            'height': 50,
            'width': 320,
            'params': {}
        };
    `;

    // Ad script - async, non-blocking
    const scriptInvoke = document.createElement('script');
    scriptInvoke.type = 'text/javascript';
    scriptInvoke.async = true;
    scriptInvoke.src = 'https://www.highperformanceformat.com/0eaadd2739774196781aff34110701c4/invoke.js';

    container.appendChild(scriptConfig);
    container.appendChild(scriptInvoke);
    document.body.appendChild(container);

    // Check for ad load after 3 seconds
    const loadTimeout = setTimeout(() => {
        const iframe = container.querySelector('iframe');

        if (iframe && iframe.offsetHeight > 0) {
            console.log(`✅ Sticky banner loaded (Home: ${isHomePage})`);

            // Show ad
            container.style.display = 'flex';
            container.style.opacity = '1';

            if (isHomePage) {
                // HOME: Check if dismissed
                if (sessionStorage.getItem('home-ad-dismissed')) {
                    container.style.display = 'none';
                    return;
                }

                // Slide in from bottom
                container.style.bottom = '0';
                document.body.style.paddingBottom = "60px";

                // Add close button AFTER 3 seconds
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
                    console.log("✅ Close button added (Home only)");
                }, 3000); // Close button appears 3 seconds after ad loads

            } else {
                // OTHER PAGES: No close button, standard show
                document.body.style.paddingBottom = "60px";
            }
        } else {
            // Ad failed - hide completely, no placeholder
            console.log("⚠️ Sticky banner failed to load");
            container.style.display = 'none';
            document.body.style.paddingBottom = "0";
        }
    }, 3000); // Check after 3 seconds

    // Handle script errors
    scriptInvoke.addEventListener('error', () => {
        console.error("Ad script failed");
        clearTimeout(loadTimeout);
        container.style.display = 'none';
        document.body.style.paddingBottom = "0";
    });
}

// INSTANT LOADING - Run immediately, non-blocking
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        requestAnimationFrame(injectStickyAd); // Use RAF for smooth UI
    });
} else {
    requestAnimationFrame(injectStickyAd); // Already loaded, run now
}
