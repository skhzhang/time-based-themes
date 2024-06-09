(async () => {
    while( true) {
        try {
            console.log("automaticDark: sending message")
            // on startup: send message to extension
            await browser.runtime.sendMessage({
                type: "color-scheme-change",
                tab: document.location.href,
                prefersColorScheme: window.matchMedia('(prefers-color-scheme: dark)').matches
            });

            break; // recieving end has started listening, message delivered!
        } catch (err) {
            console.log("automaticDark: error, retrying in 200ms ", err)
            await new Promise((resolve) => setTimeout(resolve, 200)); // pause, then try again
        }
    }

    console.log("automaticDark: inithandler")
    // then repeat on every change
    // Add listener that will change the theme if the mode is set to "system-theme"
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', ({matches}) => {
        console.log("automaticDark: changed!")
        browser.runtime.sendMessage({
            type: "color-scheme-change",
            tab: document.location.href,
            prefersColorScheme: matches
        });
    });
})()