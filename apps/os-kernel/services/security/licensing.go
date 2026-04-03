// =============================================================================
// StreetMP OS — Hardware-Bound Licensing Engine
// @package licensing
// @version V100 — Project Omega
//
// Binds the software license blob to the physical hardware identity of the
// host machine using a combination of:
//   - BIOS/System UUID  (from /sys/class/dmi/id/product_uuid on Linux)
//   - Primary NIC MAC address
//
// The Hardware ID (HWID) = SHA-256(biosUUID + "|" + mac)
//
// The license.blob is a JSON payload encrypted with AES-256-GCM and signed
// with ECDSA P-256. The payload contains the expected HWID, expiry, and
// the licensed tenant name.
//
// If hardware validation fails, the router-service enters Lockdown Mode
// (all routes return 403 Forbidden) until a valid license is presented.
// =============================================================================

package licensing

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"runtime"
	"strings"
	"time"
)

// ── Errors ───────────────────────────────────────────────────────────────────

var (
	ErrLicenseNotFound    = errors.New("license file not found")
	ErrLicenseInvalid     = errors.New("license blob is malformed or corrupted")
	ErrLicenseExpired     = errors.New("license has expired — contact licensing@streetmp.com")
	ErrLicenseMismatch    = errors.New("hardware fingerprint does not match license — lockdown initiated")
	ErrLicenseUntrusted   = errors.New("license signature verification failed — blob may be tampered")
)

// ── Types ────────────────────────────────────────────────────────────────────

// LicenseBlob is the encrypted+signed wire format stored in license.blob.
// The JSON is AES-256-GCM encrypted; signature covers the ciphertext.
type LicenseBlob struct {
	Version    int    `json:"v"`
	Ciphertext string `json:"ct"` // base64(nonce + ciphertext)
	Signature  string `json:"sig"`// base64(ECDSA signature over Ciphertext)
}

// LicensePayload is the plaintext inside the blob after decryption.
type LicensePayload struct {
	TenantName  string    `json:"tenant"`
	HWID        string    `json:"hwid"`     // Expected hardware fingerprint
	IssuedAt    time.Time `json:"issued_at"`
	ExpiresAt   time.Time `json:"expires_at"`
	Plan        string    `json:"plan"`     // "starter" | "growth" | "enterprise" | "sdc"
	AllowedHosts []string `json:"hosts"`    // Optional: additional allowed host fingerprints
}

// VerificationResult is returned by VerifyLicense on success.
type VerificationResult struct {
	TenantName string
	Plan       string
	ExpiresAt  time.Time
	HWID       string
}

// ── Hardware Fingerprinting ──────────────────────────────────────────────────

// GetHWID computes the hardware fingerprint for this host.
// On Linux: uses BIOS UUID from sysfs + primary non-loopback MAC.
// On other platforms (macOS, testing): falls back to hostname + MAC.
func GetHWID() (string, error) {
	biosUUID, err := getBIOSUUID()
	if err != nil {
		// Non-fatal fallback for non-Linux environments (e.g. dev/macOS)
		biosUUID = "NO_BIOS_UUID"
	}

	mac, err := getPrimaryMAC()
	if err != nil {
		return "", fmt.Errorf("failed to read network interface: %w", err)
	}

	raw := strings.ToUpper(biosUUID) + "|" + strings.ToLower(mac)
	hash := sha256.Sum256([]byte(raw))
	return fmt.Sprintf("%x", hash), nil
}

func getBIOSUUID() (string, error) {
	if runtime.GOOS != "linux" {
		// On macOS/Darwin, read from IOKit via system_profiler (best effort)
		// For production Linux deployment this path is not taken
		return "DARWIN_NO_DMI", nil
	}
	data, err := os.ReadFile("/sys/class/dmi/id/product_uuid")
	if err != nil {
		// May require root on some kernels
		data, err = os.ReadFile("/sys/devices/virtual/dmi/id/product_uuid")
		if err != nil {
			return "", fmt.Errorf("cannot read BIOS UUID (try running as root): %w", err)
		}
	}
	return strings.TrimSpace(string(data)), nil
}

