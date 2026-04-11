import json
import base64
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend

class CryptoService:
    def __init__(self):
        # Generate a new 2048-bit RSA key pair on startup
        self.private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
            backend=default_backend()
        )
        self.public_key = self.private_key.public_key()
        
    def get_public_key_pem(self) -> str:
        """Returns the public key in PEM format as a string"""
        pem = self.public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        )
        return pem.decode('utf-8')
        
    def decrypt_payload(self, encrypted_data: str, encrypted_key: str, iv: str) -> dict:
        """
        Decrypts a payload encrypted with hybrid RSA-OAEP + AES-256-CBC.
        Matches the Web Crypto API's RSA-OAEP with SHA-256.
        """
        try:
            # 1. Decrypt AES key using RSA-OAEP (SHA-256) private key
            aes_key_enc_bytes = base64.b64decode(encrypted_key)
            aes_key = self.private_key.decrypt(
                aes_key_enc_bytes,
                padding.OAEP(
                    mgf=padding.MGF1(algorithm=hashes.SHA256()),
                    algorithm=hashes.SHA256(),
                    label=None
                )
            )
            
            # 2. Decrypt data using the AES-256-CBC key
            data_enc_bytes = base64.b64decode(encrypted_data)
            iv_bytes = base64.b64decode(iv)
            
            cipher = Cipher(algorithms.AES(aes_key), modes.CBC(iv_bytes), backend=default_backend())
            decryptor = cipher.decryptor()
            decrypted_padded_data = decryptor.update(data_enc_bytes) + decryptor.finalize()
            
            # 3. Strip PKCS7 padding
            padding_length = decrypted_padded_data[-1]
            if padding_length < 1 or padding_length > 16:
                raise ValueError(f"Invalid PKCS7 padding value: {padding_length}")
            decrypted_data = decrypted_padded_data[:-padding_length]
            
            # 4. Parse JSON
            json_str = decrypted_data.decode('utf-8')
            return json.loads(json_str)
            
        except Exception as e:
            raise ValueError(f"Failed to decrypt payload: {str(e)}")

# Global singleton
crypto_service = CryptoService()
