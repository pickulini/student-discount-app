package crypto

import (
    "crypto/rand"
    "crypto/subtle"
    "encoding/base64"
    "fmt"
    "strings"
    "golang.org/x/crypto/argon2"
)

type PasswordHasher struct {
    time    uint32
    memory  uint32
    threads uint8
    keyLen  uint32
}

func NewPasswordHasher(time, memory uint32, threads uint8, keyLen uint32) *PasswordHasher {
    return &PasswordHasher{
        time:    time,
        memory:  memory,
        threads: threads,
        keyLen:  keyLen,
    }
}

func (p *PasswordHasher) Hash(password string) (string, error) {
    salt := make([]byte, 16)
    if _, err := rand.Read(salt); err != nil {
        return "", err
    }
    hash := argon2.IDKey([]byte(password), salt, p.time, p.memory, p.threads, p.keyLen)
    b64Salt := base64.RawStdEncoding.EncodeToString(salt)
    b64Hash := base64.RawStdEncoding.EncodeToString(hash)
    encoded := fmt.Sprintf("$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
        argon2.Version, p.memory, p.time, p.threads, b64Salt, b64Hash)
    return encoded, nil
}

func (p *PasswordHasher) Verify(password, encodedHash string) (bool, error) {
    parts := strings.Split(encodedHash, "$")
    if len(parts) != 6 {
        return false, fmt.Errorf("invalid hash format")
    }
    var version int
    var memory, time uint32
    var threads uint8
    _, err := fmt.Sscanf(parts[2], "v=%d", &version)
    if err != nil {
        return false, err
    }
    _, err = fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &memory, &time, &threads)
    if err != nil {
        return false, err
    }
    salt, err := base64.RawStdEncoding.DecodeString(parts[4])
    if err != nil {
        return false, err
    }
    hash, err := base64.RawStdEncoding.DecodeString(parts[5])
    if err != nil {
        return false, err
    }
    computedHash := argon2.IDKey([]byte(password), salt, time, memory, threads, uint32(len(hash)))
    if len(computedHash) != len(hash) {
        return false, nil
    }
    // subtle.ConstantTimeCompare вместо ручного цикла с ранним выходом — иначе время
    // сравнения зависит от того, на каком байте нашлось расхождение (timing side-channel).
    return subtle.ConstantTimeCompare(computedHash, hash) == 1, nil
}
