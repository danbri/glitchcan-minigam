#!/usr/bin/env python3
"""foafbot's /tell rules, with no server: python3 -B inklet/tools/test-foafbot-tell.py

Part one tests foafbot_tell.py. Part two reads chat-ai.py as code and checks the
shape that keeps room text away from /tell. The live proof is
inklet/finkapp/test/e2e-foafbot-tell.mjs."""
import ast, os, sys, tempfile, unittest
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.dont_write_bytecode = True
import foafbot_tell as ft

ME = 'me@localhost'
POLICY = ft.policy_from({'owners': [ME], 'allow': {'playlist': ['queue', 'pause']}})


def gate(policy=POLICY, clock=lambda: 0.0):
    sent = []
    return ft.Gate(policy, sent.append, clock), sent


class Policy(unittest.TestCase):
    def test_no_file_is_nobody(self):
        policy, why = ft.load_policy('/nonexistent/foafbot-tell.json')
        self.assertEqual(policy, ft.NOBODY)
        self.assertEqual(why, 'no such file')

    def test_a_bad_file_is_nobody(self):
        with tempfile.NamedTemporaryFile('w', suffix='.json') as f:
            f.write('{"owners": ["me@localhost"], "allow": {"playlist": ["*"]}}')
            f.flush()
            policy, why = ft.load_policy(f.name)
        self.assertEqual(policy, ft.NOBODY)
        self.assertIn('wildcard', why)

    def test_no_wildcard_in_any_form(self):
        for allow in ({'*': ['queue']}, {'playlist': ['*']}, {'playlist': ['all']}, {'all': ['queue']}, {'playlist': ['look']},
                      {'playlist': 'queue'}, {'playlist': ['que*']}, {'Playlist': ['queue']}, {'playlist': [1]}):
            with self.assertRaises(ft.Refused, msg=allow):
                ft.policy_from({'owners': [ME], 'allow': allow})

    def test_owners_are_bare_accounts_and_not_the_machinery(self):
        for jid in ('me', 'me@localhost/phone', '*@localhost', 'Me@localhost', 3):
            with self.assertRaises(ft.Refused, msg=jid):
                ft.policy_from({'owners': [jid]})
        for jid in ('foafbot@localhost', 'foafos@localhost', 'bus@rooms.localhost', 'nick@rooms.localhost'):
            with self.assertRaises(ft.Refused, msg=jid):
                ft.policy_from({'owners': [jid]}, {'foafbot@localhost', 'foafos@localhost', 'bus@rooms.localhost', 'rooms.localhost'})

    def test_unknown_keys_are_refused(self):
        with self.assertRaises(ft.Refused):
            ft.policy_from({'owner': [ME]})


