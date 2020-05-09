// Helper: Figure out if a time is in-between two times.
// Return true if it is daytime.
// Return false if it is nighttime.
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
        if (sunriseInMins <= curTimeInMins || curTimeInMins < sunsetInMins) {
            // So, we need to do the comparisons a little differently.
            return true;
        }
    }
    else {
        if (sunriseInMins <= curTimeInMins && curTimeInMins < sunsetInMins) {
            return true;
        }
    }
    return false;
}

function addLeadZero (num){
    if (num < 10) {
        return "0" + num;
    }
    else {
        return num;
    }
}

// Helper:
// Set storage only if overrideDefault is true or
// the managed storage is empty.
function setStorage(obj, overrideDefault = false) {
    for (let item in obj) {
        browser.storage.local.get(item)
            .then((fetchedItem) => {
                if (overrideDefault || isEmpty(fetchedItem)) {
                    return browser.storage.local.set(obj)
                        .then((obj) => {}, onError);
                    }
            }, onError);
    }

    return browser.storage.local.get(Object.keys(obj))
        .then((items) => {
            // Only set storage if a value is not already set,
            // or if it is already empty.
            if (overrideDefault || isEmpty(items)) {
                return browser.storage.local.set(obj)
                    .then((obj) => {
                        console.log(obj);
                    }, onError);
            }
        }, onError);
}

// Helper: Get all active alarms.
function logAllAlarms() {
    return browser.alarms.getAll()
        .then(function(alarms) {
            console.log("automaticDark DEBUG: All active alarms: ");
            console.log(alarms);
        });
}

// Helper: Print the error.
function onError(error) {
    console.log("automaticDark Error: " + error);
}

// Helper: Check if the object is empty.
function isEmpty(obj) {
    for(var key in obj) {
        if(obj.hasOwnProperty(key))
            return false;
    }
    return true;
}

// Helper:
// Convert the time from a Date object to a string in the format of HH:MM.
function convertDateToString(date) {
    let hours = date.getHours();
    let minutes = date.getMinutes();
    return addLeadZero(hours) + ":" + addLeadZero(minutes);
}
