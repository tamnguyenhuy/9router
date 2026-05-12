import { NextResponse } from "next/server";
import { exportDb, getSettings, importDb } from "@/lib/localDb";
import { applyOutboundProxyEnv } from "@/lib/network/outboundProxy";
import fs from "fs/promises";
import path from "path";
import os from "os";

function getToolDirs() {
  const home = os.homedir();
  const isWin = os.platform() === "win32";
  const isMac = os.platform() === "darwin";

  const coworkRoot = isMac 
    ? path.join(home, "Library", "Application Support", "Claude-3p")
    : isWin 
      ? path.join(process.env.APPDATA || path.join(home, "AppData", "Roaming"), "Claude-3p")
      : path.join(home, ".config", "Claude-3p");

  const copilotRoot = isMac
    ? path.join(home, "Library", "Application Support", "Code", "User")
    : isWin
      ? path.join(process.env.APPDATA || path.join(home, "AppData", "Roaming"), "Code", "User")
      : path.join(home, ".config", "Code", "User");

  return {
    claude: path.join(home, ".claude"),
    codex: path.join(home, ".codex"),
    opencode: path.join(home, ".opencode"),
    droid: path.join(home, ".factory"),
    openclaw: path.join(home, ".openclaw"),
    hermes: path.join(home, ".hermes"),
    kilo: path.join(home, ".kilo"),
    cline: path.join(home, ".cline", "data"),
    cowork: coworkRoot,
    copilot: copilotRoot,
  };
}

const TOOL_FILES = {
  claude: ["settings.json"],
  codex: ["config.toml", "auth.json"],
  opencode: ["config.json"],
  droid: ["settings.json"],
  openclaw: ["openclaw.json", "models.json"],
  hermes: ["config.yaml", ".env"],
  kilo: ["config.json"],
  cline: ["globalState.json", "secrets.json"],
  copilot: ["chatLanguageModels.json"],
};

export async function GET() {
  try {
    const payload = await exportDb();

    // Export CLI Tools Files
    const cliFiles = {};
    const toolDirs = getToolDirs();
    for (const [tool, dir] of Object.entries(toolDirs)) {
      cliFiles[tool] = {};
      if (tool === "cowork") {
        const configLib = path.join(dir, "configLibrary");
        try {
          const files = await fs.readdir(configLib);
          for (const f of files) {
            const fp = path.join(configLib, f);
            const stat = await fs.stat(fp).catch(() => null);
            if (stat && stat.isFile()) {
              cliFiles[tool][`configLibrary/${f}`] = await fs.readFile(fp, "utf-8");
            }
          }
        } catch (e) {}
        try {
          cliFiles[tool]["config.json"] = await fs.readFile(path.join(dir, "config.json"), "utf-8");
        } catch (e) {}
      } else {
        const filesToBackup = TOOL_FILES[tool] || [];
        for (const file of filesToBackup) {
          try {
            cliFiles[tool][file] = await fs.readFile(path.join(dir, file), "utf-8");
          } catch (e) {}
        }
      }
    }
    payload.cliFiles = cliFiles;

    return NextResponse.json(payload);
  } catch (error) {
    console.log("Error exporting database:", error);
    return NextResponse.json({ error: "Failed to export database" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const payload = await request.json();
    await importDb(payload);

    // Import CLI Tools Files
    if (payload.cliFiles) {
      const toolDirs = getToolDirs();
      for (const [tool, files] of Object.entries(payload.cliFiles)) {
        const dir = toolDirs[tool];
        if (!dir) continue;
        for (const [file, content] of Object.entries(files)) {
          try {
            const fullPath = path.join(dir, file);
            await fs.mkdir(path.dirname(fullPath), { recursive: true });
            await fs.writeFile(fullPath, content, "utf-8");
          } catch (e) {
            console.warn(`Failed to restore CLI file ${file} for tool ${tool}:`, e);
          }
        }
      }
    }

    // Ensure proxy settings take effect immediately after a DB import.
    try {
      const settings = await getSettings();
      applyOutboundProxyEnv(settings);
    } catch (err) {
      console.warn("[Settings][DatabaseImport] Failed to re-apply outbound proxy env:", err);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.log("Error importing database:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to import database" },
      { status: 400 }
    );
  }
}
