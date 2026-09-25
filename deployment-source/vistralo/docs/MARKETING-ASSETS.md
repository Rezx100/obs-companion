# Marketing asset production

The extraction script prepares real frames from supplied masters. It does not create a Golden Capture, reframe video, upscale video, call Higgsfield or another paid provider, or approve any product claim. A successful extraction is not marketing release approval.

## Required sources

- A continuous 90-second Golden Capture of the approved, shipped redesigned product, with the owned/permitted reference site and real session outputs specified in the handoff. Desktop source: at least 2880 × 1800, 16:10, square pixels, 60 fps. Record at the prescribed ProRes 422 or high-quality H.264 settings. Metadata checks cannot prove sufficient visual fidelity or a clean recording.
- A separately approved, preexisting 9:16 mobile master produced through the authorized Higgsfield reframe workflow, at least 720 × 1280 and 24–60 fps. Its timing must match the desktop master. A reviewed 30-fps reframe is accepted without inventing 60-fps source frames. Obtain a separately approved master if these constraints are unmet; this script never invents a portrait crop or upscales a source.
- An approval receipt for that reframe. This is supplied by the actual reviewer and linked to both master hashes; the script verifies the linkage, not the reviewer's authority or the truth of the approval.
- `ffmpeg` and `ffprobe` available on `PATH`, with the `libaom-av1` and `libwebp` encoders. No npm package downloads or provider credentials are required by the extractor.

Keep recordings and the reviewer receipt outside the repository, outside `marketing/public`, and outside the output directory. Raw capture recordings must never be committed. The script reads masters only, streams their SHA-256 hashes, and verifies those hashes again after encoding. Its public receipt omits source paths and the reviewer's identity.

Create a private reviewer receipt with actual values:

```json
{
  "method": "higgsfield-reframe",
  "captureSha256": "ACTUAL_DESKTOP_MASTER_SHA256",
  "mobileSha256": "ACTUAL_MOBILE_MASTER_SHA256",
  "approvedBy": "ACTUAL_REVIEWER",
  "approvedAt": "ACTUAL_ISO_8601_REVIEW_TIME"
}
```

Do not fill these fields with invented approval. This reframe receipt is separate from product, rights, narration, scene, and release approval in `marketing/story.json`.

## Validate and extract

Run from the application directory. Every supplied filesystem path must be absolute. The output defaults to `marketing/public/story` relative to the application, independent of the current working directory.

```bash
node scripts/extract-marketing-frames.cjs \
  --capture /absolute/private/golden-capture.mov \
  --mobile /absolute/private/approved-mobile.mov \
  --mobile-approval /absolute/private/mobile-approval.json \
  --inspect
```

`--inspect` validates source metadata, hashes, the mobile receipt, frame mapping, and encoder availability without writing assets or invoking an encode. Omit `--inspect` to extract. Optional `--out /absolute/empty-directory` changes the destination. Existing files are never overwritten; a destination must be empty or absent. Symlinks in any input/output path and overlap with either source or the private approval receipt are rejected. The script invokes binaries with `execFileSync` argument arrays and no shell.

The duration tolerance is one 60-fps frame below 90 seconds through 90.5 seconds. Desktop average and nominal rates must be 59.9–60.1 fps; mobile may be 23.9–60.1 fps. Average and nominal rates must agree within 0.1 fps. Mobile and desktop durations must differ by no more than 1/30 second. These metadata checks do not certify constant cadence, synchronized events, absence of dropped frames, or continuous product activity. Review those against the masters.

One ffmpeg process runs at a time with two encoder threads. Desktop output is 1280 × 800; mobile is 720 × 1280. Scaling only reduces source dimensions. No audio is extracted and no generated material is substituted.

## Exact frame map

The script reads `marketing/story.json` and rejects a conflicting range, dimension, or filename contract. Each interval is half-open: sample time is `start + offset × (end − start) / frameCount`. This preserves 180 unique indexes without asking ffmpeg for a nonexistent frame at 90.000 seconds.

