import paramiko
try:
    pkey = paramiko.RSAKey.from_private_key_file('/Users/DEERU/.ssh/id_rsa_vps', password='8RsPXt.#t;4dmIH#02@b')
    print("Passphrase 1 matched!")
except Exception as e:
    print("Passphrase 1 failed:", e)

try:
    pkey = paramiko.RSAKey.from_private_key_file('/Users/DEERU/.ssh/id_rsa_vps', password='StreetMP_GodMode_2026!')
    print("Passphrase 2 matched!")
except Exception as e:
    print("Passphrase 2 failed:", e)

