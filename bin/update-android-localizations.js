#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { XMLParser, XMLBuilder } = require("fast-xml-parser");

// 添加语言映射配置
const LANGUAGE_MAPPINGS = {
  // 简体中文
  "zh-Hans": ["zh-rCN"],
  // 繁体中文
  "zh-Hant": ["zh-rHK", "zh-rTW", "zh-rMO"],
};

function parseExistingStrings(xmlPath) {
  if (!fs.existsSync(xmlPath)) {
    return {};
  }

  try {
    const xmlContent = fs.readFileSync(xmlPath, "utf8");
    const parser = new XMLParser({
      ignoreAttributes: false,
      parseAttributeValue: true,
    });
    const result = parser.parse(xmlContent);

    // 提取现有的字符串资源
    const strings = {};
    if (result.resources && result.resources.string) {
      const stringResources = Array.isArray(result.resources.string)
        ? result.resources.string
        : [result.resources.string];

      stringResources.forEach((item) => {
        if (item["@_name"]) {
          strings[item["@_name"]] = item["#text"];
        }
      });
    }
    return strings;
  } catch (error) {
    console.warn(
      `Warning: Could not parse existing strings.xml at ${xmlPath}:`,
      error
    );
    return {};
  }
}

function escapeXmlValue(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// 获取 Android 平台的语言目录名
function getAndroidLanguageFolders(locale) {
  // 如果是中文配置，返回映射的语言列表
  if (LANGUAGE_MAPPINGS[locale]) {
    return LANGUAGE_MAPPINGS[locale].map((lang) => `values-${lang}`);
  }

  // 对于英语，使用默认的 values 目录
  if (locale === "en") {
    return ["values"];
  }

  // 其他语言直接使用原始locale
  return [`values-${locale}`];
}

async function updateAndroidLocalizations() {
  const projectRoot = process.cwd();
  const localizationsDir = path.join(projectRoot, "localizations");
  const androidResDir = path.join(
    projectRoot,
    "android",
    "app",
    "src",
    "main",
    "res"
  );

  // 检查必要的目录
  if (!fs.existsSync(localizationsDir)) {
    console.log(
      "Localizations directory not found, skipping Android localization update."
    );
    return;
  }

  if (!fs.existsSync(androidResDir)) {
    console.log(
      'Android resources directory not found. Make sure you have run "npx cap add android" first.'
    );
    return;
  }

  // 读取并处理所有本地化文件
  const files = fs.readdirSync(localizationsDir);
  files.forEach((file) => {
    if (file.endsWith(".json")) {
      const locale = path.basename(file, ".json");
      const configPath = path.join(localizationsDir, file);

      try {
        const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
        const androidConfig = config.android;

        if (!androidConfig) {
          console.log(`No Android configuration found in ${file}, skipping...`);
          return;
        }

        // 获取该语言对应的所有 Android 资源目录
        const folderNames = getAndroidLanguageFolders(locale);

        // 为每个目标语言创建资源文件
        folderNames.forEach((folderName) => {
          const targetDir = path.join(androidResDir, folderName);

          if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
          }

          const stringsXmlPath = path.join(targetDir, "strings.xml");

          // 读取现有的字符串资源
          const existingStrings = parseExistingStrings(stringsXmlPath);

          // 合并新的配置
          const mergedStrings = {
            ...existingStrings,
            ...Object.fromEntries(
              Object.entries(androidConfig).map(([key, value]) => [
                key,
                escapeXmlValue(value),
              ])
            ),
          };

          // 生成新的 XML 内容
          const xmlObj = {
            resources: {
              string: Object.entries(mergedStrings).map(([key, value]) => ({
                "@_name": key,
                "#text": value,
              })),
            },
          };

          const builder = new XMLBuilder({
            format: true,
            indentBy: "    ",
            ignoreAttributes: false,
          });

          const xmlContent = builder.build(xmlObj);

          // 写入文件
          fs.writeFileSync(stringsXmlPath, xmlContent, "utf8");
          console.log(
            `Updated ${stringsXmlPath} (merged ${
              Object.keys(androidConfig).length
            } strings)`
          );
        });
      } catch (error) {
        console.error(`Error processing ${file}:`, error);
      }
    }
  });
}

// 如果直接运行此文件则执行更新
if (require.main === module) {
  updateAndroidLocalizations();
}

// 导出函数
module.exports = {
  updateAndroidLocalizations,
};
