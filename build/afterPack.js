// electron-builder afterPack hook: stamp our icon onto the unpacked exe.
// (signAndEditExecutable is off because winCodeSign can't be extracted on this
// machine, so the builder never touches the exe icon itself.)
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

exports.default = async function (context) {
  if (context.electronPlatformName !== 'win32') return;
  // Trim unused Chrome locales (keep en-US + fa) to slim the installer.
  try {
    const localesDir = path.join(context.appOutDir, 'locales');
    for (const f of fs.readdirSync(localesDir)) {
      if (f !== 'en-US.pak' && f !== 'fa.pak') fs.rmSync(path.join(localesDir, f), { force: true });
    }
  } catch {}
  const exe = path.join(context.appOutDir, context.packager.appInfo.productFilename + '.exe');
  const icon = path.join(context.packager.projectDir, 'public', 'icon.ico');
  const rcedit = path.join(context.packager.projectDir, 'build', 'tools', 'rcedit-x64.exe');
  execFileSync(rcedit, [exe, '--set-icon', icon], { stdio: 'inherit' });
};
