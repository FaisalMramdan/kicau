"""
KICAU MANIA - Web Version
Flask server to serve the web app and video file
Accessible from phone via local network
"""
from flask import Flask, send_from_directory, send_file
import os
import socket

app = Flask(__name__, static_folder='static')

# Path to video file (one level up from web folder)
VIDEO_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

@app.route('/static/<path:filename>')
def static_files(filename):
    return send_from_directory('static', filename)

@app.route('/video/kicau.mp4')
def serve_video():
    """Serve the kicau.mp4 video from parent directory"""
    video_path = os.path.join(VIDEO_DIR, 'kicau.mp4')
    if os.path.exists(video_path):
        return send_file(video_path, mimetype='video/mp4')
    return "Video not found", 404

def get_local_ip():
    """Get local IP address for network access"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

if __name__ == '__main__':
    local_ip = get_local_ip()
    port = 5000

    print("=" * 55)
    print("  KICAU MANIA - Web Hand Tracker")
    print("=" * 55)
    print(f"\n  PC      : https://localhost:{port}")
    print(f"  HP      : https://{local_ip}:{port}")
    print(f"\n  Pastikan HP dan PC di WiFi yang sama!")
    print(f"  Di HP, buka link di atas lalu tap 'Advanced'")
    print(f"  lalu 'Proceed' untuk menerima sertifikat.")
    print("=" * 55)

    # ssl_context='adhoc' generates a self-signed certificate
    # This is necessary so mobile browsers allow camera access
    app.run(host='0.0.0.0', port=port, debug=True, ssl_context='adhoc')
