let locationWarning = document.getElementById("location-permission-warning");
let startupOnlyMessage = document.getElementById("startup-only-message");
let resetMessage = document.getElementById("reset-message");

let automaticSuntimesRadio = document.getElementById("automatic-suntimes-radio");
let manualSuntimesRadio = document.getElementById("manual-suntimes-radio");
let sysThemeRadio = document.getElementById("system-theme-radio");

let checkStartupBox = document.getElementById("check-startup-only");
let sunriseInput = document.getElementById("sunrise-time");
let sunsetInput = document.getElementById("sunset-time");

let daytimeThemeList = document.getElementById("daytime-theme-list");
let nighttimeThemeList = document.getElementById("nighttime-theme-list");
let geolocationBtn = document.getElementById("geolocation-btn");
let resetDefaultBtn = document.getElementById("reset-default-btn");

let debugModeBox = document.getElementById("debug-mode");
let sunriseInputEvent = new Event("input");
let sunsetInputEvent = new Event("input");

let currentlyEnabledTheme;

if (DEBUG_MODE)
    console.log("automaticDark DEBUG: DEBUG_MODE is enabled.");


// Log everything stored.
browser.storage.local.get(null)
    .then((results) => {
        if (DEBUG_MODE) {
            console.log("automaticDark DEBUG: Options page opened. All stored data:");
            console.log(results);
        }
    }, onError);

// logAllAlarms();

changeLogo();
changeOptionsPageTheme();
getChangeMode();

browser.storage.onChanged.addListener((changes, area) => {
    let changedItems = Object.keys(changes);

    if (DEBUG_MODE)
        console.log("automaticDark DEBUG: Browser storage changed. Change logo on Options page.");

    for (let item of changedItems) {

        // If the extension's current mode changes (eg. from daytime to nighttime),
        // then adjust the change and option page theme accordingly.
        if (item === CURRENT_MODE_KEY) {
            
            changeLogo();
            changeOptionsPageTheme();
        }
    }
});

// Iterate through each extension to populate the dropdowns.
browser.management.getAll().then((extensions) => {

    if (DEBUG_MODE)
        console.log(extensions);

    for (let extension of extensions) {
        // Add each theme as an option in the dropdowns.
        if (extension.type === 'theme') {

            if (DEBUG_MODE)
                console.log(extension);

            let extOption = document.createElement('option');
            extOption.textContent = extension.name;
            extOption.value = extension.id;

            daytimeThemeList.appendChild(extOption);
            nighttimeThemeList.appendChild(extOption.cloneNode(true));

            // Take note of the currently enabled theme.
            if (extension.enabled === true) {
                currentlyEnabledTheme = extension;
                if (DEBUG_MODE)
                    console.log(currentlyEnabledTheme);
            }
        }
    }

    browser.storage.local.get(DAYTIME_THEME_KEY)
        .then((theme) => {
            theme = theme[Object.keys(theme)[0]];

            if (!isEmpty(theme)) {
                // Set the default value of the dropdown.
                daytimeThemeList.value = theme.themeId;
            }

            if (currentlyEnabledTheme.id === theme.themeId) {
                if (DEBUG_MODE)
                    console.log("Day time theme is the currentlyEnabledTheme.");
            }
            else {
                if (DEBUG_MODE)
                    console.log("Day time theme is not the currentlyEnabledTheme.");
            }
        }, onError);

    browser.storage.local.get(NIGHTTIME_THEME_KEY)
        .then((theme) => {
            theme = theme[Object.keys(theme)[0]];

            if (!isEmpty(theme)) {
                // Set the default value of the dropdown.
                nighttimeThemeList.value = theme.themeId;
            }

            if (currentlyEnabledTheme.id === theme.themeId) {
                if (DEBUG_MODE)
                    console.log("Night time theme is the currentlyEnabledTheme.");
            }
            else {
                if (DEBUG_MODE)
                    console.log("Night time theme is not the currentlyEnabledTheme.");
            }
        }, onError);
});

