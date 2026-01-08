/**
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as core from "@actions/core";
import * as tc from "@actions/tool-cache";
import { exec } from "@actions/exec";
import * as path from "path";
import * as fs from "fs";

const TOOL_NAME = "firebase-tools";

/**
 * Resolves 'latest' version to actual version number from npm registry
 */
async function resolveVersion(version: string): Promise<string> {
  if (version !== "latest") {
    return version;
  }

  let output = "";
  await exec("npm", ["view", "firebase-tools", "version"], {
    listeners: {
      stdout: (data: Buffer) => {
        output += data.toString();
      },
    },
    silent: true,
  });

  return output.trim();
}

/**
 * Installs firebase-tools to a directory and returns the path
 */
async function installFirebaseTools(
  version: string,
  installDir: string
): Promise<string> {
  // Create the install directory
  fs.mkdirSync(installDir, { recursive: true });

  // Install firebase-tools to the specified directory
  await exec("npm", ["install", `firebase-tools@${version}`], {
    cwd: installDir,
    silent: false,
  });

  // Return the path to the firebase binary
  const binPath = path.join(installDir, "node_modules", ".bin");
  return binPath;
}

/**
 * Gets or installs firebase-tools with caching.
 * Returns the path to the firebase binary directory.
 */
export async function getFirebaseTools(version: string = "latest"): Promise<string> {
  // Resolve 'latest' to actual version for caching
  const resolvedVersion = await resolveVersion(version);
  core.info(`Firebase tools version: ${resolvedVersion}`);

  // Check if already cached
  let toolPath = tc.find(TOOL_NAME, resolvedVersion);

  if (toolPath) {
    core.info(`Found cached firebase-tools@${resolvedVersion}`);
  } else {
    core.info(`Installing firebase-tools@${resolvedVersion}...`);

    // Create a temporary directory for installation
    const tempDir = path.join(
      process.env.RUNNER_TEMP || "/tmp",
      `firebase-tools-${resolvedVersion}-${Date.now()}`
    );

    // Install firebase-tools
    await installFirebaseTools(resolvedVersion, tempDir);

    // Cache the installation
    toolPath = await tc.cacheDir(tempDir, TOOL_NAME, resolvedVersion);
    core.info(`Cached firebase-tools@${resolvedVersion} to ${toolPath}`);
  }

  // Return the path to the bin directory
  const binPath = path.join(toolPath, "node_modules", ".bin");

  // Add to PATH
  core.addPath(binPath);
  core.info(`Added ${binPath} to PATH`);

  return binPath;
}
