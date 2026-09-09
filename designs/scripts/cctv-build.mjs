/* ─────────────────────────────────────────────
 * CCTV 스틸 굽기 — cctv-src/*.png → public/cctv/*.jpg
 *
 * 사용: node scripts/cctv-build.mjs
 *
 * 원본(cctv-src/)은 저장소에 싣지 않는다(designs/.gitignore). 장당 2MB 대 PNG 18장이라
 * 40MB 고, 화면이 무는 것은 굽고 난 JPG 뿐이다. 그래서 **이 스크립트가 원본과 서빙본
 * 사이의 유일한 기록**이다 — 원본을 다시 받으면 여기를 돌려 같은 결과를 낸다.
 *
 * ★ 규격은 역산해서 확정했다(2026-09-09). 기존 public/cctv/*.jpg 18장이 아래 명령의
 *   출력과 **md5 까지 일치**한다. 값을 바꾸면 18장이 통째로 갈리므로 함부로 만지지 않는다.
 *
 *     sips -s format jpeg -s formatOptions 72
 *
 *   크기는 건드리지 않는다 — 원본과 결과가 둘 다 1672×941 이다. 리사이즈를 넣으면
 *   CctvStill 이 잡은 화각이 달라진다.
 *
 * sips 는 macOS 내장이라 별도 설치가 없다. 다른 OS 로 옮기면 같은 품질값을 내는
 * 인코더를 찾아야 한다(같은 숫자를 다른 인코더에 넣으면 결과가 다르다).
 *
 * mp4 두 개(door.mp4 · door2.mp4)는 굽는 대상이 아니다. public/cctv 에 직접 둔다.
 * ───────────────────────────────────────────── */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const SRC = path.resolve("cctv-src");
const OUT = path.resolve("public/cctv");
const QUALITY = "72";

if (!fs.existsSync(SRC)) {
  console.error(`원본이 없다: ${SRC}`);
  console.error("cctv-src/ 는 저장소에 실리지 않는다. 원본을 받아 그 자리에 두고 다시 돌린다.");
  process.exit(1);
}

fs.mkdirSync(OUT, { recursive: true });

const pngs = fs.readdirSync(SRC).filter((f) => f.toLowerCase().endsWith(".png")).sort();
if (pngs.length === 0) {
  console.error(`${SRC} 에 png 가 없다`);
  process.exit(1);
}

let made = 0;
for (const png of pngs) {
  const out = path.join(OUT, `${path.basename(png, path.extname(png))}.jpg`);
  execFileSync("sips", [
    "-s", "format", "jpeg",
    "-s", "formatOptions", QUALITY,
    path.join(SRC, png),
    "--out", out,
  ], { stdio: "ignore" });
  made += 1;
  console.log(`  ${png} → ${path.basename(out)}`);
}

console.log(`\n${made}장 구웠다 → ${OUT}`);
