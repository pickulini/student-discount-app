package config

import (
    "log"
    "os"
    "strconv"
)

type Config struct {
    AppPort         string
    DatabaseURL     string
    RedisURL        string
    JWTSecret       string
    JWTExpiryMin    int
    Argon2Time      uint32
    Argon2Memory    uint32
    Argon2Threads   uint8
    Argon2KeyLen    uint32
    EmailFrom       string
    SMTPHost        string
    SMTPPort        int
    SMTPUser        string
    SMTPPassword    string
    FrontendURL     string
}

func Load() *Config {
    cfg := &Config{
        AppPort:       ":" + getEnv("APP_PORT", "8080"),
        DatabaseURL:   getEnv("DATABASE_URL", ""),
        RedisURL:      getEnv("REDIS_URL", "redis://localhost:6379"),
        JWTSecret:     getEnv("JWT_SECRET", "change-me-in-production"),
        JWTExpiryMin:  getEnvAsInt("JWT_EXPIRY_MIN", 30),
        Argon2Time:    uint32(getEnvAsInt("ARGON2_TIME", 1)),
        Argon2Memory:  uint32(getEnvAsInt("ARGON2_MEMORY", 64*1024)),
        Argon2Threads: uint8(getEnvAsInt("ARGON2_THREADS", 4)),
        Argon2KeyLen:  uint32(getEnvAsInt("ARGON2_KEY_LEN", 32)),
        EmailFrom:     getEnv("EMAIL_FROM", ""),
        SMTPHost:      getEnv("SMTP_HOST", ""),
        SMTPPort:      getEnvAsInt("SMTP_PORT", 587),
        SMTPUser:      getEnv("SMTP_USER", ""),
        SMTPPassword:  getEnv("SMTP_PASSWORD", ""),
        FrontendURL:   getEnv("FRONTEND_URL", "http://localhost:3000"),
    }
    if cfg.DatabaseURL == "" {
        log.Fatal("DATABASE_URL is required")
    }
    return cfg
}

func getEnv(key, defaultVal string) string {
    if v := os.Getenv(key); v != "" {
        return v
    }
    return defaultVal
}

func getEnvAsInt(key string, defaultVal int) int {
    if v := os.Getenv(key); v != "" {
        if i, err := strconv.Atoi(v); err == nil {
            return i
        }
    }
    return defaultVal
}
