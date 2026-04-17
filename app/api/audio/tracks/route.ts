import { promises as fs } from "node:fs";
import path from "node:path";

import { NextResponse } from "next/server";

const AUDIO_DIRECTORY = path.join(process.cwd(), "public", "audio");
const SUPPORTED_AUDIO_EXTENSIONS = new Set([
  ".mp3",
  ".wav",
  ".m4a",
  ".ogg",
  ".aac",
  ".flac",
]);

export const runtime = "nodejs";

function toPublicAudioPath(fileName: string) {
  return `/audio/${encodeURIComponent(fileName)}`;
}

export async function GET() {
  try {
    const entries = await fs.readdir(AUDIO_DIRECTORY, { withFileTypes: true });
    const tracks = entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((fileName) => {
        if (fileName.startsWith(".")) {
          return false;
        }

        return SUPPORTED_AUDIO_EXTENSIONS.has(path.extname(fileName).toLowerCase());
      })
      .sort((left, right) => left.localeCompare(right))
      .map(toPublicAudioPath);

    return NextResponse.json({ tracks });
  } catch {
    return NextResponse.json({ tracks: [] });
  }
}
