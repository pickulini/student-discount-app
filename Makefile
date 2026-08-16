.PHONY: migrate-up migrate-down run build test docker-up docker-down

DB_URL=postgres://studentapp:secret@localhost:5432/discount_db?sslmode=disable

migrate-up:
	migrate -path db/migrations -database $(DB_URL) up

migrate-down:
	migrate -path db/migrations -database $(DB_URL) down

run:
	go run ./cmd/api

build:
	go build -o bin/api ./cmd/api

test:
	go test -race -v ./...

docker-up:
	docker-compose up -d

docker-down:
	docker-compose down -v

dev: docker-up migrate-up run
