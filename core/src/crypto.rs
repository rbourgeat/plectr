use aes_gcm::{ aead::{ Aead, KeyInit, OsRng }, Aes256Gcm, Nonce };
use anyhow::{ anyhow, Result };
use base64::{ Engine as _, engine::general_purpose };
use std::env;
use once_cell::sync::Lazy;
use rand::RngCore;

static MASTER_KEY: Lazy<Vec<u8>> = Lazy::new(|| {
  let key_str = env::var("ENCRYPTION_KEY").expect("ENCRYPTION_KEY must be set (32 chars)");
  key_str.as_bytes().to_vec()
});

pub struct EncryptedData {
  pub ciphertext: String,
  pub iv: String,
}

pub fn encrypt(plaintext: &str) -> Result<EncryptedData> {
  let key = &MASTER_KEY;
  if key.len() != 32 {
    return Err(anyhow!("Key must be 32 bytes"));
  }

  let cipher = Aes256Gcm::new_from_slice(key).map_err(|e| anyhow!(e.to_string()))?;

  let mut nonce_bytes = [0u8; 12];
  OsRng.fill_bytes(&mut nonce_bytes);
  let nonce = Nonce::from_slice(&nonce_bytes);

  let ciphertext_bytes = cipher.encrypt(nonce, plaintext.as_bytes()).map_err(|_| anyhow!("Encryption failure"))?;

  Ok(EncryptedData {
    ciphertext: general_purpose::STANDARD.encode(ciphertext_bytes),
    iv: general_purpose::STANDARD.encode(nonce_bytes),
  })
}

pub fn decrypt(ciphertext_b64: &str, iv_b64: &str) -> Result<String> {
  let key = &MASTER_KEY;
  let cipher = Aes256Gcm::new_from_slice(key).map_err(|e| anyhow!(e.to_string()))?;

  let nonce_bytes = general_purpose::STANDARD.decode(iv_b64)?;
  let nonce = Nonce::from_slice(&nonce_bytes);

  let ciphertext = general_purpose::STANDARD.decode(ciphertext_b64)?;

  let plaintext_bytes = cipher.decrypt(nonce, ciphertext.as_ref()).map_err(|_| anyhow!("Decryption failure (Wrong Key or Corrupted Data)"))?;

  Ok(String::from_utf8(plaintext_bytes)?)
}
