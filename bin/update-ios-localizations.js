#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const plist = require("plist");
const xcode = require("xcode");

async function updateIOSLocalizations() {
  const projectRoot = process.cwd();
  const localizationsDir = path.join(projectRoot, "localizations");

  // 查找 iOS 工程目录
  const possibleIosPaths = [
    path.join(projectRoot, "ios", "App", "App"),
    path.join(projectRoot, "ios", "App"),
  ];

  let iosResDir = null;
  let xcodeProjectPath = null;
  for (const dir of possibleIosPaths) {
    if (fs.existsSync(path.join(dir, "Info.plist"))) {
      iosResDir = dir;
      xcodeProjectPath = path.join(
        path.dirname(dir),
        "App.xcodeproj",
        "project.pbxproj"
      );
      break;
    }
  }

  if (!iosResDir) {
    console.log(
      "iOS project directory not found. Make sure you have run 'npx cap add ios' first."
    );
    return;
  }

  if (!fs.existsSync(localizationsDir)) {
    console.log(
      "localizations directory not found, skipping iOS localization update."
    );
    return;
  }

  // 读取并解析 Info.plist
  const infoPlistPath = path.join(iosResDir, "Info.plist");
  let infoPlist;
  try {
    const infoPlistContent = fs.readFileSync(infoPlistPath, "utf8");
    infoPlist = plist.parse(infoPlistContent);
  } catch (error) {
    console.error("Error reading Info.plist:", error);
    return;
  }

  // 收集所有需要本地化的语言
  const languages = new Set();
  const files = fs.readdirSync(localizationsDir);

  // 处理每个本地化配置文件
  files.forEach((file) => {
    if (file.endsWith(".json")) {
      const locale = path.basename(file, ".json");
      const configPath = path.join(localizationsDir, file);

      try {
        const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
        const iosConfig = config.ios;

        if (!iosConfig) {
          console.log(`No iOS configuration found in ${file}, skipping...`);
          return;
        }

        languages.add(locale);

        // 创建语言目录
        const lprojDir = path.join(iosResDir, `${locale}.lproj`);
        if (!fs.existsSync(lprojDir)) {
          fs.mkdirSync(lprojDir, { recursive: true });
        }

        // 更新 Info.plist 中的变量值, 更新为 CFBundleDevelopmentRegion 对应语言的 localizations 配置值
        if (locale === infoPlist.CFBundleDevelopmentRegion) {
          Object.keys(iosConfig).forEach((key) => {
            if (infoPlist[key] !== undefined) {
              infoPlist[key] = iosConfig[key];
            }
          });
        }

        // 生成 InfoPlist.strings 内容
        let content = "";
        Object.entries(iosConfig).forEach(([key, value]) => {
          if (infoPlist[key] !== undefined) {
            const escapedValue = value
              .replace(/\\/g, "\\\\")
              .replace(/"/g, '\\"')
              .replace(/\n/g, "\\n");
            content += `${key} = "${escapedValue}";\n`;
          } else {
            console.warn(
              `Warning: Key "${key}" not found in Info.plist, skipping...`
            );
          }
        });

        const stringsPath = path.join(lprojDir, "InfoPlist.strings");
        fs.writeFileSync(stringsPath, content, "utf8");
        console.log(`Updated ${stringsPath}`);
      } catch (error) {
        console.error(`Error processing ${file}:`, error);
      }
    }
  });

  // 更新 Info.plist 中的 CFBundleLocalizations
  if (languages.size > 0) {
    infoPlist.CFBundleLocalizations = Array.from(languages);
    fs.writeFileSync(infoPlistPath, plist.build(infoPlist));
    console.log("Updated Info.plist with variables and localizations");
  }

  // 更新 Xcode 项目配置
  if (fs.existsSync(xcodeProjectPath)) {
    try {
      const proj = xcode.project(xcodeProjectPath);
      proj.parseSync();

      // 获取项目的根对象
      const rootObject = proj.hash.project.rootObject;
      const pbxProject = proj.hash.project.objects.PBXProject[rootObject];

      // 确保有 knownRegions
      if (!pbxProject.knownRegions) {
        pbxProject.knownRegions = ["en", "Base"];
      }

      // 更新已知区域列表
      const updatedRegions = new Set([
        ...pbxProject.knownRegions,
        ...Array.from(languages),
      ]);
      pbxProject.knownRegions = Array.from(updatedRegions);

      // 生成唯一的 UUID
      const generateUniqueId = () => {
        const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        return Array.from(
          { length: 24 },
          () => chars[Math.floor(Math.random() * chars.length)]
        ).join("");
      };

      // 检查是否已存在 InfoPlist.strings 的配置
      let existingVariantGroup = null;
      const groups = proj.hash.project.objects.PBXVariantGroup || {};
      for (const key in groups) {
        if (groups[key].name === "InfoPlist.strings") {
          existingVariantGroup = { uuid: key, group: groups[key] };
          break;
        }
      }

      if (!existingVariantGroup) {
        const mainStringsFileId = generateUniqueId();
        // 创建 PBXBuildFile 引用
        const buildFileId = generateUniqueId(); // Generate a *separate* unique ID for PBXBuildFile
        if (!proj.hash.project.objects.PBXBuildFile) {
          proj.hash.project.objects.PBXBuildFile = {};
        }
        proj.hash.project.objects.PBXBuildFile[buildFileId] = {
          isa: "PBXBuildFile",
          fileRef: mainStringsFileId, // Refers to the PBXFileReference
        };

        // 为每种语言创建 PBXFileReference
        languages.forEach((lang) => {
          const langFileId = generateUniqueId();
          proj.hash.project.objects.PBXFileReference[langFileId] = {
            isa: "PBXFileReference",
            lastKnownFileType: "text.plist.strings",
            name: lang,
            path: `${lang}.lproj/InfoPlist.strings`,
            sourceTree: '"<group>"',
          };
        });

        // 添加到 App 目录的 PBXGroup
        const appGroup =
          proj.hash.project.objects.PBXGroup[pbxProject.mainGroup];
        const appChildren = appGroup.children.find(
          (child) => child.comment === "App" || child.comment === "public"
        );
        if (appChildren) {
          const appGroupObj =
            proj.hash.project.objects.PBXGroup[appChildren.value];
          if (appGroupObj) {
            appGroupObj.children.push({
              value: mainStringsFileId,
              comment: "InfoPlist.strings",
            });
          }
        }

        // 添加到 Resources build phase
        const resourcesBuildPhase =
          proj.hash.project.objects.PBXResourcesBuildPhase;
        const resourcesPhaseKey = Object.keys(resourcesBuildPhase)[0];
        if (!resourcesBuildPhase[resourcesPhaseKey].files) {
          resourcesBuildPhase[resourcesPhaseKey].files = [];
        }
        resourcesBuildPhase[resourcesPhaseKey].files.push({
          value: buildFileId,
          comment: "InfoPlist.strings in Resources",
        });

        // 创建 PBXVariantGroup
        if (!proj.hash.project.objects.PBXVariantGroup) {
          proj.hash.project.objects.PBXVariantGroup = {};
        }
        proj.hash.project.objects.PBXVariantGroup[mainStringsFileId] = {
          isa: "PBXVariantGroup",
          children: [],
          name: "InfoPlist.strings",
          sourceTree: '"<group>"',
        };

        // 为每种语言添加到 variant group
        languages.forEach((lang) => {
          // if (lang !== "en") {
          const langFileIdInFileReference = Object.keys(
            proj.hash.project.objects.PBXFileReference
          ).find((key) => {
            const ref = proj.hash.project.objects.PBXFileReference[key];
            return (
              ref.name === lang &&
              ref.path === `${lang}.lproj/InfoPlist.strings`
            );
          });

          if (langFileIdInFileReference) {
            proj.hash.project.objects.PBXVariantGroup[
              mainStringsFileId
            ].children.push({
              value: langFileIdInFileReference,
              comment: lang,
            });
          }
          // }
        });
      }

      // 保存项目文件
      fs.writeFileSync(xcodeProjectPath, proj.writeSync());
      console.log("Updated Xcode project configuration");
    } catch (error) {
      console.error("Error updating Xcode project:", error);
    }
  }
}

// 如果直接运行此文件则执行更新
if (require.main === module) {
  updateIOSLocalizations();
}

// 导出函数
module.exports = {
  updateIOSLocalizations,
};
