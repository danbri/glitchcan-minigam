import sys
from http.server import SimpleHTTPRequestHandler as S, ThreadingHTTPServer as T
class H(S):
    def end_headers(s):
        s.send_header('Access-Control-Allow-Origin','*'); s.send_header('Cache-Control','no-store'); super().end_headers()
T(('127.0.0.1',int(sys.argv[1])),H).serve_forever()
