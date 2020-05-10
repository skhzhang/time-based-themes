# automaticDark - Time-Based Theme Changer
This is a simple Firefox WebExtension that allows you to automatically switch between your themes based on the current time.

Set Firefox to change the UI to a dark theme during the night and change back to a light theme during the day!

**Try the extension at https://addons.mozilla.org/en-US/firefox/addon/automatic-dark/**

## Features
- Automatically calculate and set sunrise/sunset times based on your location
- - ...or manually set the sunrise and sunset times
- - ...or only change the theme based on the system theme!
- Choose the daytime theme and nighttime theme to switch between

## Notes
- If you have the `privacy.resistFingerprinting` flag in about:config set to `True`, the extension will not be able to detect your timezone ([#5][issue5]). You would need to make an adjustment in your settings to compensate for this.
- Note that Firefox's Default theme may match the default system themes out of the box (for Windows 10, this is as of [63.0](https://www.mozilla.org/en-US/firefox/63.0/releasenotes/)).

## Screenshots
![Options page in version 1.1.0](https://raw.githubusercontent.com/skhzhang/time-based-themes/assets/automaticdark-options-1.1.0-1.png)
![Dark-themed options page in version 1.1.0](https://raw.githubusercontent.com/skhzhang/time-based-themes/assets/automaticdark-options-1.1.0-2.png)
- Screenshot of the Options page in version 1.1.0.

## Feedback / Contributions
Feedback and pull requests welcome! What do you think? Let me know!
- [Add a new issue](https://github.com/skhzhang/time-based-themes/issues/new)
- [Email](mailto:simonkhzhang@gmail.com)

[issue5]: https://github.com/skhzhang/time-based-themes/issues/5
