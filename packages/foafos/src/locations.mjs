// Where a pod's files are, in words. A person should never have to guess where
// their things live, what it takes to reach them, or what could lose them.
// The Files app shows this. Design: docs/foafos-where-files-live-20261105.md.

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);
const hostOf = (iri) => { try { return new URL(iri).host; } catch { return String(iri); } };
const isLocal = (iri) => { try { return LOOPBACK.has(new URL(iri).hostname); } catch { return false; } };

function words(p) {
  if (p.carriage === 'device' && p.device === 'folder') {
    return {
      icon: '📁', kind: 'folder', finder: true,
      where: `In the folder “${p.label}” on this computer. You can open it in Finder or Explorer, though browsers do not show its full path.`,
      needs: 'Your OK, once each time you open Foafos, in Chrome or Edge on this computer.',
      encrypted: 'Not by Foafos. These are ordinary files, protected only if your disk is encrypted.',
      risk: 'If you move or rename the folder, Foafos loses it and you choose it again. Your files stay put.',
    };
  }
  if (p.carriage === 'device') {
    return {
      icon: '💽', kind: 'device', finder: false,
      where: 'In this browser’s private storage on this computer. Finder and Explorer cannot show these files.',
      needs: 'Nothing, as long as you use this browser on this computer.',
      encrypted: 'Not by Foafos. Protected only if your disk is encrypted.',
      risk: 'Clearing this site’s data deletes them, and a browser may remove them if the disk runs low or the site goes unused. Copy anything you want to keep to a folder or a pod.',
    };
  }
  if (p.carriage === 'builtin') {
    return p.kept === 'sealed' ? {
      icon: '🔒', kind: 'browser', finder: false,
      where: 'In this browser, encrypted with your session.',
      needs: 'Your session passphrase, if the session is locked.',
      encrypted: 'Yes, in the browser’s storage, with a key sealed by your passphrase.',
      risk: 'Clearing this site’s data in the browser deletes them. Forgetting the passphrase loses them.',
    } : {
      icon: '⏳', kind: 'browser', finder: false,
      where: 'In this tab’s memory only. Nothing is written to disk.',
      needs: 'Nothing.',
      encrypted: 'No, but nothing is kept once the tab closes.',
      risk: 'Closing or reloading this tab loses them. Protect your session with a passphrase to keep them, or use another location.',
    };
  }
  if (p.carriage === 'xmpp') {
    return {
      icon: '🌐', kind: 'pod', finder: false,
      where: `On a pod at ${p.podJid}, reached through ${hostOf(p.relay?.url)}.`,
      needs: 'That relay and pod running, and your sign-in in System, under Pods.',
      encrypted: `${/^wss:/i.test(String(p.relay?.url)) ? 'On the way to the relay, by TLS' : 'Not on the way to the relay, which is on this computer'}. The relay can read what passes through it. How the pod stores files is up to that pod.`,
      risk: 'As safe as that pod and whoever runs it.',
    };
  }
  const local = isLocal(p.base);
  return {
    icon: local ? '🖥' : '🌐', kind: 'pod', finder: false,
    where: local ? `On a storage server on this computer, at ${hostOf(p.base)}.` : `On the server ${hostOf(p.base)}.`,
    needs: `${local ? 'That server running. For the local one: foafos-stack start lws.' : 'A connection to that server.'}${p.auth === 'bearer' ? ' Its token, set in System, under Pods.' : ''}`,
    encrypted: /^https:/i.test(String(p.base)) ? 'On the way, by HTTPS. How the server stores files is up to the server.'
      : 'Traffic does not leave this computer, so it is not encrypted. How the server stores files depends on the server.',
    risk: local ? 'As safe as that server’s folder on this computer.' : 'As safe as that server and whoever runs it.',
  };
}

const STATUS = {
  online: 'Ready', offline: 'Not connected yet', connecting: 'Connecting', locked: 'Locked', 'needs-login': 'Needs you to sign in', error: 'Cannot reach it', 'needs-ok': 'Needs your OK',
};

/**
 * A pod record from FoafPods.list(), for a person and for a developer. It names
 * addresses but holds no secret: give it only to an app that manages the whole pod.
 */
export function describeLocation(p) {
  return {
    id: p.id, label: p.label, ...words(p), status: p.status, statusText: STATUS[p.status] || p.status, detail: p.detail || '',
    dev: { carriage: p.carriage, base: p.base, device: p.device ?? null, kept: p.kept ?? null, forApps: !!p.forApps },
  };
}
