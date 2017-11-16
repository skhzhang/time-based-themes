document.getElementById("apply-changes").addEventListener("click", function( event ) {
    // Set the current theme based on the user selection.

    if (document.getElementById("radio-default").checked) {
        setTheme('default');
    }
    else if (document.getElementById("radio-dark").checked) {
        setTheme('dark');
    }
    else if (document.getElementById("radio-light").checked) {
        setTheme('light');
    }
});