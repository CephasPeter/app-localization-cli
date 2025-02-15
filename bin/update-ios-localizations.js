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

        // 更新 Info.plist 中的变量引用
        Object.keys(iosConfig).forEach((key) => {
          if (infoPlist[key] !== undefined) {
            infoPlist[key] = `$(${key})`;
          }
        });

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

  // 更新 Info.plist
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

      // 查找或创建 InfoPlist.strings 的 variant group
      let variantGroup = null;
      const groups = proj.hash.project.objects.PBXVariantGroup || {};

      // 查找现有的 InfoPlist.strings variant group
      for (const key in groups) {
        if (groups[key].name === "InfoPlist.strings") {
          variantGroup = { uuid: key, group: groups[key] };
          break;
        }
      }

      // 如果没有找到，创建新的 variant group
      if (!variantGroup) {
        const groupUuid = proj.generateUuid();
        const newGroup = {
          isa: "PBXVariantGroup",
          name: "InfoPlist.strings",
          sourceTree: "<group>",
          children: [],
        };

        if (!proj.hash.project.objects.PBXVariantGroup) {
          proj.hash.project.objects.PBXVariantGroup = {};
        }
        proj.hash.project.objects.PBXVariantGroup[groupUuid] = newGroup;
        variantGroup = { uuid: groupUuid, group: newGroup };

        // 将 variant group 添加到主组
        const mainGroup =
          proj.hash.project.objects.PBXGroup[pbxProject.mainGroup];
        if (!mainGroup.children) mainGroup.children = [];
        mainGroup.children.push({
          value: groupUuid,
          comment: "InfoPlist.strings",
        });
      }

      // 为每种语言添加本地化文件引用
      languages.forEach((lang) => {
        const fileRef = proj.generateUuid();
        const existingChild = variantGroup.group.children.find(
          (child) => child.comment === `${lang}.lproj/InfoPlist.strings`
        );

        if (!existingChild) {
          variantGroup.group.children.push({
            value: fileRef,
            comment: `${lang}.lproj/InfoPlist.strings`,
          });

          // 添加文件引用
          if (!proj.hash.project.objects.PBXFileReference) {
            proj.hash.project.objects.PBXFileReference = {};
          }

          proj.hash.project.objects.PBXFileReference[fileRef] = {
            isa: "PBXFileReference",
            lastKnownFileType: "text.plist.strings",
            name: "InfoPlist.strings",
            path: `${lang}.lproj/InfoPlist.strings`,
            sourceTree: "<group>",
          };
        }
      });

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
