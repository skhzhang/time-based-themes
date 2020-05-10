'use strict';

const KEY_PREFIX = 'autodark';

const CHANGE_MODE_KEY = KEY_PREFIX + "changeMode";
const CHECK_TIME_STARTUP_ONLY_KEY = KEY_PREFIX + "checkTimeStartupOnly";
const DAYTIME_THEME_KEY = KEY_PREFIX + "daytimeTheme";
const NIGHTTIME_THEME_KEY = KEY_PREFIX + "nighttimeTheme";
const SUNRISE_TIME_KEY = KEY_PREFIX + "sunriseTime";
const SUNSET_TIME_KEY = KEY_PREFIX + "sunsetTime";
const NEXT_SUNRISE_ALARM_NAME = KEY_PREFIX + "nextSunrise";
const NEXT_SUNSET_ALARM_NAME = KEY_PREFIX + "nextSunset";

const GEOLOCATION_LATITUDE_KEY = KEY_PREFIX + "geoLatitude";
const GEOLOCATION_LONGITUDE_KEY = KEY_PREFIX + "geoLongitude";

const DEFAULT_CHANGE_MODE = "manual-suntimes";
const DEFAULT_CHECK_TIME_STARTUP_ONLY = false;
const DEFAULT_SUNRISE_TIME = "08:00";
const DEFAULT_SUNSET_TIME = "20:00";

// Default themes are set after looking through the user's
// current theme and their installed themes.
let DEFAULT_DAYTIME_THEME = "";
let DEFAULT_NIGHTTIME_THEME = "";

// Things to do when the extension is starting up
// (or if the settings have been reset).
function init() {
    //console.log("automaticDark DEBUG: Starting up automaticDark");
    browser.runtime.onInstalled.addListener(extensionUpdated);

    // Set values if they each have never been set before,
    // such as on first-time startup.
    return setStorage({
            [CHANGE_MODE_KEY]: {mode: DEFAULT_CHANGE_MODE}, // should change so that it populates with "location-suntimes"
            [CHECK_TIME_STARTUP_ONLY_KEY]: {check: DEFAULT_CHECK_TIME_STARTUP_ONLY},
            [SUNRISE_TIME_KEY]: {time: DEFAULT_SUNRISE_TIME},
            [SUNSET_TIME_KEY]: {time: DEFAULT_SUNSET_TIME}
        })
        .then((obj) => {
            // Check the user's themes and check the default daytime and
            // nighttime themes based on this.
            return setDefaultThemes();
        }, onError)
        .then(() => {
            return setStorage({
                [DAYTIME_THEME_KEY]: {themeId: DEFAULT_DAYTIME_THEME},
                [NIGHTTIME_THEME_KEY]: {themeId: DEFAULT_NIGHTTIME_THEME}
            });
        }, onError)
        .then(() => {
            // If flag is not set to check only on startup,
            // create alarms to change the theme in the future.
            browser.alarms.onAlarm.addListener(alarmListener);
            return browser.storage.local.get([CHECK_TIME_STARTUP_ONLY_KEY, CHANGE_MODE_KEY]);
        }, onError)
        .then((obj) => {
            if (!obj[CHECK_TIME_STARTUP_ONLY_KEY].check) {

                // On start up, change the themes appropriately.
                changeThemes(obj[CHANGE_MODE_KEY].mode);

                // Add a listener to change the theme when the window is focused.

                // For changing based on system theme, this is a hack/additional check as
                // matchMedia().addListener does not seem to be working.

                // Also for changing based on suntimes,
                // every time the window is focused, check the time and reset the alarms.
                // This prevents any delay in the alarms after OS sleep/hibernation.
                browser.windows.onFocusChanged.addListener((windowId) => {
                    if (windowId !== browser.windows.WINDOW_ID_NONE) {
                        browser.storage.local.get(CHANGE_MODE_KEY)
                            .then((obj) => {
                                changeThemes(obj[CHANGE_MODE_KEY].mode);

                                if (obj[CHANGE_MODE_KEY].mode === "location-suntimes" || obj[CHANGE_MODE_KEY].mode === "manual-suntimes"){
                                    browser.alarms.clearAll();
                                    createAlarm(SUNRISE_TIME_KEY, NEXT_SUNRISE_ALARM_NAME, 60 * 24),
                                    createAlarm(SUNSET_TIME_KEY, NEXT_SUNSET_ALARM_NAME, 60 * 24)
                                }
                            });
                    }
                });

                if (obj[CHANGE_MODE_KEY].mode === "system-theme") {
                    // Add a listener to change the theme as soon as the
                    // system theme is changed.
                    // This should work but is not in testing.
                    window.matchMedia('(prefers-color-scheme: dark)').addListener((e) => {
                        if (e.matches) {
                            browser.storage.local.get(NIGHTTIME_THEME_KEY)
                                .then((obj) => {
                                    enableTheme(obj, NIGHTTIME_THEME_KEY);
                                }, onError);
                        }
                        else {
                            browser.storage.local.get(DAYTIME_THEME_KEY)
                                .then((obj) => {
                                    enableTheme(obj, DAYTIME_THEME_KEY);
                                }, onError);
                        }
                    }, onError);
                }
                else if (obj[CHANGE_MODE_KEY].mode === "location-suntimes") {
                    // If we are set to get suntimes automatically,
                    // then calculate the suntimes again.
                    return calculateSuntimes()
                        .then((result) => {
                            return Promise.all([
                                browser.storage.local.set({[SUNRISE_TIME_KEY]: {time: convertDateToString(result.nextSunrise)}}),
                                browser.storage.local.set({[SUNSET_TIME_KEY]: {time: convertDateToString(result.nextSunset)}})
                            ]);
                        })
                        .then(() => {
                            return Promise.all([
                                createAlarm(SUNRISE_TIME_KEY, NEXT_SUNRISE_ALARM_NAME, 60 * 24),
                                createAlarm(SUNSET_TIME_KEY, NEXT_SUNSET_ALARM_NAME, 60 * 24)
                            ]);
                        });
                }
                else {
                    return Promise.all([
                        createAlarm(SUNRISE_TIME_KEY, NEXT_SUNRISE_ALARM_NAME, 60 * 24),
                        createAlarm(SUNSET_TIME_KEY, NEXT_SUNSET_ALARM_NAME, 60 * 24)
                    ]);
                }
            }
        }, onError);
}

