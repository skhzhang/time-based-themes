'use strict';

function init() {

    // Set values if they each have never been set before,
    // such as on first-time startup.
    if (!localStorage.hasOwnProperty(checkTimeStartupOnlyKey)) {
        localStorage[checkTimeStartupOnlyKey] = DEFAULT_CHECK_TIME_STARTUP_ONLY;
    }
    if (!localStorage.hasOwnProperty(checkTimeIntervalKey)) {
        localStorage[checkTimeIntervalKey] = DEFAULT_CHECK_TIME_INTERVAL;
    }
    if (!localStorage.hasOwnProperty(sunriseTimeKey)) {
        localStorage[sunriseTimeKey] = DEFAULT_SUNRISE_TIME;
    }
    if (!localStorage.hasOwnProperty(sunsetTimeKey)) {
        localStorage[sunsetTimeKey] = DEFAULT_SUNSET_TIME;
    }

    // Iterate through each theme.
    browser.management.getAll().then((extensions) => {
        for (let extension of extensions) {
            if (extension.type === 'theme') {

                // Set the default daytime/nighttime theme
                // to the currently enabled theme.
                if (extension.enabled) {
                    DEFAULT_DAYTIME_THEME = extension.id;
                    DEFAULT_NIGHTTIME_THEME = extension.id;
                }
                // If there is a theme named "Dark",
                // replace the default nighttime theme with this.
                // "Dark" is the default dark theme that comes 
                // with Firefox out of the box.
                if (extension.name === "Dark") {
                    DEFAULT_NIGHTTIME_THEME = extension.id;
                }
            }
        }

        // Set values if they each have never been set before,
        // such as on first-time startup.
        // Only do this after we know the themes that
        // the user has installed.
        if (!localStorage.hasOwnProperty(daytimeThemeKey)) {
            localStorage[daytimeThemeKey] = DEFAULT_DAYTIME_THEME;
        }
        if (!localStorage.hasOwnProperty(nighttimeThemeKey)) {
            localStorage[nighttimeThemeKey] = DEFAULT_NIGHTTIME_THEME;
        }

    });

    // On start up, check the time to see what theme to show.
    checkTime();

    // Set up an alarm to check this regularly.
    browser.alarms.onAlarm.addListener(checkTime);
    browser.alarms.create('checkTime', 
        {periodInMinutes: parseInt(localStorage[checkTimeIntervalKey])}
    );

    // logAllAlarms();
}

init();