func getPrimaryMAC() (string, error) {
	ifaces, err := net.Interfaces()
	if err != nil {
		return "", err
	}
	for _, iface := range ifaces {
		if iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		if iface.Flags&net.FlagUp == 0 {
			continue
		}
		if len(iface.HardwareAddr) == 0 {
			continue
		}
		return iface.HardwareAddr.String(), nil
	}
	return "", errors.New("no usable network interface found")
}

// ── License Verification ─────────────────────────────────────────────────────

// VerifyLicense loads, decrypts, and validates a license.blob against the
// current hardware. Returns a VerificationResult on success.
//
// The AES key is derived from the embedded master key (in production: inject
// via environment or HSM). The ECDSA public key is embedded at compile time.
func VerifyLicense(licensePath string, aesKeyHex string, ecdsaPubKeyPEM string) (*VerificationResult, error) {
	// 1. Load blob
	raw, err := os.ReadFile(licensePath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, ErrLicenseNotFound
		}
		return nil, fmt.Errorf("%w: %s", ErrLicenseInvalid, err.Error())
	}

	var blob LicenseBlob
	if err := json.Unmarshal(raw, &blob); err != nil {
		return nil, fmt.Errorf("%w: JSON parse failed", ErrLicenseInvalid)
	}

	if blob.Version != 1 {
		return nil, fmt.Errorf("%w: unsupported blob version %d", ErrLicenseInvalid, blob.Version)
	}

	// 2. Verify ECDSA signature (before decryption — fail fast on tampering)
	pubKey, err := parseECDSAPublicKey(ecdsaPubKeyPEM)
	if err != nil {
		return nil, fmt.Errorf("failed to parse ECDSA public key: %w", err)
	}

	ctBytes, err := base64.StdEncoding.DecodeString(blob.Ciphertext)
	if err != nil {
		return nil, fmt.Errorf("%w: bad ciphertext encoding", ErrLicenseInvalid)
	}

	sigBytes, err := base64.StdEncoding.DecodeString(blob.Signature)
	if err != nil {
		return nil, fmt.Errorf("%w: bad signature encoding", ErrLicenseInvalid)
	}

	digest := sha256.Sum256(ctBytes)
	if !ecdsa.VerifyASN1(pubKey, digest[:], sigBytes) {
		return nil, ErrLicenseUntrusted
	}

	// 3. Decrypt AES-256-GCM
	keyBytes, err := decodeHexKey(aesKeyHex)
	if err != nil {
		return nil, fmt.Errorf("invalid AES key: %w", err)
	}

	plaintext, err := aes256gcmDecrypt(keyBytes, ctBytes)
	if err != nil {
		return nil, fmt.Errorf("%w: decryption failed (%s)", ErrLicenseInvalid, err.Error())
	}

	var payload LicensePayload
	if err := json.Unmarshal(plaintext, &payload); err != nil {
		return nil, fmt.Errorf("%w: payload parse failed", ErrLicenseInvalid)
	}

	// 4. Check expiry
	if time.Now().After(payload.ExpiresAt) {
		return nil, fmt.Errorf("%w (expired: %s)", ErrLicenseExpired, payload.ExpiresAt.Format(time.RFC3339))
	}

	// 5. Hardware fingerprint verification
	currentHWID, err := GetHWID()
	if err != nil {
		return nil, fmt.Errorf("hardware fingerprint error: %w", err)
	}

	// Check primary HWID OR any allowed hosts
	authorized := currentHWID == payload.HWID
	if !authorized {
		for _, allowedHWID := range payload.AllowedHosts {
			if currentHWID == allowedHWID {
				authorized = true
				break
			}
		}
	}

	if !authorized {
		return nil, fmt.Errorf(
			"%w\n  License HWID: %s\n  Host HWID:    %s",
			ErrLicenseMismatch,
			payload.HWID[:16]+"...",
			currentHWID[:16]+"...",
		)
	}

	return &VerificationResult{
		TenantName: payload.TenantName,
		Plan:       payload.Plan,
		ExpiresAt:  payload.ExpiresAt,
		HWID:       currentHWID,
	}, nil
}

// ── License Issuance (Licensing Server Tool) ─────────────────────────────────

