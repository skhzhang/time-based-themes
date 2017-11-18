let checkTimeBtn = document.getElementById("check-time-btn");
let alarmIntervalInput = document.getElementById("alarm-interval");
let sunriseInput = document.getElementById("sunrise-time");
let sunsetInput = document.getElementById("sunset-time");
let daytimeThemeList = document.getElementById("daytime-theme-list");
let nighttimeThemeList = document.getElementById("nighttime-theme-list");
let resetDefaultBtn = document.getElementById("reset-default-btn");

// Iterate through each theme.
browser.management.getAll().then((extensions) => {
    for (let extension of extensions) {
        if (extension.type === 'theme') {
            let extOption = document.createElement('option');
            extOption.textContent = extension.name;
            extOption.value = extension.id;

            // Add each theme as an option in the dropdowns.
            daytimeThemeList.appendChild(extOption);
            nighttimeThemeList.appendChild(extOption.cloneNode(true));

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
    if (!localStorage.hasOwnProperty(daytimeThemeKey)) {
      localStorage[daytimeThemeKey] = DEFAULT_DAYTIME_THEME;
    }
    if (!localStorage.hasOwnProperty(nighttimeThemeKey)) {
      localStorage[nighttimeThemeKey] = DEFAULT_NIGHTTIME_THEME;
    }

    // Set the value to match the one in localStorage.
    daytimeThemeList.value = localStorage[daytimeThemeKey];
    nighttimeThemeList.value = localStorage[nighttimeThemeKey];
});

// Set the value to match the one in localStorage.
alarmIntervalInput.value = parseInt(localStorage[checkTimeIntervalKey]);
sunriseInput.value = localStorage[sunriseTimeKey];
sunsetInput.value = localStorage[sunsetTimeKey];

// Manually check the time and change the theme if appropriate.
checkTimeBtn.addEventListener("click", function(event) {
    checkTime();
});

// Change the sunrise time.
sunriseInput.addEventListener("input", function(event) {

    localStorage[sunriseTimeKey] = sunriseInput.value;
    // console.log("Set the sunrise time to " + sunriseInput.value);
});

// Change the sunset time.
sunsetInput.addEventListener("input", function(event) {

    localStorage[sunsetTimeKey] = sunsetInput.value;
    // console.log("Set the sunset time to " + sunsetInput.value);
});

// Change the alarm interval time.
alarmIntervalInput.addEventListener("input", function(event) {

    localStorage[checkTimeIntervalKey] = parseInt(alarmIntervalInput.value);
    updateCheckTime(localStorage[checkTimeIntervalKey]);
});

// Set the daytime theme.
daytimeThemeList.addEventListener('change', 
    function() {
        localStorage[daytimeThemeKey] = this.value;
    }
);

// Set the nighttime theme.
nighttimeThemeList.addEventListener('change', 
    function() {
        localStorage[nighttimeThemeKey] = this.value;
    }
);

// Reset all settings to their default.
// Note that the "default" themes may change
// depending on the user's current theme and their 
// installed themes.
resetDefaultBtn.addEventListener("click", 
    function(event) {
        if (window.confirm("Are you sure you want to reset to default settings?")) {
            localStorage[checkTimeIntervalKey] = DEFAULT_CHECK_TIME_INTERVAL;
            localStorage[sunriseTimeKey] = DEFAULT_SUNRISE_TIME;
            localStorage[sunsetTimeKey] = DEFAULT_SUNSET_TIME;
            localStorage[daytimeThemeKey] = DEFAULT_DAYTIME_THEME;
            localStorage[nighttimeThemeKey] = DEFAULT_NIGHTTIME_THEME;

            alarmIntervalInput.value = DEFAULT_CHECK_TIME_INTERVAL;
            sunriseInput.value = DEFAULT_SUNRISE_TIME;
            sunsetInput.value = DEFAULT_SUNSET_TIME;
            daytimeThemeList.value = DEFAULT_DAYTIME_THEME;
            nighttimeThemeList.value = DEFAULT_NIGHTTIME_THEME;
        }
    }
);

