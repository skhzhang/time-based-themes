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
const SYSTEM_THEME_POLL_ALARM_NAME = KEY_PREFIX + "systemThemePoll";

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

// All theme switches are funneled through this queue so only one runs at a
// time. The change event, the focus listener, the poll and the startup check
// can otherwise fire near-simultaneously and interleave: the second chain's
// theme.reset() can land after the first chain's finished switch, and
// theme.reset() always repaints the *default* theme, not the enabled one
// (see bug 1415267) — leaving the default theme on screen with no
// color_scheme workaround applied and nothing left to correct it.
let theme_switch_queue = Promise.resolve();

// Run fn after every previously queued theme switch has fully finished.
// Returns fn's own promise; the stored queue tail never stays rejected.
function queueThemeSwitch(fn) {
    const result = theme_switch_queue.then(fn);
    theme_switch_queue = result.then(() => {}, onError);
    return result;
}

let DEBUG_MODE = false;
browser.storage.local.get(DEBUG_MODE_KEY)
    .then((obj) => {
        // On a fresh install this read runs before init() has created
        // the key, so guard against it being absent.
        DEBUG_MODE = !!(obj[DEBUG_MODE_KEY] && obj[DEBUG_MODE_KEY].check);

        logDebug("Checked storage and DEBUG_MODE is enabled.");
    }, onError);

// Pick up the Debug mode checkbox immediately. The read above only runs
// once at page load, so the background page never saw later changes —
// toggling the checkbox did nothing for its logging until the extension
// reloaded or the browser restarted.
browser.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[DEBUG_MODE_KEY]) {
        DEBUG_MODE = !!(changes[DEBUG_MODE_KEY].newValue && changes[DEBUG_MODE_KEY].newValue.check);
        logDebug("Storage changed and DEBUG_MODE is now " + DEBUG_MODE + ".");
    }
});

// Things to do when the extension is starting up
// (or if the settings have been reset).
function init() {
    logDebug("0 - Start init");
    logDebug("0 - Starting up automaticDark");

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
            // If flag is not set to check only on startup,
            // create alarms to change the theme in the future.
            browser.alarms.onAlarm.addListener(alarmListener);
            return browser.storage.local.get([CHECK_TIME_STARTUP_ONLY_KEY, CHANGE_MODE_KEY]);
        }, onError)
        .then((obj) => {
            if (!obj[CHECK_TIME_STARTUP_ONLY_KEY].check) {
                // On start up, change the themes appropriately.
                queueThemeSwitch(() => changeThemeBasedOnChangeMode(obj[CHANGE_MODE_KEY].mode));

                // Poll the system theme on a timer as a fallback. Since Firefox 95,
                // prefers-color-scheme in extension pages reflects the browser theme
                // rather than the OS (Bugzilla 1741009, resolved WORKSFORME), so the
                // matchMedia 'change' event below only fires on OS theme changes while
                // the color_scheme "system" workaround is applied — and a change can
                // still be missed (e.g. while the machine sleeps).
                // See issues #43, #64, #67.
                browser.alarms.create(SYSTEM_THEME_POLL_ALARM_NAME, {periodInMinutes: 1});

                // Add a listener to change the theme when the window is focused.

                // For changing based on system theme, this is an additional check as
                // matchMedia().addListener does not always work across OS configurations.
                // Also for changing based on suntimes,
                // every time the window is focused, check the time and reset the alarms.
                // This prevents any delay in the alarms after OS sleep/hibernation.
                browser.windows.onFocusChanged.addListener((windowId) => {
                    if (windowId !== browser.windows.WINDOW_ID_NONE) {

                        logDebug("10 - Window was focused. Attempt theme change.");

                        browser.storage.local.get(CHANGE_MODE_KEY)
                            .then((obj) => {
                                queueThemeSwitch(() => changeThemeBasedOnChangeMode(obj[CHANGE_MODE_KEY].mode));

                                if (obj[CHANGE_MODE_KEY].mode === "location-suntimes" || obj[CHANGE_MODE_KEY].mode === "manual-suntimes"){
                                    browser.alarms.clearAll();
                                    createAlarm(SUNRISE_TIME_KEY, NEXT_SUNRISE_ALARM_NAME, 60 * 24),
                                    createAlarm(SUNSET_TIME_KEY, NEXT_SUNSET_ALARM_NAME, 60 * 24)
                                }

                                // clearAll() above can wipe the poll alarm; re-establish it.
                                browser.alarms.create(SYSTEM_THEME_POLL_ALARM_NAME, {periodInMinutes: 1});
                            });
                    }
                });

                // Add listener that will change the theme if the mode is set to "system-theme"
                window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {

                    if (!detect_scheme_change_block) {
                        logDebug("10 - prefers-color-scheme changed.");

                        browser.storage.local.get(CHANGE_MODE_KEY)
                            .then((obj) => {
                                if (obj[CHANGE_MODE_KEY].mode === "system-theme") {
                                    queueThemeSwitch(checkSysTheme);
                                }
                        });
                    } else {
                        logDebug("prefers-color-scheme changed, but scheme change detection is currently disabled.");
                    }

                }, onError);

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
            else {
                // Change only on startup: this is the startup, so switch once.
                // In system-theme mode the switch chain also applies the
                // color_scheme workaround and re-enables a theme whose paint was
                // lost (e.g. after an extension reload); the other modes need
                // neither. Nothing further is needed here.
                return queueThemeSwitch(() => changeThemeBasedOnChangeMode(obj[CHANGE_MODE_KEY].mode));
            }
        }, onError);
}