// Changes the current theme.
// Takes a parameter indicating how to decide what theme to change to.
function changeThemes(mode) {
    if (mode === "system-theme") {
        checkSysTheme();
    }
    else if (mode === "location-suntimes" || mode === "manual-suntimes"){
        checkTime();
    }
}

// Creates an alarm based on a key used to get 
// a String in the 24h format "HH:MM" and an alarm name.
function createAlarm(timeKey, alarmName, periodInMinutes = null) {
    return browser.storage.local.get([
            CHECK_TIME_STARTUP_ONLY_KEY,
            timeKey
        ])
        .then((obj) => {
            let timeSplit = obj[timeKey].time.split(":");

            const when = convertToNextMilliEpoch(timeSplit[0], timeSplit[1]);
            return browser.alarms.create(alarmName, {
                when,
                periodInMinutes
            })
         }, onError)
        .then(() => {
            //logAllAlarms();
        }, onError);
}

// Depending on the alarm name passed, this listener will:
// - Get the stored daytime/nighttime theme and try to enable theme.
// - Check the time and change the theme accordingly.
function alarmListener(alarmInfo) {
    if (alarmInfo.name === NEXT_SUNRISE_ALARM_NAME) {
        return browser.storage.local.get([CHANGE_MODE, DAYTIME_THEME_KEY])
            .then(
                (values) => {
                    // If we are set to get suntimes automatically,
                    // then calculate the sunset again upon
                    // an alarm and create new alarms based on that.
                    if (obj[CHANGE_MODE_KEY] = "location-suntimes") {
                        calculateSuntimes()
                            .then((result) => {
                                return Promise.all([
                                    browser.storage.local.set({[SUNRISE_TIME_KEY]: {time: convertDateToString(result.nextSunrise)}}),
                                    browser.storage.local.set({[SUNSET_TIME_KEY]: {time: convertDateToString(result.nextSunset)}})
                                ]);
                            })
                            .then(() => {
                                return Promise.all([
                                    createAlarm(SUNRISE_TIME_KEY, NEXT_SUNRISE_ALARM_NAME, 60 * 24),
                                    createAlarm(SUNSET_TIME_KEY, NEXT_SUNSET_ALARM_NAME, 60 * 24)
                                ]);
                            });

                        
                    }
                    enableTheme(values, DAYTIME_THEME_KEY);
                }
                , onError);
    }
    else if (alarmInfo.name === NEXT_SUNSET_ALARM_NAME) {
        return browser.storage.local.get([AUTOMATIC_SUNTIMES_KEY, NIGHTTIME_THEME_KEY])
            .then(
                (values) => {
                    if (obj[CHANGE_MODE_KEY] = "location-suntimes") {
                        calculateSuntimes()
                            .then((result) => {
                                return Promise.all([
                                    browser.storage.local.set({[SUNRISE_TIME_KEY]: {time: convertDateToString(result.nextSunrise)}}),
                                    browser.storage.local.set({[SUNSET_TIME_KEY]: {time: convertDateToString(result.nextSunset)}})
                                ]);
                            })
                            .then(() => {
                                return Promise.all([
                                    createAlarm(SUNRISE_TIME_KEY, NEXT_SUNRISE_ALARM_NAME, 60 * 24),
                                    createAlarm(SUNSET_TIME_KEY, NEXT_SUNSET_ALARM_NAME, 60 * 24)
                                ]);
                            });
                    }
                    enableTheme(values, NIGHTTIME_THEME_KEY);
                }
                , onError);
    }
    else if (alarmInfo.name === "checkTime") {
        return checkTime();
    }
}

