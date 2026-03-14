const { withAndroidManifest } = require('expo/config-plugins');

function withWallpaperSetter(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const application = manifest.manifest.application[0];

    // Add SetWallpaperReceiver if not already present
    if (!application.receiver) {
      application.receiver = [];
    }

    const receiverExists = application.receiver.some(
      (r) => r.$?.['android:name'] === 'expo.modules.wallpapersetter.SetWallpaperReceiver'
    );

    if (!receiverExists) {
      application.receiver.push({
        $: {
          'android:name': 'expo.modules.wallpapersetter.SetWallpaperReceiver',
          'android:exported': 'true',
        },
        'intent-filter': [
          {
            action: [
              {
                $: {
                  'android:name': 'com.untodo.SET_WALLPAPER',
                },
              },
            ],
          },
        ],
      });
    }

    return config;
  });
}

module.exports = withWallpaperSetter;
