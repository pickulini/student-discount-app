package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"your-project/internal/config"
	"your-project/internal/repository/postgres"
	"your-project/internal/util"
)

func main() {
	cfg := config.Load()
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	db, err := postgres.NewDB(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	userRepo := postgres.NewUserRepo(db)

	users, err := userRepo.ListUsersWithoutUsername(ctx)
	if err != nil {
		log.Fatal(err)
	}
	log.Printf("Found %d users without username", len(users))

	for _, u := range users {
		base := util.SlugifyUsername(u.FullName)
		if base == "" {
			base = fmt.Sprintf("user_%d", u.ID)
		}

		candidate := base
		for i := 2; i < 100; i++ {
			exists, err := userRepo.UsernameExists(ctx, candidate)
			if err != nil {
				log.Printf("user %d: check error: %v", u.ID, err)
				break
			}
			if !exists {
				break
			}
			suffix := fmt.Sprintf("_%d", i)
			trimmed := base
			if len(trimmed)+len(suffix) > 30 {
				trimmed = trimmed[:30-len(suffix)]
			}
			candidate = trimmed + suffix
		}

		if err := userRepo.SetUsername(ctx, u.ID, candidate); err != nil {
			log.Printf("user %d: set username %q failed: %v", u.ID, candidate, err)
			continue
		}
		log.Printf("user %d (%s) -> @%s", u.ID, u.FullName, candidate)
	}

	log.Println("Done")
}
