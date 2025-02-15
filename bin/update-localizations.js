#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const {
  updateAndroidLocalizations,
} = require("./update-android-localizations");
const { updateIOSLocalizations } = require("./update-ios-localizations");

function showHelp() {
  console.log(`
Usage: npx app-localization-cli [options]

Options:
  --platform <platform>  Specify platform (ios, android, or both)
  --help               Show this help message
  
Example:
  npx app-localization-cli
  npx app-localization-cli --platform ios
  npx app-localization-cli --platform android
`);
}

async function main() {
  const args = process.argv.slice(2);
  const platformArg = args.indexOf("--platform");
  let platform = "both";

  if (args.includes("--help")) {
    showHelp();
    return;
  }

  if (platformArg !== -1 && args[platformArg + 1]) {
    platform = args[platformArg + 1].toLowerCase();
  }

  const projectRoot = process.cwd();
  const localizationsDir = path.join(projectRoot, "localizations");

  if (!fs.existsSync(localizationsDir)) {
    console.error(
      "Error: localizations directory not found in project root.\n" +
        "Please create a 'localizations' directory with your localization files."
    );
    process.exit(1);
  }

  try {
    if (platform === "both" || platform === "android") {
      await updateAndroidLocalizations();
    }

    if (platform === "both" || platform === "ios") {
      await updateIOSLocalizations();
    }
  } catch (error) {
    console.error("Error updating localizations:", error);
    process.exit(1);
  }
}

// 如果直接运行此文件则执行 main
if (require.main === module) {
  main();
}
