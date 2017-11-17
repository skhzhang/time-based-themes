const KEY_PREFIX = 'tbthemesinfo';

const daytimeThemeKey = KEY_PREFIX + "daytimeTheme";
const nighttimeThemeKey = KEY_PREFIX + "nighttimeTheme";
const checkTimeIntervalKey = KEY_PREFIX + "checkTimeInterval";
const sunriseTimeKey = KEY_PREFIX + "sunriseTime";
const sunsetTimeKey = KEY_PREFIX + "sunsetTime";

let DEFAULT_DAYTIME_THEME = "";
let DEFAULT_NIGHTTIME_THEME = "";
const DEFAULT_CHECK_TIME_INTERVAL = 5;
const DEFAULT_SUNRISE_TIME = "08:00";
const DEFAULT_SUNSET_TIME = "20:00";

// var currentTheme = '';

// Set values if they each have never been set before,
// such as on first-time startup.
if (!localStorage.hasOwnProperty(checkTimeIntervalKey)) {
    localStorage[checkTimeIntervalKey] = DEFAULT_CHECK_TIME_INTERVAL;
}
if (!localStorage.hasOwnProperty(sunriseTimeKey)) {
    localStorage[sunriseTimeKey] = DEFAULT_SUNRISE_TIME;
}
if (!localStorage.hasOwnProperty(sunsetTimeKey)) {
    localStorage[sunsetTimeKey] = DEFAULT_SUNSET_TIME;
}

const themes = {
  'day': {
    colors: {
      accentcolor: '#CF723F',
      textcolor: '#111',
    }
  },
  'night': {
    images: {
      headerURL: 'headers/moon.jpg',
    },
    colors: {
      accentcolor: '#000',
      textcolor: '#4FC',
    }
  },
  'default': {
    images: {
      headerURL: '',
    },
  },
  'dark': {
    images: {
      headerURL: '',
    },
    colors: {
      accentcolor: '#000',
      textcolor: '#FFF',
      toolbar: "#323234",
    }
  },
  'light': {
    images: {
      headerURL: '',
    },
    colors: {
      accentcolor: '#e3e4e6',
      textcolor: '#000',
      toolbar: "#f3f4f5",
    }
  }
};

/*
// Set the theme.
function setTheme(theme) {
  if (theme === currentTheme) {
    // No point in changing the theme if it has already been set.
    return;
  }
  else if (theme === "default") {
    resetTheme();
  }
  else {
    console.log("Set theme to " + theme);
    console.log(themes[theme]);

    currentTheme = theme;
    browser.theme.update(themes[theme]);
  }
}
*/

// Enable the theme.
function enableTheme(themeId) {
    browser.management.setEnabled(themeId, true);
    console.log("Enabled theme " + themeId);
}

// Reset all updates made to the user's theme.
function resetTheme() {
    browser.theme.reset();
    console.log("Reset the user's theme to their originally selected theme.");
}

// Check the current system time and set the theme based on the time.
function checkTime() {
    let date = new Date();
    let hours = date.getHours();
    let minutes = date.getMinutes();

    let sunriseSplit = localStorage[sunriseTimeKey].split(":");
    let sunsetSplit = localStorage[sunsetTimeKey].split(":");

    // Will set the sun theme between sunrise and sunset.
    if (timeInBetween(hours, minutes, sunriseSplit[0], sunriseSplit[1], sunsetSplit[0], sunsetSplit[1])) {
        console.log(localStorage[daytimeThemeKey]);
        //setTheme(localStorage[daytimeThemeKey]);
        enableTheme(localStorage[daytimeThemeKey]);
    } else {
        console.log(localStorage[nighttimeThemeKey]);
        //setTheme(localStorage[nighttimeThemeKey]);
        enableTheme(localStorage[nighttimeThemeKey]);
    }
}

// Update the checkTime alarm.
function updateCheckTime(timeInterval) {
    browser.alarms.onAlarm.removeListener(checkTime);
    browser.alarms.onAlarm.addListener(checkTime);
    browser.alarms.create('checkTime', {periodInMinutes: parseInt(localStorage[checkTimeIntervalKey])});
    console.log("Set the alarm interval time to " + localStorage[checkTimeIntervalKey] + " mins.");
}

// Helper function to figure out if a time is in-between two times.
function timeInBetween(
      curHours, curMins, 
      sunriseHours, sunriseMins, 
      sunsetHours, sunsetMins
    ) {
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
            console.log("It is currently daytime.");
            return true;
        }
    }
    else {
        if (sunriseInMins <= curTimeInMins && curTimeInMins < sunsetInMins) {
            console.log("It is currently daytime.");
            return true;
        }
    }

    console.log("It is currently nighttime.");

    return false;
}