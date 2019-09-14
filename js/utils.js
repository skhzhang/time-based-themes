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

// Helper:
// Set storage only if overrideDefault is true or
// the managed storage is empty.
function setStorage(obj, overrideDefault = false) {
    //console.log(obj);
    return browser.storage.local.get(Object.keys(obj))
        .then((items) => {
            // Only set storage if a value is not already set,
            // or if it is already empty.
            if (overrideDefault || isEmpty(items)) {
                return browser.storage.local.set(obj)
                    .then(() => { 
                        /*
                        for (let item in obj) {
                            console.log("automaticDark DEBUG: Successfully set " + item); 
                        }
                        */
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