// Changes the current theme.
// Takes a parameter indicating how to decide what theme to change to.
function changeThemeBasedOnChangeMode(mode) {
    logDebug("Start changeThemeBasedOnChangeMode");

    return browser.storage.local.get(CHANGE_MODE_KEY)
        .then((obj) => {
            let mode = obj[CHANGE_MODE_KEY].mode;

            logDebug("50 changeThemeBasedOnChangeMode - Mode is set to: " + mode);

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
    logDebug("Start createAlarm and create alarm name " + alarmName);

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
    logDebug("Start alarmListener");
    if (alarmInfo.name) {
        logDebug("Triggering alarm name: " + alarmInfo.name);
    }

    if (alarmInfo.name === NEXT_SUNRISE_ALARM_NAME || alarmInfo.name === NEXT_SUNSET_ALARM_NAME) {
        return browser.storage.local.get(CHANGE_MODE_KEY)
            .then((obj) => {
                // In automatic (location) mode, recalculate the next sunrise/sunset
                // times upon each alarm and reschedule the alarms based on them.
                if (obj[CHANGE_MODE_KEY].mode === "location-suntimes") {
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
            }, onError)
            // checkTime() reads the (possibly just-updated) sunrise/sunset times,
            // enables the correct day/night theme, and records the current mode.
            .then(() => queueThemeSwitch(checkTime));
    }
    else if (alarmInfo.name === SYSTEM_THEME_POLL_ALARM_NAME) {
        // System-theme mode: re-check the OS theme on a timer, as a fallback
        // for when the prefers-color-scheme 'change' event isn't delivered.
        return browser.storage.local.get(CHANGE_MODE_KEY)
            .then((obj) => {
                if (obj[CHANGE_MODE_KEY].mode === "system-theme") {
                    return queueThemeSwitch(checkSysTheme);
                }
            }, onError);
    }
}

// Check the current system time and set the theme based on the time.
// Will set the daytime theme between sunrise and sunset.
// Otherwise, set nighttime theme.

// TODO: Can split this function to be more generic. Make function enableTime happen as a parameter.
// Record the current mode (day-mode/night-mode), writing storage only
// when the value actually changes. The once-a-minute poll and the
// window-focus listener land here constantly; without the guard they
// generate a steady stream of no-op writes and onChanged events.
function setCurrentMode(mode) {
    return browser.storage.local.get(CURRENT_MODE_KEY)
        .then((obj) => {
            if (!obj[CURRENT_MODE_KEY] || obj[CURRENT_MODE_KEY].mode !== mode) {
                return browser.storage.local.set({[CURRENT_MODE_KEY]: {mode: mode}});
            }
        });
}

function checkTime() {
    let date = new Date(Date.now());
    let hours = date.getHours();
    let minutes = date.getMinutes();

    logDebug("Start checkTime");
    logDebug("It is currently: " + hours + ":" + minutes + ". Conducting time check now...");

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
                                return setCurrentMode("day-mode");
                            });
                    }, onError);
            } else {
                return browser.storage.local.get(NIGHTTIME_THEME_KEY)
                    .then((obj) => {
                        return enableTheme(obj, NIGHTTIME_THEME_KEY)
                            .then(() => {
                                return setCurrentMode("night-mode");
                            });
                    }, onError);
            }
        }, onError);
}

