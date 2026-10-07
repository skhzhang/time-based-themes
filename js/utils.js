// Helper: Log debug messages.
function logDebug(text) {
    if (DEBUG_MODE) {
        console.log("automaticDark DEBUGGING: " + text);
    }
}

// Helper: Print the error.
function onError(error) {
    console.log("automaticDark Error: " + error);
}

// getCurrent() returns absolute moz-extension: image URLs that update()
// rejects. Embed PNG/JPEG images as data URLs when reapplying the theme
// with a system color scheme (Firefox bug 1618563).
async function sanitizeThemeForUpdate(theme) {
    if (!theme.images) return theme;

    async function convertImage(image) {
        if (typeof image !== "string" || !image.startsWith("moz-extension://")) return image;
        const response = await fetch(image);
        if (!response.ok) throw new Error("Could not read theme image: " + response.status);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.onabort = () => reject(new Error("Theme image read was aborted."));
            reader.readAsDataURL(blob);
        });
    }

    // Ignore legacy/experiment image fields: they are not painted, but their
    // absolute URLs would still fail update() validation.
    const images = {};
    if (theme.images.theme_frame !== undefined) {
        images.theme_frame = await convertImage(theme.images.theme_frame);
    }
    if (theme.images.additional_backgrounds) {
        images.additional_backgrounds = await Promise.all(
            theme.images.additional_backgrounds.map(convertImage));
    }
    return {...theme, images};
}

// Helper: Figure out if a time is in-between two times.
// Return true if it is daytime.
// Return false if it is nighttime.
function timeInBetween(
        curHours, curMins, 
        sunriseHours, sunriseMins, 
        sunsetHours, sunsetMins
    ){
    logDebug("Start timeInBetween");

    let curTimeInMins = curHours * 60 + parseInt(curMins);
    let sunriseInMins = sunriseHours * 60 + parseInt(sunriseMins);
    let sunsetInMins = sunsetHours * 60 + parseInt(sunsetMins);
    let difference = sunsetInMins - sunriseInMins;

    // If the difference is negative, 
    // we know the "sunrise" is on the previous day.
    if (difference < 0) {
        difference += 1440;
        if (sunriseInMins <= curTimeInMins || curTimeInMins < sunsetInMins) {
            // So, we need to do the comparisons a little differently.
            logDebug("timeInBetween determined it is currently daytime (" + curHours + ":" + curMins + ") because sunrise is " + sunriseHours + ":" + sunriseMins + " and sunset is " + sunsetHours + ":" + sunsetMins + ".");
            return true;
        }
    }
    else {
        if (sunriseInMins <= curTimeInMins && curTimeInMins < sunsetInMins) {
            logDebug("timeInBetween determined it is currently daytime.");
            return true;
        }
}
    logDebug("timeInBetween determined it is currently nighttime.");
    return false;
}

function addLeadZero (num){
    logDebug("Start addLeadZero");

    if (num < 10) {
        return "0" + num;
    }
    else {
        return num;
    }
}

// Helper:
// Set each key in storage only if overrideDefault is true or
// that key has never been set before.
function setStorage(obj, overrideDefault = false) {
    logDebug("Start setStorage");

    return Promise.all(Object.keys(obj).map((item) => {
        return browser.storage.local.get(item)
            .then((fetchedItem) => {
                if (overrideDefault || isEmpty(fetchedItem)) {
                    return browser.storage.local.set({[item]: obj[item]})
                        .then(() => {}, onError);
                }
            }, onError);
    }));
}

// Helper: Get all active alarms.
function logAllAlarms() {
    logDebug("Start logAllAlarms");

    return browser.alarms.getAll()
        .then(function(alarms) {
            logDebug("Log all active alarms...");
            if (DEBUG_MODE) {
                console.log(alarms);
            }
        });
}

// Helper: Check if the object is empty.
function isEmpty(obj) {
    for(var key in obj) {
        if(obj.hasOwnProperty(key))
            return false;
    }
    return true;
}

// Take in the time as hours and minutes and
// return the next time it will occur as
// milliseconds since the epoch.
function convertToNextMilliEpoch(hours, minutes) {
    let returnDate = new Date(Date.now());
    returnDate.setHours(hours);
    returnDate.setMinutes(minutes);
    returnDate.setSeconds(0);
    returnDate.setMilliseconds(0);

    // If the specified time has already occurred, 
    // the next time it will occur will be the next day.
    if (returnDate < Date.now()) {
        returnDate.setDate(returnDate.getDate() + 1);
    }
    return returnDate.getTime();
}

// Helper:
// Convert the time from a Date object to a string in the format of HH:MM.
function convertDateToString(date) {
    let hours = date.getHours();
    let minutes = date.getMinutes();
    return addLeadZero(hours) + ":" + addLeadZero(minutes);
}

