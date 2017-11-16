
var keyPrefix = 'tbthemesinfo';

var currentTheme = '';
var currentThemeKey = keyPrefix + currentTheme;

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
    setTheme('dark');
  }
}