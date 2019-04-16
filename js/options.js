let checkTimeBtn = document.getElementById("check-time-btn");
let alarmIntervalInput = document.getElementById("alarm-interval");
let checkStartupBox = document.getElementById("check-startup-only");
let sunriseInput = document.getElementById("sunrise-time");
let sunsetInput = document.getElementById("sunset-time");

//let nighttimeExtList = document.getElementById("nighttime-ext-list");

let daytimeThemeList = document.getElementById("daytime-theme-list");
let nighttimeThemeList = document.getElementById("nighttime-theme-list");
let resetDefaultBtn = document.getElementById("reset-default-btn");

// Log everything stored.
browser.storage.local.get(null)
    .then((results) => {
        console.log(results);
    }, onError);


// Iterate through each extension to populate the dropdowns.
browser.management.getAll().then((extensions) => {
    for (let extension of extensions) {
        let extOption = document.createElement('option');
        extOption.textContent = extension.name;
        extOption.value = extension.id;

        // Add each theme as an option in the dropdowns.
        if (extension.type === 'theme') {
            daytimeThemeList.appendChild(extOption);
            nighttimeThemeList.appendChild(extOption.cloneNode(true));
        }
    }

    // Set the default value of the dropdowns.
    browser.storage.local.get(daytimeThemeKey)
        .then((theme) => {
            theme = theme[Object.keys(theme)[0]];

            if (!isEmpty(theme)) {
                daytimeThemeList.value = theme.themeId;
            }
        }, onError);

    browser.storage.local.get(nighttimeThemeKey)
        .then((theme) => {
            theme = theme[Object.keys(theme)[0]];

            if (!isEmpty(theme)) {
                nighttimeThemeList.value = theme.themeId;
            }
        }, onError);

});

// Set the default value of the input 
// to match the one in localStorage.
browser.storage.local.get(checkTimeIntervalKey)
    .then((obj) => {
        alarmIntervalInput.value = parseInt(obj[checkTimeIntervalKey].periodMin);
    }, onError);

browser.storage.local.get(sunriseTimeKey)
    .then((obj) => {
        sunriseInput.value = obj[sunriseTimeKey].time;
    }, onError);

browser.storage.local.get(sunsetTimeKey)
    .then((obj) => {
        sunsetInput.value = obj[sunsetTimeKey].time;
    }, onError);

checkStartupBox.addEventListener("input", function(event) {
    if (checkStartupBox.checked) {
        alarmIntervalInput.disabled = true;
        browser.storage.local.set({[checkTimeStartupOnlyKey]: {check: true}});
        browser.alarms.onAlarm.removeListener(checkTime);
    }
    else {
        alarmIntervalInput.disabled = false;
        browser.storage.local.set({[checkTimeStartupOnlyKey]: {check: false}});
        updateCheckTime(localStorage[checkTimeIntervalKey]);
    }
});

// Manually check the time and change the theme if appropriate.
checkTimeBtn.addEventListener("click", function(event) {
    checkTime();
});

// Change the alarm interval time.
alarmIntervalInput.addEventListener("input", function(event) {
    browser.storage.local.set({[checkTimeIntervalKey]: {periodMin: alarmIntervalInput.value}})
        .then(() => {
            updateCheckTime(alarmIntervalInput.value);
        }, onError);
    // console.log("Changed the alarm interval time to " + alarmIntervalInput.value);
});

// Change the sunrise time.
sunriseInput.addEventListener("input", function(event) {
    browser.storage.local.set({[sunriseTimeKey]: {time: sunriseInput.value}})
        .then(() => {}, onError);
    // console.log("Changed the sunrise time to " + sunriseInput.value);
});

// Change the sunset time.
sunsetInput.addEventListener("input", function(event) {
    browser.storage.local.set({[sunsetTimeKey]: {time: sunsetInput.value}})
        .then(() => {}, onError);
    // console.log("Changed the sunset time to " + sunsetInput.value);
});

// Set the daytime theme.
daytimeThemeList.addEventListener('change', 
    function() {
        browser.storage.local.set({[daytimeThemeKey]: {themeId: this.value}})
            .then(() => {}, onError);
    }
);

// Set the nighttime theme.
nighttimeThemeList.addEventListener('change', 
    function() {
        browser.storage.local.set({[nighttimeThemeKey]: {themeId: this.value}})
            .then(() => {}, onError);
    }
);

// Reset all settings to their default.
// Note that the "default" themes may change
// depending on the user's current theme and their 
// installed themes.
resetDefaultBtn.addEventListener("click", 
    function(event) {
        if (window.confirm("Are you sure you want to reset to default settings?")) {
            browser.storage.local.clear();

            alarmIntervalInput.value = DEFAULT_CHECK_TIME_INTERVAL;
            sunriseInput.value = DEFAULT_SUNRISE_TIME;
            sunsetInput.value = DEFAULT_SUNSET_TIME;
            daytimeThemeList.value = DEFAULT_DAYTIME_THEME;
            nighttimeThemeList.value = DEFAULT_NIGHTTIME_THEME;
            init();
        }
    }
);