// Check the system theme and set the theme accordingly.
function checkSysTheme() {
    logDebug("Start checkSysTheme");

    if(window.matchMedia('(prefers-color-scheme: dark)').matches){
        logDebug("90 checkSysTheme - User prefers dark interface");
        return browser.storage.local.get(NIGHTTIME_THEME_KEY)
            .then((obj) => {
                return Promise.all([
                    setCurrentMode("night-mode"),
                    enableTheme(obj, NIGHTTIME_THEME_KEY)
                ]);
            }, onError);
    } else {
        logDebug("90 checkSysTheme - User prefers light interface");
        return browser.storage.local.get(DAYTIME_THEME_KEY)
            .then((obj) => {
                return Promise.all([
                    setCurrentMode("day-mode"),
                    enableTheme(obj, DAYTIME_THEME_KEY)
                ]);
            }, onError);
    }
}

// The built-in Light/Dark themes declare a color scheme which overrides the
// browser's OS light/dark signal — once one is enabled the OS can no longer
// be sensed and switching stops. In system-theme mode, the "System theme — auto" theme
// paints the same under the OS side the slot is enabled for (identically on
// Mac/Windows; on Linux it follows the system/GTK colors) and leaves the signal alone,
// so enable it in their place. Skip when the same theme fills both slots
// (the user wants that scheme permanently) or when the theme opposes its slot
// (e.g. built-in Dark as the daytime theme) — auto would visibly repaint those.
function substituteBuiltInTheme(themeId, themeKey) {
    let aligned =
        (themeKey === DAYTIME_THEME_KEY && themeId === "firefox-compact-light@mozilla.org")
        || (themeKey === NIGHTTIME_THEME_KEY && themeId === "firefox-compact-dark@mozilla.org");
    if (!aligned) {
        return Promise.resolve(themeId);
    }
    return browser.storage.local.get([CHANGE_MODE_KEY, DAYTIME_THEME_KEY, NIGHTTIME_THEME_KEY])
        .then((obj) => {
            if (obj[CHANGE_MODE_KEY].mode === "system-theme"
                && obj[DAYTIME_THEME_KEY] && obj[NIGHTTIME_THEME_KEY]
                && obj[DAYTIME_THEME_KEY].themeId !== obj[NIGHTTIME_THEME_KEY].themeId) {
                logDebug("substituteBuiltInTheme - " + themeId + " pins the OS scheme. Enabling System theme (auto) instead.");
                return "default-theme@mozilla.org";
            }
            return themeId;
        });
}

// Parse the object given and enable the theme.if it is not
// already enabled.
function enableTheme(theme, themeKey) {
    logDebug("Start enableTheme");

    theme = theme[themeKey];
    return substituteBuiltInTheme(theme.themeId, themeKey)
        .then((themeId) => browser.management.get(themeId)
            .then((extInfo) => {
                if (!extInfo.enabled) {
                    logDebug("100 enableTheme - Enabled theme " + themeId);
                    detect_scheme_change_block = true; // Temporarily disables detection of color scheme change
                    return browser.management.setEnabled(themeId, true).then(enableSchemeChangeDetection,
                        (err) => { detect_scheme_change_block = false; onError(err); });
                }
                else {
                    logDebug("100 enableTheme - " + themeId + " is already enabled.");
                    return reapplyColorSchemeFix(themeId);
                }
            }, onError));
}

// Built-in themes report no colors from theme.getCurrent(), so for them a
// colorless paint cannot be told apart from a correct one.
const BUILT_IN_THEME_IDS = [
    "default-theme@mozilla.org",
    "firefox-compact-light@mozilla.org",
    "firefox-compact-dark@mozilla.org"
];

// If re-enabling a theme doesn't surface colors, the theme genuinely has
// none (like the built-ins above, should their ids ever change) — remember
// it and stop retrying, or the once-a-minute poll would toggle it into a
// visible flicker loop.
let repaint_attempted_theme = null;

