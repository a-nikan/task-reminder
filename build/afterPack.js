// electron-builder afterPack hook: stamp our icon onto the unpacked exe.
// (signAndEditExecutable is off because winCodeSign can't be extracted on this
// machine, so the builder never touches the exe icon itself.)
const { execFileSync } = require('child_process');
const path = require('path');

exports.default = async function (context) {
  if (context.electronPlatformName !== 'win32') return;
  const exe = path.join(context.appOutDir, context.packager.appInfo.productFilename + '.exe');
  const icon = path.join(context.packager.projectDir, 'public', 'icon.ico');
  const rcedit = path.join(context.packager.projectDir, 'build', 'tools', 'rcedit-x64.exe');
  execFileSync(rcedit, [exe, '--set-icon', icon], { stdio: 'inherit' });
};
