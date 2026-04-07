import { spawn } from "node:child_process";
import { AppError } from "@/lib/errors";

const DEFAULT_FRAME_COUNT = 8;

function runProcess(
  command: string,
  args: string[],
  collectStdout = false,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args);
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    if (collectStdout) {
      proc.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    }
    proc.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

    proc.on("close", (code) => {
      if (code !== 0) {
        const stderr = Buffer.concat(stderrChunks).toString("utf8");
        return reject(new Error(`${command} exited with code ${code}: ${stderr.slice(0, 300)}`));
      }
      resolve(collectStdout ? Buffer.concat(stdoutChunks) : Buffer.alloc(0));
    });

    proc.on("error", (err) => {
      reject(new Error(`Failed to spawn ${command}: ${err.message}`));
    });
  });
}

async function getVideoDurationSeconds(videoPath: string): Promise<number> {
  const output = await runProcess(
    "ffprobe",
    ["-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", videoPath],
    true,
  );
  const duration = parseFloat(output.toString("utf8").trim());
  return isNaN(duration) ? 0 : duration;
}

async function extractFrameAtTimestamp(
  videoPath: string,
  timestamp: number,
): Promise<Buffer> {
  return runProcess(
    "ffmpeg",
    [
      "-ss", String(timestamp.toFixed(3)),
      "-i", videoPath,
      "-frames:v", "1",
      "-vf", "scale=640:-1",
      "-f", "image2pipe",
      "-vcodec", "mjpeg",
      "pipe:1",
    ],
    true,
  );
}

/**
 * 从本地视频文件提取均匀分布的帧，返回 base64 JPEG 数据 URI 数组。
 * 要求服务器已安装 ffmpeg 和 ffprobe。
 */
export async function extractVideoFramesAsBase64(
  videoPath: string,
  frameCount = DEFAULT_FRAME_COUNT,
): Promise<string[]> {
  let duration: number;
  try {
    duration = await getVideoDurationSeconds(videoPath);
  } catch {
    throw new AppError("VIDEO_FRAME_EXTRACT_FAILED", "无法读取视频时长，请确认服务器已安装 ffprobe", 502);
  }

  if (duration <= 0) {
    throw new AppError("VIDEO_FRAME_EXTRACT_FAILED", "无法获取视频时长", 502);
  }

  const interval = duration / (frameCount + 1);
  const frames: string[] = [];

  for (let i = 1; i <= frameCount; i++) {
    const timestamp = interval * i;
    let buffer: Buffer;
    try {
      buffer = await extractFrameAtTimestamp(videoPath, timestamp);
    } catch {
      throw new AppError("VIDEO_FRAME_EXTRACT_FAILED", "视频帧提取失败，请确认服务器已安装 ffmpeg", 502);
    }
    frames.push(`data:image/jpeg;base64,${buffer.toString("base64")}`);
  }

  return frames;
}
