import http.server
import socketserver
import socket
import webbrowser
import os
import sys

PORT = 8080

def get_lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # Doesn't actually connect, just determines route
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Enable CORS and caching headers
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

def run():
    web_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(web_dir)

    lan_ip = get_lan_ip()
    local_url = f"http://localhost:{PORT}"
    phone_url = f"http://{lan_ip}:{PORT}"

    print("=" * 60)
    print("  [Emma] 3D VRM 영어 회화 & 롤플레잉 앱 서버")
    print("=" * 60)
    print(f" * PC 접속 주소       : {local_url}")
    print(f" * 스마트폰 접속 주소 : {phone_url}")
    print("=" * 60)
    print(" [스마트폰 접속 방법]")
    print(f" 1. 스마트폰을 PC와 같은 Wi-Fi에 연결합니다.")
    print(f" 2. 스마트폰 브라우저(Chrome/Safari)에서 위 스마트폰 주소로 접속합니다.")
    print(f" 3. 브라우저 메뉴에서 '홈 화면에 추가'를 누르면 단독 앱으로 설치됩니다!")
    print("=" * 60)
    print(" [팁] 서버를 종료하려면 Ctrl + C 를 누르세요.")
    print("=" * 60)

    # Open PC browser for instant preview
    try:
        webbrowser.open(local_url)
    except Exception:
        pass

    with socketserver.TCPServer(("0.0.0.0", PORT), CustomHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n서버가 종료되었습니다.")

if __name__ == '__main__':
    run()