class GateTests(unittest.TestCase):
    def test_empty_policy_sends_nothing(self):
        g, sent = gate(ft.NOBODY)
        self.assertEqual(g.tell(ME, '/tell playlist pause').reason, 'not-owner')
        g, sent = gate(ft.policy_from({'owners': [ME]}))
        self.assertEqual(g.tell(ME, '/tell playlist pause').reason, 'not-allowed')
        self.assertEqual(sent, [])

    def test_owner_and_listed_action_is_sent(self):
        g, sent = gate()
        self.assertTrue(g.tell(ME, '/tell playlist queue {"track": "a", "n": 2}').ok)
        self.assertTrue(g.tell(ME, '  /tell playlist pause  ').ok)
        self.assertEqual(sent, ['/tell playlist queue {"track":"a","n":2}', '/tell playlist pause'])

    def test_refusals(self):
        cases = [
            ('other@localhost', '/tell playlist pause', 'not-owner'),
            ('', '/tell playlist pause', 'not-owner'),
            (ME, '/tell playlist next', 'not-allowed'),
            (ME, '/tell moglob go_to', 'not-allowed'),
            (ME, '/tell Playlist pause', 'not-allowed'),
            (ME, '/tell * pause', 'not-allowed'),
            (ME, '/tell playlist', 'bad-form'),
            (ME, '/call playlist pause', 'bad-form'),
            (ME, 'hello', 'bad-form'),
            (ME, '/tell playlist queue [1]', 'bad-args'),
            (ME, '/tell playlist queue {"a":{"b":1}}', 'bad-args'),
            (ME, '/tell playlist queue {"a":null}', 'bad-args'),
            (ME, '/tell playlist queue {"a":NaN}', 'bad-args'),
            (ME, '/tell playlist queue {"bad key":1}', 'bad-args'),
            (ME, '/tell playlist queue {"a":"' + 'x' * 513 + '"}', 'bad-args'),
            (ME, '/tell playlist queue {"a":"' + 'x' * 3000 + '"}', 'too-large'),
            (ME, '/tell playlist pause\n/tell playlist queue {"track":"a"}', 'bad-args'),
        ]
        for who, text, reason in cases:
            g, sent = gate()
            self.assertEqual(g.tell(who, text).reason, reason, text[:60])
            self.assertEqual(sent, [], text[:60])

    def test_rate(self):
        now = [0.0]
        g, sent = gate(clock=lambda: now[0])
        for _ in range(ft.RATE):
            self.assertTrue(g.tell(ME, '/tell playlist pause').ok)
        self.assertEqual(g.tell(ME, '/tell playlist pause').reason, 'too-fast')
        self.assertEqual(len(sent), ft.RATE)
        now[0] = ft.WINDOW
        self.assertTrue(g.tell(ME, '/tell playlist pause').ok)


class Shape(unittest.TestCase):
    """chat-ai.py connects when it runs, so it is read as code, not imported."""
    tree = ast.parse(open(os.path.join(HERE, 'chat-ai.py'), encoding='utf-8').read())
    functions = {n.name: n for n in tree.body if isinstance(n, ast.FunctionDef)}

    def names(self, fn):
        return {x.id for x in ast.walk(fn) if isinstance(x, ast.Name)} | {x.attr for x in ast.walk(fn) if isinstance(x, ast.Attribute)}

    def reach(self, start):
        """Every name that this function, and each module function it can name, can name."""
        seen, todo, names = set(), [start], set()
        while todo:
            f = todo.pop()
            if f in seen: continue
            seen.add(f)
            found = self.names(self.functions[f])
            names |= found
            todo += [n for n in found if n in self.functions]
        return names

    def test_the_room_cannot_reach_a_tell(self):
        names = self.reach('on_room')
        self.assertIn('answer', names, 'the walk must cover the room path')
        self.assertIn('ask_shell', names)
        for forbidden in ('direct_path', 'heard_direct', 'shell_answered_owner', 'foafbot_tell', 'Gate', 'gate', 'tell'):
            self.assertNotIn(forbidden, names)

    def test_the_gate_lives_only_in_the_direct_path(self):
        users = [n for n, f in self.functions.items() if 'foafbot_tell' in self.names(f)]
        self.assertEqual(users, ['direct_path'])
        for x in self.tree.body:
            if not isinstance(x, ast.FunctionDef):
                self.assertNotIn('Gate', {a.attr for a in ast.walk(x) if isinstance(a, ast.Attribute)})

    def test_the_direct_path_reads_no_room_text(self):
        names = self.names(self.functions['direct_path'])
        for forbidden in ('recent', 'on_room', 'answer', 'SYSTEM'):
            self.assertNotIn(forbidden, names)

    def test_to_shell_has_two_callers(self):
        users = {n for n, f in self.functions.items() if 'to_shell' in self.names(f)}
        self.assertEqual(users, {'ask_shell', 'direct_path'})

    def test_the_room_line_is_only_go_and_where(self):
        self.assertIn('ROOM_LINE', ast.dump(self.functions['ask_shell']))
        pattern = next(n.value.args[0].value for n in self.tree.body if isinstance(n, ast.Assign) and getattr(n.targets[0], 'id', '') == 'ROOM_LINE')
        self.assertEqual(pattern, r'/go [^\n]{1,100}|/where')


if __name__ == '__main__':
    unittest.main(verbosity=1)