// Change the logo on the options page based on the current mode.
function changeLogo() {
    if (DEBUG_MODE)
        console.log("automaticDark DEBUG: Start changeLogo");

    browser.storage.local.get(CURRENT_MODE_KEY)
        .then((currentMode) => {
            currentMode = currentMode[CURRENT_MODE_KEY].mode;

            if (DEBUG_MODE)
                console.log("automaticDark DEBUG: Changing logo to: " + currentMode);

            if (currentMode === "day-mode") {
                document.querySelector(".logo.day-mode").style.display = "inline-block";
                document.querySelector(".logo.night-mode").style.display = "none";
                document.querySelector(".logo.off-mode").style.display = "none";
            } else if (currentMode === "night-mode") {
                document.querySelector(".logo.day-mode").style.display = "none";
                document.querySelector(".logo.night-mode").style.display = "inline-block";
                document.querySelector(".logo.off-mode").style.display = "none";
            } else { // off-mode
                document.querySelector(".logo.day-mode").style.display = "none";
                document.querySelector(".logo.night-mode").style.display = "none";
                document.querySelector(".logo.off-mode").style.display = "inline-block";
            }
        }, onError);
}

// Change the logo on the options page based on the current mode.
function changeOptionsPageTheme() {
    if (DEBUG_MODE)
        console.log("automaticDark DEBUG: Start changeOptionsPageTheme");
    /*
    browser.storage.local.get(CURRENT_MODE_KEY)
        .then((currentMode) => {
            currentMode = currentMode[CURRENT_MODE_KEY].mode;

            if (DEBUG_MODE)
                console.log("automaticDark DEBUG: Changing options page theme to: " + currentMode);

            if (currentMode === "day-mode") {
                document.getElementsByTagName("body")[0].className = "day";
            } else if (currentMode === "night-mode") {
                document.getElementsByTagName("body")[0].className = "night"; 
            } else { // off-mode
                document.getElementsByTagName("body")[0].className = "day";
            }
        }, onError);
    */
}

// Set the settings on the page based on what mode is set in storage.
function getChangeMode() {
    if (DEBUG_MODE)
        console.log("automaticDark DEBUG: Start getChangeMode");

    return browser.storage.local.get(CHANGE_MODE_KEY)
        .then((obj) => {
            if (obj[CHANGE_MODE_KEY].mode === "location-suntimes") {
                automaticSuntimesRadio.checked = true;
                manualSuntimesRadio.checked = false;
                sysThemeRadio.checked = false;
                sunriseInput.disabled = true;
                sunsetInput.disabled = true;
            }
            else if (obj[CHANGE_MODE_KEY].mode === "manual-suntimes") {
                automaticSuntimesRadio.checked = false;
                manualSuntimesRadio.checked = true;
                sysThemeRadio.checked = false;
                sunriseInput.disabled = false;
                sunsetInput.disabled = false;
            }
            else if (obj[CHANGE_MODE_KEY].mode === "system-theme") {
                automaticSuntimesRadio.checked = false;
                manualSuntimesRadio.checked = false;
                sysThemeRadio.checked = true;
                sunriseInput.disabled = true;
                sunsetInput.disabled = true;
            }
        }, onError);
}

browser.storage.local.get(CHECK_TIME_STARTUP_ONLY_KEY)
    .then((obj) => {
        checkStartupBox.checked = obj[CHECK_TIME_STARTUP_ONLY_KEY].check;
    }, onError);

browser.storage.local.get(DEBUG_MODE_KEY)
    .then((obj) => {
        debugModeBox.checked = obj[DEBUG_MODE_KEY].check;
        DEBUG_MODE = obj[DEBUG_MODE_KEY].check;
    }, onError);

