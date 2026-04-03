import paramiko
try:
    pkey = paramiko.RSAKey.from_private_key_file('/Users/DEERU/.ssh/id_rsa_vps', password='')
    print("KEY UNLOCKED successfully with EMPTY passphrase!")
except Exception as e:
    print("FAIL:", e)