// Re-apply the color_scheme fix if the enabled theme is missing it.
// Switching to system-theme mode while the matching theme is already
// enabled skips enableSchemeChangeDetection(), leaving the theme without
// color_scheme "system" — OS scheme changes then go undetected for the
// rest of the session.
function reapplyColorSchemeFix(themeId) {
    return browser.storage.local.get(CHANGE_MODE_KEY)
        .then((obj) => {
            if (obj[CHANGE_MODE_KEY].mode !== "system-theme") {
                return;
            }
            return browser.theme.getCurrent().then((current_theme) => {
                if (current_theme.colors) {
                    // A painted theme has colors, so any earlier repaint
                    // attempt worked; allow future repaints again.
                    repaint_attempted_theme = null;
                    if (!current_theme.properties || current_theme.properties.color_scheme !== "system") {
                        return enableSchemeChangeDetection();
                    }
                    return;
                }
                // management can report the theme as enabled while the default
                // theme is what is actually painted: theme.reset() always
                // repaints the default theme (bug 1415267), and reloading the
                // extension drops its theme.update() overlay the same way.
                // getCurrent() then reports no colors, so the branch above
                // never fires and the wrong paint would otherwise be permanent.
                // Toggle the theme to force a real repaint.
                if (themeId
                    && !BUILT_IN_THEME_IDS.includes(themeId)
                    && themeId !== repaint_attempted_theme) {
                    logDebug("reapplyColorSchemeFix - " + themeId + " is enabled but not painted. Re-enabling it.");
                    repaint_attempted_theme = themeId;
                    detect_scheme_change_block = true;
                    return browser.management.setEnabled(themeId, false)
                        .then(() => browser.management.setEnabled(themeId, true))
                        .then(enableSchemeChangeDetection,
                            (err) => { detect_scheme_change_block = false; onError(err); })
                        .then(() => browser.theme.getCurrent())
                        .then((repainted) => {
                            // Colors surfacing means the repaint worked; allow
                            // another repaint if the paint is lost again later.
                            if (repainted.colors) {
                                repaint_attempted_theme = null;
                            }
                        });
                }
            });
        });
}

// Modifies the color scheme of the current theme to prevent interference with detection of the OS system theme.
// This only applies when the extension is set to "system theme" mode.
function enableSchemeChangeDetection() {
    logDebug("Start enableSchemeChangeDetection");

    return browser.storage.local.get(CHANGE_MODE_KEY)
        .then((obj) => {
            let mode = obj[CHANGE_MODE_KEY].mode;

            // Only modify the current theme when the extension is set to "system theme" mode.
            if (mode === "system-theme") {
                // Drop any dynamic theme we previously applied via theme.update()
                // BEFORE reading getCurrent(). theme.update() creates an overlay
                // owned by this extension that sits on top of the enabled static
                // theme; while that overlay exists, getCurrent() returns it, not
                // the static theme underneath.
                // Without the reset, a stale overlay (e.g. last night's dark
                // colors) gets re-applied over the newly enabled theme and masks
                // it indefinitely, even though management reports the right theme.
                return browser.theme.reset()
                    .then(() => browser.theme.getCurrent())
                    .then((current_theme) => {
                        logDebug("Logging current theme...");
                        if (DEBUG_MODE) {
                            console.log(current_theme);
                        }

                        if (current_theme.colors) { // "System theme — auto" is an empty object
                            logDebug("enableSchemeChangeDetection - Mode is set to 'system-theme'. Set color_scheme to system.");

                            // Some themes are returned without a 'properties' object.
                            // Guard against that so we don't throw and leave the
                            // scheme-change block stuck on (silently disabling detection).
                            if (!current_theme.properties)
                                current_theme.properties = {};
                            current_theme.properties.color_scheme = "system"; // Change the property of the theme object
                            current_theme.properties.content_color_scheme = "system"; // Optional

                            return sanitizeThemeForUpdate(current_theme)
                                .then((sanitized_theme) => browser.theme.update(sanitized_theme))
                                .then(() => {
                                    logDebug("enableSchemeChangeDetection - Updated current theme.");
                                });
                        }
                    })
                    // Un-block scheme change detection whether or not the update applied.
                    .then(() => { detect_scheme_change_block = false; },
                          (err) => { detect_scheme_change_block = false; onError(err); });
            }
            else { //if (mode === "location-suntimes" || mode === "manual-suntimes"){
                logDebug("enableSchemeChangeDetection - Mode is set to: " + mode + ". Reset theme to default.");

                return browser.theme.reset().then(() => {
                    logDebug("enableSchemeChangeDetection - Reset current theme.");
                    detect_scheme_change_block = false;
                });
            }
        });
}

// Set the currently enabled theme
// as the default daytime/nighttime theme.
//
// Set default nighttime theme to Firefox's
// default if it is available.
function setDefaultThemes() {
    logDebug("Start setDefaultThemes");

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
    logDebug("Start setGeolocation");

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
    logDebug("Start calculateSuntimes");

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