browser.storage.local.get([SUNRISE_TIME_KEY, SUNSET_TIME_KEY])
    .then((obj) => {
        sunriseInput.value = obj[SUNRISE_TIME_KEY].time;
        sunsetInput.value = obj[SUNSET_TIME_KEY].time;
    }, onError);

automaticSuntimesRadio.addEventListener("input", function(event) {
    if (automaticSuntimesRadio.checked) {

        // Prompt for and set the user's geolocation in storage.
        return setGeolocation()
            .then(() => {
                    // Calculate sunrise/sunset times based on location.
                    calculateSuntimes().then((suntimes) => {
                        changeLogo();

                        // Make changes to settings based on calculation results.
                        browser.storage.local.set({[CHANGE_MODE_KEY]: {mode: "location-suntimes"}});
                        sunriseInput.disabled = true;
                        sunsetInput.disabled = true;

                        sunriseInput.value = convertDateToString(suntimes.nextSunrise);
                        sunsetInput.value = convertDateToString(suntimes.nextSunset);
                        sunriseInput.dispatchEvent(sunriseInputEvent);
                        sunsetInput.dispatchEvent(sunsetInputEvent);
                    });
                }, (error) => {
                    onError(error);
                    locationWarning.style.display = "inline";
                    getChangeMode(); // In error, change radio buttons (and settings) back to the way they were, based on storage.
                    changeThemeBasedOnChangeMode("location-theme");
                });
    }
});

manualSuntimesRadio.addEventListener("input", function(event) {
    if (manualSuntimesRadio.checked) {
        browser.storage.local.set({[CHANGE_MODE_KEY]: {mode: "manual-suntimes"}});
        sunriseInput.disabled = false;
        sunsetInput.disabled = false;
        changeThemeBasedOnChangeMode("manual-suntimes").then(changeLogo);
    }
});

sysThemeRadio.addEventListener("input", function(event) {
    if (sysThemeRadio.checked) {
        // browser.browserSettings.overrideContentColorScheme changes the following
        // about:config to "2", effectively applying a light/dark theme based on the device theme
        // and allowing the prefers-color-scheme media query to be used to detect the device theme.
        // The about:config setting is: layout.css.prefers-color-scheme.content-override
        browser.browserSettings.overrideContentColorScheme.set({value: "system"});

        browser.storage.local.set({[CHANGE_MODE_KEY]: {mode: "system-theme"}});
        sunriseInput.disabled = true;
        sunsetInput.disabled = true;
        changeThemeBasedOnChangeMode("system-theme").then(changeLogo);
    }
});

// Enable/disable the check on startup-only flag.
checkStartupBox.addEventListener("input", function(event) {
    if (checkStartupBox.checked) {
        browser.storage.local.set({[CHECK_TIME_STARTUP_ONLY_KEY]: {check: true}});
        Promise.all([
                browser.alarms.clear(NEXT_SUNRISE_ALARM_NAME),
                browser.alarms.clear(NEXT_SUNSET_ALARM_NAME)
            ])
            .then(() => {
                logAllAlarms();
            }, onError);
        startupOnlyMessage.style.display = "inline";
    }
    else {
        browser.storage.local.set({[CHECK_TIME_STARTUP_ONLY_KEY]: {check: false}});
        createAlarm(SUNRISE_TIME_KEY, NEXT_SUNRISE_ALARM_NAME, 60 * 24);
        createAlarm(SUNSET_TIME_KEY, NEXT_SUNSET_ALARM_NAME, 60 * 24);
        startupOnlyMessage.style.display = "none";
    }
});

// Enable/disable the check on debug mode flag.
debugModeBox.addEventListener("input", function(event) {
    DEBUG_MODE = debugModeBox.checked;
    browser.storage.local.set({[DEBUG_MODE_KEY]: {check: debugModeBox.checked}})
        .then(() => {
            console.log("automaticDark DEBUG_MODE has been set to: " + DEBUG_MODE);
        }, onError);
});

