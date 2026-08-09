# Gurbani Khoj AI for iPhone and iPad

This directory contains the native SwiftUI app. It is being developed alongside the existing
web app; the two projects do not overwrite or depend on one another.

## Current milestone

- Native SwiftUI application shell
- iPhone and iPad support
- Minimum deployment target: iOS 17
- Bundle identifier: `com.harnoorsingh.gurbanikhojai`
- Automatic signing through the Apple Developer team configured in the Xcode project

The Gurbani database, search, favorites, topics, and AI search will be added in later
milestones.

## Open and run

1. Open `GurbaniKhojAI.xcodeproj` in Xcode.
2. If Xcode asks for an iOS platform or simulator runtime, install it from Xcode Settings >
   Components.
3. Select the `GurbaniKhojAI` scheme and an iPhone or iPad simulator.
4. Press the Run button or use Product > Run.
5. For a physical device, connect the device, enable Developer Mode, and confirm the selected
   Team under the target's Signing & Capabilities settings.
