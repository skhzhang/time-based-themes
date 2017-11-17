const KEY_PREFIX = 'tbthemesinfo';

var currentTheme = '';
const currentThemeKey = KEY_PREFIX + currentTheme;
const checkTimeIntervalKey = KEY_PREFIX + "checkTimeInterval";
const sunriseTimeKey = KEY_PREFIX + "sunriseTime";
const sunsetTimeKey = KEY_PREFIX + "sunsetTime";

// Set interval to 5 if it has never been set before,
// such as on first-time startup.
if (!localStorage.hasOwnProperty(checkTimeIntervalKey)) {
  localStorage[checkTimeIntervalKey] = 5;
}
if (!localStorage.hasOwnProperty(sunriseTimeKey)) {
  localStorage[sunriseTimeKey] = '08:00';
}
if (!localStorage.hasOwnProperty(sunsetTimeKey)) {
  localStorage[sunsetTimeKey] = "20:00";
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

// Set the theme.
function setTheme(theme) {
  if (currentTheme === theme) {
    // No point in changing the theme if it has already been set.
    return;
  }

  console.log("Set theme to " + theme);
  console.log(themes[theme]);

  currentTheme = theme;
  browser.theme.update(themes[theme]);
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

  let sunriseHours = localStorage[sunriseTimeKey].split(":")[0];
  let sunriseMins = localStorage[sunriseTimeKey].split(":")[1];
  let sunsetHours = localStorage[sunsetTimeKey].split(":")[0];
  let sunsetMins = localStorage[sunsetTimeKey].split(":")[1];

  // Will set the sun theme between sunrise and sunset.
  if (timeInBetween(hours, minutes, sunriseHours, sunriseMins, sunsetHours, sunsetMins)) {
    setTheme('light');
  } else {
    setTheme('dark');
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
  var curTimeInMins = curHours * 60 + parseInt(curMins);
  var sunriseInMins = sunriseHours * 60 + parseInt(sunriseMins);
  var sunsetInMins = sunsetHours * 60 + parseInt(sunsetMins);
  var difference = sunsetInMins - sunriseInMins;

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