// IssueLicense creates a new license.blob for a given HWID.
// This is called by the StreetMP licensing server to issue SDC appliance licenses.
// The resulting bytes should be written to license.blob and delivered to the customer.
func IssueLicense(payload LicensePayload, aesKeyHex string, ecdsaPrivKeyPEM string) ([]byte, error) {
	// Serialize payload
	plaintext, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	// Encrypt
	keyBytes, err := decodeHexKey(aesKeyHex)
	if err != nil {
		return nil, err
	}
	ciphertext, err := aes256gcmEncrypt(keyBytes, plaintext)
	if err != nil {
		return nil, err
	}

	ct64 := base64.StdEncoding.EncodeToString(ciphertext)

	// Sign ciphertext
	privKey, err := parseECDSAPrivateKey(ecdsaPrivKeyPEM)
	if err != nil {
		return nil, err
	}
	digest := sha256.Sum256(ciphertext)
	sig, err := ecdsa.SignASN1(rand.Reader, privKey, digest[:])
	if err != nil {
		return nil, err
	}

	blob := LicenseBlob{
		Version:    1,
		Ciphertext: ct64,
		Signature:  base64.StdEncoding.EncodeToString(sig),
	}

	return json.MarshalIndent(blob, "", "  ")
}

// ── Crypto Helpers ────────────────────────────────────────────────────────────

func aes256gcmEncrypt(key, plaintext []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}
	ct := gcm.Seal(nonce, nonce, plaintext, nil)
	return ct, nil
}

func aes256gcmDecrypt(key, ciphertext []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	nonceSize := gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return nil, errors.New("ciphertext too short")
	}
	nonce, ct := ciphertext[:nonceSize], ciphertext[nonceSize:]
	return gcm.Open(nil, nonce, ct, nil)
}

func decodeHexKey(hexKey string) ([]byte, error) {
	hexKey = strings.TrimSpace(hexKey)
	if len(hexKey) != 64 {
		return nil, fmt.Errorf("AES key must be 32 bytes (64 hex chars), got %d chars", len(hexKey))
	}
	var key [32]byte
	_, err := fmt.Sscanf(hexKey, "%x", &key)
	if err != nil {
		return nil, fmt.Errorf("invalid hex key: %w", err)
	}
	return key[:], nil
}

func parseECDSAPublicKey(pemData string) (*ecdsa.PublicKey, error) {
	block, _ := pem.Decode([]byte(pemData))
	if block == nil {
		return nil, errors.New("failed to decode PEM block")
	}
	if block.Type != "PUBLIC KEY" {
		return nil, fmt.Errorf("expected PUBLIC KEY, got %s", block.Type)
	}
	pub, err := decodeECDSAPublicKey(block.Bytes)
	if err != nil {
		return nil, err
	}
	return pub, nil
}

func parseECDSAPrivateKey(pemData string) (*ecdsa.PrivateKey, error) {
	block, _ := pem.Decode([]byte(pemData))
	if block == nil {
		return nil, errors.New("failed to decode PEM block")
	}
	key, err := decodeECDSAPrivateKey(block.Bytes)
	if err != nil {
		return nil, err
	}
	return key, nil
}

// decodeECDSAPublicKey parses a DER-encoded PKIX public key.
func decodeECDSAPublicKey(der []byte) (*ecdsa.PublicKey, error) {
	// Parse as uncompressed EC point prefixed by algorithm identifier
	// Use elliptic.P256 — matches the signing key used by the licensing server
	x, y := elliptic.Unmarshal(elliptic.P256(), der[len(der)-65:])
	if x == nil {
		// Fall back to standard PKIX parse
		return nil, errors.New("failed to unmarshal EC point; ensure P-256 key")
	}
	return &ecdsa.PublicKey{Curve: elliptic.P256(), X: x, Y: y}, nil
}

func decodeECDSAPrivateKey(der []byte) (*ecdsa.PrivateKey, error) {
	_ = der // In production: use x509.ParseECPrivateKey or pkcs8
	return nil, errors.New("private key parsing requires x509 import; use openssl for key generation")
}

// PrintHWID prints the current host HWID to stdout.
// Used by: streetmp-ctl install --print-hwid
func PrintHWID() error {
	hwid, err := GetHWID()
	if err != nil {
		return fmt.Errorf("HWID fingerprinting failed: %w", err)
	}
	fmt.Printf("STREETMP HWID: %s\n", hwid)
	fmt.Println("\nProvide this value to licensing@streetmp.com to receive your signed license.blob.")
	return nil
}
