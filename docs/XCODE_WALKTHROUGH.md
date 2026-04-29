# RecipeSage iOS - Xcode Setup Walkthrough

**Prerequisites:** You've already run `npx cap open ios` and Xcode is launching.

---

## Step 1: Initial Xcode Window

When Xcode opens, you'll see the project navigator on the left and the main editor area. Here's what to expect:

### Project Structure (Left Sidebar)

```
📁 App (top level)
  ├── 📁 App (the main app target)
  │     ├── AppDelegate.swift
  │     ├── Info.plist
  │     ├── Assets.xcassets
  │     └── ...
  ├── 📁 RecipeSageShare (the share extension)
  │     ├── ShareViewController.swift
  │     └── Info.plist
  └── 📁 Pods (CocoaPods dependencies)
```

---

## Step 2: Configure App Groups (CRITICAL!)

This is the most important step. The Share Extension and main app need to share data via App Groups.

### 2a. Select the Main App Target

1. Click on **"App"** at the very top of the project navigator (the blue icon)
2. In the main area, you'll see tabs: **General**, **Signing & Capabilities**, **Build Settings**, etc.
3. Click **"Signing & Capabilities"**

### 2b. Add App Groups to Main App

1. Click the **"+ Capability"** button (bottom left)
2. Type "App Groups" in the search box
3. Double-click **"App Groups"** to add it
4. You'll see a new "App Groups" section appear
5. Click the **"+"** button under App Groups
6. Enter: `group.com.recipesage.app.shared`
7. Click **"OK"**

**You should see:**

```
☑️ group.com.recipesage.app.shared
```

### 2c. Add App Groups to Share Extension

1. At the top of the screen, there's a dropdown that says **"App"**
2. Click it and select **"RecipeSageShare"**
3. Click **"+ Capability"** again
4. Add **"App Groups"** capability
5. Click the **"+"** button
6. Select the SAME group: `group.com.recipesage.app.shared`
7. Click **"OK"**

**Both targets must have the same App Group!**

---

## Step 3: Configure Signing

### 3a. Select Your Team

1. Make sure you're on the **"RecipeSageShare"** target (from dropdown)
2. Under "Signing" section:
   - Check **"Automatically manage signing"**
   - Click **"Team"** dropdown
   - Select your Apple ID / Team (should show "6A27LJB29X")

3. Switch to **"App"** target (from dropdown)
4. Do the same:
   - Check **"Automatically manage signing"**
   - Select your team

### 3b. Verify Bundle Identifiers

**App target:**

- Bundle Identifier: `com.recipesage.app`

**RecipeSageShare target:**

- Bundle Identifier: `com.recipesage.app.share`

These should already be set correctly from the files we created.

---

## Step 4: Select a Device

1. At the top of Xcode window, there's a device selector
2. It probably shows **"Any iOS Device (arm64)"** or "iPhone 15 Pro"
3. Click it and select:
   - **Your connected iPhone** (if plugged in), OR
   - **iPhone 15 Pro** (simulator)

**Note:** Share Extension testing works best on a real device, but you can test the basic app on a simulator.

---

## Step 5: Build and Run

### First Build

1. Press **Cmd+R** (or click the ▶️ play button)
2. Xcode will:
   - Compile the Swift code
   - Build the web assets
   - Package everything
   - Install on your device/simulator
   - Launch the app

### Expected First Build Time

- 2-5 minutes (downloads dependencies, builds everything)
- Subsequent builds: 10-30 seconds

---

## Step 6: Test the App

### Basic App Test

1. The app should open to the RecipeSage login screen
2. Log in with your existing account
3. Browse recipes - everything should work like the web app

### Test the Share Extension (Requires Real Device)

**From Safari:**

1. Open Safari on your iPhone
2. Go to any recipe website (e.g., allrecipes.com)
3. Tap the **Share button** (square with arrow)
4. Scroll through the app icons
5. You should see **"RecipeSage"** in the list!
6. Tap it
7. The RecipeSage app should open
8. You should see the import dialog with the URL pre-filled

**From Instagram:**

1. Open Instagram
2. Find a recipe post
3. Tap the three dots (⋯) → Share → More
4. Look for "RecipeSage"
5. Tap it
6. App opens with import dialog

---

## Step 7: Troubleshooting

### "App Groups not enabled" Error

**Fix:** You missed Step 2. Both targets need the App Group capability.

### "Signing certificate not found"

**Fix:**

- Make sure you're signed into Xcode with your Apple ID
- Xcode → Preferences → Accounts → Sign in
- May need free Apple Developer account

### "Build failed: Capacitor not found"

**Fix:**

```bash
cd packages/frontend
npx cap sync ios
```

Then rebuild in Xcode.

### "Share extension not appearing"

**Fix:**

- Make sure you're testing on a real device (not simulator)
- The app must be installed first
- Try restarting the device

### "App opens but URL not passed"

**Fix:** Check App Groups are configured identically on both targets.

---

## Step 8: Build for Distribution (Optional)

When you're ready to distribute:

### Archive the App

1. Select **"Any iOS Device (arm64)"** as the target
2. Go to **Product → Archive**
3. Wait for build to complete
4. Organizer window opens automatically

### Upload to TestFlight

1. In Organizer, select your archive
2. Click **"Distribute App"**
3. Select **"App Store Connect"** → **"Upload"**
4. Follow prompts (takes 10-20 minutes)
5. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
6. Add the build to TestFlight
7. Invite testers

---

## Quick Reference: Key Files

| File                      | Purpose               | Location in Xcode                           |
| ------------------------- | --------------------- | ------------------------------------------- |
| AppDelegate.swift         | Handles deep links    | App → AppDelegate.swift                     |
| Info.plist                | URL schemes           | App → Info.plist                            |
| ShareViewController.swift | Share extension logic | RecipeSageShare → ShareViewController.swift |
| capacitor.config.json     | Web app config        | App → capacitor.config.json                 |

---

## Success Checklist

- [ ] App Groups added to both targets
- [ ] Same App Group ID on both: `group.com.recipesage.app.shared`
- [ ] Signing configured with your team
- [ ] App builds without errors (Cmd+R)
- [ ] App launches and shows RecipeSage
- [ ] Share from Safari shows "RecipeSage" option
- [ ] Tapping it opens RecipeSage with import dialog

---

## Need Help?

If you get stuck:

1. Check the build log (Cmd+9 to show)
2. Look for red error messages
3. Common issues are usually signing or App Groups related
4. Clean build folder: Cmd+Shift+K, then rebuild

**You're ready to build!** 🚀
