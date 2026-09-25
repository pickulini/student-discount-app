package http

import (
    "net/http"
    "github.com/go-chi/chi/v5"
    chiMiddleware "github.com/go-chi/chi/v5/middleware"
    "your-project/internal/transport/http/handlers"
    "your-project/internal/transport/http/middleware"
    "your-project/internal/usecase"
    "your-project/internal/infrastructure/crypto"
)

func NewRouter(
    authUsecase *usecase.AuthUsecase,
    jwtManager *crypto.JWTManager,
) *chi.Mux {
    r := chi.NewRouter()
    r.Use(chiMiddleware.Logger)
    r.Use(chiMiddleware.Recoverer)
    r.Use(middleware.CORS(""))

    authHandler := handlers.NewAuthHandler(authUsecase)

    r.Post("/api/v1/auth/register", authHandler.Register)
    r.Post("/api/v1/auth/login", authHandler.Login)
    r.Post("/api/v1/auth/refresh", authHandler.Refresh)

    r.Group(func(r chi.Router) {
        r.Use(middleware.Auth(jwtManager))
        r.Get("/api/v1/users/me", func(w http.ResponseWriter, r *http.Request) {
            w.Write([]byte(`{"message":"profile"}`))
        })
    })

    return r
}
