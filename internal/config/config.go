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
    PaymentWebhookSecret string
    LoginRateLimitPerMin int
}

func Load() *Config {
    cfg := &Config{
        AppPort:       ":" + getEnv("APP_PORT", "8080"),
        DatabaseURL:   getEnv("DATABASE_URL", ""),
        RedisURL:      getEnv("REDIS_URL", "redis://localhost:6379"),
        JWTSecret:     getEnv("JWT_SECRET", "change-me-in-production"),
        JWTExpiryMin:  getEnvAsInt("JWT_EXPIRY_MIN", 30),
        Argon2Time:    uint32(getEnvAsInt("ARGON2_TIME", 2)), // OWASP рекомендует t>=2 при m=64MB
        Argon2Memory:  uint32(getEnvAsInt("ARGON2_MEMORY", 64*1024)),
        Argon2Threads: uint8(getEnvAsInt("ARGON2_THREADS", 4)),
        Argon2KeyLen:  uint32(getEnvAsInt("ARGON2_KEY_LEN", 32)),
        EmailFrom:     getEnv("EMAIL_FROM", ""),
        SMTPHost:      getEnv("SMTP_HOST", ""),
        SMTPPort:      getEnvAsInt("SMTP_PORT", 587),
        SMTPUser:      getEnv("SMTP_USER", ""),
        SMTPPassword:  getEnv("SMTP_PASSWORD", ""),
        FrontendURL:   getEnv("FRONTEND_URL", "http://localhost:3000"),
        PaymentWebhookSecret: getEnv("PAYMENT_WEBHOOK_SECRET", ""),
        LoginRateLimitPerMin: getEnvAsInt("LOGIN_RATE_LIMIT_PER_MIN", 10),
    }
    if cfg.DatabaseURL == "" {
        log.Fatal("DATABASE_URL is required")
    }
    if cfg.JWTSecret == "change-me-in-production" {
        log.Println("WARNING: JWT_SECRET is not set, using an insecure default. Set JWT_SECRET before deploying to production!")
    }
    if cfg.PaymentWebhookSecret == "" {
        // Fallback so the app keeps working out of the box, but this is not safe for production:
        // anyone who can read the (weak, possibly default) JWT secret could also forge payment webhooks.
        log.Println("WARNING: PAYMENT_WEBHOOK_SECRET is not set, deriving it from JWT_SECRET. Set a dedicated PAYMENT_WEBHOOK_SECRET before deploying to production!")
        cfg.PaymentWebhookSecret = "webhook:" + cfg.JWTSecret
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
