var alarmIntervalInput = document.getElementById("alarm-interval");
var sunriseInput = document.getElementById("sunrise-time");
var sunsetInput = document.getElementById("sunset-time");

// Set the value to match the one in localStorage.
alarmIntervalInput.value = parseInt(localStorage[checkTimeIntervalKey]);
sunriseInput.value = localStorage[sunriseTimeKey];
sunsetInput.value = localStorage[sunsetTimeKey];

sunriseInput.addEventListener("input", function(event) {
    // Change the sunrise time.

    localStorage[sunriseTimeKey] = sunriseInput.value;
    console.log("Set the sunrise time to " + sunriseInput.value);
});


sunsetInput.addEventListener("input", function(event) {
    // Change the sunset time.

    localStorage[sunsetTimeKey] = sunsetInput.value;
    console.log("Set the sunset time to " + sunsetInput.value);
});

alarmIntervalInput.addEventListener("input", function(event) {
    // Change the alarm interval time.
    localStorage[checkTimeIntervalKey] = parseInt(alarmIntervalInput.value);

    updateCheckTime(localStorage[checkTimeIntervalKey]);
});

document.getElementById("check-time-btn").addEventListener("click", function(event) {
    checkTime();
});

document.getElementById("radio-default").addEventListener("click", function(event) {
    // Set the current theme to the default theme.
    resetTheme();
});

document.getElementById("radio-dark").addEventListener("click", function(event) {
    // Set the current theme to the dark theme.
    setTheme('dark');
});

document.getElementById("radio-light").addEventListener("click", function(event) {
    // Set the current theme to the light theme.
    setTheme('light');
});

document.getElementById("reset-default-btn").addEventListener("click", function(event) {
    // Reset all settings to their default.
    localStorage[checkTimeIntervalKey] = 5;
    localStorage[sunriseTimeKey] = "08:00";
    localStorage[sunsetTimeKey] = "20:00";
    resetTheme();

    document.getElementById("radio-default").checked = false;
    document.getElementById("radio-dark").checked = false;
    document.getElementById("radio-light").checked = false;

});