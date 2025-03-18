from http.server import HTTPServer, BaseHTTPRequestHandler

class ServerHandle(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/plain')
        self.end_headers()
        self.wfile.write(b'Hello, world!')

def run():
    server_address = ('', 3067)
    httpd = HTTPServer(server_address, ServerHandle)
    print('Tagger running on port 3067')
    httpd.serve_forever()

run()