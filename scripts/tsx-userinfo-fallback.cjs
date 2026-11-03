const os = require('node:os');
const path = require('node:path');

// tsx may start a child Node process for its preflight. Forward this fallback
// to child processes as well, where os.userInfo() can fail on locked Windows.
const fallbackPath = path.resolve(__filename).replace(/\\/g, '/');
if (!process.env.NODE_OPTIONS?.includes(fallbackPath)) {
  const fallbackFlag = `--require="${fallbackPath}"`;
  process.env.NODE_OPTIONS = [process.env.NODE_OPTIONS, fallbackFlag].filter(Boolean).join(' ');
}

const originalUserInfo = os.userInfo.bind(os);
os.userInfo = (...args) => {
  try {
    return originalUserInfo(...args);
  } catch (error) {
    if ((error?.syscall || error?.info?.syscall) !== 'uv_os_get_passwd') throw error;

    return {
      uid: -1,
      gid: -1,
      username: process.env.USERNAME || 'hadirr',
      homedir: process.env.USERPROFILE || os.tmpdir(),
      shell: process.env.ComSpec || ''
    };
  }
};
