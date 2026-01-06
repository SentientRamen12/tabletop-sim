# tabletop-sim

Repo to simulate tabletop games

## Lodu

A card-based board game inspired by Ashte Kashte. Race your pieces to the center using cards instead of dice.

### Dev Setup

```bash
cd ludo_plus
npm install
npm run dev
```

### Build

```bash
npm run build          # Build for preview
npm run package        # Package for current platform
npm run package:mac    # Build macOS .dmg
npm run package:win    # Build Windows .exe
npm run package:linux  # Build Linux .deb / AppImage
```

Output goes to `ludo_plus/release/`.