// Check the current system time and set the theme based on the time.
// Will set the daytime theme between sunrise and sunset.
// Otherwise, set nighttime theme.

// TODO: Can split this function to be more generic. Make function enableTime happen as a parameter.
function checkTime() {
    let date = new Date(Date.now());
    let hours = date.getHours();
    let minutes = date.getMinutes();
    //console.log("It is currently: " + hours + ":" + minutes + ". Conducting time check now...");

    return browser.storage.local.get([SUNRISE_TIME_KEY, SUNSET_TIME_KEY])
        .then((obj) => {
            let sunriseSplit = obj[SUNRISE_TIME_KEY].time.split(":");
            let sunsetSplit = obj[SUNSET_TIME_KEY].time.split(":");

            if (timeInBetween(
                    hours, minutes, 
                    sunriseSplit[0], sunriseSplit[1], 
                    sunsetSplit[0], sunsetSplit[1])) {
                browser.storage.local.get(DAYTIME_THEME_KEY)
                    .then((obj) => {
                        enableTheme(obj, DAYTIME_THEME_KEY);
                    }, onError);
            } else {
                browser.storage.local.get(NIGHTTIME_THEME_KEY)
                    .then((obj) => {
                        enableTheme(obj, NIGHTTIME_THEME_KEY);
                    }, onError);
            }
        }, onError);
}

// Check the system theme and set the theme accordingly.
function checkSysTheme() {
    if(window.matchMedia('(prefers-color-scheme: dark)').matches){
        browser.storage.local.get(NIGHTTIME_THEME_KEY)
            .then((obj) => {
                return enableTheme(obj, NIGHTTIME_THEME_KEY);
            }, onError);
    } else {
        browser.storage.local.get(DAYTIME_THEME_KEY)
            .then((obj) => {
                return enableTheme(obj, DAYTIME_THEME_KEY);
            }, onError);
    }
}

// Parse the object given and enable the theme.if it is not
// already enabled.
function enableTheme(theme, themeKey) {
    theme = theme[themeKey];
    return browser.management.get(theme.themeId)
        .then((extInfo) => {
            if (!extInfo.enabled) {
                //console.log("automaticDark DEBUG: Enabled theme " + theme.themeId);
                browser.management.setEnabled(theme.themeId, true);
            }
        }, onError);
}

// Take in the time as hours and minutes and
// return the next time it will occur as
// milliseconds since the epoch.
function convertToNextMilliEpoch(hours, minutes) {
    let returnDate = new Date(Date.now());
    returnDate.setHours(hours);
    returnDate.setMinutes(minutes);
    returnDate.setSeconds(0);
    returnDate.setMilliseconds(0);

    // If the specified time has already occurred, 
    // the next time it will occur will be the next day.
    if (returnDate < Date.now()) {
        returnDate.setDate(returnDate.getDate() + 1);
    }
    return returnDate.getTime();
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

// Prompt user to give location. Then store it.
function setGeolocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject('Geolocation is not supported by your browser.');
        } else {
            navigator.geolocation.getCurrentPosition((position) => {
                    setStorage({
                        [GEOLOCATION_LATITUDE_KEY]: {latitude: position.coords.latitude},
                        [GEOLOCATION_LONGITUDE_KEY]: {longitude: position.coords.longitude}
                    })
                    .then(() => {
                        resolve(); 
                    });
                }, () => {
                reject("Unable to fetch current location.");
            });
        }
    });
}

// Calculate the next sunrise/sunset times
// based on today's date,.tomorrow's date, and geolocation in storage.
function calculateSuntimes() {
    return browser.storage.local.get([GEOLOCATION_LATITUDE_KEY, GEOLOCATION_LONGITUDE_KEY])
        .then((position) => {

            // Prepare today and tomorrow's date for calculations.
            let today = new Date(Date.now());
            let tomorrow =  new Date(Date.now());
            tomorrow.setDate(tomorrow.getDate() + 1);
            let dates = [today, tomorrow];

            let results = [];
            dates.forEach((date) => {
                results.push(
                    // Do the calculations using SunCalc.
                    // Figure out today and tomorrow's sunrise/sunset times.
                    SunCalc.getTimes(date, 
                        position[GEOLOCATION_LATITUDE_KEY].latitude, 
                        position[GEOLOCATION_LONGITUDE_KEY].longitude)
                );
            });

            let now = new Date(Date.now());
            let nextSunrise = new Date(results[0].sunrise);
            let nextSunset = new Date(results[0].sunset);
            nextSunrise.setDate(nextSunrise.getDate() + 10);
            nextSunset.setDate(nextSunset.getDate() + 10);

            // Figure out whether today or tomorrow's sunrise/sunset time should be used.
            results.forEach((result) => {
                if (now < result.sunrise && result.sunrise < nextSunrise) {
                    nextSunrise = result.sunrise;
                }
                if (now < result.sunset && result.sunset < nextSunset) {
                    nextSunset = result.sunset;
                }
            });

            return {nextSunrise: nextSunrise, nextSunset: nextSunset};
        }, onError);
}


function extensionUpdated() {

}