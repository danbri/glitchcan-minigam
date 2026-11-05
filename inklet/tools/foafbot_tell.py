"""foafbot's own rules for /tell: who may ask, and for which app actions.

chat-ai.py builds one Gate, inside its direct-message path, and the room path has
no reference to it. This file holds no socket and starts nothing, so
test-foafbot-tell.py can run it alone. The shell still makes every check of its
own after this one. Why it is built this way: docs/foafos-foafbot-tell-20261105.md.

The owner's file, <--dir>/foafbot-tell.json by default. With no file, nobody may
ask for anything. It is read once, when the bot starts.

  {"owners": ["me@localhost"],
   "allow": {"playlist": ["queue", "pause"]},
   "usage": "queue takes {\"track\":\"ID\"}. pause takes nothing."}
"""
import collections, json, re, threading, time

NAME = re.compile(r'[a-z][a-z0-9_-]{0,63}')
JID = re.compile(r'[a-z0-9._-]{1,64}@[a-z0-9.-]{1,128}')
ARG_NAME = re.compile(r'[A-Za-z][A-Za-z0-9_-]{0,63}')      # the shell's plainArgs, for the same reasons
TELL = re.compile(r'/tell\s+(\S+)\s+(\S+)(?:\s+(.+))?', re.S)
MAX_ARGS, MAX_ARG = 2048, 512
RATE, WINDOW = 6, 60.0                                     # tells sent, in seconds. The shell allows more
RESERVED = {'all', 'look'}                                 # grant levels in the shell, never action names here

WHY = {
    'not-allowed': 'I may not send that: it is not on my list. Nothing was sent.',
    'bad-form': 'Use /tell APP ACTION {json}. Nothing was sent.',
    'bad-args': 'Arguments must be one flat JSON object of plain values. Nothing was sent.',
    'too-large': 'Those arguments are too large. Nothing was sent.',
    'too-fast': 'Too many actions in a short time. Nothing was sent. Ask again in a minute.',
}

Policy = collections.namedtuple('Policy', 'owners allow usage')
NOBODY = Policy(frozenset(), {}, '')


class Refused(ValueError):
    """The owner's file cannot be used, so the bot acts as if it were not there."""


def policy_from(data, reserved_jids=()):
    """The policy in this parsed file. One bad entry refuses the whole file, because a list that is half read is not
    what the owner wrote."""
    if not isinstance(data, dict) or set(data) - {'owners', 'allow', 'usage'}:
        raise Refused('expected only "owners", "allow" and "usage"')
    owners, allow, usage = data.get('owners', []), data.get('allow', {}), data.get('usage', '')
    if not isinstance(owners, list) or not isinstance(allow, dict) or not isinstance(usage, str):
        raise Refused('"owners" is a list, "allow" is an object of lists, "usage" is text')
    for jid in owners:
        if not isinstance(jid, str) or not JID.fullmatch(jid):
            raise Refused(f'owner {jid!r} is not a bare account such as me@localhost')
        if jid in reserved_jids or jid.split('@')[1] in reserved_jids:
            raise Refused(f'{jid} cannot be an owner: it is the bot, the shell or the room service')
    clean = {}
    for app, actions in allow.items():
        if not NAME.fullmatch(app) or app in RESERVED or not isinstance(actions, list):
            raise Refused(f'app {app!r} must be one exact id with a list of actions. There is no wildcard')
        for action in actions:
            if not isinstance(action, str) or not NAME.fullmatch(action) or action in RESERVED:
                raise Refused(f'action {action!r} in {app} must be one exact name. There is no wildcard')
        clean[app] = frozenset(actions)
    return Policy(frozenset(owners), clean, usage[:1000])


def load_policy(path, reserved_jids=()):
    """(policy, why it is empty or None). No file, or a file that cannot be used, gives nobody and nothing."""
    try:
        with open(path, encoding='utf-8') as f:
            return policy_from(json.load(f), reserved_jids), None
    except FileNotFoundError:
        return NOBODY, 'no such file'
    except (OSError, ValueError) as e:
        return NOBODY, f'refused: {e}'


def plain_args(text):
    """The flat argument object in this text, or None. The same rule as plainArgs in the shell."""
    def no_constant(name):
        raise ValueError(name)
    try:
        args = json.loads(text, parse_constant=no_constant)
    except (ValueError, RecursionError):
        return None
    if not isinstance(args, dict):
        return None
    for k, v in args.items():
        if not ARG_NAME.fullmatch(k) or not isinstance(v, (str, int, float)) or len(str(v)) > MAX_ARG:
            return None
    return args


Outcome = collections.namedtuple('Outcome', 'ok reason app action')


class Gate:
    """The only code that builds a /tell. `send` takes the line for the shell; the line is made here from checked
    parts, so no text from the asker goes to the shell whole."""

    def __init__(self, policy, send, clock=time.monotonic):
        self.policy, self.send, self.clock = policy, send, clock
        self.sent = collections.deque()
        self.lock = threading.Lock()

    def tell(self, sender, text):
        """`sender` is the bare JID the server stamped on a direct message."""
        if sender not in self.policy.owners:
            return Outcome(False, 'not-owner', None, None)
        m = TELL.fullmatch(text.strip())
        if not m:
            return Outcome(False, 'bad-form', None, None)
        app, action, raw = m.groups()
        if action not in self.policy.allow.get(app, ()):
            return Outcome(False, 'not-allowed', app[:64], action[:64])
        if raw and len(raw) > MAX_ARGS:
            return Outcome(False, 'too-large', app, action)
        args = plain_args(raw) if raw else {}
        if args is None:
            return Outcome(False, 'bad-args', app, action)
        with self.lock:
            now = self.clock()
            while self.sent and now - self.sent[0] >= WINDOW:
                self.sent.popleft()
            if len(self.sent) >= RATE:
                return Outcome(False, 'too-fast', app, action)
            self.sent.append(now)
        self.send(f'/tell {app} {action}' + (' ' + json.dumps(args, separators=(',', ':'), ensure_ascii=False) if args else ''))
        return Outcome(True, 'sent', app, action)
