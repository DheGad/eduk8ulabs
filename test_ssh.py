import paramiko
import sys

SSH_HOST = "187.127.131.212"
SSH_USER = "root"
SSH_PASS = "8RsPXt.#t;4dmIH#02@b"

try:
    print("Testing SSH connection to", SSH_HOST)
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(SSH_HOST, username=SSH_USER, password=SSH_PASS, timeout=10)
    print("SUCCESS: Logged in!")
    stdin, stdout, stderr = client.exec_command("ls /opt/streetmp-os")
    print("LS OUTPUT:")
    print(stdout.read().decode())
    client.close()
except Exception as e:
    print("FAILED:", str(e))
