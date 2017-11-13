// Code based on WebExtension example located here: 
// https://github.com/mdn/webextensions-examples/tree/master/dynamic-theme

var currentTheme = '';

const themes = {
  'day': {
    colors: {
      accentcolor: '#CF723F',
      textcolor: '#111',
    }
  },
  'night': {
    images: {
      headerURL: 'moon.jpg',
    },
    colors: {
      accentcolor: '#000',
      textcolor: '#4FC',
    }
  },
  'default': {
  },
  'black': {
    images: {
      headerURL: 'black.png',
    },
    colors: {
      accentcolor: '#000',
      textcolor: '#FFF',
      toolbar: "#323234",
    }
  },
  'light': {
    images: {
      headerURL: 'e3e4e6.png',
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
  console.log("Setting theme to " + theme);
  console.log(themes[theme]);
  currentTheme = theme;
  browser.theme.update(themes[theme]);
}

// Check the current system time and set the theme based on the time.
function checkTime() {
  let date = new Date();
  let hours = date.getHours();
  // Will set the sun theme between 8am and 8pm.
  if ((hours > 8) && (hours < 20)) {
    setTheme('default');
  } else {
    //setTheme('black');
  }
}

// Only available in Firefox 58+.
/*
async function getCurrentThemeInfo() {
  let themeInfo = await browser.theme.getCurrent();
  console.log(themeInfo);
}

getCurrentThemeInfo();
*/

// On start up, check the time to see what theme to show.
checkTime();

// Set up an alarm to check this regularly.
browser.alarms.onAlarm.addListener(checkTime);
browser.alarms.create('checkTime', {periodInMinutes: 5});

// Manually set a theme. Overrides everything else.
setTheme('light');