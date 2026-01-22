
// MicroEarn Ad Integration - INSTANT LOADING
// Monetag Rewarded Ads + Adsterra Sticky Banner (HOME ONLY)

// ==========================================
// MONETAG SDK READINESS
// ==========================================

let monetagSDKReady = false;

function checkMontagSDK() {
    if (typeof window.show_10496645 === 'function') {
        monetagSDKReady = true;
        console.log("✅ Monetag SDK ready");
        window.dispatchEvent(new Event('monetag-sdk-ready'));
        return true;
    }
    return false;
}

// Check immediately and repeatedly until ready
checkMontagSDK();
const sdkCheck = setInterval(() => {
    if (checkMontagSDK()) {
        clearInterval(sdkCheck);
    }
}, 200); // Check every 200ms

// Stop checking after 10 seconds
setTimeout(() => clearInterval(sdkCheck), 10000);

// ==========================================
// MONETAG REWARDED ADS
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
// STICKY BANNER (HOME PAGE ONLY)
// ==========================================

function injectStickyAd() {
    // Only on home page
    const isHomePage = document.getElementById('home-indicator') ||
        window.location.pathname.includes('index.html') ||
        window.location.pathname === '/';

    if (!isHomePage) {
        console.log("Not home page - skipping sticky ad");
        return;
    }

    // Avoid duplicates
    if (document.getElementById('adsterra-sticky-container')) return;

    // Check if user dismissed it
    if (sessionStorage.getItem('home-ad-dismissed')) {
        console.log("User dismissed home ad - skipping");
        return;
    }

    console.log("Injecting sticky banner on HOME page...");

    // Container - starts hidden, no reserved space
    const container = document.createElement('div');
    container.id = 'adsterra-sticky-container';
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
        transition: opacity 0.3s ease-out;
    `;

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

    // Check if ad loaded after 2 seconds (faster check)
    setTimeout(() => {
        const iframe = container.querySelector('iframe');
        if (iframe && iframe.offsetHeight > 0) {
            console.log("✅ Home sticky banner loaded");

            // Show the ad
            container.style.display = 'flex';
            container.style.height = '50px';
            container.style.opacity = '1';
            document.body.style.paddingBottom = "60px";

            // Add close button after 3 seconds
            setTimeout(() => {
                const closeBtn = document.createElement('button');
                closeBtn.innerHTML = '✕';
                closeBtn.style.cssText = `
                    position: absolute;
                    top: 2px;
                    right: 2px;
                    background: rgba(0,0,0,0.8);
                    color: white;
                    border: none;
                    border-radius: 50%;
                    width: 22px;
                    height: 22px;
                    font-size: 14px;
                    cursor: pointer;
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 0;
                    line-height: 1;
                    font-weight: bold;
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
                console.log("✅ Close button added");
            }, 3000); // Show close button after 3 seconds
        } else {
            console.log("⚠️ Home sticky banner failed to load");
            container.style.display = 'none';
        }
    }, 2000); // Check ad loading after 2 seconds

    // Handle script errors
    scriptInvoke.addEventListener('error', () => {
        console.error("Adsterra script failed");
        container.style.display = 'none';
    });
}

// INSTANT LOADING - Run as soon as DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectStickyAd);
} else {
    // DOM already loaded, run immediately
    injectStickyAd();
}
