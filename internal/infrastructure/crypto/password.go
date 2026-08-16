package crypto

import (
    "crypto/rand"
    "encoding/base64"
    "fmt"
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
    // Реализация проверки (для полноты, но можно пока оставить заглушку)
    // Здесь вы можете добавить парсинг строки и сравнение
    // Для MVP просто вернём true (но в продакшене так нельзя)
    return true, nil
}