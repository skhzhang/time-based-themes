'use strict';

const KEY_PREFIX = 'autodark';

const checkTimeIntervalKey = KEY_PREFIX + "checkTimeInterval";
const checkTimeStartupOnlyKey = KEY_PREFIX + "checkTimeStartupOnly";
const daytimeThemeKey = KEY_PREFIX + "daytimeTheme";
const nighttimeThemeKey = KEY_PREFIX + "nighttimeTheme";
const sunriseTimeKey = KEY_PREFIX + "sunriseTime";
const sunsetTimeKey = KEY_PREFIX + "sunsetTime";

// Default themes are set after looking through the user's
// current theme and their installed themes.
let DEFAULT_DAYTIME_THEME = "";
let DEFAULT_NIGHTTIME_THEME = "";

const DEFAULT_CHECK_TIME_STARTUP_ONLY = false;
const DEFAULT_CHECK_TIME_INTERVAL = 5;
const DEFAULT_SUNRISE_TIME = "08:00";
const DEFAULT_SUNSET_TIME = "20:00";

// Print what the item was set to.
function setItem(item) {
  console.log("Item set to: " + item);
}

// Print the error!
function onError(error) {
  console.log("Error! " + error);
}

// Check if the object is empty.
function isEmpty(obj) {
    for(var key in obj) {
        if(obj.hasOwnProperty(key))
            return false;
    }
    return true;
}

// Set storage only if overrideDefault is true or
// the managed storage is empty.
function setStorage(obj, overrideDefault = false) {
    //console.log("Setting storage to...");
    //console.log(obj);
    return browser.storage.local.get(Object.keys(obj))
        .then((item) => {

            // Only set storage if a value is not already set,
            // or if it is already empty.
            if (overrideDefault || isEmpty(item)) {
                browser.storage.local.set(obj)
                    .then(() => { console.log("Successfully set " + Object.keys(obj)[0]); }, onError);
            }
        }, onError);
}

// Enable the theme.
function enableTheme(theme) {
    theme = theme[Object.keys(theme)[0]];
    browser.management.get(theme.themeId)
        .then(() => {
            console.log("Enabled theme " + theme.themeId);
            browser.management.setEnabled(theme.themeId, true);
        }, onError);
}

// Check the current system time and set the theme based on the time.
function checkTime() {
    let date = new Date();
    let hours = date.getHours();
    let minutes = date.getMinutes();

    // logAllAlarms();

    console.log("Conducting time check now...");

    browser.storage.local.get([sunriseTimeKey, sunsetTimeKey])
        .then((obj) => {
            let sunriseSplit = obj[sunriseTimeKey].time.split(":");
            let sunsetSplit = obj[sunsetTimeKey].time.split(":");

            // Will set the sun theme between sunrise and sunset.
            // Otherwise, set nighttime theme.
            if (timeInBetween(
                    hours, minutes, 
                    sunriseSplit[0], sunriseSplit[1], 
                    sunsetSplit[0], sunsetSplit[1])
                ) {
                    browser.storage.local.get(daytimeThemeKey)
                        .then(enableTheme, onError);
            } else {
                browser.storage.local.get(nighttimeThemeKey)
                    .then(enableTheme, onError);
            }

        }, onError);


}

// Update the checkTime alarm.
function updateCheckTime(timeInterval) {
    browser.alarms.clear('checkTime');
    browser.alarms.onAlarm.removeListener(checkTime);
    browser.alarms.onAlarm.addListener(checkTime);
    browser.storage.local.get(checkTimeIntervalKey)
        .then((obj) => {
            browser.alarms.create('checkTime',
                {periodInMinutes: parseInt(obj[checkTimeIntervalKey].periodMin)}
                );
            console.log("Set the alarm interval time to " + obj[checkTimeIntervalKey].periodMin + " mins.");
        }, onError);
}

// Helper function to figure out if a time is in-between two times.
function timeInBetween(
      curHours, curMins, 
      sunriseHours, sunriseMins, 
      sunsetHours, sunsetMins
    ){
    let curTimeInMins = curHours * 60 + parseInt(curMins);
    let sunriseInMins = sunriseHours * 60 + parseInt(sunriseMins);
    let sunsetInMins = sunsetHours * 60 + parseInt(sunsetMins);
    let difference = sunsetInMins - sunriseInMins;

    // If the difference is negative, 
    // we know the "sunrise" is on the previous day.
    if (difference < 0) {
        difference += 1440;

        // So, we need to do the comparisons a little differently.
        if (sunriseInMins <= curTimeInMins || curTimeInMins < sunsetInMins) {
            // console.log("It is currently daytime.");
            return true;
        }
    }
    else {
        if (sunriseInMins <= curTimeInMins && curTimeInMins < sunsetInMins) {
            // console.log("It is currently daytime.");
            return true;
        }
    }
    // console.log("It is currently nighttime.");
    return false;
}

// Helper function to get all active alarms.
function logAllAlarms() {
    let getAlarms = browser.alarms.getAll();
    getAlarms.then(function(alarms) {
        console.log('All active alarms: ');
        console.log(alarms);
    });
}

// Set the currently enabled theme
// as the default daytime/nighttime theme.
//
// Set default nighttime theme to Firefox's
// default if it is available.
function setDefaultThemes() {
    // Iterate through each theme.
    return browser.management.getAll()
        .then((extensions) => {
            for (let extension of extensions) {
                if (extension.type === 'theme') {
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
        })
}

// Things to do when the extension is starting up.
function init() {
    console.log("Starting up...");

    // Set values if they each have never been set before,
    // such as on first-time startup.
    setStorage({
            [checkTimeStartupOnlyKey]: {check: DEFAULT_CHECK_TIME_STARTUP_ONLY},
            [checkTimeIntervalKey]: {periodMin: DEFAULT_CHECK_TIME_INTERVAL},
            [sunriseTimeKey]: {time: DEFAULT_SUNRISE_TIME},
            [sunsetTimeKey]: {time: DEFAULT_SUNSET_TIME}
        })
        .then(() => {
            return setDefaultThemes()
                .then(() => {
                    // Set default daytime and nighttime themes
                    // if they each have never been set before,
                    // such as on first-time startup.
                    //
                    // Only do this after we know the themes that
                    // the user has installed.
                    return setStorage({
                        [daytimeThemeKey]: {themeId: DEFAULT_DAYTIME_THEME},
                        [nighttimeThemeKey]: {themeId: DEFAULT_NIGHTTIME_THEME}
                    });
                })
                .then(() => {
                    // On start up, check the time to see what theme to show.
                    checkTime();

                    // If flag is not set to check only on startup,
                    // set up an alarm to check this regularlyr
                    // according to the time interval set.
                    browser.alarms.onAlarm.addListener(checkTime);
                    browser.storage.local.get([checkTimeIntervalKey, checkTimeStartupOnlyKey])
                        .then((obj) => {
                            if (obj.hasOwnProperty(checkTimeStartupOnlyKey)) {
                                if (!obj[checkTimeStartupOnlyKey].check) {
                                    browser.alarms.create(
                                        'checkTime',
                                        {periodInMinutes: parseInt(obj[checkTimeIntervalKey].periodMin)}
                                        );
                                }
                            }
                            logAllAlarms();
                        }, onError);
                });
        });
}