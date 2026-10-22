// Runner chrome strings. The chrome follows the user's language, not the app's.
// Add a language by adding a table with every key; missing keys fall back to English.

const en = {
  skip: 'Skip to app',
  back: 'Back',
  backTo: 'Back to {page}',
  menu: 'App menu',
  pages: 'Pages in this app',
  opening: 'Opening {app}…',
  openingPercent: 'Opening {app}: {n}%',
  opened: '{app} is open',
  pageOpened: '{page} opened',
  backAt: 'Back at {page}',
  paused: '{app} paused',
  resumed: '{app} resumed',
  closed: '{app} closed',
  openAgain: 'Open again',
  slow: '{page} is taking a long time to load.',
  reloadPage: 'Reload this page',
  retry: 'Try again',
  closeApp: 'Close app',
  problemTitle: 'Something went wrong',
  problemDetails: 'Technical details',
  appError: '{app} reported an error. You can keep using it, or reload the page.',
  notFound: 'There is no app called “{id}” here.',
  netFail: 'The app could not be downloaded. Check your connection and try again.',
  badPackage: 'This app package is damaged or not supported.',
  textSize: 'Text size',
  theme: 'Colours',
  themeSystem: 'Same as device',
  themeLight: 'Light',
  themeDark: 'Dark',
  themeContrast: 'High contrast',
  motion: 'Movement',
  motionSystem: 'Same as device',
  motionReduce: 'Reduce movement',
  permissions: 'Permissions',
  permAsk: '{app} asks for:',
  permAllow: 'Allow selected',
  permNone: 'Allow none',
  permNoReason: 'No reason given',
  permUnavailable: 'Not available on this runner',
  permChange: 'You can change this later in the app menu.',
  about: 'About this app',
  version: 'Version {v}',
  developer: 'Developer details',
  done: 'Done',
  shortcuts: 'Keyboard: Alt+Left goes back. Escape closes this menu.',
};

const zhCN = {
  skip: '跳到应用',
  back: '返回',
  backTo: '返回到{page}',
  menu: '应用菜单',
  pages: '本应用中的页面',
  opening: '正在打开{app}…',
  openingPercent: '正在打开{app}：{n}%',
  opened: '{app}已打开',
  pageOpened: '已打开{page}',
  backAt: '已回到{page}',
  paused: '{app}已暂停',
  resumed: '{app}已继续',
  closed: '{app}已关闭',
  openAgain: '重新打开',
  slow: '{page}加载时间较长。',
  reloadPage: '重新加载此页',
  retry: '重试',
  closeApp: '关闭应用',
  problemTitle: '出现问题',
  problemDetails: '技术细节',
  appError: '{app}报告了一个错误。您可以继续使用，或重新加载此页。',
  notFound: '这里没有名为“{id}”的应用。',
  netFail: '无法下载此应用。请检查网络连接后重试。',
  badPackage: '此应用包已损坏或不受支持。',
  textSize: '文字大小',
  theme: '颜色',
  themeSystem: '跟随设备',
  themeLight: '浅色',
  themeDark: '深色',
  themeContrast: '高对比度',
  motion: '动画',
  motionSystem: '跟随设备',
  motionReduce: '减少动画',
  permissions: '权限',
  permAsk: '{app}请求：',
  permAllow: '允许所选项',
  permNone: '全部不允许',
  permNoReason: '未说明原因',
  permUnavailable: '此运行器不支持',
  permChange: '之后可以在应用菜单中更改。',
  about: '关于此应用',
  version: '版本 {v}',
  developer: '开发者信息',
  done: '完成',
  shortcuts: '键盘：Alt+左箭头返回。Esc 关闭此菜单。',
};

const TABLES = { en, 'zh-CN': zhCN, zh: zhCN };

export function pickLocale(candidates) {
  for (const c of candidates) {
    if (TABLES[c]) return c;
    const base = String(c).split('-')[0];
    if (base === 'zh') return 'zh-CN';
    if (TABLES[base]) return base;
  }
  return 'en';
}

/** t('pageOpened', { page: 'Detail' }) */
export function strings(locale) {
  const table = TABLES[locale] || en;
  return (key, vars = {}) => (table[key] ?? en[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}
