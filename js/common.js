'use strict';

const KEY_PREFIX = 'autodark';

const DEBUG_MODE_KEY = KEY_PREFIX + "debugMode"; 

const CURRENT_MODE_KEY = KEY_PREFIX + "currentMode"; // day-mode, night-mode

const CHANGE_MODE_KEY = KEY_PREFIX + "changeMode"; // location-suntimes, manual-suntimes, system-theme
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

const DEFAULT_DEBUG_MODE = false;

// Default themes are set after looking through the user's
// current theme and their installed themes.
let DEFAULT_DAYTIME_THEME = "";
let DEFAULT_NIGHTTIME_THEME = "";


var detect_scheme_change_block = false; // This is just a sneaky way to prevent flashing

let DEBUG_MODE = false;
browser.storage.local.get(DEBUG_MODE_KEY)
    .then((obj) => {
        DEBUG_MODE = obj[DEBUG_MODE_KEY].check;

        if (DEBUG_MODE)
            console.log("automaticDark DEBUG: DEBUG_MODE is enabled.");
    }, onError);

// Things to do when the extension is starting up
// (or if the settings have been reset).
function init() {
    if (DEBUG_MODE) {
        console.log("automaticDark DEBUG: 0 - Start init");
        console.log("automaticDark DEBUG: 0 - Starting up automaticDark");
    }

    // Set values if they each have never been set before,
    // such as on first-time startup.
    return setStorage({
            [CHANGE_MODE_KEY]: {mode: DEFAULT_CHANGE_MODE},
            [CHECK_TIME_STARTUP_ONLY_KEY]: {check: DEFAULT_CHECK_TIME_STARTUP_ONLY},
            [DEBUG_MODE_KEY]: {check: DEFAULT_DEBUG_MODE},
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
            // this needs to be done regardless of settings
            // otherwise we don't know what the system theme is, when the user switches to system-theme
            enableSystemThemeTracking();

            // If flag is not set to check only on startup,
            // create alarms to change the theme in the future.
            browser.alarms.onAlarm.addListener(alarmListener);
            return browser.storage.local.get([CHECK_TIME_STARTUP_ONLY_KEY, CHANGE_MODE_KEY]);
        }, onError)
        .then((obj) => {
            if (!obj[CHECK_TIME_STARTUP_ONLY_KEY].check) {
                // On start up, change the themes appropriately.
                changeThemeBasedOnChangeMode(obj[CHANGE_MODE_KEY].mode);

                // Add a listener to change the theme when the window is focused.

                // For changing based on system theme, this is an additional check as
                // matchMedia().addListener does not always work across OS configurations.
                // Also for changing based on suntimes,
                // every time the window is focused, check the time and reset the alarms.
                // This prevents any delay in the alarms after OS sleep/hibernation.
                browser.windows.onFocusChanged.addListener((windowId) => {
                    if (windowId !== browser.windows.WINDOW_ID_NONE) {

                        if (DEBUG_MODE)
                            console.log("automaticDark DEBUG: 10 - Window was focused. Attempt theme change.");

                        browser.storage.local.get(CHANGE_MODE_KEY)
                            .then((obj) => {
                                changeThemeBasedOnChangeMode(obj[CHANGE_MODE_KEY].mode);

                                if (obj[CHANGE_MODE_KEY].mode === "location-suntimes" || obj[CHANGE_MODE_KEY].mode === "manual-suntimes"){
                                    browser.alarms.clearAll();
                                    createAlarm(SUNRISE_TIME_KEY, NEXT_SUNRISE_ALARM_NAME, 60 * 24),
                                    createAlarm(SUNSET_TIME_KEY, NEXT_SUNSET_ALARM_NAME, 60 * 24)
                                }
                            });
                    }
                });

                if (obj[CHANGE_MODE_KEY].mode === "system-theme") {
                    // browser.browserSettings.overrideContentColorScheme changes the following
                    // about:config to "2", effectively applying a light/dark theme based on the device theme
                    // and allowing the prefers-color-scheme media query to be used to detect the device theme.
                    // The about:config setting is: layout.css.prefers-color-scheme.content-override
                    browser.browserSettings.overrideContentColorScheme.set({value: "system"}); // TODO: May not be required
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
                else { // manual-suntimes
                    return Promise.all([
                        createAlarm(SUNRISE_TIME_KEY, NEXT_SUNRISE_ALARM_NAME, 60 * 24),
                        createAlarm(SUNSET_TIME_KEY, NEXT_SUNSET_ALARM_NAME, 60 * 24)
                    ]);
                }
            }
        }, onError)
        .then((obj) => {
            enableSchemeChangeDetection();
        }, onError);
}

// Changes the current theme.
// Takes a parameter indicating how to decide what theme to change to.
function changeThemeBasedOnChangeMode(mode) {
    if (DEBUG_MODE)
        console.log("automaticDark DEBUG: Start changeThemeBasedOnChangeMode");

    return browser.storage.local.get(CHANGE_MODE_KEY)
        .then((obj) => {
            let mode = obj[CHANGE_MODE_KEY].mode;

            if (DEBUG_MODE)
                console.log("automaticDark DEBUG: 50 changeThemeBasedOnChangeMode - Mode is set to: " + mode);

            if (mode === "system-theme") {
                return checkSysTheme(); 
            }
            else if (mode === "location-suntimes" || mode === "manual-suntimes"){
                return checkTime();
            }
        });
}

// Creates an alarm based on a key used to get 
// a String in the 24h format "HH:MM" and an alarm name.
function createAlarm(timeKey, alarmName, periodInMinutes = null) {
    if (DEBUG_MODE)
        console.log("automaticDark DEBUG: Start createAlarm");

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
    if (DEBUG_MODE)
        console.log("automaticDark DEBUG: Start alarmListener");

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

    if (DEBUG_MODE) {
        console.log("automaticDark DEBUG: Start checkTime");
        console.log("automaticDark DEBUG: It is currently: " + hours + ":" + minutes + ". Conducting time check now...");
    }

    return browser.storage.local.get([SUNRISE_TIME_KEY, SUNSET_TIME_KEY])
        .then((obj) => {
            let sunriseSplit = obj[SUNRISE_TIME_KEY].time.split(":");
            let sunsetSplit = obj[SUNSET_TIME_KEY].time.split(":");

            if (timeInBetween(
                    hours, minutes, 
                    sunriseSplit[0], sunriseSplit[1], 
                    sunsetSplit[0], sunsetSplit[1])) {
                return browser.storage.local.get(DAYTIME_THEME_KEY)
                    .then((obj) => {
                        return enableTheme(obj, DAYTIME_THEME_KEY)
                            .then(() => {
                                return browser.storage.local.set({[CURRENT_MODE_KEY]: {mode: "day-mode"}});
                            });
                    }, onError);
            } else {
                return browser.storage.local.get(NIGHTTIME_THEME_KEY)
                    .then((obj) => {
                        return enableTheme(obj, NIGHTTIME_THEME_KEY)
                            .then(() => {
                                return browser.storage.local.set({[CURRENT_MODE_KEY]: {mode: "night-mode"}});
                            });
                    }, onError);
            }
        }, onError);
}

// Check the system theme and set the theme accordingly.
// system-theme is updated using events, that are sent on startup and during runtime.
// because the background script cant determine the system theme on it's owb ( #43 ), it cannot update the theme imperatively.
var system_is_dark = null;

function checkSysTheme() {
    if (DEBUG_MODE)
        console.log("automaticDark DEBUG: Start checkSysTheme");

    if(system_is_dark == true){
        if (DEBUG_MODE)
            console.log("automaticDark DEBUG: 90 checkSysTheme - User prefers dark interface");
            
        return browser.storage.local.get(NIGHTTIME_THEME_KEY)
            .then((obj) => {
                return Promise.all([
                    browser.storage.local.set({[CURRENT_MODE_KEY]: {mode: "night-mode"}}), 
                    enableTheme(obj, NIGHTTIME_THEME_KEY)
                ]);
            }, onError);
    } else if (system_is_dark == false) {
        if (DEBUG_MODE)
            console.log("automaticDark DEBUG: 90 checkSysTheme - User prefers light interface");

        return browser.storage.local.get(DAYTIME_THEME_KEY)
            .then((obj) => {
                return Promise.all([
                    browser.storage.local.set({[CURRENT_MODE_KEY]: {mode: "day-mode"}}),
                    enableTheme(obj, DAYTIME_THEME_KEY)
                ]);
            }, onError);
    }
    // if system_is_dark is null, it probably won't be for long
    // we wouldn't want to assume a default, then change the theme back and forth when events come in
}

// This enables listening to messeges from tabs (system-theme-notifier.js) that are detecting changes to the system theme
// this needs to be done to keep the system_is_dark variable in sync,
// which is then applied normally when checkSysTheme is called. 
function enableSystemThemeTracking() {
    if (DEBUG_MODE)
        console.log("automaticDark DEBUG: Start enableSystemThemeTracking");

    // watching the media never did anything
    browser.runtime.onMessage.removeListener(systemThemeListener);
    browser.runtime.onMessage.addListener(systemThemeListener);
}

function systemThemeListener(msg, sender) {
    if (msg.type!=="color-scheme-change") {
        return false;
    }

    if (DEBUG_MODE)
        console.log("automaticDark DEBUG: 10 - prefers-color-scheme changed in tab: ", msg.tab, " and is now: ", msg.prefersColorScheme);

    if (system_is_dark !== msg.prefersColorScheme) {
        if (DEBUG_MODE)
            console.log("automaticDark DEBUG: 10 - new system theme recognized: ", msg.prefersColorScheme);

        // SAVE the system theme
        system_is_dark = msg.prefersColorScheme;

        // UPDATE theme (if system-theme mode is on.)
        browser.storage.local.get(CHANGE_MODE_KEY)
        .then((obj) => {
            console.log("automaticDark DEBUG: 10 - new system theme so updating ");
            if (obj[CHANGE_MODE_KEY].mode === "system-theme" && !detect_scheme_change_block) { // doesnt update theme, if block is set
                checkSysTheme();
            }
        });
    }

    return false;
}

// Parse the object given and enable the theme.if it is not
// already enabled.
function enableTheme(theme, themeKey) {
    if (DEBUG_MODE)
        console.log("automaticDark DEBUG: Start enableTheme");

    theme = theme[themeKey];
    return browser.management.get(theme.themeId)
        .then((extInfo) => {
            if (!extInfo.enabled) {
                if (DEBUG_MODE)
                    console.log("automaticDark DEBUG: 100 enableTheme - Enabled theme " + theme.themeId);
                detect_scheme_change_block = true; // Temporarily disables detection of color scheme change
                browser.management.setEnabled(theme.themeId, true).then(enableSchemeChangeDetection);
            }
            else {
                if (DEBUG_MODE)
                    console.log("automaticDark DEBUG: 100 enableTheme - " + theme.themeId + " is already enabled.");
            }
        }, onError);
}

// Modifies the color scheme of the current theme to prevent interference with detection of the OS system theme.
// This only applies when the extension is set to "system theme" mode.
function enableSchemeChangeDetection() {
    if (DEBUG_MODE)
        console.log("automaticDark DEBUG: Start enableSchemeChangeDetection");

    browser.storage.local.get(CHANGE_MODE_KEY)
        .then((obj) => {
            let mode = obj[CHANGE_MODE_KEY].mode;

            browser.theme.getCurrent().then(current_theme => {

                if (DEBUG_MODE)
                    console.log(current_theme);

                if (current_theme.colors) { // "System theme — auto" is an empty object

                    // Only modify the current theme when the extension is set to "system theme" mode.
                    if (mode === "system-theme") {
                        if (DEBUG_MODE)
                            console.log("automaticDark DEBUG: enableSchemeChangeDetection - Mode is set to 'system-theme'. Set color_scheme to system.");

                        current_theme.properties.color_scheme = "system"; // Change the property of the theme object
                        current_theme.properties.content_color_scheme = "system"; // Optional

                        browser.theme.update(current_theme).then(() => {
                            if (DEBUG_MODE)
                                console.log("automaticDark DEBUG: enableSchemeChangeDetection - Updated current theme.");
                            detect_scheme_change_block = false;
                        }); // Applies amended theme and un-block scheme change detection

                    }
                    else { //if (mode === "location-suntimes" || mode === "manual-suntimes"){
                        if (DEBUG_MODE)
                            console.log("automaticDark DEBUG: enableSchemeChangeDetection - Mode is set to: " + mode + ". Reset theme to default.");

                        browser.theme.reset().then(() => {
                            if (DEBUG_MODE)
                                console.log("automaticDark DEBUG: enableSchemeChangeDetection - Reset current theme.");
                            detect_scheme_change_block = false;
                        });
                    }

                } else {
                    detect_scheme_change_block = false;
                }
            });
        });
}

// Set the currently enabled theme
// as the default daytime/nighttime theme.
//
// Set default nighttime theme to Firefox's
// default if it is available.
function setDefaultThemes() {
    if (DEBUG_MODE)
        console.log("automaticDark DEBUG: Start setDefaultThemes");

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
    if (DEBUG_MODE)
        console.log("automaticDark DEBUG: Start setGeolocation");

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
    if (DEBUG_MODE)
        console.log("automaticDark DEBUG: Start calculateSuntimes");

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