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

function isEmpty(obj) {
    for(var key in obj) {
        if(obj.hasOwnProperty(key))
            return false;
    }
    return true;
}

function setItem(item) {
  console.log("Item set to: " + item);
}

function onError(error) {
  console.log("Error! " + error);
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

    let promise1 = browser.storage.local.get(sunriseTimeKey);
    let promise2 = browser.storage.local.get(sunsetTimeKey);

    Promise.all([promise1, promise2])
        .then((objArr) => {
            let sunriseSplit = "";
            let sunsetSplit = "";

            for (let obj of objArr) {
                if (Object.keys(obj)[0] === sunriseTimeKey) {
                    console.log(obj);
                    sunriseSplit = obj[sunriseTimeKey].time.split(":");
                }
                else if (Object.keys(obj)[0] === sunsetTimeKey) {
                    sunsetSplit = obj[sunsetTimeKey].time.split(":");
                }
            }

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