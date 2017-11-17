// Code based on WebExtension example located here: 
// https://github.com/mdn/webextensions-examples/tree/master/dynamic-theme

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
browser.alarms.create('checkTime', {periodInMinutes: parseInt(localStorage[checkTimeIntervalKey])});

// Manually set a theme. Overrides everything else.
//setTheme('light');