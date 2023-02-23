'use strict';

init();

browser.runtime.onInstalled.addListener(async ({reason, previousVersion}) => {
  if (DEBUG_MODE)
    console.log("automaticDark DEBUG: 0 - Installed - Reason: " + reason + ", Previous Version: " + previousVersion + ".");

  init();
  
  if (reason === 'install') {
    if (DEBUG_MODE)
      console.log("automaticDark DEBUG: 0 - Open the options page.");
    browser.runtime.openOptionsPage();
  }
});