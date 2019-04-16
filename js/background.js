'use strict';

// Set storage only if overrideDefault is true or
// the managed storage is empty.
function setStorage(obj, overrideDefault = false) {
    browser.storage.local.get(Object.keys(obj)[0])
        .then((item) => {

            // Only set storage if a value is not already set,
            // or if it is already empty.
            if (overrideDefault || isEmpty(item)) {
                browser.storage.local.set(obj)
                    .then(() => { console.log("Successfully set " + Object.keys(obj)[0]); }, onError);
            }
        }, onError);
}

function init() {

    // Set values if they each have never been set before,
    // such as on first-time startup.
    setStorage({[checkTimeStartupOnlyKey]: {check: DEFAULT_CHECK_TIME_STARTUP_ONLY}});
    setStorage({[checkTimeIntervalKey]: {periodMin: DEFAULT_CHECK_TIME_INTERVAL}});
    setStorage({[sunriseTimeKey]: {time: DEFAULT_SUNRISE_TIME}});
    setStorage({[sunsetTimeKey]: {time: DEFAULT_SUNSET_TIME}});

    // Iterate through each theme.
    browser.management.getAll().then((extensions) => {
        for (let extension of extensions) {
            if (extension.type === 'theme') {
                // Set the currently enabled theme
                // as the default daytime/nighttime theme.
                if (extension.enabled) {
                    DEFAULT_DAYTIME_THEME = extension.id;
                    DEFAULT_NIGHTTIME_THEME = extension.id;
                }

                // If the theme is Firefox's default dark theme,
                // set the default nighttime theme to it.
                if (extension.id === "firefox-compact-dark@mozilla.org") {
                    DEFAULT_NIGHTTIME_THEME = extension.id;
                }
            }
        }

        // Set default daytime and nighttime themes
        // if they each have never been set before,
        // such as on first-time startup.
        //
        // Only do this after we know the themes that
        // the user has installed.
        setStorage({[daytimeThemeKey]: {themeId: DEFAULT_DAYTIME_THEME}});
        setStorage({[nighttimeThemeKey]: {themeId: DEFAULT_NIGHTTIME_THEME}});

/*
        browser.storage.local.get("daytimetheme")
            .then((item) => {
                if (isEmpty(item)) {
                    browser.storage.local.set({daytimeTheme: {themeId: DEFAULT_DAYTIME_THEME}})
                        .then(() => { console.log("Default daytime theme has been set."); }, onError);
                }
            }, onError);
*/
    });

    // On start up, check the time to see what theme to show.
    checkTime();

    // Set up an alarm to check this regularly.
    browser.alarms.onAlarm.addListener(checkTime);
    browser.storage.local.get(checkTimeIntervalKey)
        .then((obj) => {
            browser.alarms.create('checkTime',
                    {periodInMinutes: parseInt(obj[checkTimeIntervalKey].periodMin)}
                );
            logAllAlarms();
        }, onError);
}

init();