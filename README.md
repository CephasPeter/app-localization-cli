# App Localization CLI (ALC)

A simple CLI tool for managing app localizations for iOS and Android projects using Capacitor or Cordova.

## Features

📱 iOS & Android Support  
🔄 Automatic Resource Updates  
🌐 Multiple Language Support  
⚡️ Easy to Use

## Apps use ALC

- [AcuNote](https://yangguang2009.github.io/acunote/): Acupuncture and Meridian points learning app.
- [W3S](https://yangguang2009.github.io/w3s/): Easy frontend tutorials for beginners.
- [Classical Chinese](https://yangguang2009.github.io/classicalchinese): Learn Classical Chinese Easily.
- [Style Rater](https://yangguang2009.github.io/stylerater): Meet Your Better Self!
- [Chinese Meal](https://yangguang2009.github.io/chinesemeal/): Chinese Vegetarian Cuisine Guide.
- Welcome to add your app here...

## Installation & Usage

No installation needed! Just run with npx:

```bash
npx app-localization-cli
```

Or install globally if you prefer:

```bash
npm install -g app-localization-cli
update-localizations
```

## Project Structure

Your project should look like this:

```
your-project/
├── localizations/          # Your localization configs
│   ├── en.json
│   ├── zh-Hans.json
│   └── zh-Hant.json
├── ios/                    # iOS project directory
│   └── App/
│       ├── App/
│       │   ├── Info.plist
│       │   ├── en.lproj/
│       │   ├── zh-Hans.lproj/
│       │   └── zh-Hant.lproj/
│       └── App.xcodeproj/
│           └── project.pbxproj
└── android/               # Android project directory
    └── app/
        └── src/
            └── main/
                └── res/
                    ├── values/
                    │   └── strings.xml
                    ├── values-zh-rCN/
                    │   └── strings.xml
                    └── values-zh-rTW/
                        └── strings.xml
```

## Configuration

### 1. Create Localization Files

Create JSON files in the `localizations` directory for each language:

📄 `localizations/en.json`:

```json
{
  "ios": {
    "CFBundleDisplayName": "My App"
  },
  "android": {
    "title_activity_main": "My App"
  }
}
```

📄 `localizations/zh-Hans.json`:

```json
{
  "ios": {
    "CFBundleDisplayName": "我的应用"
  },
  "android": {
    "title_activity_main": "我的应用"
  }
}
```

### 2. Run the Tool

```bash
# Update both platforms
npx app-localization-cli

# Or update specific platform
npx app-localization-cli --platform ios
npx app-localization-cli --platform android
```

## How It Works

### iOS

1. Creates `.lproj` directories for each language
2. Generates `InfoPlist.strings` files with localized values
3. Updates `Info.plist` to add CFBundleLocalizations and CFBundleDevelopmentRegion localizations values
4. Updates Xcode project configuration to include new languages

Example iOS output:

```
MyApp/
├── en.lproj/
│   └── InfoPlist.strings     # CFBundleDisplayName = "My App";
├── zh-Hans.lproj/
│   └── InfoPlist.strings     # CFBundleDisplayName = "我的应用";
└── Info.plist                # CFBundleDisplayName = "My App";
```

### Android

1. Creates `values-*` directories for each language
2. Generates or updates `strings.xml` files
3. Preserves existing string resources
4. Handles XML escaping automatically

Example Android output:

```
res/
├── values/
│   └── strings.xml          # <string name="title_activity_main">My App</string>
└── values-zh-rCN/
    └── strings.xml          # <string name="title_activity_main">我的应用</string>
```

## Supported Keys

### iOS

| Key                   | Description              |
| --------------------- | ------------------------ |
| `CFBundleDisplayName` | App name shown on device |
| ...                   | Any string resource      |

### Android

| Key                   | Description         |
| --------------------- | ------------------- |
| `title_activity_main` | Application title   |
| ...                   | Any string resource |

## Language Code Mapping

| Language            | iOS Code  | Android Code                                      |
| ------------------- | --------- | ------------------------------------------------- |
| English             | `en`      | `values`                                          |
| Simplified Chinese  | `zh-Hans` | `values-zh-rCN`                                   |
| Traditional Chinese | `zh-Hant` | `values-zh-rTW`, `values-zh-rHK`, `values-zh-rMO` |
| Other Languages     | ...       | ...                                               |

## Troubleshooting

### Common Issues

1. **NSUserTrackingUsageDescription is empty after build**

   Set a default value for `NSUserTrackingUsageDescription` in `Info.plist`.
   Otherwise, it will be empty after build in `CFBundleDevelopmentRegion` language.

2. **Files Not Updated**

   ```bash
   # Check if localizations directory exists
   ls localizations/*.json

   # Verify file permissions
   ls -l ios/App/App
   ls -l android/app/src/main/res
   ```

3. **Wrong Directory Structure**

   ```bash
   # Should be in project root
   npx app-localization-cli --help
   ```

4. **Invalid JSON Format**
   ```bash
   # Validate JSON files
   cat localizations/*.json | jq '.'
   ```

### Debug Mode

```bash
# Run with debug output
DEBUG=true npx app-localization-cli
```

## License

MIT
