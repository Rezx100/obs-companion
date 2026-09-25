# Setup and recording walkthrough

Install the unsigned 64-bit preview using the supplied installer. It installs to the current user's Programs folder and creates Start-menu/Desktop shortcuts. Uninstall removes application files and shortcuts; it retains projects and protected credentials.

## Dependencies

- Windows 10/11 x64 and Microsoft Edge. No cloud VM.
- OBS Studio with WebSocket 5.x (bundled since OBS 28). Enable server authentication under Tools. Companion accepts only 127.0.0.1.
- FFmpeg and FFprobe executables. Select exact installed executables in Settings. The bundled Playwright FFmpeg helper is only for browser recording; it is not a full editing FFmpeg/FFprobe distribution.
- Space for original MKV, separate source derivatives, review outputs and exports. Start requires 2 GiB free; automatic stop triggers below 256 MiB. This is a floor, not an estimate for a 40-minute session. Check actual recording bitrate and reserve several times the projected master size.

## First recording

1. In Settings, connect OBS with its port/password. Create a Record Myself project.
2. Prepare OBS workspace. Companion creates and selects its own profile/scene collection, remembering the previous selection. It refuses setup during an existing stream or recording.
3. Select the actual camera, microphone and display. Optional desktop audio uses a different track. All other audio inputs are muted in the dedicated collection. Verify the Boya device by name; do not assume its Windows ID is stable.
4. Select Software H.264 for an initial small test, or first choose a supported hardware H.264 recording encoder in the Companion profile's OBS Output → Advanced settings and choose **Use encoder selected in OBS**. Do not select “Use stream encoder,” which can prevent pausing. Encoder availability/quality must be confirmed in OBS, not inferred from CPU model.
5. Configure, inspect both source previews, confirm source resolution in OBS and check the microphone meter. The preview is a fresh OBS snapshot, not a live 30 fps stream. Refresh as needed. Camera format support is still a Windows hardware acceptance check.
6. Record a short clap or other visible/audible sync cue. Pause, resume, then Finish. Do not close OBS while recording.
7. Open Folder, prepare MP4 replay, extract both sources, and inspect duration, quality, timing and routing. No success is shown after an unconfirmed disconnect. If interrupted, reconnect, stop any continuing recording in OBS, then recover the MKV.
8. Restore the previous OBS workspace when finished. Original footage remains local. Review derivatives before deleting anything.

## Website studies

Enter a public URL and optional same-origin paths; choose desktop/mobile and reduced motion. Local/private URLs require explicit approval of that exact origin. The app does not import logged-in browser sessions. Click targets require explicit selectors; forms and likely purchase/account actions are blocked. Some sites require POST APIs or authentication and will report gaps.

Capture runs in isolated Microsoft Edge on Windows. The dedicated evidence video and screenshots are Playwright recordings, not OBS camera capture. Review sessions, coverage and text readability. Initial page entrances are recorded before exploration. The implementation brief links to recorded frames and original-speed video. Browser frame timestamps are approximate relative to video; animation-event metadata is a different, measurable clock.

Select consecutive frames only after reviewing privacy before optional cloud analysis. Captured website text never authorizes native operations. Reinspection starts a new evidence run and preserves old runs.

## Narration and editing

Import a completed video/audio file, or use captured evidence. A word-timed transcript is a JSON array (or `{ "words": [...] }`) with `text`, `start`, `end` in **seconds**, chronological and finite. Imported words can propose cuts across long gaps/isolated fillers. Review the plan; semantic repetition removal and English correction are not automatic.

A narrated study plan is an array of `{ "video": "relative/path.webm", "start": 0, "end": 5, "audio": "relative/audio.mp3", "text": "Caption text" }`. Narration audio must already exist locally. Rendering makes 1920×1080 segments, preserving source aspect ratio and original speed, then holds the last frame if audio is longer. If narration is shorter it trims the demonstration; review this explicitly. Output includes MP4 and segment-level SRT, not phoneme alignment. There is no music.

Voice-only replacement copies the video stream and requires duration within 250 ms. It does not modify mouth movements or prove lip synchronization.

Export projects to a new folder (including a user's sync folder if desired). This is a completed local file copy, not a resumable cloud upload integration. Cancellation leaves a `.partial` folder. Reopen through **Open exported project**; job history is preserved to prevent automatic repeat submissions.