// If the sunrise time input is changed,
// change the sunrise time and check if the current theme should be changed.
// Also create an alarm if the 'check startup only' flag is disabled.
sunriseInput.addEventListener("input", function(event) {
    browser.storage.local.set({[SUNRISE_TIME_KEY]: {time: sunriseInput.value}})
        .then(() => {
            checkTime().then(changeLogo);
            return browser.storage.local.get(CHECK_TIME_STARTUP_ONLY_KEY)
        }, onError)
        .then((obj) => {
            if (!obj[CHECK_TIME_STARTUP_ONLY_KEY].check) {
                return createAlarm(SUNRISE_TIME_KEY, NEXT_SUNRISE_ALARM_NAME, 60 * 24);
            }
        });
});

// If the sunset time input is changed,
// change the sunset time and check if the current theme should be changed.
sunsetInput.addEventListener("input", function(event) {
    browser.storage.local.set({[SUNSET_TIME_KEY]: {time: sunsetInput.value}})
        .then(() => {
            checkTime().then(changeLogo);
            return browser.storage.local.get(CHECK_TIME_STARTUP_ONLY_KEY);
        }, onError)
        .then((obj) => {
            if (!obj[CHECK_TIME_STARTUP_ONLY_KEY].check) {
                return createAlarm(SUNSET_TIME_KEY, NEXT_SUNSET_ALARM_NAME, 60 * 24);
            }
        });
});

// If the dropdown for daytime themes is changed,
// set the daytime theme and check if the current theme should be changed.
daytimeThemeList.addEventListener('change', function(event) {
    browser.storage.local.set({[DAYTIME_THEME_KEY]: {themeId: this.value}})
        .then(() => {
            return browser.storage.local.get([CHECK_TIME_STARTUP_ONLY_KEY, CHANGE_MODE_KEY]);
        }, onError)
        .then((obj) => {
            changeThemeBasedOnChangeMode(obj[CHANGE_MODE_KEY].mode);
        }, onError);
    }
);

// If the dropdown for nighttime themes is changed,
// set the nighttime theme and check if the current theme should be changed.
nighttimeThemeList.addEventListener('change', function(event) {
    browser.storage.local.set({[NIGHTTIME_THEME_KEY]: {themeId: this.value}})
        .then(() => {
            return browser.storage.local.get([CHECK_TIME_STARTUP_ONLY_KEY, CHANGE_MODE_KEY]);
        }, onError)
        .then((obj) => {
            changeThemeBasedOnChangeMode(obj[CHANGE_MODE_KEY].mode);
        }, onError);
    }
);

// Reset all settings to their default.
// Note that the "default" themes may change
// depending on the user's current theme and their 
// installed themes.
resetDefaultBtn.addEventListener("click", 
    function(event) {
        if (window.confirm("Are you sure you want to reset to default settings?")) {
            Promise.all([
                    browser.storage.local.clear(),
                    browser.alarms.clearAll()
                ])
                .then(() => {
                    automaticSuntimesRadio.checked = false;
                    manualSuntimesRadio.checked = true;
                    sysThemeRadio.checked = false;
                    sunriseInput.disabled = false;
                    sunsetInput.disabled = false;

                    checkStartupBox.checked = DEFAULT_CHECK_TIME_STARTUP_ONLY;
                    debugModeBox.checked = DEFAULT_DEBUG_MODE;
                    sunriseInput.value = DEFAULT_SUNRISE_TIME;
                    sunsetInput.value = DEFAULT_SUNSET_TIME;

                    return setDefaultThemes();

                }, onError)
                .then(() => {
                    daytimeThemeList.value = DEFAULT_DAYTIME_THEME;
                    nighttimeThemeList.value = DEFAULT_NIGHTTIME_THEME;
                    resetMessage.style.display = "inline";

                    return init();
                }, onError)
                .then(changeLogo);
        }
    }
);


