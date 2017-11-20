'use strict';

const KEY_PREFIX = 'tbthemesinfo';

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

// Enable the theme.
function enableTheme(themeId) {
    browser.management.setEnabled(themeId, true);
    // console.log("Enabled theme " + themeId);
}

// Check the current system time and set the theme based on the time.
function checkTime() {
    let date = new Date();
    let hours = date.getHours();
    let minutes = date.getMinutes();

    // logAllAlarms();

    // console.log("Conducting time check now...");

    let sunriseSplit = localStorage.getItem(sunriseTimeKey).split(":");
    let sunsetSplit = localStorage.getItem(sunsetTimeKey).split(":");

    // Will set the sun theme between sunrise and sunset.
    if (timeInBetween(
            hours, minutes, 
            sunriseSplit[0], sunriseSplit[1], 
            sunsetSplit[0], sunsetSplit[1])
        ){
        enableTheme(localStorage.getItem(daytimeThemeKey));
    } else {
        enableTheme(localStorage.getItem(nighttimeThemeKey));
    }
}

// Update the checkTime alarm.
function updateCheckTime(timeInterval) {
    browser.alarms.clear('checkTime');
    browser.alarms.onAlarm.removeListener(checkTime);
    browser.alarms.onAlarm.addListener(checkTime);
    browser.alarms.create('checkTime', 
        {periodInMinutes: parseInt(localStorage[checkTimeIntervalKey])}
    );
    // console.log("Set the alarm interval time to " + localStorage[checkTimeIntervalKey] + " mins.");
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
    getAlarms.then(function() {
        console.log('All active alarms: ');
        for (let alarm of alarms) {
            console.log(alarm.name);
        }
    });
}