| Scene | Output indexes | Source interval | Last sampled timestamp |
| --- | --- | --- | ---: |
| Capture | 0000–0035 | 0 ≤ t < 9 s | 8.750000 s |
| Observe | 0036–0083 | 9 ≤ t < 24 s | 23.687500 s |
| Judgment | Reuse 0068 | Held 19 s | 19.000000 s |
| Brief | 0084–0107 | 55 ≤ t < 63 s | 62.666667 s |
| Build | 0108–0155 | 65 ≤ t < 80 s | 79.687500 s |
| Brand | 0156–0179 | 82 ≤ t < 90 s | 89.666667 s |

The handoff's reference to a held `0060` frame conflicts with its timing. In this linear map, frame 0060 is 16.500 seconds; frame 0068 is exactly 19.000 seconds. The judgment scene must declare `[68, 68]`. The script requires this and never relabels frame 0060 as a 19-second capture. Frame 0060 is still available as an observation poster.

The source frame chosen by ffmpeg is the decoded frame at/after the seek timestamp; the receipt records the requested timestamp. Source cadence and compression may place that frame within one source-frame interval. The held 19-second image still needs a human check that the pricing section is actually present.

## Encodings and byte gates

For each device, extract `stage-d-0000`…`stage-d-0179` or `stage-m-0000`…`stage-m-0179`, each as AVIF and WebP. There are 720 sequence images in total.

- AVIF uses `libaom-av1`, still-picture mode, default CRF 28, CPU-used 6, and YUV 4:2:0. CRF 28 is an approximation for the handoff's quality-55 intent; ffmpeg does not expose a universal equivalent quality-55 setting. Check small text visually. `--avif-crf 0..63` allows an explicit reviewed adjustment, recorded in the receipt.
- WebP uses quality 80, compression level 6, and YUV 4:2:0.
- Each desktop codec sequence must be at most 8,000,000 bytes; each mobile codec sequence at most 4,000,000 bytes. These are decimal MB, checked separately per codec. Both versions are stored, but a visitor normally downloads one.
- The script reports actual bytes and returns exit code 2 if any budget is exceeded. It does not silently lower quality or discard frames. Review the source/encoding and run again into a fresh output directory. WebP quality remains 80.

The approximate handoff targets of 30–45 KB per desktop frame and 20 KB per mobile frame do not guarantee totals for real UI captures. A working extractor is not evidence that the assets meet the budgets. Page transfer size also includes posters, narration, and other assets outside these sequence totals.

## Outputs and review

Representative AVIF/WebP Stage-size posters are copied directly from real sequence frames:

| Poster stem | Source frame |
| --- | ---: |
| `poster-d` / `poster-m` | 0000 |
| `poster-observe-d` / `poster-observe-m` | 0060 |
| `poster-judgment-d` / `poster-judgment-m` | 0068 |
| `poster-brief-d` / `poster-brief-m` | 0107 |
| `poster-build-d` / `poster-build-m` | 0155 |
| `poster-brand-d` / `poster-brand-m` | 0179 |

`extraction-receipt.json` records the master hashes, selected metadata, manifest hash, tool versions, encoder settings, all requested timestamps, every encoded file hash, poster hashes, and per-codec budgets. `README.md` summarizes the result. The script never changes `story.json`, marks a scene approved, creates a ready manifest, or publishes assets. Failed runs retain partial output, an in-progress marker, and an explicit failure notice for diagnosis; use a fresh output directory after resolving the failure.

These Stage-size posters do not replace the handoff's 2× editorial stills. Still required separately: a full brief-page capture, a genuine original/rebuild pair at identical scroll positions, the real 60-second narrated MP4/WebM with VTT and transcript, source text for every caption/callout, and any permitted team screenshots. Do not fabricate these from extracted frames or claim the build poster is a verified compare pair.

Review the real assets for truthful product state, no personal data, permitted reference content, sharp type, correct measurement captions, cursor movement, synchronized mobile framing, and unchanged agent output. Only then update evidence fields and asset paths in `marketing/story.json` through the normal reviewed workflow and run the marketing release gate.

## Validation status

This implementation was syntax-checked and its frame mapping and input rejection were checked locally. No approved Golden Capture or approved mobile master was available during implementation. Real frame extraction, encoder fidelity, final sequence byte budgets, mobile framing, content approval, and asset-backed performance remain unverified.
